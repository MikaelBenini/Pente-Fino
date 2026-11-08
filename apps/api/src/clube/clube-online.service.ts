// Clube online (Etapa 24): conta para receber (subconta do Asaas), link de assinatura com split
// automático e o webhook que transforma pagamento em adesão. A plataforma nunca segura o dinheiro:
// o Asaas manda a parte da barbearia direto para a carteira dela.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  adesaoDoCliente,
  cifrar,
  configuracaoDoSistema,
  decifrar,
  gravarAviso,
  type Transacao,
} from '@pente-fino/db';
import {
  caminhoAssinarClube,
  dataLocal,
  dividirRepasse,
  formatarMoeda,
  lerConfiguracaoPublica,
  percentualDaBarbearia,
  somarMeses,
  textoInclui,
  vencimentoDepoisDaBaixa,
  type AssinarClubeEntrada,
  type ClubeParaAssinar,
  type DadosRecebimento,
  type DataISO,
  type RecebimentoClube,
  type RecebimentoNaTela,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { data } from '../comum/escopo.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { ErroCobranca, PROVEDOR_COBRANCA, type ProvedorCobranca } from '../cobranca/provedor.js';
import type { PagamentoWebhook } from '../cobranca/cobranca.service.js';

const centavos = (reais: number | null | undefined) => Math.round((reais ?? 0) * 100);
const PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

@Injectable()
export class ClubeOnlineService {
  private readonly log = new Logger('Clube online');

  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
  ) {}

  /** Erro do Asaas vira mensagem para a tela; falha de rede, aviso genérico. */
  private async asaas<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      if (e instanceof ErroCobranca) throw Erros.conflito(e.message);
      this.log.error(`Asaas indisponível: ${(e as Error).message}`);
      throw Erros.conflito('Não deu para falar com o Asaas agora. Tente de novo em instantes.');
    }
  }

  async taxaBp(): Promise<number> {
    return lerConfiguracaoPublica(await configuracaoDoSistema(this.banco.prisma)).clubeOnline
      .taxaBp;
  }

  private chave(cifrada: string) {
    return decifrar(cifrada, this.config.plataforma.chave);
  }

  // ─── Conta para receber ────────────────────────────────────────────────

  /** Situação (consultada no Asaas enquanto não aprova) e saldo. */
  async recebimento(): Promise<RecebimentoNaTela> {
    const taxaBp = await this.taxaBp();
    const r = await this.banco.daConta((tx) => tx.recebimentoOnline.findFirst());
    if (!r) return { situacao: null, nome: null, documento: null, taxaBp, saldo: null };
    const apiKey = this.chave(r.apiKeyCifrada);
    let situacao = r.situacao as RecebimentoNaTela['situacao'];
    if (situacao !== 'aprovada') {
      const nova = await this.provedor.situacaoSubconta(apiKey).catch(() => null);
      if (nova && nova !== situacao) {
        situacao = nova;
        await this.banco.daConta((tx) =>
          tx.recebimentoOnline.update({ where: { id: r.id }, data: { situacao: nova } }),
        );
      }
    }
    const saldo = await this.provedor.saldoSubconta(apiKey).catch(() => null);
    return { situacao, nome: r.nome, documento: r.documento, taxaBp, saldo };
  }

  async criarRecebimento(d: DadosRecebimento): Promise<RecebimentoNaTela> {
    const existe = await this.banco.daConta((tx) => tx.recebimentoOnline.findFirst());
    if (existe) throw Erros.conflito('A conta para receber já foi criada.');
    const s = await this.asaas(() => this.provedor.criarSubconta(d));
    await this.banco.daConta(async (tx) => {
      const r = await tx.recebimentoOnline.create({
        data: {
          asaasContaId: s.id,
          walletId: s.walletId,
          apiKeyCifrada: cifrar(s.apiKey, this.config.plataforma.chave),
          nome: d.nome,
          documento: d.documento,
        },
      });
      // Os dados ficam no Asaas; a auditoria guarda só quem abriu a conta e para quem.
      await auditar(tx, {
        entidade: 'recebimento_online',
        entidadeId: r.id,
        acao: 'criar',
        depois: { nome: d.nome, tipo: d.tipo },
      });
    });
    return this.recebimento();
  }

  async linkDocumentos(): Promise<string | null> {
    const r = await this.banco.daConta((tx) => tx.recebimentoOnline.findFirst());
    if (!r) throw Erros.naoEncontrado('Crie a conta para receber primeiro.');
    return this.asaas(() => this.provedor.linkDocumentos(this.chave(r.apiKeyCifrada)));
  }

  /** Mensalidades pagas pelo link no mês: o que entrou, as taxas e o que vai para a barbearia. */
  async recebimentos(mes: string): Promise<RecebimentoClube[]> {
    const de = new Date(`${mes}-01T00:00:00Z`);
    const ate = new Date(`${somarMeses(`${mes}-01` as DataISO, 1)}T00:00:00Z`);
    const linhas = await this.banco.daConta((tx) =>
      tx.pagamentoClube.findMany({
        where: { origem: 'online', pagoEm: { gte: de, lt: ate } },
        include: { adesao: { include: { cliente: true, itemClube: true } } },
        orderBy: { pagoEm: 'desc' },
      }),
    );
    return linhas.map((p) => ({
      id: p.id,
      cliente: p.adesao.cliente.nome,
      plano: p.adesao.itemClube.nome,
      pagoEm: p.pagoEm.toISOString().slice(0, 10),
      forma: p.forma,
      valor: p.valor,
      taxaAsaas: p.taxaAsaas,
      taxaPlataforma: p.taxaPlataforma,
      repasse: p.repasse ?? p.valor - p.taxaAsaas - p.taxaPlataforma,
      creditoPrevisto: p.creditoPrevisto?.toISOString().slice(0, 10) ?? null,
    }));
  }

  // ─── Link de assinatura (público) ──────────────────────────────────────

  /** Unidade pelo slug do link, sem depender do agendamento público. */
  private async unidade(slug: string) {
    const u = await this.banco.semConta({ slugClube: slug }, (tx) =>
      tx.unidade.findUnique({ where: { slug } }),
    );
    if (!u || !u.ativa) throw Erros.naoEncontrado('Este link do clube não existe.');
    return u;
  }

  /** Link do plano (ou da lista) e a mensagem pronta para o WhatsApp. */
  linkDoPlano(slug: string, planoId?: string): string {
    return `${this.config.appUrl}${caminhoAssinarClube(slug, planoId)}`;
  }

  async clubeParaAssinar(slug: string): Promise<ClubeParaAssinar> {
    const u = await this.unidade(slug);
    return this.banco.naConta(u.contaId, async (tx) => {
      const recebe = await tx.recebimentoOnline.findFirst();
      if (!recebe) throw Erros.naoEncontrado('Esta barbearia ainda não recebe o clube online.');
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: u.contaId } });
      const planos = await tx.itemClube.findMany({
        where: { unidadeId: u.id, ativo: true },
        include: { servicos: { include: { servico: true } } },
        orderBy: { valor: 'asc' },
      });
      return {
        barbearia: conta.nome,
        unidade: u.nome,
        planos: planos.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          valor: p.valor,
          inclui: p.servicos.map((s) => textoInclui(s.servico.nome, s.quantidade)),
        })),
      };
    });
  }

  /**
   * Cliente assina pelo link: cliente (pelo WhatsApp) na barbearia, cliente e assinatura no Asaas
   * com o split para a carteira da barbearia. Devolve a página de pagamento do Asaas.
   */
  async assinar(slug: string, d: AssinarClubeEntrada): Promise<{ link: string }> {
    const u = await this.unidade(slug);
    const taxaBp = await this.taxaBp();
    const preparo = await this.banco.naConta(u.contaId, async (tx) => {
      const recebe = await tx.recebimentoOnline.findFirst();
      if (!recebe) throw Erros.conflito('Esta barbearia ainda não recebe o clube online.');
      const plano = await tx.itemClube.findFirst({
        where: { id: d.itemClubeId, unidadeId: u.id, ativo: true },
      });
      if (!plano) throw Erros.naoEncontrado('Este plano não está disponível.');
      const cliente =
        (await tx.cliente.findFirst({ where: { telefone: d.telefone } })) ??
        (await tx.cliente.create({
          data: {
            nome: d.nome,
            telefone: d.telefone,
            unidadeOrigemId: u.id,
            consentimentoMsg: true,
          },
        }));
      if (await adesaoDoCliente(tx, cliente.id))
        throw Erros.conflito(
          'Você já tem um plano ativo nesta barbearia. Para trocar, fale com a recepção.',
        );
      // Assinatura iniciada e ainda não paga: devolve a mesma página de pagamento.
      const pendente = await tx.assinaturaClubeOnline.findFirst({
        where: { clienteId: cliente.id, itemClubeId: plano.id, status: 'aguardando' },
      });
      return { recebe, plano, cliente, pendente };
    });
    if (preparo.pendente?.link) return { link: preparo.pendente.link };

    const { recebe, plano, cliente } = preparo;
    const referencia = `clube:${u.contaId}:${cliente.id}`;
    const clienteAsaas = await this.asaas(() =>
      this.provedor.criarCliente({
        nome: d.nome,
        documento: d.cpf,
        email: d.email ?? '',
        telefone: d.telefone,
        referencia,
      }),
    );
    const hoje = dataLocal(new Date()) as DataISO;
    const assinatura = await this.asaas(() =>
      this.provedor.criarAssinatura({
        cliente: clienteAsaas.id,
        valor: plano.valor,
        ciclo: 'mensal',
        vencimento: hoje,
        descricao: `${plano.nome} · ${u.nome}`,
        referencia,
        split: { walletId: recebe.walletId, percentual: percentualDaBarbearia(taxaBp) },
      }),
    );
    const cobrancas = await this.asaas(() => this.provedor.cobrancasDaAssinatura(assinatura.id));
    const link = cobrancas.find((c) => c.link)?.link ?? null;
    if (!link) throw Erros.conflito('O Asaas não devolveu a página de pagamento. Tente de novo.');
    await this.banco.naConta(u.contaId, (tx) =>
      tx.assinaturaClubeOnline.create({
        data: {
          itemClubeId: plano.id,
          clienteId: cliente.id,
          asaasClienteId: clienteAsaas.id,
          asaasAssinaturaId: assinatura.id,
          link,
          taxaBp,
        },
      }),
    );
    return { link };
  }

  // ─── Webhook ───────────────────────────────────────────────────────────

  /** A assinatura é do clube? (O webhook da cobrança do sistema cuida do resto.) */
  async contaDaAssinatura(asaasAssinaturaId: string): Promise<string | null> {
    const a = await this.banco.semConta({ assinaturaClube: asaasAssinaturaId }, (tx) =>
      tx.assinaturaClubeOnline.findUnique({
        where: { asaasAssinaturaId },
        select: { contaId: true },
      }),
    );
    return a?.contaId ?? null;
  }

  /**
   * Mensalidade paga: cria a adesão (primeira) ou anda o vencimento um mês, e registra o
   * pagamento com as taxas e o repasse. Repetido (mesma cobrança) não conta duas vezes.
   */
  async webhook(contaId: string, evento: string, p: PagamentoWebhook): Promise<string> {
    if (!PAGO.has(evento) || !p.subscription) return 'ignorado';
    return this.banco.naConta(contaId, async (tx) => {
      const a = await tx.assinaturaClubeOnline.findUnique({
        where: { asaasAssinaturaId: p.subscription! },
        include: { itemClube: true },
      });
      if (!a || a.status === 'cancelada') return 'ignorado';
      if (await tx.pagamentoClube.findFirst({ where: { idExterno: p.id } })) return 'repetido';
      const hoje = dataLocal(new Date()) as DataISO;
      const primeira = !a.adesaoId;
      const adesaoId = await this.renovarAdesao(tx, a, hoje);
      const valor = centavos(p.value);
      const liquido = p.netValue != null ? centavos(p.netValue) : valor;
      // O Asaas informa quanto foi para a carteira da barbearia; sem isso, a mesma conta dele.
      const doAsaas = p.split?.find((x) => x.totalValue != null)?.totalValue;
      const calculado = dividirRepasse(liquido, a.taxaBp);
      const barbearia = doAsaas != null ? centavos(doAsaas) : calculado.barbearia;
      const plataforma = liquido - barbearia;
      await tx.pagamentoClube.create({
        data: {
          adesaoId,
          valor,
          forma: p.billingType === 'CREDIT_CARD' ? 'credito' : 'pix',
          pagoEm: data(hoje),
          referenteA: data(hoje),
          origem: 'online',
          idExterno: p.id,
          taxaAsaas: valor - liquido,
          taxaPlataforma: plataforma,
          repasse: barbearia,
          creditoPrevisto: p.estimatedCreditDate ? data(p.estimatedCreditDate as DataISO) : null,
        },
      });
      await auditar(tx, {
        entidade: 'adesao_clube',
        entidadeId: adesaoId,
        acao: 'mensalidade_online',
        depois: { valor, repasse: barbearia, cobranca: p.id },
      });
      // Assinou pelo link: a barbearia fica sabendo na central de avisos.
      if (primeira) {
        const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: a.clienteId } });
        await gravarAviso(tx, contaId, a.itemClube.unidadeId, {
          tipo: 'clube_online',
          titulo: 'Novo assinante pelo link',
          texto: `${cliente.nome} assinou o ${a.itemClube.nome} e pagou ${formatarMoeda(valor)}.`,
          link: '/clube',
          chave: `clube_online:${p.id}`,
        });
      }
      return 'aplicado';
    });
  }

  private async renovarAdesao(
    tx: Transacao,
    a: { id: string; clienteId: string; itemClubeId: string; adesaoId: string | null },
    hoje: DataISO,
  ): Promise<string> {
    const atual = a.adesaoId
      ? await tx.adesaoClube.findUnique({ where: { id: a.adesaoId } })
      : null;
    if (atual && atual.status !== 'cancelada') {
      const venc = atual.vencimento.toISOString().slice(0, 10) as DataISO;
      await tx.adesaoClube.update({
        where: { id: atual.id },
        data: {
          vencimento: data(vencimentoDepoisDaBaixa(venc, hoje)),
          status: 'ativa',
          avisoVencimentoEm: null,
        },
      });
      return atual.id;
    }
    // Primeira mensalidade: o plano começa hoje (um ativo por cliente; o anterior, se houver, sai).
    const outra = await adesaoDoCliente(tx, a.clienteId);
    if (outra && outra.id !== a.adesaoId)
      await tx.adesaoClube.update({
        where: { id: outra.id },
        data: {
          status: 'cancelada',
          canceladaEm: new Date(),
          motivoCancelamento: 'Assinou outro plano pelo link',
        },
      });
    const nova = await tx.adesaoClube.create({
      data: {
        clienteId: a.clienteId,
        itemClubeId: a.itemClubeId,
        inicio: data(hoje),
        vencimento: data(somarMeses(hoje, 1)),
      },
    });
    await tx.assinaturaClubeOnline.update({
      where: { id: a.id },
      data: { status: 'ativa', adesaoId: nova.id },
    });
    return nova.id;
  }

  /** Cancelou a adesão no balcão: cancela também a cobrança recorrente no Asaas. */
  async cancelarDaAdesao(tx: Transacao, adesaoId: string): Promise<string | null> {
    const a = await tx.assinaturaClubeOnline.findUnique({ where: { adesaoId } });
    if (!a || a.status === 'cancelada') return null;
    await tx.assinaturaClubeOnline.update({ where: { id: a.id }, data: { status: 'cancelada' } });
    return a.asaasAssinaturaId;
  }

  async cancelarNoAsaas(asaasAssinaturaId: string): Promise<void> {
    await this.provedor
      .cancelarAssinatura(asaasAssinaturaId)
      .catch((e: Error) => this.log.error(`Cancelar ${asaasAssinaturaId} no Asaas: ${e.message}`));
  }
}

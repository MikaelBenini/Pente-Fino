import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  formatarData,
  formatarMoeda,
  dataLocal,
  EVENTOS_RECUSA,
  faturaDaCobranca,
  LIMITES_PLANO,
  NOME_PLANO,
  valorDaCobranca,
  type AssinarEntrada,
  type CobrancaExterna,
  conferirTrocaDePlano,
  type PlanoConta,
  type PreviaTrocaPlano,
  type UsoDaConta,
} from '@pente-fino/shared';
import { AssinaturaGuard } from '../assinatura/assinatura.guard.js';
import { PlanoGuard } from '../assinatura/plano.guard.js';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import {
  cobrancaDoAsaas,
  ErroCobranca,
  PROVEDOR_COBRANCA,
  type ProvedorCobranca,
} from './provedor.js';

/** Mesmo dia, n meses depois (vencimento do Asaas é dia do mês; dia 31 cai no último dia). */
function somarMeses(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo), 12)).toISOString().slice(0, 10);
}
const menosUmDia = (data: string) =>
  new Date(Date.parse(`${data}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const dataBanco = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Pagamento como chega no webhook do Asaas (só o que usamos). */
export interface PagamentoWebhook {
  id: string;
  customer: string;
  subscription?: string | null;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string | null;
  billingType?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  clientPaymentDate?: string | null;
  /** Valor depois da taxa do Asaas (o split usa este). */
  netValue?: number | null;
  /** Quando o Asaas prevê o crédito na conta. */
  estimatedCreditDate?: string | null;
}

/**
 * Assinatura do Pente Fino pela barbearia: assina no Asaas, traz as cobranças para a tabela
 * de faturas (pelo webhook ou pelo "conferir") e libera a conta assim que o dinheiro entra.
 */
interface PagamentoParaAvisar {
  conta: string;
  donos: { nome: string; email: string }[];
  valor: string;
  periodo: string;
}

@Injectable()
export class CobrancaService {
  private readonly log = new Logger('Cobrança');

  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
    @Inject(AssinaturaGuard) private readonly trava: AssinaturaGuard,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(PrecosService) private readonly precos: PrecosService,
    @Inject(PlanoGuard) private readonly planos: PlanoGuard,
  ) {}

  private async externo<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ErroCobranca) throw Erros.conflito(e.message);
      this.log.error(`Asaas indisponível: ${(e as Error).message}`);
      throw Erros.conflito(
        'Não deu para falar com o sistema de cobrança agora. Tente de novo em instantes.',
      );
    }
  }

  /** Dono assina: cria cliente e assinatura no Asaas; devolve o link da primeira cobrança. */
  async assinar(d: AssinarEntrada): Promise<{ linkPagamento: string | null }> {
    const quem = Contexto.usuario();
    const { conta, usuario, unidades, profissionais } = await this.banco.daConta(async (tx) => ({
      conta: await tx.conta.findFirstOrThrow(),
      usuario: await tx.usuario.findUniqueOrThrow({ where: { id: quem.id } }),
      unidades: await tx.unidade.count({ where: { ativa: true } }),
      profissionais: await tx.profissional.count({ where: { ativo: true } }),
    }));
    if (conta.asaasAssinaturaId)
      throw Erros.conflito(
        'A conta já tem assinatura. Para trocar de plano, fale com o suporte do Pente Fino.',
      );
    const limite = LIMITES_PLANO[d.plano];
    if (unidades > limite.unidades || profissionais > limite.profissionais)
      throw Erros.requisicaoInvalida(
        'limite_plano',
        `O plano ${NOME_PLANO[d.plano]} vai até ${limite.unidades} unidade(s) e ${limite.profissionais} profissionais; hoje a conta tem ${unidades} e ${profissionais}. Escolha um plano maior.`,
      );

    const clienteId =
      conta.asaasClienteId ??
      (
        await this.externo(() =>
          this.provedor.criarCliente({
            nome: conta.nome,
            documento: d.documento,
            email: usuario.email,
            telefone: usuario.telefone,
            referencia: conta.id,
          }),
        )
      ).id;
    await this.banco.daConta((tx) =>
      tx.conta.update({
        where: { id: conta.id },
        data: { asaasClienteId: clienteId, documento: d.documento },
      }),
    );
    const tabelaHoje = await this.precos.vigente(dataLocal(new Date()));
    const assinatura = await this.externo(() =>
      this.provedor.criarAssinatura({
        cliente: clienteId,
        valor: valorDaCobranca(d.plano, d.ciclo, unidades, tabelaHoje, conta.descontoBp),
        ciclo: d.ciclo,
        vencimento: dataLocal(new Date()),
        descricao: `Pente Fino ${NOME_PLANO[d.plano]} (${d.ciclo})`,
        referencia: conta.id,
      }),
    );
    await this.banco.daConta(async (tx) => {
      await tx.conta.update({
        where: { id: conta.id },
        data: {
          asaasAssinaturaId: assinatura.id,
          plano: d.plano,
          ciclo: d.ciclo,
          // Assinar é contrato: vale a tabela de hoje.
          precosDesde: this.precos.hoje(),
        },
      });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: 'assinar',
        antes: { plano: conta.plano, ciclo: conta.ciclo, status: conta.status },
        depois: { plano: d.plano, ciclo: d.ciclo, assinatura: assinatura.id },
      });
    });
    await this.conferir();
    const pendente = await this.banco.daConta((tx) =>
      tx.faturaAssinatura.findFirst({
        where: { status: 'aberta', linkPagamento: { not: null } },
        orderBy: { vencimento: 'asc' },
      }),
    );
    return { linkPagamento: pendente?.linkPagamento ?? null };
  }

  /** Uso da conta e prévia da troca para o plano escolhido. */
  async previaTroca(para: PlanoConta): Promise<PreviaTrocaPlano> {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findFirstOrThrow();
      const hoje = dataLocal(new Date());
      const uso: UsoDaConta = {
        unidades: await tx.unidade.count({ where: { ativa: true } }),
        profissionais: await tx.profissional.count({ where: { ativo: true } }),
        whatsappConectado: (await tx.botConexao.count({ where: { status: 'conectado' } })) > 0,
        adesoesAtivas: await tx.adesaoClube.count({ where: { status: 'ativa' } }),
        esperaAguardando: await tx.listaEspera.count({
          where: { status: 'aguardando', dia: { gte: new Date(`${hoje}T00:00:00Z`) } },
        }),
      };
      return conferirTrocaDePlano({
        de: conta.plano,
        para,
        ciclo: conta.ciclo ?? 'mensal',
        uso,
        tabelaAtual: await this.precos.vigente(conta.precosDesde),
        tabelaNova: await this.precos.vigente(dataLocal(new Date())),
        descontoBp: conta.descontoBp,
      });
    });
  }

  /**
   * O dono troca de plano: subir vale na hora; descer só se a conta cabe no plano novo. Com
   * assinatura no Asaas, o valor novo vale também para as cobranças em aberto.
   */
  async trocarPlano(para: PlanoConta): Promise<PreviaTrocaPlano> {
    const previa = await this.previaTroca(para);
    if (previa.de === para) throw Erros.conflito(`A conta já está no plano ${NOME_PLANO[para]}.`);
    if (previa.bloqueios.length)
      throw Erros.requisicaoInvalida('limite_plano', previa.bloqueios.join(' '));
    const conta = await this.banco.daConta((tx) => tx.conta.findFirstOrThrow());
    const ciclo = conta.ciclo ?? 'mensal';
    if (conta.asaasAssinaturaId) {
      const unidades = await this.banco.daConta((tx) =>
        tx.unidade.count({ where: { ativa: true } }),
      );
      const tabelaHoje = await this.precos.vigente(dataLocal(new Date()));
      await this.externo(() =>
        this.provedor.atualizarAssinatura(conta.asaasAssinaturaId!, {
          valor: valorDaCobranca(para, ciclo, unidades, tabelaHoje, conta.descontoBp),
          descricao: `Pente Fino ${NOME_PLANO[para]} (${ciclo})`,
        }),
      );
    }
    await this.banco.daConta(async (tx) => {
      await tx.conta.update({
        where: { id: conta.id },
        // Trocar de plano é contrato novo: vale a tabela de hoje.
        data: { plano: para, precosDesde: this.precos.hoje() },
      });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: 'trocar_plano',
        antes: { plano: previa.de },
        depois: { plano: para, perdas: previa.perdas },
      });
    });
    this.planos.esquecer(conta.id);
    return previa;
  }

  /** "Já paguei, conferir": busca as cobranças no Asaas e atualiza as faturas. */
  async conferir(): Promise<void> {
    const conta = await this.banco.daConta((tx) => tx.conta.findFirstOrThrow());
    if (!conta.asaasAssinaturaId) return;
    const cobrancas = await this.externo(() =>
      this.provedor.cobrancasDaAssinatura(conta.asaasAssinaturaId!),
    );
    const pagos: PagamentoParaAvisar[] = [];
    await this.banco.daConta(async (tx) => {
      for (const c of cobrancas) {
        const p = await this.aplicar(tx, c);
        if (p) pagos.push(p);
      }
    });
    for (const p of pagos) await this.avisarPagamento(p);
    this.trava.esquecer(conta.id);
  }

  /**
   * Webhook do Asaas (já autenticado pelo token). Acha a conta pelo cliente; ignora o que não
   * é da assinatura dela. Nunca lança por dado desconhecido: o Asaas pausa a fila se errar.
   */
  async webhook(evento: string, p: PagamentoWebhook): Promise<'aplicado' | 'ignorado'> {
    const conta = await this.banco.semConta({ clienteAsaas: p.customer }, (tx) =>
      tx.conta.findFirst({ select: { id: true, asaasAssinaturaId: true } }),
    );
    if (!conta || !p.subscription || p.subscription !== conta.asaasAssinaturaId) return 'ignorado';
    const pago = await this.banco.naConta(conta.id, (tx) =>
      this.aplicar(tx, cobrancaDoAsaas(p), EVENTOS_RECUSA[evento]),
    );
    if (pago) await this.avisarPagamento(pago);
    this.trava.esquecer(conta.id);
    return 'aplicado';
  }

  /** Cria ou atualiza a fatura da cobrança; paga tira a conta do teste. */
  /** E-mail "pagamento recebido" aos donos (falha de fila não desfaz o pagamento). */
  private async avisarPagamento(p: PagamentoParaAvisar): Promise<void> {
    for (const d of p.donos)
      await this.emails
        .pagamentoRecebido({
          para: d.email,
          nome: d.nome.split(' ')[0] ?? d.nome,
          conta: p.conta,
          valor: p.valor,
          periodo: p.periodo,
        })
        .catch((e: Error) => this.log.error(`Aviso de pagamento: ${e.message}`));
  }

  /** Aplica a cobrança do Asaas; devolve o aviso de pagamento quando ela acabou de ser paga. */
  private async aplicar(
    tx: Transacao,
    c: CobrancaExterna,
    recusa?: string,
  ): Promise<PagamentoParaAvisar | null> {
    const conta = await tx.conta.findFirstOrThrow();
    const f = faturaDaCobranca(c);
    const atual = await tx.faturaAssinatura.findUnique({
      where: { origem_idExterno: { origem: 'asaas', idExterno: c.id } },
    });
    // Paga não volta atrás por aviso atrasado ou repetido ("criada", "recusada" depois do
    // "paga"); só estorno ou exclusão (cancelada) tira a fatura de paga.
    if (atual?.status === 'paga' && f.status !== 'cancelada') return null;
    // Recusa vale até pagar: a cobrança segue "pendente" no Asaas depois do cartão recusado.
    const status = recusa
      ? 'recusada'
      : f.status === 'aberta' && atual?.status === 'recusada'
        ? 'recusada'
        : f.status;
    const motivoRecusa =
      status === 'recusada' ? (recusa ?? atual?.motivoRecusa ?? 'Pagamento recusado.') : null;
    const dados = {
      valor: c.valor,
      vencimento: dataBanco(c.vencimento),
      status,
      forma: status === 'paga' ? f.forma : null,
      pagaEm: status === 'paga' ? f.pagaEm : null,
      motivoRecusa,
      linkPagamento: c.link,
    };
    const fim = atual
      ? atual.periodoFim.toISOString().slice(0, 10)
      : menosUmDia(somarMeses(c.vencimento, conta.ciclo === 'anual' ? 12 : 1));
    if (atual) await tx.faturaAssinatura.update({ where: { id: atual.id }, data: dados });
    else {
      await tx.faturaAssinatura.create({
        data: {
          ...dados,
          plano: conta.plano,
          ciclo: conta.ciclo,
          origem: 'asaas',
          idExterno: c.id,
          periodoInicio: dataBanco(c.vencimento),
          periodoFim: dataBanco(fim),
        },
      });
    }
    if (status === 'paga' && conta.status === 'teste')
      await tx.conta.update({ where: { id: conta.id }, data: { status: 'ativa', testeAte: null } });
    if (status !== 'paga') return null;
    const donos = await tx.usuario.findMany({
      where: { ativo: true, papeis: { some: { papel: 'dono' } } },
      select: { nome: true, email: true },
    });
    const inicio = atual ? atual.periodoInicio.toISOString().slice(0, 10) : c.vencimento;
    return {
      conta: conta.nome,
      donos,
      valor: formatarMoeda(c.valor),
      periodo: `${formatarData(`${inicio}T12:00:00Z`)} a ${formatarData(`${fim}T12:00:00Z`)}`,
    };
  }
}

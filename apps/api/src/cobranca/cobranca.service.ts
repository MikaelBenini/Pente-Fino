import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
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
}

/**
 * Assinatura do Pente Fino pela barbearia: assina no Asaas, traz as cobranças para a tabela
 * de faturas (pelo webhook ou pelo "conferir") e libera a conta assim que o dinheiro entra.
 */
@Injectable()
export class CobrancaService {
  private readonly log = new Logger('Cobrança');

  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
    @Inject(AssinaturaGuard) private readonly trava: AssinaturaGuard,
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
    const assinatura = await this.externo(() =>
      this.provedor.criarAssinatura({
        cliente: clienteId,
        valor: valorDaCobranca(d.plano, d.ciclo, unidades),
        ciclo: d.ciclo,
        vencimento: dataLocal(new Date()),
        descricao: `Pente Fino ${NOME_PLANO[d.plano]} (${d.ciclo})`,
        referencia: conta.id,
      }),
    );
    await this.banco.daConta(async (tx) => {
      await tx.conta.update({
        where: { id: conta.id },
        data: { asaasAssinaturaId: assinatura.id, plano: d.plano, ciclo: d.ciclo },
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
      return conferirTrocaDePlano({ de: conta.plano, para, ciclo: conta.ciclo ?? 'mensal', uso });
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
      await this.externo(() =>
        this.provedor.atualizarAssinatura(conta.asaasAssinaturaId!, {
          valor: valorDaCobranca(para, ciclo, unidades),
          descricao: `Pente Fino ${NOME_PLANO[para]} (${ciclo})`,
        }),
      );
    }
    await this.banco.daConta(async (tx) => {
      await tx.conta.update({ where: { id: conta.id }, data: { plano: para } });
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
    await this.banco.daConta(async (tx) => {
      for (const c of cobrancas) await this.aplicar(tx, c);
    });
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
    await this.banco.naConta(conta.id, (tx) =>
      this.aplicar(tx, cobrancaDoAsaas(p), EVENTOS_RECUSA[evento]),
    );
    this.trava.esquecer(conta.id);
    return 'aplicado';
  }

  /** Cria ou atualiza a fatura da cobrança; paga tira a conta do teste. */
  private async aplicar(tx: Transacao, c: CobrancaExterna, recusa?: string): Promise<void> {
    const conta = await tx.conta.findFirstOrThrow();
    const f = faturaDaCobranca(c);
    const atual = await tx.faturaAssinatura.findUnique({
      where: { origem_idExterno: { origem: 'asaas', idExterno: c.id } },
    });
    // Paga não volta atrás por aviso atrasado ou repetido ("criada", "recusada" depois do
    // "paga"); só estorno ou exclusão (cancelada) tira a fatura de paga.
    if (atual?.status === 'paga' && f.status !== 'cancelada') return;
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
    if (atual) await tx.faturaAssinatura.update({ where: { id: atual.id }, data: dados });
    else {
      const fim = menosUmDia(somarMeses(c.vencimento, conta.ciclo === 'anual' ? 12 : 1));
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
  }
}

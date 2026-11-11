import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  fichaDaContaPlataforma,
  aplicarSituacaoDaConta,
  marcarContaInterna,
  mudarPlanoDaConta,
  mudarTesteDaConta,
  situacaoDaContaPlataforma,
  registrarPagamentoManual,
} from '@pente-fino/db';
import {
  dataLocal,
  fimDoPeriodo,
  formatarData,
  formatarMoeda,
  NOME_PLANO,
  origemCadastroSchema,
  problemaFimDoTeste,
  resumoDaOrigem,
  transicaoDaConta,
  valorDaCobranca,
  type AcaoContaEntrada,
  type ContaInternaEntrada,
  type FichaContaPlataforma,
  type MudarPlanoContaEntrada,
  type MudarTesteContaEntrada,
  type RegistrarPagamentoEntrada,
} from '@pente-fino/shared';
import { AssinaturaGuard } from '../assinatura/assinatura.guard.js';
import { PlanoGuard } from '../assinatura/plano.guard.js';
import { ErroCobranca, PROVEDOR_COBRANCA, type ProvedorCobranca } from '../cobranca/provedor.js';
import { Erros } from '../comum/erros.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { BancoPlataforma } from './banco-plataforma.js';

/** Erros levantados pelas funções do banco → resposta HTTP. */
function traduzir(e: unknown): never {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('conta_inexistente')) throw Erros.naoEncontrado('Conta não encontrada.');
  if (msg.includes('conta_parada'))
    throw Erros.conflito(
      'A conta está bloqueada ou cancelada: desbloqueie ou reative com o próximo passo.',
    );
  throw e;
}

/**
 * Ações da administração numa conta: cada uma passa por uma função do banco, fica na auditoria
 * da plataforma com o motivo e vale na hora para a barbearia (as travas esquecem o que guardaram).
 */
@Injectable()
export class AdminContasService {
  private readonly logger = new Logger('Administração');

  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AssinaturaGuard) private readonly trava: AssinaturaGuard,
    @Inject(PlanoGuard) private readonly planos: PlanoGuard,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(PrecosService) private readonly precos: PrecosService,
  ) {}

  private valeNaHora(contaId: string) {
    this.trava.esquecer(contaId);
    this.planos.esquecer(contaId);
  }

  async ficha(contaId: string): Promise<FichaContaPlataforma> {
    const f = await fichaDaContaPlataforma(this.banco.prisma, contaId);
    if (!f) throw Erros.naoEncontrado('Conta não encontrada.');
    const situacao = await situacaoDaContaPlataforma(this.banco.prisma, contaId);
    const eventos = await this.banco.prisma.auditoriaPlataforma.findMany({
      where: { contaAfetadaId: contaId },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    return {
      ...(f as unknown as Omit<
        FichaContaPlataforma,
        'historico' | 'statusAnterior' | 'cortesiaAte' | 'cobrarAPartirDe' | 'interna' | 'origem'
      >),
      statusAnterior: situacao?.statusAnterior ?? null,
      cortesiaAte: situacao?.cortesiaAte ?? null,
      cobrarAPartirDe: situacao?.cobrarAPartirDe ?? null,
      interna: situacao?.interna ?? false,
      origem: resumoDaOrigem(origemCadastroSchema.safeParse(situacao?.origem).data),
      historico: eventos.map((e) => ({
        acao: e.acao,
        quem: e.usuario?.nome ?? null,
        motivo: e.motivo,
        antes: e.antes,
        depois: e.depois,
        criadoEm: e.criadoEm.toISOString(),
      })),
    };
  }

  async mudarPlano(
    contaId: string,
    d: MudarPlanoContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const antes = await mudarPlanoDaConta(this.banco.prisma, contaId, d.plano, d.ciclo).catch(
      traduzir,
    );
    // Cobrança automática: o Asaas passa a cobrar o valor novo (também o que está em aberto).
    let asaas: 'atualizado' | 'falhou' | null = null;
    if (antes.asaasAssinaturaId) {
      try {
        await this.provedor.atualizarAssinatura(antes.asaasAssinaturaId, {
          valor: valorDaCobranca(
            d.plano,
            d.ciclo,
            Number(antes.unidades) || 1,
            await this.precos.vigente(dataLocal(new Date())),
            Number((await fichaDaContaPlataforma(this.banco.prisma, contaId))?.descontoBp ?? 0),
          ),
          descricao: `Pente Fino ${NOME_PLANO[d.plano]} (${d.ciclo})`,
        });
        asaas = 'atualizado';
      } catch (e) {
        asaas = 'falhou';
        this.logger.error(`Asaas ao mudar o plano da conta ${contaId}: ${(e as Error).message}`);
      }
    }
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_plano',
      contaId,
      antes: { plano: antes.plano, ciclo: antes.ciclo },
      depois: { plano: d.plano, ciclo: d.ciclo, asaas },
      motivo: d.motivo,
      ip,
    });
    this.valeNaHora(contaId);
    return { asaas };
  }

  async mudarTeste(
    contaId: string,
    d: MudarTesteContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    // Admin R6: teste tem limite; para mais tempo sem pagar, cortesia (com motivo e fim).
    const problema = problemaFimDoTeste(d.ate, dataLocal(new Date()));
    if (problema) throw Erros.validacao([{ campo: 'ate', mensagem: problema }]);
    // Vale até o fim do dia escolhido, em São Paulo.
    const ate = new Date(`${d.ate}T23:59:59-03:00`);
    const antes = await mudarTesteDaConta(this.banco.prisma, contaId, ate).catch(traduzir);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_teste',
      contaId,
      antes,
      depois: { status: 'teste', testeAte: ate.toISOString() },
      motivo: d.motivo,
      ip,
    });
    this.valeNaHora(contaId);
  }

  /**
   * Admin R3: bloquear, desbloquear, cancelar, reativar, cortesia e início da cobrança, pela
   * máquina de estados (transicaoDaConta). Cancelar para a cobrança automática no Asaas antes de
   * gravar: se o Asaas não responder, nada muda (a conta não fica cancelada sendo cobrada).
   */
  async mudarSituacao(
    contaId: string,
    d: AcaoContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const atual = await situacaoDaContaPlataforma(this.banco.prisma, contaId);
    if (!atual) throw Erros.naoEncontrado('Conta não encontrada.');
    const hoje = dataLocal(new Date());
    const r = transicaoDaConta(
      {
        status: atual.status,
        statusAnterior: atual.statusAnterior,
        testeAte: atual.testeAte ? dataLocal(new Date(atual.testeAte)) : null,
        cobrancaAutomatica: atual.asaasAssinaturaId !== null,
      },
      d,
      hoje,
    );
    if (!r.ok) throw Erros.validacao([{ campo: d.data ? 'data' : 'acao', mensagem: r.motivo }]);
    if (r.mudanca.pararCobrancaAutomatica && atual.asaasAssinaturaId) {
      try {
        await this.provedor.cancelarAssinatura(atual.asaasAssinaturaId);
      } catch (e) {
        // Já cancelada no Asaas (404): segue; outro erro: não cancela pela metade.
        if (!(e instanceof ErroCobranca && e.status === 404)) {
          this.logger.error(`Asaas ao cancelar a conta ${contaId}: ${(e as Error).message}`);
          throw Erros.conflito(
            'Não deu para parar a cobrança automática no Asaas, então a conta não foi cancelada. Tente de novo em instantes.',
          );
        }
      }
    }
    const antes = await aplicarSituacaoDaConta(
      this.banco.prisma,
      contaId,
      r.mudanca,
      d.motivo,
    ).catch(traduzir);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: d.acao,
      contaId,
      antes,
      depois: { ...r.mudanca, proximo: d.proximo ?? null },
      motivo: d.motivo,
      ip,
    });
    this.valeNaHora(contaId);
  }

  /** Admin R5: conta da própria equipe sai das métricas, do "Precisa de atenção" e da cobrança. */
  async marcarInterna(
    contaId: string,
    d: ContaInternaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const antes = await marcarContaInterna(this.banco.prisma, contaId, d.interna).catch(traduzir);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: d.interna ? 'marcar_interna' : 'desmarcar_interna',
      contaId,
      antes: { interna: antes },
      depois: { interna: d.interna },
      motivo: d.motivo,
      ip,
    });
    this.valeNaHora(contaId);
  }

  async registrarPagamento(
    contaId: string,
    d: RegistrarPagamentoEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const ficha = await fichaDaContaPlataforma(this.banco.prisma, contaId);
    if (!ficha) throw Erros.naoEncontrado('Conta não encontrada.');
    const fim = fimDoPeriodo(d.periodoInicio, ficha.ciclo as 'mensal' | 'anual');
    const r = await registrarPagamentoManual(this.banco.prisma, {
      contaId,
      valor: d.valor,
      forma: d.forma,
      pagaEm: new Date(`${d.pagoEm}T12:00:00-03:00`),
      inicio: d.periodoInicio,
      fim,
      recebidoPorId: a.id,
      comprovante: d.comprovante,
    }).catch(traduzir);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'registrar_pagamento',
      contaId,
      antes: { status: r.statusAntes },
      depois: {
        fatura: r.faturaId,
        valor: d.valor,
        forma: d.forma,
        periodo: [d.periodoInicio, fim],
        comprovante: d.comprovante,
      },
      ip,
    });
    this.valeNaHora(contaId);
    // "Pagamento recebido" aos donos (falha de fila não desfaz o registro).
    for (const dono of (ficha.donos as { nome: string; email: string }[]) ?? [])
      await this.emails
        .pagamentoRecebido({
          para: dono.email,
          nome: dono.nome.split(' ')[0] ?? dono.nome,
          conta: String(ficha.nome),
          valor: formatarMoeda(d.valor),
          periodo: `${formatarData(`${d.periodoInicio}T12:00:00Z`)} a ${formatarData(`${fim}T12:00:00Z`)}`,
        })
        .catch((e: Error) => this.logger.error(`Aviso de pagamento: ${e.message}`));
    return { periodoFim: fim };
  }
}

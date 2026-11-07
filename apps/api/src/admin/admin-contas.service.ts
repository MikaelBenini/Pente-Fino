import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  fichaDaContaPlataforma,
  mudarPlanoDaConta,
  mudarSituacaoDaConta,
  mudarTesteDaConta,
  registrarPagamentoManual,
} from '@pente-fino/db';
import {
  dataLocal,
  fimDoPeriodo,
  formatarData,
  formatarMoeda,
  NOME_PLANO,
  STATUS_DA_ACAO,
  valorDaCobranca,
  type FichaContaPlataforma,
  type MudarPlanoContaEntrada,
  type MudarSituacaoContaEntrada,
  type MudarTesteContaEntrada,
  type RegistrarPagamentoEntrada,
} from '@pente-fino/shared';
import { AssinaturaGuard } from '../assinatura/assinatura.guard.js';
import { PlanoGuard } from '../assinatura/plano.guard.js';
import { PROVEDOR_COBRANCA, type ProvedorCobranca } from '../cobranca/provedor.js';
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
    throw Erros.conflito('A conta está suspensa ou cancelada. Reative antes.');
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
    const eventos = await this.banco.prisma.auditoriaPlataforma.findMany({
      where: { contaAfetadaId: contaId },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    return {
      ...(f as unknown as Omit<FichaContaPlataforma, 'historico'>),
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

  async mudarSituacao(
    contaId: string,
    d: MudarSituacaoContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const status = STATUS_DA_ACAO[d.acao];
    const antes = await mudarSituacaoDaConta(this.banco.prisma, contaId, status, d.motivo).catch(
      traduzir,
    );
    await this.auth.auditar({
      usuarioId: a.id,
      acao: d.acao,
      contaId,
      antes,
      depois: { status },
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

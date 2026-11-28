import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ativacaoDaContaPlataforma,
  funilDaConta,
  fichaDaContaPlataforma,
  aplicarSituacaoDaConta,
  marcarContaInterna,
  mudarWhatsappDoDono,
  mudarLicencaDaConta,
  mudarPlanoDaConta,
  mudarTesteDaConta,
  situacaoDaContaPlataforma,
  registrarPagamentoManual,
  suporteLiberadoDaConta,
} from '@pente-fino/db';
import {
  dataLocal,
  fimDoPeriodo,
  formatarData,
  formatarMoeda,
  licencaDoProduto,
  NOME_LICENCA,
  produtoDaConta,
  NOME_PLANO,
  PLANOS_DA_LICENCA,
  origemCadastroSchema,
  etapaAtualDoFunil,
  problemaFimDoTeste,
  resumoDaOrigem,
  transicaoDaConta,
  valorDaCobranca,
  type AcaoContaEntrada,
  type ContaInternaEntrada,
  type WhatsappDonoEntrada,
  type FichaContaPlataforma,
  type MudarLicencaContaEntrada,
  type MudarProdutoContaEntrada,
  type MudarPlanoContaEntrada,
  type MudarTesteContaEntrada,
  type NotaInterna,
  type NotaInternaEntrada,
  type RegistrarPagamentoEntrada,
  fimDaSessaoSuporte,
  type SessaoSuporteAberta,
} from '@pente-fino/shared';
import { AssinaturaGuard } from '../assinatura/assinatura.guard.js';
import { PlanoGuard } from '../assinatura/plano.guard.js';
import { ErroCobranca, PROVEDOR_COBRANCA, type ProvedorCobranca } from '../cobranca/provedor.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { TokensAcesso } from '../auth/tokens.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { BancoPlataforma } from './banco-plataforma.js';

/** Erros levantados pelas funções do banco → resposta HTTP. */
function traduzir(e: unknown): never {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('conta_inexistente')) throw Erros.naoEncontrado('Conta não encontrada.');
  if (msg.includes('dono_inexistente'))
    throw Erros.naoEncontrado('Esse e-mail não é de um dono desta conta.');
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
    @Inject(BancoService) private readonly bancoApp: BancoService,
    @Inject(TokensAcesso) private readonly tokens: TokensAcesso,
  ) {}

  /**
   * Admin F5: abre o painel da barbearia em modo suporte (só leitura), se o dono liberou.
   * A sessão dura 1 h, nunca depois do fim da liberação, e fica nas duas auditorias.
   */
  async abrirSuporte(contaId: string, a: AdminAutenticado): Promise<SessaoSuporteAberta> {
    const conta = await suporteLiberadoDaConta(this.banco.prisma, contaId);
    if (!conta) throw Erros.naoEncontrado('Conta não encontrada.');
    const agora = new Date();
    const ate = fimDaSessaoSuporte(conta.liberadoAte, agora);
    if (!ate)
      throw Erros.conflito(
        'O dono não liberou o acesso de suporte, ou a liberação já venceu. Ele libera em Configurações → Acesso do suporte.',
      );
    const token = await this.tokens.emitirSuporte(contaId, { id: a.id, nome: a.nome }, ate);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'abrir_modo_suporte',
      contaId,
      depois: { ate: ate.toISOString() },
      ip: a.ip,
    });
    // Na auditoria da barbearia: o dono vê quem do Pente Fino entrou e até quando.
    await this.bancoApp.naConta(contaId, (tx) =>
      tx.auditoria.create({
        data: {
          usuarioId: null,
          entidade: 'conta',
          entidadeId: contaId,
          acao: 'acesso_suporte',
          depois: { quem: a.nome, ate: ate.toISOString() },
        },
      }),
    );
    return { token, ate: ate.toISOString() };
  }

  private valeNaHora(contaId: string) {
    this.trava.esquecer(contaId);
    this.planos.esquecer(contaId);
  }

  async ficha(contaId: string): Promise<FichaContaPlataforma> {
    const f = await fichaDaContaPlataforma(this.banco.prisma, contaId);
    if (!f) throw Erros.naoEncontrado('Conta não encontrada.');
    const situacao = await situacaoDaContaPlataforma(this.banco.prisma, contaId);
    const [eventos, ativacao, notas, funil, suporte] = await Promise.all([
      this.banco.prisma.auditoriaPlataforma.findMany({
        where: { contaAfetadaId: contaId },
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
        take: 50,
      }),
      ativacaoDaContaPlataforma(this.banco.prisma, contaId),
      this.notas(contaId),
      funilDaConta(this.banco.prisma, contaId),
      suporteLiberadoDaConta(this.banco.prisma, contaId),
    ]);
    return {
      ...(f as unknown as Omit<
        FichaContaPlataforma,
        | 'historico'
        | 'statusAnterior'
        | 'cortesiaAte'
        | 'cobrarAPartirDe'
        | 'interna'
        | 'origem'
        | 'ativacao'
        | 'etapaFunil'
        | 'notas'
        | 'suporteLiberadoAte'
      >),
      suporteLiberadoAte:
        suporte?.liberadoAte && suporte.liberadoAte > new Date()
          ? suporte.liberadoAte.toISOString()
          : null,
      ativacao,
      etapaFunil: funil ? etapaAtualDoFunil(funil) : null,
      notas,
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

  /** Notas da equipe sobre a conta (admin U3), das mais novas; a barbearia não vê. */
  async notas(contaId: string): Promise<NotaInterna[]> {
    const linhas = await this.banco.prisma.notaInternaConta.findMany({
      where: { contaAfetadaId: contaId },
      include: { autor: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    return linhas.map((n) => ({
      id: n.id,
      texto: n.texto,
      autor: n.autor?.nome ?? null,
      criadoEm: n.criadoEm.toISOString(),
    }));
  }

  async anotar(
    contaId: string,
    d: NotaInternaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ): Promise<NotaInterna> {
    if (!(await fichaDaContaPlataforma(this.banco.prisma, contaId)))
      throw Erros.naoEncontrado('Conta não encontrada.');
    const n = await this.banco.prisma.notaInternaConta.create({
      data: { contaAfetadaId: contaId, autorId: a.id, texto: d.texto },
    });
    // Na auditoria fica só que houve nota; o texto está na própria nota.
    await this.auth.auditar({ usuarioId: a.id, acao: 'nota_interna', contaId, ip });
    return { id: n.id, texto: n.texto, autor: a.nome, criadoEm: n.criadoEm.toISOString() };
  }

  /**
   * Produto e plano de uma vez (o bloco "Produto e plano" da ficha): licença e tipo de negócio
   * saem do produto; no Atendimento, o tipo de negócio fica o que a conta já tem. Uma auditoria
   * e uma atualização no Asaas com o valor final.
   */
  async mudarProduto(
    contaId: string,
    d: MudarProdutoContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const ficha = (await fichaDaContaPlataforma(
      this.banco.prisma,
      contaId,
    )) as FichaContaPlataforma | null;
    if (!ficha) throw Erros.naoEncontrado('Conta não encontrada.');
    const { licenca, segmento } = licencaDoProduto(d.produto, ficha.segmento);
    const mudouLicenca = licenca !== ficha.licenca || segmento !== ficha.segmento;
    const mudouPlano = d.plano !== ficha.plano || d.ciclo !== ficha.ciclo;
    if (!mudouLicenca && !mudouPlano)
      throw Erros.conflito('Nada mudou: é o mesmo produto e plano.');
    const antesLicenca = mudouLicenca
      ? await mudarLicencaDaConta(this.banco.prisma, contaId, licenca, segmento).catch(traduzir)
      : null;
    const antesPlano = mudouPlano
      ? await mudarPlanoDaConta(this.banco.prisma, contaId, d.plano, d.ciclo).catch(traduzir)
      : null;
    const asaasId = antesPlano?.asaasAssinaturaId ?? antesLicenca?.asaasAssinaturaId ?? null;
    const automacoes = (antesPlano?.automacoes ?? antesLicenca?.automacoes) === true;
    const unidades = Number(antesPlano?.unidades ?? antesLicenca?.unidades) || 1;
    let asaas: 'atualizado' | 'falhou' | null = null;
    if (asaasId) {
      try {
        await this.provedor.atualizarAssinatura(asaasId, {
          valor: valorDaCobranca(
            d.plano,
            d.ciclo,
            unidades,
            await this.precos.vigente(dataLocal(new Date())),
            Number(ficha.descontoBp ?? 0),
            automacoes,
            licenca,
          ),
          descricao: `Pente Fino ${NOME_LICENCA[licenca]} ${NOME_PLANO[d.plano]} (${d.ciclo})`,
        });
        asaas = 'atualizado';
      } catch (e) {
        asaas = 'falhou';
        this.logger.error(`Asaas ao mudar o produto da conta ${contaId}: ${(e as Error).message}`);
      }
    }
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_produto',
      contaId,
      antes: {
        produto: produtoDaConta(ficha.licenca, ficha.segmento),
        plano: ficha.plano,
        ciclo: ficha.ciclo,
      },
      depois: { produto: d.produto, plano: d.plano, ciclo: d.ciclo, asaas },
      motivo: d.motivo,
      ip,
    });
    this.valeNaHora(contaId);
    return { asaas };
  }

  async mudarPlano(
    contaId: string,
    d: MudarPlanoContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const fichaAntes = (await fichaDaContaPlataforma(
      this.banco.prisma,
      contaId,
    )) as FichaContaPlataforma | null;
    const licenca = fichaAntes?.licenca ?? 'barbearia';
    if (!PLANOS_DA_LICENCA[licenca].includes(d.plano))
      throw Erros.conflito(
        `A Licença ${NOME_LICENCA[licenca]} não tem o plano ${NOME_PLANO[d.plano]}. Troque a licença antes.`,
      );
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
            Number(fichaAntes?.descontoBp ?? 0),
            antes.automacoes === true,
            licenca,
          ),
          descricao: `Pente Fino ${NOME_LICENCA[licenca]} ${NOME_PLANO[d.plano]}${antes.automacoes === true ? ' + Automações' : ''} (${d.ciclo})`,
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

  /**
   * Troca a licença e o segmento (ADR 0015). O plano atual precisa existir na licença nova; com
   * cobrança automática, o Asaas passa a cobrar o preço da licença nova.
   */
  async mudarLicenca(
    contaId: string,
    d: MudarLicencaContaEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const ficha = (await fichaDaContaPlataforma(
      this.banco.prisma,
      contaId,
    )) as FichaContaPlataforma | null;
    if (!ficha) throw Erros.naoEncontrado('Conta não encontrada.');
    if (!PLANOS_DA_LICENCA[d.licenca].includes(ficha.plano))
      throw Erros.conflito(
        `A Licença ${NOME_LICENCA[d.licenca]} não tem o plano ${NOME_PLANO[ficha.plano]}. Mude o plano para ${PLANOS_DA_LICENCA[d.licenca].map((p) => NOME_PLANO[p]).join(', ')} antes.`,
      );
    const antes = await mudarLicencaDaConta(
      this.banco.prisma,
      contaId,
      d.licenca,
      d.segmento,
    ).catch(traduzir);
    let asaas: 'atualizado' | 'falhou' | null = null;
    if (antes.asaasAssinaturaId && antes.licenca !== d.licenca) {
      try {
        await this.provedor.atualizarAssinatura(antes.asaasAssinaturaId, {
          valor: valorDaCobranca(
            ficha.plano,
            ficha.ciclo,
            Math.max(1, Number(antes.unidades) || 1),
            await this.precos.vigente(dataLocal(new Date())),
            Number(ficha.descontoBp ?? 0),
            antes.automacoes === true,
            d.licenca,
          ),
          descricao: `Pente Fino ${NOME_LICENCA[d.licenca]} ${NOME_PLANO[ficha.plano]} (${ficha.ciclo})`,
        });
        asaas = 'atualizado';
      } catch (e) {
        asaas = 'falhou';
        this.logger.error(`Asaas ao mudar a licença da conta ${contaId}: ${(e as Error).message}`);
      }
    }
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_licenca',
      contaId,
      antes: { licenca: antes.licenca, segmento: antes.segmento },
      depois: { licenca: d.licenca, segmento: d.segmento, asaas },
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

  /** Troca o WhatsApp do dono (pedido do dono em 20/11/2026), com motivo e auditoria. */
  async mudarWhatsappDono(
    contaId: string,
    d: WhatsappDonoEntrada,
    a: AdminAutenticado,
    ip: string | null,
  ) {
    const antes = await mudarWhatsappDoDono(this.banco.prisma, contaId, d.email, d.telefone).catch(
      traduzir,
    );
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_whatsapp_dono',
      contaId,
      antes: { email: d.email, telefone: antes },
      depois: { email: d.email, telefone: d.telefone },
      motivo: d.motivo,
      ip,
    });
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

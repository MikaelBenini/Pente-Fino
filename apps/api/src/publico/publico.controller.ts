import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  aplicarModelosIniciais,
  configuracaoDoSistema,
  clienteDoToken,
  criarLinkDoHorario,
  duracaoDosServicos,
  primeiroHorarioPossivel,
  faltasRecentes,
  usarToken,
  precoServicoVigente,
  Prisma,
  type Transacao,
  estadoAssinatura,
} from '@pente-fino/db';
import {
  lerRegrasAgendamento,
  agendamentoPublicoSchema,
  deveOferecerAntecipar,
  esperaPublicaSchema,
  type EsperaPublicaCriada,
  type EsperaPublicaEntrada,
  bloqueadoPorFaltas,
  caminhoDoHorario,
  cadastroContaSchema,
  confirmarEmailSchema,
  emailDescartavel,
  pareceRobo,
  type ConfirmarEmailEntrada,
  dataLocal,
  formatarDiaPorExtenso,
  formatarHora,
  gerarSlug,
  slugSchema,
  TEXTO_AGENDAR_POR_AQUI,
  TEXTO_ATIVAR_LEMBRETES,
  type ClienteDoLink,
  variantesTelefone,
  type LembretesDoSite,
  type AgendamentoPublicoCriado,
  type AgendamentoPublicoEntrada,
  type CadastroContaEntrada,
  type HorarioLivre,
  type Sessao,
  type UnidadePublica,
  lerConfiguracaoPublica,
  type TabelaPrecosPlanos,
  temRecurso,
} from '@pente-fino/shared';
import type { Request } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auditar } from '../auditoria/auditoria.js';
import { AgendaService } from '../agenda/agenda.service.js';
import { AuthService } from '../auth/auth.service.js';
import { LimiteAutenticacao, Publico } from '../auth/decoradores.js';
import { gerarHashSenha } from '../auth/senhas.js';
import { BancoService } from '../comum/banco.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { EmailsService } from '../emails/emails.service.js';
import { Erros } from '../comum/erros.js';
import { LimiteCadastro } from './limite-cadastro.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EventosService } from '../filas/filas.module.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';
import { emSequencia, umPorVez } from '../comum/sequencia.js';

const slugParam = new PipeZod(slugSchema);

/** "Prefere pelo WhatsApp?": o bot conectado e marcando pela conversa. */
async function linkAgendarPelaConversa(tx: Transacao, unidadeId: string, regras: unknown) {
  if (!lerRegrasAgendamento(regras).pelaConversa) return null;
  const c = await tx.botConexao.findUnique({ where: { unidadeId } });
  if (c?.status !== 'conectado' || !c.numero) return null;
  return `https://wa.me/${c.numero}?text=${encodeURIComponent(TEXTO_AGENDAR_POR_AQUI)}`;
}

const consultaToken = z.object({ c: z.string().regex(/^[A-Za-z0-9_-]{10,20}$/, 'Link inválido.') });

/** Avisos pelo WhatsApp: ligados se já conversou; se não, o botão para ativar (proteção do número). */
export async function ativacaoDosAvisos(
  tx: Transacao,
  unidadeId: string,
  telefone: string,
): Promise<EsperaPublicaCriada> {
  const c = await tx.botConexao.findUnique({ where: { unidadeId } });
  if (c?.status !== 'conectado' || !c.numero) return { lembretes: null, linkLembretes: null };
  const falou = await tx.mensagem.findFirst({
    where: { unidadeId, telefone: { in: variantesTelefone(telefone) }, direcao: 'entrada' },
    select: { id: true },
  });
  return falou
    ? { lembretes: 'ligados', linkLembretes: null }
    : {
        lembretes: 'ativar',
        linkLembretes: `https://wa.me/${c.numero}?text=${encodeURIComponent(TEXTO_ATIVAR_LEMBRETES)}`,
      };
}

/** Número do bot que manda os lembretes: WhatsApp conectado e lembretes ligados nas regras. */
async function numeroDosLembretes(tx: Transacao, unidadeId: string, regras: unknown) {
  if (lerRegrasAgendamento(regras).lembretesHoras.length === 0) return null;
  const c = await tx.botConexao.findUnique({ where: { unidadeId } });
  return c?.status === 'conectado' && c.numero ? c.numero : null;
}
const consultaHorarios = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
  servicoIds: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(5)),
  profissionalId: z.uuid().optional(),
});
/** Até quantos horários futuros um mesmo telefone pode ter pelo link. */
/** Até quantos dias à frente o link aceita agendar. */

@ApiTags('Público (sem login)')
@Controller('publico')
export class PublicoController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AgendaService) private readonly agenda: AgendaService,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(PrecosService) private readonly precosServico: PrecosService,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(LimiteCadastro) private readonly limiteCadastro: LimiteCadastro,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  // ─── Cadastro de conta ──────────────────────────────────────────────────

  @Get('precos')
  @Publico()
  @ApiOperation({ summary: 'Preços dos planos que valem hoje (site e cadastro)' })
  async precos(): Promise<TabelaPrecosPlanos> {
    return this.precosServico.vigente(dataLocal(new Date()));
  }

  @Get('cupom/:codigo')
  @Publico()
  @LimiteAutenticacao()
  @ApiOperation({ summary: 'Conferir um cupom antes de se cadastrar (desconto ou o motivo)' })
  async cupom(
    @Param('codigo') codigo: string,
  ): Promise<{ codigo: string; descontoBp: number; restantes: number | null }> {
    const r = await this.precosServico.cupomValido(codigo.slice(0, 30));
    return { codigo: r.cupom!, descontoBp: r.descontoBp, restantes: r.restantes };
  }

  @Post('contas')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar conta (barbearia + dono) e já entrar' })
  async cadastrar(
    @Corpo(cadastroContaSchema) d: CadastroContaEntrada,
    @Req() req: Request,
  ): Promise<Sessao> {
    // Robôs (Etapa 15.4): campo isca ou envio rápido demais; recusa sem dizer por quê.
    if (pareceRobo(d, Date.now(), this.config.cadastro.tempoMinimoMs))
      throw Erros.requisicaoInvalida(
        'cadastro_recusado',
        'Não foi possível criar a conta agora. Confira os dados e tente de novo.',
      );
    if (emailDescartavel(d.email))
      throw Erros.validacao([
        {
          campo: 'email',
          mensagem: 'Use um e-mail permanente: ele recebe a confirmação e os avisos.',
        },
      ]);
    await this.limiteCadastro.conferir(req.ip);
    const existente = await this.banco.semConta({ loginEmail: d.email }, (tx) =>
      tx.usuario.findUnique({ where: { email: d.email } }),
    );
    if (existente)
      throw Erros.conflito('Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".');
    const senhaHash = await gerarHashSenha(d.senha);
    const contaId = randomUUID();
    // Dias de teste e versão dos termos vêm da administração (com padrão do sistema).
    const { teste } = lerConfiguracaoPublica(await configuracaoDoSistema(this.banco.prisma));
    const desconto = await this.precosServico.cupomValido(d.cupom);
    const testeAte = new Date(Date.now() + teste.dias * 86_400_000);
    let sessao: Sessao;
    let linkConfirmacao: string | undefined;
    try {
      sessao = await this.banco.naConta(contaId, async (tx) => {
        await tx.conta.create({
          data: {
            id: contaId,
            nome: d.barbearia,
            plano: d.plano,
            ciclo: d.ciclo,
            status: 'teste',
            testeAte,
            precosDesde: new Date(`${dataLocal(new Date())}T00:00:00Z`),
            cupom: desconto.cupom,
            descontoBp: desconto.descontoBp,
          },
        });
        const unidade = await tx.unidade.create({
          data: {
            nome: 'Unidade principal',
            capacidade: 2,
            slug: `${gerarSlug(d.barbearia).slice(0, 50) || 'barbearia'}-${randomBytes(2).toString('hex')}`,
          },
        });
        // Começa sem e-mail confirmado: o link vai no e-mail de boas-vindas.
        const dono = await tx.usuario.create({
          data: {
            nome: d.nome,
            email: d.email,
            senhaHash,
            emailConfirmadoEm: null,
            telefone: d.whatsapp ?? null,
          },
        });
        linkConfirmacao = (await this.auth.criarLinkDeConfirmacao(tx, dono.id)).link;
        await tx.papelUsuario.create({
          data: { usuarioId: dono.id, papel: 'dono', unidadeId: null },
        });
        // Categorias de despesa, mensagens e menu do bot; os serviços vêm da configuração guiada.
        await aplicarModelosIniciais(tx, {
          unidadeIds: [unidade.id],
          vigenciaInicio: dataLocal(new Date()),
          incluirServicos: false,
        });
        await auditar(
          tx,
          {
            entidade: 'conta',
            entidadeId: contaId,
            acao: 'criar',
            depois: {
              nome: d.barbearia,
              plano: d.plano,
              ciclo: d.ciclo,
              aceiteTermos: teste.versaoTermos,
            },
          },
          dono.id,
        );
        return this.auth.montarSessao(tx, dono.id);
      });
    } catch (e) {
      // Dois cadastros com o mesmo e-mail ao mesmo tempo.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw Erros.conflito(
          'Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".',
        );
      }
      throw e;
    }
    // A conta já existe: falha no e-mail não desfaz o cadastro.
    await this.emails
      .boasVindas({
        para: d.email,
        nome: d.nome,
        conta: d.barbearia,
        testeAte,
        dias: teste.dias,
        link: linkConfirmacao,
      })
      .catch(() => undefined);
    return sessao;
  }

  @Post('confirmar-email')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirmar o e-mail pelo link (cadastro pelo site)' })
  async confirmarEmail(@Corpo(confirmarEmailSchema) d: ConfirmarEmailEntrada): Promise<void> {
    await this.auth.confirmarEmail(d.token);
  }

  // ─── Link público de agendamento ────────────────────────────────────────

  /** Acha a unidade pelo endereço (só com o link ligado) e devolve a conta dela. */
  private async unidade(slug: string) {
    const u = await this.banco.semConta({ slugPublico: slug }, (tx) =>
      tx.unidade.findUnique({ where: { slug } }),
    );
    if (!u || !u.agendamentoPublico || !u.ativa)
      throw Erros.naoEncontrado('Esta página de agendamento não existe ou foi desligada.');
    return u;
  }

  @Get('agendamento/:slug')
  @Publico()
  @ApiOperation({ summary: 'Dados da página de agendamento: serviços com preço e barbeiros' })
  async pagina(@Param('slug', slugParam) slug: string): Promise<UnidadePublica> {
    const u = await this.unidade(slug);
    const hoje = dataLocal(new Date());
    return this.banco.naConta(u.contaId, async (tx) => {
      const [conta, servicos, profissionais] = await emSequencia([
        tx.conta.findUniqueOrThrow({ where: { id: u.contaId } }),
        tx.servico.findMany({
          where: { ativo: true },
          orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
        }),
        tx.profissional.findMany({
          where: { unidadeId: u.id, ativo: true },
          include: { usuario: true },
          orderBy: { usuario: { nome: 'asc' } },
        }),
      ]);
      const comPreco = await umPorVez(servicos, async (s) => ({
        id: s.id,
        nome: s.nome,
        duracaoMin: s.duracaoMin,
        ehExtra: s.ehExtra,
        preco: (await precoServicoVigente(tx, s.id, u.id, hoje)) ?? null,
      }));
      return {
        nome: u.nome,
        barbearia: conta.nome,
        endereco: u.endereco,
        telefone: u.telefone,
        // Só o que tem preço na unidade pode ser agendado pelo cliente.
        servicos: comPreco.filter((s) => s.preco !== null),
        profissionais: profissionais.map((p) => ({
          id: p.id,
          nome: p.usuario.nome.split(' ')[0]!,
        })),
        lembretesWhatsapp: !!(await numeroDosLembretes(tx, u.id, u.regrasAgendamento)),
        linkWhatsappAgendar: await linkAgendarPelaConversa(tx, u.id, u.regrasAgendamento),
        listaEspera: temRecurso((await estadoAssinatura(tx)).plano, 'listaEspera'),
        outrasUnidades: (
          await tx.unidade.findMany({
            where: {
              id: { not: u.id },
              ativa: true,
              agendamentoPublico: true,
              slug: { not: null },
            },
            select: { slug: true, nome: true, endereco: true },
            orderBy: { nome: 'asc' },
          })
        ).map((o) => ({ slug: o.slug!, nome: o.nome, endereco: o.endereco })),
      };
    });
  }

  @Get('agendamento/:slug/cliente')
  @Publico()
  @LimiteAutenticacao()
  @ApiOperation({ summary: 'Quem veio pelo link do bot: nome e telefone para preencher' })
  async clienteDoLink(
    @Param('slug', slugParam) slug: string,
    @Consulta(consultaToken) q: z.infer<typeof consultaToken>,
  ): Promise<ClienteDoLink> {
    const u = await this.unidade(slug);
    return this.banco.naConta(u.contaId, async (tx) => {
      const t = await clienteDoToken(tx, u.id, q.c);
      if (!t?.cliente.telefone)
        throw Erros.naoEncontrado('Este link já foi usado ou venceu. Preencha seus dados.');
      return { nome: t.cliente.nome, telefone: t.cliente.telefone };
    });
  }

  @Get('agendamento/:slug/horarios')
  @Publico()
  @ApiOperation({ summary: 'Horários livres para os serviços escolhidos' })
  async horarios(
    @Param('slug', slugParam) slug: string,
    @Consulta(consultaHorarios) c: z.infer<typeof consultaHorarios>,
  ): Promise<HorarioLivre[]> {
    const u = await this.unidade(slug);
    const regras = lerRegrasAgendamento(u.regrasAgendamento);
    this.exigirJanela(c.data, regras.janelaDias);
    return this.banco.naConta(u.contaId, async (tx) => {
      const duracao = await this.duracao(tx, c.servicoIds);
      return this.agenda.calcularLivres(tx, u.id, c.data, duracao, c.profissionalId, {
        antecedenciaMin: regras.antecedenciaMin,
      });
    });
  }

  @Post('agendamento/:slug')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agendar pelo link (cria cliente pelo telefone e a comanda prevista)' })
  async agendar(
    @Param('slug', slugParam) slug: string,
    @Corpo(agendamentoPublicoSchema) d: AgendamentoPublicoEntrada,
  ): Promise<AgendamentoPublicoCriado> {
    const u = await this.unidade(slug);
    const regras = lerRegrasAgendamento(u.regrasAgendamento);
    this.exigirJanela(dataLocal(new Date(d.inicio)), regras.janelaDias);
    if (new Date(d.inicio).getTime() < Date.now() + regras.antecedenciaMin * 60_000)
      throw Erros.requisicaoInvalida(
        'horario_passado',
        regras.antecedenciaMin > 0
          ? `Pelo link, marque com pelo menos ${regras.antecedenciaMin} minutos de antecedência. Escolha outro horário.`
          : 'Este horário já passou. Escolha outro.',
      );
    const r = await this.banco.naConta(u.contaId, async (tx) => {
      // Veio pelo link do bot: o telefone é o do token (uso único), não o digitado.
      const doLink = d.c ? await clienteDoToken(tx, u.id, d.c) : null;
      if (doLink) {
        if (!(await usarToken(tx, doLink.tokenId)))
          throw Erros.conflito('Este link já foi usado. Preencha seus dados.');
        if (doLink.cliente.telefone) d = { ...d, telefone: doLink.cliente.telefone };
      }
      // Conta só para consulta não recebe agendamento novo pelo link.
      if ((await estadoAssinatura(tx)).somenteLeitura)
        throw Erros.conflito(
          'O agendamento pelo link está indisponível no momento. Fale com a barbearia pelo telefone ou WhatsApp.',
        );
      const cliente = await tx.cliente.findFirst({ where: { telefone: d.telefone } });
      if (
        cliente &&
        bloqueadoPorFaltas(await faltasRecentes(tx, cliente.id, new Date(), regras), regras)
      )
        throw Erros.conflito(
          'Para marcar um novo horário, fale com a barbearia pelo WhatsApp ou telefone.',
        );
      if (cliente) {
        const futuros = await tx.agendamento.count({
          where: {
            clienteId: cliente.id,
            unidadeId: u.id,
            inicio: { gt: new Date() },
            status: { in: ['agendado', 'confirmado'] },
          },
        });
        if (futuros >= regras.maxFuturos) {
          throw Erros.conflito(
            'Você já tem horários marcados com a gente. Para mudar, fale com a barbearia pelo WhatsApp.',
          );
        }
      }
      // "Avisar se vagar antes": a grade do dia antes de marcar e o primeiro horário possível.
      const diaEscolhido = dataLocal(new Date(d.inicio));
      const livresAntes = (
        await this.agenda.calcularLivres(
          tx,
          u.id,
          diaEscolhido,
          await duracaoDosServicos(tx, d.servicoIds),
          d.profissionalId,
          {
            antecedenciaMin: regras.antecedenciaMin,
          },
        )
      ).flatMap((l) => l.inicios);
      const primeiroPossivel = await primeiroHorarioPossivel(
        tx,
        u.id,
        [d.profissionalId],
        diaEscolhido,
        new Date(),
        regras.antecedenciaMin,
      );
      const comandaId = await this.agenda.criarAgendamento(
        tx,
        {
          unidadeId: u.id,
          profissionalId: d.profissionalId,
          ...(cliente
            ? { clienteId: cliente.id }
            : { clienteNovo: { nome: d.nome, telefone: d.telefone } }),
          inicio: d.inicio,
          servicoIds: d.servicoIds,
          origem: 'link',
          encaixe: false,
          confirmarEncaixe: false,
        },
        null,
      );
      const c = await tx.comanda.findUniqueOrThrow({
        where: { id: comandaId },
        include: {
          agendamento: true,
          profissional: { include: { usuario: true } },
          itens: { include: { servico: true } },
        },
      });
      // Marcou pelo site: da próxima vez o bot já manda o link.
      if (c.clienteId)
        await tx.cliente.update({ where: { id: c.clienteId }, data: { canalPreferido: 'site' } });
      // Caixa de lembretes marcada: aceite gravado no cliente. Os lembretes só saem para quem
      // já escreveu para a unidade (proteção do número); se ainda não, o botão abre a conversa.
      let lembretes: LembretesDoSite = null;
      let linkLembretes: string | null = null;
      const numero = d.lembretes ? await numeroDosLembretes(tx, u.id, u.regrasAgendamento) : null;
      if (d.lembretes && c.clienteId) {
        await tx.cliente.update({
          where: { id: c.clienteId },
          data: { consentimentoMsg: true, consentimentoEm: new Date() },
        });
        if (numero) {
          const falou = await tx.mensagem.findFirst({
            where: {
              unidadeId: u.id,
              telefone: { in: variantesTelefone(d.telefone) },
              direcao: 'entrada',
            },
            select: { id: true },
          });
          lembretes = falou ? 'ligados' : 'ativar';
          if (!falou)
            linkLembretes = `https://wa.me/${numero}?text=${encodeURIComponent(TEXTO_ATIVAR_LEMBRETES)}`;
        }
      }
      const aceita =
        !!c.clienteId &&
        !!(await tx.cliente.findUnique({ where: { id: c.clienteId } }))?.consentimentoMsg;
      const podeAntecipar =
        aceita &&
        temRecurso((await estadoAssinatura(tx)).plano, 'listaEspera') &&
        !!primeiroPossivel &&
        deveOferecerAntecipar({
          livres: livresAntes,
          escolhido: new Date(d.inicio).toISOString(),
          primeiroPossivel,
          jaNaLista: false,
        });
      // Link para o cliente remarcar ou cancelar sozinho (o token só aparece aqui).
      return {
        ...c,
        token: await criarLinkDoHorario(tx, c.agendamentoId!),
        lembretes,
        linkLembretes,
        podeAntecipar,
      };
    });
    await this.eventos
      .publicar('agendamento.criado', u.contaId, { comandaId: r.id, origem: 'link' })
      .catch(() => undefined);
    await this.agenda.agendarLembretes(u.contaId, r.id);
    await this.agenda.avisarEquipeDaComanda(u.contaId, r.id, 'novo');
    const servicos = r.itens.map((i) => i.servico?.nome ?? 'Serviço');
    const profissional = r.profissional.usuario.nome.split(' ')[0]!;
    const quando = `${formatarDiaPorExtenso(r.agendamento!.inicio)} às ${formatarHora(r.agendamento!.inicio)}`;
    const mensagem = `Olá! Agendei pelo link: ${servicos.join(' + ')} na ${u.nome}, ${quando}, com ${profissional}. Nome: ${d.nome}.`;
    return {
      inicio: r.agendamento!.inicio.toISOString(),
      fim: r.agendamento!.fim.toISOString(),
      profissional,
      servicos,
      total: r.totalLiquido,
      linkWhatsapp: u.telefone
        ? `https://wa.me/${u.telefone}?text=${encodeURIComponent(mensagem)}`
        : null,
      linkGerenciar: caminhoDoHorario(r.token),
      lembretes: r.lembretes,
      linkLembretes: r.linkLembretes,
      podeAntecipar: r.podeAntecipar,
      toleranciaMin: regras.toleranciaAtrasoMin,
    };
  }

  @Post('agendamento/:slug/espera')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '"Avise-me se vagar": entra na lista de espera do dia pelo site' })
  async esperar(
    @Param('slug', slugParam) slug: string,
    @Corpo(esperaPublicaSchema) d: EsperaPublicaEntrada,
  ): Promise<EsperaPublicaCriada> {
    const u = await this.unidade(slug);
    const regras = lerRegrasAgendamento(u.regrasAgendamento);
    this.exigirJanela(d.dia, regras.janelaDias);
    return this.banco.naConta(u.contaId, async (tx) => {
      const estado = await estadoAssinatura(tx);
      if (estado.somenteLeitura)
        throw Erros.conflito('Indisponível no momento. Fale com a barbearia.');
      if (!temRecurso(estado.plano, 'listaEspera'))
        throw Erros.conflito('Esta barbearia não usa lista de espera. Tente outro dia.');
      await duracaoDosServicos(tx, d.servicoIds).catch(() => {
        throw Erros.naoEncontrado('Serviço não encontrado.');
      });
      if (d.profissionalId) {
        const p = await tx.profissional.findUnique({ where: { id: d.profissionalId } });
        if (!p || p.unidadeId !== u.id || !p.ativo)
          throw Erros.naoEncontrado('Profissional não encontrado.');
      }
      const doLink = d.c ? await clienteDoToken(tx, u.id, d.c) : null;
      const telefone = doLink?.cliente.telefone ?? d.telefone;
      const cliente =
        doLink?.cliente ??
        (await tx.cliente.findFirst({ where: { telefone } })) ??
        (await tx.cliente.create({
          data: { nome: d.nome, telefone, unidadeOrigemId: u.id, origemLead: 'site' },
        }));
      // Pediu para ser avisado: é o aceite para receber mensagens.
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { consentimentoMsg: true, consentimentoEm: new Date() },
      });
      const dia = new Date(`${d.dia}T00:00:00.000Z`);
      const ja = await tx.listaEspera.findFirst({
        where: {
          clienteId: cliente.id,
          unidadeId: u.id,
          dia,
          status: { in: ['aguardando', 'oferecido'] },
        },
      });
      if (!ja)
        await tx.listaEspera.create({
          data: {
            unidadeId: u.id,
            clienteId: cliente.id,
            profissionalId: d.profissionalId,
            servicoIds: d.servicoIds,
            dia,
            deMin: 0,
            ateMin: 24 * 60,
            origem: 'site',
          },
        });
      return ativacaoDosAvisos(tx, u.id, telefone);
    });
  }

  private exigirJanela(dia: string, janelaDias: number) {
    const hoje = dataLocal(new Date());
    const limite = new Date(`${hoje}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + janelaDias);
    if (dia < hoje || dia > limite.toISOString().slice(0, 10)) {
      throw Erros.validacao([
        { campo: 'data', mensagem: `Escolha um dia entre hoje e os próximos ${janelaDias} dias.` },
      ]);
    }
  }

  private async duracao(tx: Transacao, servicoIds: string[]): Promise<number> {
    const servicos = await tx.servico.findMany({ where: { id: { in: servicoIds }, ativo: true } });
    if (servicos.length !== new Set(servicoIds).size)
      throw Erros.naoEncontrado('Serviço não encontrado.');
    return servicos.reduce((s, x) => s + x.duracaoMin, 0);
  }
}

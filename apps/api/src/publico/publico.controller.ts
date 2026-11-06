import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  aplicarModelosIniciais,
  criarLinkDoHorario,
  precoServicoVigente,
  Prisma,
  type Transacao,
  estadoAssinatura,
} from '@pente-fino/db';
import {
  lerRegrasAgendamento,
  agendamentoPublicoSchema,
  caminhoDoHorario,
  cadastroContaSchema,
  dataLocal,
  formatarDiaPorExtenso,
  formatarHora,
  gerarSlug,
  slugSchema,
  type AgendamentoPublicoCriado,
  type AgendamentoPublicoEntrada,
  type CadastroContaEntrada,
  type HorarioLivre,
  type Sessao,
  type UnidadePublica,
  DIAS_TESTE,
  VERSAO_TERMOS,
} from '@pente-fino/shared';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auditar } from '../auditoria/auditoria.js';
import { AgendaService } from '../agenda/agenda.service.js';
import { AuthService } from '../auth/auth.service.js';
import { LimiteAutenticacao, Publico } from '../auth/decoradores.js';
import { gerarHashSenha } from '../auth/senhas.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { EventosService } from '../filas/filas.module.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';
import { emSequencia, umPorVez } from '../comum/sequencia.js';

const slugParam = new PipeZod(slugSchema);
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
  ) {}

  // ─── Cadastro de conta ──────────────────────────────────────────────────

  @Post('contas')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar conta (barbearia + dono) e já entrar' })
  async cadastrar(@Corpo(cadastroContaSchema) d: CadastroContaEntrada): Promise<Sessao> {
    const existente = await this.banco.semConta({ loginEmail: d.email }, (tx) =>
      tx.usuario.findUnique({ where: { email: d.email } }),
    );
    if (existente)
      throw Erros.conflito('Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".');
    const senhaHash = await gerarHashSenha(d.senha);
    const contaId = randomUUID();
    try {
      return await this.banco.naConta(contaId, async (tx) => {
        await tx.conta.create({
          data: {
            id: contaId,
            nome: d.barbearia,
            plano: d.plano,
            ciclo: d.ciclo,
            status: 'teste',
            testeAte: new Date(Date.now() + DIAS_TESTE * 86_400_000),
          },
        });
        const unidade = await tx.unidade.create({
          data: {
            nome: 'Unidade principal',
            capacidade: 2,
            slug: `${gerarSlug(d.barbearia).slice(0, 50) || 'barbearia'}-${randomBytes(2).toString('hex')}`,
          },
        });
        const dono = await tx.usuario.create({ data: { nome: d.nome, email: d.email, senhaHash } });
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
              aceiteTermos: VERSAO_TERMOS,
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
      };
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
      // Conta só para consulta não recebe agendamento novo pelo link.
      if ((await estadoAssinatura(tx)).somenteLeitura)
        throw Erros.conflito(
          'O agendamento pelo link está indisponível no momento. Fale com a barbearia pelo telefone ou WhatsApp.',
        );
      const cliente = await tx.cliente.findFirst({ where: { telefone: d.telefone } });
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
      // Link para o cliente remarcar ou cancelar sozinho (o token só aparece aqui).
      return { ...c, token: await criarLinkDoHorario(tx, c.agendamentoId!) };
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
    };
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

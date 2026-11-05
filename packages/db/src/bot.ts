// O bot do WhatsApp no banco: o que o motor precisa saber da unidade, o atendimento de uma
// mensagem recebida e o envio das respostas. Usado pela API (simulador, webhook) e pelo worker.
import {
  dataLocal,
  dataParaBanco,
  dentroDoHorario,
  descreverHorario,
  EXPIRACAO_SESSAO_MIN,
  grupoDaPalavraChave,
  lerNumeros,
  MENSAGENS_BOT_PADRAO,
  MENU_BOT_PADRAO,
  menuBotSchema,
  normalizar,
  responder,
  TIPOS_MENSAGEM_BOT,
  variantesTelefone,
  type ContextoConversa,
  type EventoWhatsapp,
  type MensagensBot,
  type MenuBot,
  type ResultadoConversa,
  type SessaoBot,
  type StatusConexaoWhatsapp,
  type TurnoBot,
} from '@pente-fino/shared';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';
import { passoDaAgenda, podeAgendarPelaConversa, type DadosDaConversa } from './agendar-bot.js';
import { gravarRespostaPesquisa, pesquisaValida } from './avaliacao.js';
import { precoServicoVigente } from './vigencia.js';

type Tx = Prisma.TransactionClient;

export const json = (v: unknown) => structuredClone(v) as Prisma.InputJsonValue;

/** O que está gravado passa de novo pelo esquema: menu estragado não chega ao motor. */
export function lerMenu(valor: unknown): MenuBot {
  const r = menuBotSchema.safeParse(valor);
  return r.success ? r.data : structuredClone(MENU_BOT_PADRAO);
}

/** Menu publicado; conta antiga sem menu recebe o padrão publicado na hora. */
export async function menuPublicado(tx: Tx) {
  const atual = await tx.botMenu.findFirst({ where: { status: 'publicado' } });
  if (atual) return atual;
  return tx.botMenu.create({
    data: { status: 'publicado', menu: json(MENU_BOT_PADRAO), publicadoEm: new Date() },
  });
}

/** Mensagens prontas da conta, com o padrão onde o dono não mexeu. */
export async function mensagensDoBot(tx: Tx): Promise<MensagensBot> {
  const salvas = await tx.modeloMensagem.findMany({
    where: { unidadeId: null, ativo: true, tipo: { in: [...TIPOS_MENSAGEM_BOT] } },
  });
  const m: MensagensBot = { ...MENSAGENS_BOT_PADRAO };
  for (const s of salvas) m[s.tipo as keyof MensagensBot] = s.texto;
  return m;
}

export type UnidadeDoBotNoBanco = Prisma.UnidadeGetPayload<{
  include: { profissionais: { include: { horarios: true } }; botConexao: true };
}>;

export function unidadeDoBot(tx: Tx, unidadeId: string) {
  return tx.unidade.findUnique({
    where: { id: unidadeId },
    include: { profissionais: { include: { horarios: true } }, botConexao: true },
  });
}

/** Expediente da equipe: nos dias da unidade, do primeiro turno que abre ao último que fecha. */
export function expedienteDaUnidade(u: UnidadeDoBotNoBanco): TurnoBot[] {
  const turnos: TurnoBot[] = [];
  for (const dia of u.diasTrabalho) {
    const doDia = u.profissionais
      .filter((p) => p.ativo)
      .flatMap((p) => p.horarios.filter((h) => h.diaSemana === dia));
    if (doDia.length === 0) continue;
    turnos.push({
      diaSemana: dia,
      inicioMin: Math.min(...doDia.map((h) => h.inicioMin)),
      fimMin: Math.max(...doDia.map((h) => h.fimMin)),
    });
  }
  return turnos;
}

/** Horário que vale, se está aberto agora (calendário incluído) e o link de agendamento. */
export async function situacaoDaUnidade(
  tx: Tx,
  u: UnidadeDoBotNoBanco,
  agora: Date,
  appUrl: string,
) {
  const expediente = expedienteDaUnidade(u);
  const horario = (u.botHorario as TurnoBot[] | null) ?? null;
  const vale = horario ?? expediente;
  const fechadoHoje = await tx.calendarioUnidade.findFirst({
    where: { unidadeId: u.id, data: dataParaBanco(dataLocal(agora)), trabalha: false },
  });
  return {
    expediente,
    horario,
    descricao: descreverHorario(vale),
    // Sem horário conhecido (equipe sem expediente cadastrado), não diz que está fechado.
    aberto: !fechadoHoje && (vale.length === 0 || dentroDoHorario(vale, agora)),
    link:
      u.agendamentoPublico && u.slug ? `${appUrl}/agendar?u=${encodeURIComponent(u.slug)}` : null,
  };
}

/** O que o motor precisa saber da unidade para responder. */
export async function contextoDaConversa(
  tx: Tx,
  u: UnidadeDoBotNoBanco,
  agora: Date,
  appUrl: string,
  extra: Pick<ContextoConversa, 'cliente'> & Partial<ContextoConversa> = { cliente: null },
): Promise<ContextoConversa> {
  const s = await situacaoDaUnidade(tx, u, agora, appUrl);
  const servicos = await tx.servico.findMany({
    where: { ativo: true },
    orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
  });
  const conta = await tx.conta.findFirst({ select: { nome: true } });
  const hoje = dataLocal(agora);
  const precos: { nome: string; valor: number }[] = [];
  for (const sv of servicos) {
    const valor = await precoServicoVigente(tx, sv.id, u.id, hoje);
    if (valor !== undefined) precos.push({ nome: sv.nome, valor });
  }
  return {
    agora,
    barbearia: conta?.nome ?? u.nome,
    unidade: u.nome,
    endereco: u.endereco,
    horario: s.descricao,
    dentroDoHorario: s.aberto,
    link: s.link,
    precos,
    ...extra,
  };
}

// ─── Conexão ──────────────────────────────────────────────────────────────

/** Nome da instância no provedor: um por unidade, sem dado pessoal. */
export const instanciaDaUnidade = (unidadeId: string) => `pf-${unidadeId}`;

/**
 * Webhook chega só com a instância: descobre a conta e a unidade. A política
 * webhook_por_instancia libera só aquela linha de bot_conexao.
 */
export function conexaoDaInstancia(prisma: PrismaClient, instancia: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.instancia_bot', ${instancia}, true)`;
    return tx.botConexao.findUnique({
      where: { instancia },
      select: { contaId: true, unidadeId: true, instancia: true },
    });
  });
}

/**
 * Estado novo da conexão (do webhook ou da consulta ao provedor). Caiu sozinha = estava
 * conectada e ficou desconectada sem o dono pedir (quem desconecta pelo painel grava antes).
 * "Conectando" logo depois de conectado é o provedor se reconectando: não muda nada.
 */
export async function registrarEstadoConexao(
  tx: Tx,
  unidadeId: string,
  novo: { status: StatusConexaoWhatsapp; numero: string | null },
  agora = new Date(),
) {
  const atual = await tx.botConexao.findUnique({ where: { unidadeId } });
  if (!atual) return null;
  if (atual.status === 'conectado' && novo.status === 'aguardando_qr') return atual;
  const caiu = atual.status === 'conectado' && novo.status === 'desconectado';
  return tx.botConexao.update({
    where: { unidadeId },
    data: {
      status: novo.status,
      numero: novo.numero ?? atual.numero,
      caiuEm: novo.status === 'conectado' ? null : caiu ? agora : atual.caiuEm,
    },
  });
}

// ─── Agendamento pela conversa ────────────────────────────────────────────

const venceu = (s: SessaoBot, agora: Date) =>
  agora.getTime() - Date.parse(s.ultimaEm) > EXPIRACAO_SESSAO_MIN * 60_000;

/**
 * O menu (motor puro) mais o agendamento passo a passo. Com um agendamento em andamento, a
 * resposta vai para ele, salvo SAIR/RECEBER e palavras-chave ("atendente", "menu"), que
 * largam o agendamento. "Agendar" no menu começa o passo a passo.
 */
export async function responderComAgenda(
  tx: Tx,
  d: {
    menu: MenuBot;
    mensagens: MensagensBot;
    sessao: SessaoBot | null;
    entrada: string;
    ctx: ContextoConversa;
    dados: DadosDaConversa;
  },
): Promise<ResultadoConversa> {
  const { agenda, ...semAgenda } = d.sessao ?? ({} as SessaoBot);
  const base: SessaoBot | null = d.sessao ? semAgenda : null;
  const texto = normalizar(d.entrada);
  const emAndamento =
    !!agenda &&
    !!d.sessao &&
    !d.sessao.pesquisa &&
    !d.sessao.comAtendente &&
    !venceu(d.sessao, d.dados.agora) &&
    texto !== 'sair' &&
    texto !== 'receber' &&
    !(lerNumeros(d.entrada).length === 0 && grupoDaPalavraChave(d.menu, d.entrada));

  if (emAndamento) {
    const p = await passoDaAgenda(tx, agenda, d.entrada, d.dados);
    const sessao: SessaoBot = {
      ...base!,
      ultimaEm: d.dados.agora.toISOString(),
      erros: 0,
      ...(p.agenda ? { agenda: p.agenda } : {}),
    };
    if (p.voltarAoMenu) {
      // Desistiu ou não deu: o menu de novo ("0" no menu principal mostra as opções).
      const menu = responder(d.menu, d.mensagens, sessao, '0', d.ctx);
      return { ...menu, respostas: [...p.respostas, ...menu.respostas] };
    }
    return {
      respostas: p.respostas,
      sessao,
      acao: p.comandaId ? 'agendar' : null,
      consentimento: null,
      avaliacao: null,
    };
  }

  const r = responder(d.menu, d.mensagens, base, d.entrada, d.ctx);
  if ((r.acao !== 'agendar' && r.acao !== 'meus_horarios') || !d.ctx.agendarPelaConversa) return r;
  const p = await passoDaAgenda(tx, null, null, d.dados, r.acao);
  return {
    ...r,
    respostas: [...r.respostas, ...p.respostas],
    sessao: { ...r.sessao, ...(p.agenda ? { agenda: p.agenda } : {}) },
  };
}

// ─── Mensagem recebida ────────────────────────────────────────────────────

export type ResultadoAtendimento =
  | { tipo: 'sem_conexao' }
  | { tipo: 'repetida' }
  | {
      tipo: 'respondida';
      contaId: string;
      unidadeId: string;
      instancia: string;
      clienteId: string;
      clienteNovo: boolean;
      /** Respostas gravadas como pendentes, na ordem de envio. */
      saidas: string[];
      acao: string | null;
      consentimento: boolean | null;
    };

const NOME_PADRAO_CLIENTE = 'Cliente do WhatsApp';

const repetida = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * Uma mensagem do cliente: acha (ou cadastra) o cliente pelo telefone, roda o menu
 * publicado, guarda a sessão e a escolha de avisos e grava as respostas para enviar.
 * A mesma mensagem entregue duas vezes (mesmo id) é descartada.
 */
export async function atenderMensagem(
  prisma: PrismaClient,
  evento: Extract<EventoWhatsapp, { tipo: 'mensagem' }>,
  opcoes: { appUrl: string; agora?: Date },
): Promise<ResultadoAtendimento> {
  const conexao = await conexaoDaInstancia(prisma, evento.instancia);
  if (!conexao) return { tipo: 'sem_conexao' };
  const agora = opcoes.agora ?? new Date();
  const { contaId, unidadeId } = conexao;

  try {
    return await naConta(
      prisma,
      contaId,
      async (tx) => {
        const ja = await tx.mensagem.findUnique({
          where: { unidadeId_idExterno: { unidadeId, idExterno: evento.idExterno } },
          select: { id: true },
        });
        if (ja) return { tipo: 'repetida' } as const;

        const variantes = variantesTelefone(evento.telefone);
        const telefone = variantes[0]!;
        let cliente = await tx.cliente.findFirst({
          where: { telefone: { in: variantes } },
          orderBy: { criadoEm: 'asc' },
        });
        const clienteNovo = !cliente;
        cliente ??= await tx.cliente.create({
          data: {
            nome: evento.nome ?? NOME_PADRAO_CLIENTE,
            telefone,
            unidadeOrigemId: unidadeId,
            origemLead: 'bot',
          },
        });

        const conversouAntes = await tx.mensagem.findFirst({
          where: { telefone: { in: variantes }, direcao: 'entrada' },
          select: { id: true },
        });
        await tx.mensagem.create({
          data: {
            unidadeId,
            clienteId: cliente.id,
            telefone: evento.telefone,
            direcao: 'entrada',
            texto: evento.texto,
            status: 'recebida',
            idExterno: evento.idExterno,
            criadoEm: new Date(evento.recebidaEm),
          },
        });

        const u = await unidadeDoBot(tx, unidadeId);
        if (!u) return { tipo: 'sem_conexao' } as const;
        const salva = await tx.botSessao.findUnique({
          where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
        });
        const ctx = await contextoDaConversa(tx, u, agora, opcoes.appUrl, {
          // Só cumprimenta pelo nome quem a barbearia já conhecia.
          cliente: clienteNovo ? null : cliente.nome,
          pedirConsentimento: cliente.consentimentoEm === null && !conversouAntes,
          agendarPelaConversa: await podeAgendarPelaConversa(tx, unidadeId, dataLocal(agora)),
        });
        const menu = lerMenu((await menuPublicado(tx)).menu);
        // Pesquisa vencida ou já cancelada sai da sessão antes de responder.
        const sessaoSalva = await pesquisaValida(
          tx,
          (salva?.sessao as unknown as SessaoBot | undefined) ?? null,
          agora,
        );
        const r = await responderComAgenda(tx, {
          menu,
          mensagens: await mensagensDoBot(tx),
          sessao: sessaoSalva,
          entrada: evento.texto,
          ctx,
          dados: {
            unidadeId,
            clienteId: cliente.id,
            barbearia: ctx.barbearia,
            link: ctx.link,
            agora,
          },
        });
        if (r.avaliacao) await gravarRespostaPesquisa(tx, r.avaliacao, agora);

        // Pediu atendente agora: entra na fila da tela Conversas; o bot voltou: sai dela.
        const atendenteDesde = r.sessao.comAtendente ? (salva?.atendenteDesde ?? agora) : null;
        await tx.botSessao.upsert({
          where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
          create: {
            unidadeId,
            telefone: evento.telefone,
            clienteId: cliente.id,
            sessao: json(r.sessao),
            atendenteDesde,
          },
          update: { clienteId: cliente.id, sessao: json(r.sessao), atendenteDesde },
        });
        if (r.consentimento !== null) {
          await tx.cliente.update({
            where: { id: cliente.id },
            data: { consentimentoMsg: r.consentimento, consentimentoEm: agora },
          });
        }
        const saidas: string[] = [];
        for (const texto of r.respostas) {
          const m = await tx.mensagem.create({
            data: {
              unidadeId,
              clienteId: cliente.id,
              telefone: evento.telefone,
              direcao: 'saida',
              texto,
              status: 'pendente',
            },
            select: { id: true },
          });
          saidas.push(m.id);
        }
        return {
          tipo: 'respondida',
          contaId,
          unidadeId,
          instancia: conexao.instancia,
          clienteId: cliente.id,
          clienteNovo,
          saidas,
          acao: r.acao,
          consentimento: r.consentimento,
        } as const;
      },
      // O agendamento pela conversa consulta a agenda de vários dias numa mensagem só.
      { timeout: 15_000 },
    );
  } catch (e) {
    // Duas entregas da mesma mensagem ao mesmo tempo: a segunda bate no índice único.
    if (repetida(e)) return { tipo: 'repetida' };
    throw e;
  }
}

// ─── Envio ────────────────────────────────────────────────────────────────

export type PreparoEnvio =
  { tipo: 'enviar'; instancia: string; telefone: string; texto: string } | { tipo: 'pular' };

/**
 * Antes de enviar: só mensagem pendente, só para quem já falou com esta unidade
 * (nunca para um número que não escreveu antes) e só com o número conectado.
 */
export async function prepararEnvio(
  prisma: PrismaClient,
  contaId: string,
  mensagemId: string,
): Promise<PreparoEnvio> {
  return naConta(prisma, contaId, async (tx) => {
    const m = await tx.mensagem.findUnique({
      where: { id: mensagemId },
      include: { unidade: { include: { botConexao: true } } },
    });
    if (!m || m.direcao !== 'saida' || m.status !== 'pendente') return { tipo: 'pular' } as const;
    const descartar = async (erro: string) => {
      await tx.mensagem.update({ where: { id: m.id }, data: { status: 'descartada', erro } });
      return { tipo: 'pular' } as const;
    };
    const falou = await tx.mensagem.findFirst({
      where: {
        unidadeId: m.unidadeId,
        telefone: { in: variantesTelefone(m.telefone) },
        direcao: 'entrada',
      },
      select: { id: true },
    });
    if (!falou) return descartar('O número nunca falou com a barbearia.');
    const conexao = m.unidade.botConexao;
    if (!conexao || conexao.status !== 'conectado')
      return descartar('O WhatsApp da unidade não está conectado.');
    return {
      tipo: 'enviar',
      instancia: conexao.instancia,
      telefone: m.telefone,
      texto: m.texto,
    } as const;
  });
}

export async function registrarEnvio(
  prisma: PrismaClient,
  contaId: string,
  mensagemId: string,
  r: { ok: true; idExterno: string | null } | { ok: false; erro: string },
): Promise<void> {
  await naConta(prisma, contaId, (tx) =>
    tx.mensagem.update({
      where: { id: mensagemId },
      data: r.ok
        ? { status: 'enviada', idExterno: r.idExterno, enviadaEm: new Date(), erro: null }
        : { status: 'falhou', erro: r.erro.slice(0, 500) },
    }),
  );
}

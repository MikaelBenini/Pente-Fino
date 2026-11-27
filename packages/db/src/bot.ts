// O bot do WhatsApp no banco: o que o motor precisa saber da unidade, o atendimento de uma
// mensagem recebida e o envio das respostas. Usado pela API (simulador, webhook) e pelo worker.
import { temNaConta } from './assinatura.js';
import {
  dataLocal,
  dataParaBanco,
  dentroDoHorario,
  proximaAbertura,
  descreverHorario,
  EXPIRACAO_SESSAO_MIN,
  grupoDaPalavraChave,
  lerNumeros,
  lerRegrasAgendamento,
  MENU_BOT_PADRAO,
  mensagensBotPadrao,
  menuBotPadrao,
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
  NOTA_BAIXA_ATE,
  type FimDaEsperaDoAtendente,
  TEXTO_AGENDAR_POR_AQUI,
  type CanalAgendamento,
  type TrabalhoNotificacao,
  preencher,
  mereceConviteGoogle,
  type ClubeNoBot,
  type DataISO,
  type VagaLiberada,
  caminhoAssinarClube,
  avisoContatoAnuncio,
  formatarTelefone,
  emHorarioDeSilencio,
  enderecoCompleto,
  linkMapaDaUnidade,
  numeroWhatsappDaUnidade,
  PALAVRAS_VOLTAR_AO_BOT,
  proximoHorarioDeEnvio,
  RESPOSTA_ATE_MIN,
  VALIDADE_SEGURADA_H,
  avisoNumeroProtegido,
  ehProativa,
  JANELA_FALHAS_MIN,
  JANELA_REPETIDA_MIN,
  limiteProativasDoDia,
  fimDoAquecimento,
  type ProtecaoDoNumero,
  pausaPorRisco,
  tempoDigitandoMs,
  inicioDaJanelaDoLoop,
  pareceLoop,
  situacaoDaConversa,
  type OrigemConversa,
  lerFluxoAnuncio,
  ORIGEM_ANUNCIO,
  lerFuncionamento,
  lerPedidoNatural,
  respostaSimNao,
  responderAnuncio,
  type ChegadaDoAnuncio,
  type FluxoAnuncio,
  DIAS_SEM_REPETIR_ANUNCIO,
  linkDeAgendamento,
} from '@pente-fino/shared';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';
import {
  agendarPeloPedido,
  mudarHorarioDoLembrete,
  passoDaAgenda,
  podeAgendarPelaConversa,
  servicosParaAgendar,
  type DadosDaConversa,
  type PassoDaAgenda,
} from './agendar-bot.js';
import { gravarAviso } from './central-avisos.js';
import { vocabularioDaConta } from './vocabulario.js';
import { atenderEquipe, avisarEquipeSobreHorario } from './equipe-whatsapp.js';
import { notificacaoDoHorario } from './push.js';
import { responderOferta } from './espera.js';
import { adesaoDoCliente, detalharAdesao } from './clube.js';
import { confirmarPeloCliente } from './lembretes.js';
import { gravarRespostaPesquisa, pesquisaValida } from './avaliacao.js';
import { precoServicoVigente } from './vigencia.js';

type Tx = Prisma.TransactionClient;

export const json = (v: unknown) => structuredClone(v) as Prisma.InputJsonValue;

/** O WhatsApp da unidade nos botões do cliente: o do bot conectado, senão o telefone. */
export async function whatsappDaUnidade(
  tx: Tx,
  unidade: { id: string; telefone: string | null },
): Promise<string | null> {
  const conexao = await tx.botConexao.findUnique({
    where: { unidadeId: unidade.id },
    select: { status: true, numero: true },
  });
  return numeroWhatsappDaUnidade({ conexao, telefone: unidade.telefone });
}

/**
 * De onde vem a próxima mudança de estado da conversa (testes de 19/11/2026): o gatilho
 * bot_sessao_estado grava no histórico com esta origem e, quando houver, quem fez.
 */
export async function origemDaConversa(
  tx: Tx,
  origem: OrigemConversa,
  autorId: string | null = null,
): Promise<void> {
  await tx.$queryRaw`SELECT set_config('app.origem_conversa', ${origem}, true), set_config('app.autor_conversa', ${autorId ?? ''}, true)`;
}

const lerCanal = (c: string | null): CanalAgendamento | null =>
  c === 'conversa' || c === 'site' ? c : null;

/** O que está gravado passa de novo pelo esquema: menu estragado não chega ao motor. */
export function lerMenu(valor: unknown): MenuBot {
  const r = menuBotSchema.safeParse(valor);
  return r.success ? r.data : structuredClone(MENU_BOT_PADRAO);
}

/**
 * Menu publicado. Com a unidade (decisão do dono em 16/11/2026): o dela, se ela personalizou;
 * senão, o padrão da barbearia. Conta antiga sem menu recebe o padrão publicado na hora.
 */
export async function menuPublicado(tx: Tx, unidadeId: string | null = null) {
  if (unidadeId) {
    const daUnidade = await tx.botMenu.findFirst({ where: { status: 'publicado', unidadeId } });
    if (daUnidade) return daUnidade;
  }
  const atual = await tx.botMenu.findFirst({ where: { status: 'publicado', unidadeId: null } });
  if (atual) return atual;
  return tx.botMenu.create({
    data: {
      status: 'publicado',
      menu: json(menuBotPadrao(await vocabularioDaConta(tx))),
      publicadoEm: new Date(),
    },
  });
}

/**
 * Mensagens prontas: o padrão do sistema, por cima as da barbearia e, com a unidade, as que ela
 * personalizou (decisão do dono em 16/11/2026).
 */
export async function mensagensDoBot(
  tx: Tx,
  unidadeId: string | null = null,
): Promise<MensagensBot> {
  const salvas = await tx.modeloMensagem.findMany({
    where: {
      unidadeId: unidadeId ? { in: [unidadeId] } : null,
      ativo: true,
      tipo: { in: [...TIPOS_MENSAGEM_BOT] },
    },
  });
  const daConta = unidadeId
    ? await tx.modeloMensagem.findMany({
        where: { unidadeId: null, ativo: true, tipo: { in: [...TIPOS_MENSAGEM_BOT] } },
      })
    : [];
  const m: MensagensBot = mensagensBotPadrao(await vocabularioDaConta(tx));
  // A da unidade vem por último: vence a da barbearia.
  for (const s of [...daConta, ...salvas]) m[s.tipo as keyof MensagensBot] = s.texto;
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
  // O horário de funcionamento da unidade vem antes do expediente dos barbeiros (pedido do dono
  // em 16/11/2026: sem barbeiro cadastrado, aparecia "a combinar").
  const funcionamento = lerFuncionamento(u.horarioFuncionamento);
  const vale = horario ?? (funcionamento.length ? funcionamento : expediente);
  const fechadoHoje = await tx.calendarioUnidade.findFirst({
    where: { unidadeId: u.id, data: dataParaBanco(dataLocal(agora)), trabalha: false },
  });
  return {
    expediente,
    horario,
    /** O horário que vale para o bot (o dele, o da unidade ou o da equipe). */
    vale,
    descricao: descreverHorario(vale),
    // Sem horário conhecido (equipe sem expediente cadastrado), não diz que está fechado.
    aberto: !fechadoHoje && (vale.length === 0 || dentroDoHorario(vale, agora)),
    link: u.agendamentoPublico && u.slug ? linkDeAgendamento(appUrl, u.slug) : null,
  };
}

/** Mensagens de anúncio: as da unidade, se ela personalizou; senão, as da conta. */
export async function fluxoAnuncioDaUnidade(tx: Tx, u: { fluxoAnuncio: Prisma.JsonValue | null }) {
  if (u.fluxoAnuncio !== null) return lerFluxoAnuncio(u.fluxoAnuncio);
  return lerFluxoAnuncio(
    (await tx.conta.findFirst({ select: { fluxoAnuncio: true } }))?.fluxoAnuncio,
  );
}

/** O que o motor precisa saber da unidade para responder. */
export async function contextoDaConversa(
  tx: Tx,
  u: UnidadeDoBotNoBanco,
  agora: Date,
  appUrl: string,
  extra: Pick<ContextoConversa, 'cliente'> & Partial<ContextoConversa> & { clienteId?: string } = {
    cliente: null,
  },
): Promise<ContextoConversa> {
  const { clienteId, ...resto } = extra;
  const s = await situacaoDaUnidade(tx, u, agora, appUrl);
  const servicos = await tx.servico.findMany({
    where: { ativo: true, unidadeIds: { has: u.id } },
    orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
  });
  const conta = await tx.conta.findFirst({ select: { nome: true } });
  const hoje = dataLocal(agora);
  const precos: { nome: string; valor: number; duracaoMin: number }[] = [];
  for (const sv of servicos) {
    const valor = await precoServicoVigente(tx, sv.id, u.id, hoje);
    if (valor !== undefined) precos.push({ nome: sv.nome, valor, duracaoMin: sv.duracaoMin });
  }
  return {
    agora,
    barbearia: conta?.nome ?? u.nome,
    unidade: u.nome,
    // Com cidade e UF: o mapa não pode cair numa rua igual de outra cidade (testes de 19/11).
    endereco: enderecoCompleto(u),
    mapa: linkMapaDaUnidade(u),
    horario: s.descricao,
    dentroDoHorario: s.aberto,
    link: s.link,
    precos,
    // Quando a recepção volta, para o "falar com atendente" fora do horário.
    proximaAbertura: s.aberto ? null : proximaAbertura(s.vale, agora),
    clube: await clubeNoBot(tx, u, clienteId, hoje as DataISO, appUrl),
    ...resto,
  };
}

/** Opção "Clube" do bot: planos ativos da unidade e o plano de quem conversa. */
async function clubeNoBot(
  tx: Tx,
  u: { id: string; slug: string | null },
  clienteId: string | undefined,
  hoje: DataISO,
  appUrl: string,
): Promise<ClubeNoBot> {
  const unidadeId = u.id;
  // Clube online ligado: o bot manda o link para o cliente assinar sozinho.
  const online =
    u.slug && appUrl ? await tx.recebimentoOnline.findFirst({ select: { id: true } }) : null;
  const planos = await tx.itemClube.findMany({
    where: { unidadeId, ativo: true },
    orderBy: { valor: 'asc' },
    include: { servicos: { include: { servico: { select: { nome: true } } } } },
  });
  const a = clienteId ? await adesaoDoCliente(tx, clienteId) : null;
  const d = a && a.itemClube.unidadeId === unidadeId ? await detalharAdesao(tx, a, hoje) : null;
  return {
    planos: planos.map((p) => ({
      nome: p.nome,
      valor: p.valor,
      inclusos: p.servicos
        .map((s) =>
          s.quantidade === null
            ? `${s.servico.nome} à vontade`
            : `${s.quantidade} ${s.servico.nome.toLowerCase()}`,
        )
        .join(', '),
    })),
    assinatura: d
      ? {
          plano: d.plano.nome,
          vencimento: d.vencimento,
          emDia: d.situacao === 'ativa',
          restantes: d.restantes.map((r) => ({ servico: r.servico, restam: r.restam })),
        }
      : null,
    linkAssinar: online && u.slug ? `${appUrl}${caminhoAssinarClube(u.slug)}` : null,
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
  // Aquecimento (protecao-whatsapp.ts): conta de quando este número foi conectado. Reconectar
  // o mesmo número mantém a contagem; número novo começa de novo, sem a pausa do anterior.
  const numeroNovo =
    novo.status === 'conectado' &&
    (atual.conectadoEm === null || (!!novo.numero && novo.numero !== atual.numero));
  return tx.botConexao.update({
    where: { unidadeId },
    data: {
      status: novo.status,
      numero: novo.numero ?? atual.numero,
      caiuEm: novo.status === 'conectado' ? null : caiu ? agora : atual.caiuEm,
      ...(numeroNovo ? { conectadoEm: agora, pausadoAte: null, pausaMotivo: null } : {}),
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
    /** Fluxo de quem vem de anúncio e se esta mensagem veio de um (pedido do dono em 16/11). */
    anuncio?: { fluxo: FluxoAnuncio; chegada: ChegadaDoAnuncio | boolean };
  },
): Promise<
  ResultadoConversa & {
    /** Começou agora a conversa automática do anúncio (marca a conversa). */
    anuncioComecou?: boolean;
    agendamento?: { id: string; inicio: string };
    mudanca?: PassoDaAgenda['mudanca'];
    /** Lista de espera: "já foi preenchido" para os outros que receberam a vaga. */
    outrasSaidas?: string[];
    /** Antecipou pela lista: o horário antigo vagou. */
    vaga?: VagaLiberada;
  }
> {
  // Quem vem de anúncio tem conversa própria, antes do menu (pedido do dono em 16/11).
  if (d.anuncio && !d.sessao?.pesquisa) {
    const a = responderAnuncio(
      d.anuncio.fluxo,
      d.sessao,
      d.entrada,
      d.dados.agora,
      d.anuncio.chegada,
      d.ctx.cliente,
    );
    if (a)
      return {
        respostas: a.respostas,
        sessao: a.sessao,
        acao: a.paraEquipe ? 'falar_com_atendente' : null,
        consentimento: null,
        avaliacao: null,
        anuncioComecou: a.comecou,
      };
  }

  const { agenda, lembrete, oferta, ...resto } = d.sessao ?? ({} as SessaoBot);
  const base: SessaoBot | null = d.sessao ? resto : null;
  const texto = normalizar(d.entrada);
  const agoraIso = d.dados.agora.toISOString();

  // Resposta à oferta da lista de espera: 1 leva o horário, 2 recusa (continua na lista).
  if (oferta && base && !base.comAtendente && !d.dados.simulacao) {
    const numeros = lerNumeros(d.entrada);
    const r = await responderOferta(tx, {
      esperaId: oferta.esperaId,
      entrada: numeros.length === 1 ? numeros[0]! : null,
      agora: d.dados.agora,
    });
    if (r)
      return {
        respostas: r.respostas,
        sessao: { ...base, ultimaEm: agoraIso, erros: 0 },
        acao: null,
        consentimento: null,
        avaliacao: null,
        outrasSaidas: r.outrasSaidas,
        ...(r.agendamento ? { agendamento: r.agendamento } : {}),
        ...(r.mudanca ? { mudanca: r.mudanca } : {}),
        ...(r.vaga ? { vaga: r.vaga } : {}),
      };
  }

  // Resposta ao lembrete: 1 confirma; no de 24 h, 2 remarca e 3 cancela. Outra coisa segue
  // a conversa normal (e o lembrete sai da sessão).
  if (lembrete && base && !base.comAtendente) {
    const numeros = lerNumeros(d.entrada);
    // "sim" ou "confirmo" também confirmam o lembrete (cenários de 19/11/2026).
    const um = numeros.length === 1 ? numeros[0]! : respostaSimNao(texto) === 1 ? 1 : null;
    const sessao: SessaoBot = { ...base, ultimaEm: agoraIso, erros: 0 };
    if (um === 1) {
      const ok = await confirmarPeloCliente(tx, lembrete.agendamentoId, d.dados.agora);
      return {
        respostas: [
          ok
            ? 'Confirmado! ✅ Te esperamos.'
            : 'Esse horário não está mais marcado. Para marcar, responda AGENDAR.',
        ],
        sessao,
        acao: null,
        consentimento: null,
        avaliacao: null,
      };
    }
    if ((um === 2 || um === 3) && lembrete.tipo === '24h') {
      const p = await mudarHorarioDoLembrete(
        tx,
        lembrete.agendamentoId,
        um === 2 ? 'remarcar' : 'cancelar',
        d.dados,
      );
      return {
        respostas: p.respostas,
        sessao: { ...sessao, ...(p.agenda ? { agenda: p.agenda } : {}) },
        acao: null,
        consentimento: null,
        avaliacao: null,
      };
    }
  }
  const emAndamento =
    !!agenda &&
    !!d.sessao &&
    !d.sessao.pesquisa &&
    !d.sessao.comAtendente &&
    !venceu(d.sessao, d.dados.agora) &&
    texto !== 'sair' &&
    texto !== 'receber' &&
    // VOLTAR e MENU são do passo a passo (lista do dono em 16/11), mesmo sendo palavras-chave.
    (['voltar', 'menu', 'inicio'].includes(texto) ||
      !(lerNumeros(d.entrada).length === 0 && grupoDaPalavraChave(d.menu, d.entrada)));

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
      ...(p.agendamento ? { agendamento: p.agendamento } : {}),
      ...(p.mudanca ? { mudanca: p.mudanca } : {}),
      ...(p.vaga ? { vaga: p.vaga } : {}),
    };
  }

  // "Quero cortar amanhã às 15h": serviço, dia e hora na frase (lista do dono em 16/11).
  if (d.ctx.agendarPelaConversa && !base?.comAtendente && !base?.pesquisa) {
    const hoje = dataLocal(d.dados.agora);
    const local = new Date(d.dados.agora.getTime() - 3 * 3_600_000);
    const pedido = lerPedidoNatural(
      d.entrada,
      await servicosParaAgendar(tx, d.dados.unidadeId, hoje),
      hoje,
      local.getUTCHours() * 60 + local.getUTCMinutes(),
    );
    if (pedido) {
      const p = await agendarPeloPedido(tx, pedido, d.dados);
      const sessao: SessaoBot = {
        ...(base ?? {}),
        caminho: [],
        comAtendente: false,
        ultimaEm: agoraIso,
        erros: 0,
        ...(p.agenda ? { agenda: p.agenda } : {}),
      };
      if (p.voltarAoMenu) {
        const menu = responder(d.menu, d.mensagens, sessao, '0', d.ctx);
        return { ...menu, respostas: [...p.respostas, ...menu.respostas] };
      }
      return {
        respostas: p.respostas,
        sessao,
        acao: 'agendar',
        consentimento: null,
        avaliacao: null,
      };
    }
  }

  // "Prefere pelo WhatsApp?" do site: começa o agendamento já pela conversa.
  const porAqui = texto === normalizar(TEXTO_AGENDAR_POR_AQUI);
  const r = responder(d.menu, d.mensagens, base, porAqui ? 'agendar' : d.entrada, d.ctx);
  // Pediu atendente no meio do agendamento: o que já escolheu fica para a equipe ver.
  if (r.acao === 'falar_com_atendente' && agenda) r.sessao.pedido = agenda;
  if ((r.acao !== 'agendar' && r.acao !== 'meus_horarios') || !d.ctx.agendarPelaConversa) return r;
  if (porAqui && d.dados.clienteId && !d.dados.simulacao)
    await tx.cliente.update({
      where: { id: d.dados.clienteId },
      data: { canalPreferido: 'conversa' },
    });
  const p = await passoDaAgenda(
    tx,
    null,
    null,
    porAqui ? { ...d.dados, canalPreferido: 'conversa' } : d.dados,
    r.acao,
  );
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
  | { tipo: 'sem_bot' }
  // Outro número conectado ao sistema (unidade sua ou de outra barbearia): o bot não responde.
  | { tipo: 'numero_do_sistema' }
  // Muitas respostas seguidas para o mesmo número: parou e passou para a equipe.
  | { tipo: 'loop' }
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
      /** Marcou ou remarcou pela conversa: o worker agenda os lembretes. */
      agendamento?: { id: string; inicio: string };
      /** Alguém da equipe ligou o assistente agora: o worker agenda a agenda e o resumo do dia. */
      assistenteAtivado?: string;
      /** Nota 1 ou 2 na pesquisa: o worker agenda o aviso para dono e gestor. */
      notaBaixa?: { avaliacaoId: string; concluida: boolean };
      /** Começou a esperar atendente (ISO): o worker agenda o fim da espera. */
      esperaAtendente?: string;
      /** Push do PWA para o profissional cuja agenda mudou pela conversa. */
      notificacao?: TrabalhoNotificacao;
      /** Horário que vagou (cancelou ou antecipou pela conversa): o worker oferece para a lista. */
      vaga?: VagaLiberada;
      /** Avisos da central (contato novo de anúncio): o worker põe as notificações na fila. */
      notificacoes?: TrabalhoNotificacao[];
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

        // Alguém da equipe (assistente): responde e nunca vira cliente.
        const equipe = await atenderEquipe(tx, {
          unidadeId,
          telefone: evento.telefone,
          texto: evento.texto,
          agora,
        });
        if (equipe) {
          await tx.mensagem.create({
            data: {
              unidadeId,
              telefone: evento.telefone,
              direcao: 'entrada',
              texto: evento.texto,
              status: 'recebida',
              idExterno: evento.idExterno,
              criadoEm: new Date(evento.recebidaEm),
            },
          });
          const saidas: string[] = [];
          for (const texto of equipe.respostas) {
            const m = await tx.mensagem.create({
              data: {
                unidadeId,
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
            clienteId: '',
            clienteNovo: false,
            saidas,
            acao: null,
            consentimento: null,
            ...(equipe.ativado ? { assistenteAtivado: equipe.ativado } : {}),
          } as const;
        }

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
            // Veio pelo anúncio: a origem fica "anuncio" (relatório de clientes de anúncio).
            origemLead: evento.anuncio ? ORIGEM_ANUNCIO : 'bot',
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
        // Sem as Automações (Agenda ou Básico sem contratar), o WhatsApp só manda os avisos do
        // agendamento: a mensagem fica em Conversas e o bot não responde sozinho.
        if (!(await temNaConta(tx, 'bot'))) return { tipo: 'sem_bot' } as const;
        // Número de outra unidade (ou de outra barbearia do sistema): a mensagem fica em
        // Conversas, mas o bot não responde; dois bots se respondendo viram um loop.
        const [doSistema] = await tx.$queryRaw<{ sim: boolean }[]>`
          SELECT numero_conectado_ao_sistema(${variantes}::text[]) AS sim`;
        if (doSistema?.sim) return { tipo: 'numero_do_sistema' } as const;
        const salva = await tx.botSessao.findUnique({
          where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
        });
        // Trava contra loop: muitas respostas do bot E muitas mensagens do número em poucos
        // minutos, contando só depois que o bot voltou (testes de 19/11/2026: a contagem antiga
        // pegava o teste de uma pessoa logo depois de "Devolver ao bot"). Para, e a conversa vai
        // para a equipe (fila de Conversas), com o motivo no histórico.
        const salvaSessao = (salva?.sessao as unknown as SessaoBot | undefined) ?? null;
        const desde = inicioDaJanelaDoLoop(agora, salvaSessao?.botDesde);
        const [respostasDoBot, entradasRecentes] = await Promise.all([
          tx.mensagem.count({
            where: {
              unidadeId,
              telefone: { in: variantes },
              direcao: 'saida',
              autorId: null,
              peloCelular: false,
              criadoEm: { gte: desde },
            },
          }),
          tx.mensagem.count({
            where: {
              unidadeId,
              telefone: { in: variantes },
              direcao: 'entrada',
              criadoEm: { gte: desde },
            },
          }),
        ]);
        if (pareceLoop(respostasDoBot, entradasRecentes)) {
          const antes = salvaSessao;
          await origemDaConversa(tx, 'trava_loop');
          const sessao: SessaoBot = {
            caminho: [],
            erros: 0,
            ultimaEm: agora.toISOString(),
            ...(antes ?? {}),
            comAtendente: true,
          };
          await tx.botSessao.upsert({
            where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
            create: {
              unidadeId,
              telefone: evento.telefone,
              clienteId: cliente.id,
              sessao: json(sessao),
              atendenteDesde: agora,
            },
            update: { sessao: json(sessao), atendenteDesde: salva?.atendenteDesde ?? agora },
          });
          return { tipo: 'loop' } as const;
        }
        const ctx = await contextoDaConversa(tx, u, agora, opcoes.appUrl, {
          // Só cumprimenta pelo nome quem a barbearia já conhecia.
          cliente: clienteNovo ? null : cliente.nome,
          clienteId: cliente.id,
          pedirConsentimento: cliente.consentimentoEm === null && !conversouAntes,
          // Áudio, figurinha ou foto sem texto: o motor não responde "não entendi".
          conteudo: evento.conteudo ?? (evento.texto.trim() ? 'texto' : 'midia'),
          agendarPelaConversa: await podeAgendarPelaConversa(tx, unidadeId, dataLocal(agora)),
        });
        const menu = lerMenu((await menuPublicado(tx, unidadeId)).menu);
        // Pesquisa vencida ou já cancelada sai da sessão antes de responder.
        const sessaoSalva = await pesquisaValida(
          tx,
          (salva?.sessao as unknown as SessaoBot | undefined) ?? null,
          agora,
        );
        // Esperando atendente e ninguém assumiu: MENU volta ao bot (a transferência avisa).
        const voltouPeloCliente =
          !!salva?.atendenteDesde &&
          sessaoSalva?.comAtendente === true &&
          (PALAVRAS_VOLTAR_AO_BOT as readonly string[]).includes(normalizar(evento.texto));
        const r = await responderComAgenda(tx, {
          menu,
          mensagens: await mensagensDoBot(tx, unidadeId),
          sessao: voltouPeloCliente
            ? { ...sessaoSalva!, comAtendente: false, caminho: [], erros: 0 }
            : sessaoSalva,
          entrada: evento.texto,
          ctx,
          dados: {
            unidadeId,
            clienteId: cliente.id,
            barbearia: ctx.barbearia,
            link: ctx.link,
            canalPreferido: lerCanal(cliente.canalPreferido),
            appUrl: opcoes.appUrl,
            agora,
            regras: lerRegrasAgendamento(u.regrasAgendamento),
          },
          anuncio: {
            fluxo: await fluxoAnuncioDaUnidade(tx, u),
            chegada: {
              doAnuncio: !!evento.anuncio,
              primeiroContato: !conversouAntes,
              anuncioRecente:
                !!salva?.anuncioEm &&
                agora.getTime() - salva.anuncioEm.getTime() < DIAS_SEM_REPETIR_ANUNCIO * 86_400_000,
            },
          },
        });
        if (r.avaliacao) await gravarRespostaPesquisa(tx, r.avaliacao, agora);
        // Fim da pesquisa com nota 5 e link do Google na unidade: convite para avaliar lá.
        if (r.avaliacao?.concluida && u.linkAvaliacaoGoogle) {
          const av = await tx.avaliacao.findUnique({
            where: { id: r.avaliacao.avaliacaoId },
            select: { notaAtendimento: true, notaBarbearia: true },
          });
          if (av && mereceConviteGoogle(av.notaAtendimento, av.notaBarbearia)) {
            const mensagens = await mensagensDoBot(tx, unidadeId);
            r.respostas.push(
              preencher(mensagens.convite_google, {
                barbearia: ctx.barbearia,
                unidade: u.nome,
                google: u.linkAvaliacaoGoogle,
              }),
            );
          }
        }
        // Nota 1 ou 2 ainda sem aviso: o worker avisa dono e gestor (no fim ou depois da espera).
        const notaBaixa = r.avaliacao
          ? await tx.avaliacao.findFirst({
              where: {
                id: r.avaliacao.avaliacaoId,
                gestaoAvisadaEm: null,
                OR: [
                  { notaAtendimento: { lte: NOTA_BAIXA_ATE } },
                  { notaBarbearia: { lte: NOTA_BAIXA_ATE } },
                ],
              },
              select: { id: true },
            })
          : null;

        // Pediu atendente agora: entra na fila da tela Conversas; o bot voltou: sai dela.
        const atendenteDesde = r.sessao.comAtendente ? (salva?.atendenteDesde ?? agora) : null;
        // Histórico do estado (testes de 19/11/2026): de onde veio a mudança, se houver.
        const antes = situacaoDaConversa(
          salva?.atendenteDesde ?? null,
          sessaoSalva?.comAtendente === true,
        );
        const depois = situacaoDaConversa(atendenteDesde, r.sessao.comAtendente);
        if (antes !== depois) {
          if (depois === 'bot') r.sessao.botDesde = agora.toISOString();
          await origemDaConversa(
            tx,
            depois === 'bot'
              ? voltouPeloCliente
                ? 'cliente_voltou'
                : 'atendimento_venceu'
              : r.sessao.respostasAnuncio && !sessaoSalva?.respostasAnuncio
                ? 'anuncio'
                : 'cliente_pediu',
          );
        }
        // Veio de anúncio (o WhatsApp avisou, ou entrou no fluxo pela frase): a conversa fica marcada.
        const deAnuncio = !!evento.anuncio || !!r.anuncioComecou;
        // Cliente novo que entrou pela frase do anúncio: a origem também é o anúncio.
        if (clienteNovo && r.anuncioComecou && !evento.anuncio)
          await tx.cliente.update({
            where: { id: cliente.id },
            data: { origemLead: ORIGEM_ANUNCIO },
          });
        const anuncio = {
          anuncioEm: deAnuncio ? (salva?.anuncioEm ?? agora) : (salva?.anuncioEm ?? null),
          anuncioTitulo: evento.anuncio?.titulo ?? salva?.anuncioTitulo ?? null,
        };
        const gravada = await tx.botSessao.upsert({
          where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
          create: {
            unidadeId,
            telefone: evento.telefone,
            clienteId: cliente.id,
            sessao: json(r.sessao),
            atendenteDesde,
            ...anuncio,
          },
          update: { clienteId: cliente.id, sessao: json(r.sessao), atendenteDesde, ...anuncio },
        });
        // Primeira vez que este número chega por anúncio: aviso na central (pedido de 16/11/2026).
        const notificacoes =
          deAnuncio && !salva?.anuncioEm && anuncio.anuncioEm
            ? await gravarAviso(
                tx,
                contaId,
                unidadeId,
                avisoContatoAnuncio({
                  sessaoId: gravada.id,
                  desde: anuncio.anuncioEm.toISOString(),
                  cliente: clienteNovo
                    ? (evento.nome ?? formatarTelefone(evento.telefone))
                    : cliente.nome,
                  titulo: anuncio.anuncioTitulo,
                }),
              )
            : [];
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
        // Lista de espera: "já foi preenchido" para os outros (cada mensagem tem o seu número).
        saidas.push(...(r.outrasSaidas ?? []));
        // Mudou a agenda pela conversa: avisa o profissional (se ele ligou o assistente).
        if (r.mudanca) {
          const aviso = await avisarEquipeSobreHorario(
            tx,
            r.mudanca.agendamentoId,
            r.mudanca.tipo,
            agora,
          );
          if (aviso) saidas.push(...aviso.mensagemIds);
        }
        // E no celular (push), para os aparelhos que ele ligou no Perfil.
        const notificacao = r.mudanca
          ? await notificacaoDoHorario(tx, r.mudanca.agendamentoId, r.mudanca.tipo, agora)
          : null;
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
          ...(r.agendamento ? { agendamento: r.agendamento } : {}),
          ...(notificacao ? { notificacao } : {}),
          ...(r.vaga ? { vaga: r.vaga } : {}),
          ...(notificacoes.length ? { notificacoes } : {}),
          ...(notaBaixa
            ? { notaBaixa: { avaliacaoId: notaBaixa.id, concluida: r.avaliacao!.concluida } }
            : {}),
          // Passou a esperar atendente agora: o worker confere em 2 h se alguém respondeu.
          ...(atendenteDesde && !salva?.atendenteDesde
            ? { esperaAtendente: atendenteDesde.toISOString() }
            : {}),
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
  | {
      tipo: 'enviar';
      instancia: string;
      telefone: string;
      texto: string;
      /** Automática para quem não escreveu em 24 h: sai no ritmo das proativas. */
      proativa: boolean;
      /** "Digitando..." antes de enviar (protecao-whatsapp.ts). */
      digitandoMs: number;
    }
  | { tipo: 'pular' }
  /** Automático de madrugada (não é resposta): segura até o horário de envio. */
  | { tipo: 'adiar'; ate: string };

/**
 * Antes de enviar: só mensagem pendente, só para quem já falou com esta unidade
 * (nunca para um número que não escreveu antes) e só com o número conectado.
 */
export async function prepararEnvio(
  prisma: PrismaClient,
  contaId: string,
  mensagemId: string,
  agora: Date = new Date(),
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
    if (!falou) return descartar('O número nunca falou com a unidade.');
    // Número conectado ao sistema (outra unidade, outra barbearia): nada automático vai para ele
    // (pedido do dono em 18/11/2026). A resposta escrita pela equipe no painel continua saindo.
    if (m.autorId === null) {
      const [doSistema] = await tx.$queryRaw<{ sim: boolean }[]>`
        SELECT numero_conectado_ao_sistema(${variantesTelefone(m.telefone)}::text[]) AS sim`;
      if (doSistema?.sim) return descartar('O número é de outra unidade conectada ao sistema.');
    }
    const conexao = m.unidade.botConexao;
    if (!conexao || conexao.status !== 'conectado')
      return descartar('O WhatsApp da unidade não está conectado.');
    // Madrugada (22h às 7h): mensagem automática que não responde a quem acabou de escrever
    // (lembrete, pesquisa, aviso, fim da espera) fica segurada até as 7h; se até lá perder o
    // sentido (mais de 12 h), é descartada (pedido do dono em 20/11/2026).
    if (m.autorId === null && emHorarioDeSilencio(agora)) {
      const acabouDeEscrever = await tx.mensagem.findFirst({
        where: {
          unidadeId: m.unidadeId,
          telefone: { in: variantesTelefone(m.telefone) },
          direcao: 'entrada',
          criadoEm: { gte: new Date(agora.getTime() - RESPOSTA_ATE_MIN * 60_000) },
        },
        select: { id: true },
      });
      if (!acabouDeEscrever) {
        const ate = proximoHorarioDeEnvio(agora);
        if (ate.getTime() - m.criadoEm.getTime() > VALIDADE_SEGURADA_H * 3_600_000)
          return descartar('Automática de madrugada: perdeu o sentido até o horário de envio.');
        return { tipo: 'adiar', ate: ate.toISOString() } as const;
      }
    }
    // Proteção do número (27/11/2026): só a automática passa por aqui; a resposta digitada pela
    // equipe sai como sempre.
    let proativa = false;
    if (m.autorId === null) {
      const telefones = variantesTelefone(m.telefone);
      const repetida = await tx.mensagem.findFirst({
        where: {
          unidadeId: m.unidadeId,
          telefone: { in: telefones },
          direcao: 'saida',
          status: 'enviada',
          texto: m.texto,
          enviadaEm: { gte: new Date(agora.getTime() - JANELA_REPETIDA_MIN * 60_000) },
        },
        select: { id: true },
      });
      if (repetida)
        return descartar(
          `O mesmo texto já foi para este número há menos de ${JANELA_REPETIDA_MIN} minutos.`,
        );
      const ultimaEntrada = await tx.mensagem.findFirst({
        where: { unidadeId: m.unidadeId, telefone: { in: telefones }, direcao: 'entrada' },
        orderBy: { criadoEm: 'desc' },
        select: { criadoEm: true },
      });
      proativa = ehProativa(ultimaEntrada?.criadoEm.getTime() ?? null, agora.getTime());
    }
    if (proativa) {
      // Segura até a hora indicada; se até lá a mensagem perder o sentido, descarta.
      const segurar = (ate: Date, motivo: string) =>
        ate.getTime() - m.criadoEm.getTime() > VALIDADE_SEGURADA_H * 3_600_000
          ? descartar(motivo)
          : ({ tipo: 'adiar', ate: ate.toISOString() } as const);
      if (conexao.pausadoAte && conexao.pausadoAte > agora)
        return segurar(conexao.pausadoAte, 'Automáticas pausadas para proteger o número.');
      const umDiaAtras = new Date(agora.getTime() - 86_400_000);
      const [falhasRecentes, saidas24h, proativas24h] = await Promise.all([
        tx.mensagem.count({
          where: {
            unidadeId: m.unidadeId,
            direcao: 'saida',
            status: 'falhou',
            criadoEm: { gte: new Date(agora.getTime() - JANELA_FALHAS_MIN * 60_000) },
          },
        }),
        tx.mensagem.count({
          where: {
            unidadeId: m.unidadeId,
            direcao: 'entrada',
            texto: { equals: 'sair', mode: 'insensitive' },
            criadoEm: { gte: umDiaAtras },
          },
        }),
        tx.mensagem.count({
          where: { unidadeId: m.unidadeId, proativa: true, enviadaEm: { gte: umDiaAtras } },
        }),
      ]);
      const pausa = pausaPorRisco({ falhasRecentes, saidas24h, proativas24h }, agora);
      if (pausa) {
        await tx.botConexao.update({
          where: { unidadeId: m.unidadeId },
          data: { pausadoAte: pausa.ate, pausaMotivo: pausa.motivo },
        });
        await gravarAviso(
          tx,
          contaId,
          m.unidadeId,
          avisoNumeroProtegido({
            unidadeId: m.unidadeId,
            unidade: m.unidade.nome,
            motivo: pausa.motivo,
            ate: pausa.ate,
          }),
        );
        return segurar(pausa.ate, 'Automáticas pausadas para proteger o número.');
      }
      const hoje = dataLocal(agora);
      const enviadasHoje = await tx.mensagem.count({
        where: {
          unidadeId: m.unidadeId,
          proativa: true,
          enviadaEm: { gte: new Date(`${hoje}T00:00:00-03:00`) },
        },
      });
      if (enviadasHoje >= limiteProativasDoDia(conexao.conectadoEm, agora))
        return segurar(
          new Date(Date.parse(`${hoje}T09:00:00-03:00`) + 86_400_000),
          'Limite diário de mensagens automáticas do número (protege contra restrição).',
        );
    }
    return {
      tipo: 'enviar',
      instancia: conexao.instancia,
      telefone: m.telefone,
      texto: m.texto,
      proativa,
      digitandoMs: tempoDigitandoMs(m.texto),
    } as const;
  });
}

export async function registrarEnvio(
  prisma: PrismaClient,
  contaId: string,
  mensagemId: string,
  r: { ok: true; idExterno: string | null; proativa?: boolean } | { ok: false; erro: string },
): Promise<void> {
  await naConta(prisma, contaId, (tx) =>
    tx.mensagem.update({
      where: { id: mensagemId },
      data: r.ok
        ? {
            status: 'enviada',
            idExterno: r.idExterno,
            enviadaEm: new Date(),
            erro: null,
            proativa: r.proativa ?? false,
          }
        : { status: 'falhou', erro: r.erro.slice(0, 500) },
    }),
  );
}

/**
 * 2 horas depois do pedido de atendente: se ninguém da equipe assumiu nem respondeu (a espera
 * é a mesma), o bot volta a atender e avisa o cliente. Devolve o que pôr na fila de saída.
 */
export async function encerrarEsperaDoAtendente(
  prisma: PrismaClient,
  job: Omit<FimDaEsperaDoAtendente, 'tipo'>,
  agora: Date = new Date(),
): Promise<{ contaId: string; instancia: string; mensagemIds: string[] } | null> {
  return naConta(prisma, job.contaId, async (tx) => {
    const s = await tx.botSessao.findUnique({
      where: { unidadeId_telefone: { unidadeId: job.unidadeId, telefone: job.telefone } },
      include: { unidade: { include: { botConexao: true } } },
    });
    if (!s?.atendenteDesde || s.atendenteDesde.toISOString() !== job.desde) return null;
    const sessao = s.sessao as unknown as SessaoBot;
    await origemDaConversa(tx, 'espera_venceu');
    await tx.botSessao.update({
      where: { id: s.id },
      data: {
        sessao: json({
          ...sessao,
          comAtendente: false,
          caminho: [],
          erros: 0,
          botDesde: agora.toISOString(),
        }),
        atendenteDesde: null,
      },
    });
    const conexao = s.unidade.botConexao;
    if (conexao?.status !== 'conectado') return null;
    // De madrugada o bot volta em silêncio (pedido do dono em 20/11/2026: "mensagens saindo de
    // madrugada, com conversa encerrada"); se o cliente escrever, o bot já responde.
    if (emHorarioDeSilencio(agora)) return null;
    const texto = (await mensagensDoBot(tx, job.unidadeId)).atendente_sem_resposta;
    const m = await tx.mensagem.create({
      data: {
        unidadeId: job.unidadeId,
        telefone: job.telefone,
        direcao: 'saida',
        texto,
        status: 'pendente',
      },
      select: { id: true },
    });
    return { contaId: job.contaId, instancia: conexao.instancia, mensagemIds: [m.id] };
  });
}

/**
 * Janela em que uma mensagem igual que o bot mandou ainda pode ser o eco dela. A fila espaça as
 * respostas: com várias na frente, o eco pode chegar alguns minutos depois de gravada.
 */
const JANELA_ECO_MS = 15 * 60_000;

/** Texto comparável do eco: sem diferença de fim de linha, espaços nas pontas ou em sequência. */
export function textoDoEco(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .trim();
}

/**
 * Mensagem que saiu do próprio número (pedido do dono em 16/11/2026: "se respondo pelo meu zap,
 * o bot continua na conversa e vira bagunça"). Se foi o bot ou o painel (mesmo id, ou o mesmo
 * texto para o mesmo número há pouco), é só o eco. Senão, é a equipe pelo celular: a mensagem
 * entra no histórico e a conversa fica "com a equipe" (o bot fica quieto até o cliente ficar
 * 2 horas sem escrever ou a equipe devolver em Conversas).
 */
export async function registrarMensagemPropria(
  prisma: PrismaClient,
  evento: Extract<EventoWhatsapp, { tipo: 'propria' }>,
): Promise<'eco' | 'equipe' | 'sem_conexao'> {
  const conexao = await conexaoDaInstancia(prisma, evento.instancia);
  if (!conexao) return 'sem_conexao';
  const { contaId, unidadeId } = conexao;
  return naConta(prisma, contaId, async (tx) => {
    if (
      await tx.mensagem.findFirst({ where: { idExterno: evento.idExterno }, select: { id: true } })
    )
      return 'eco';
    const variantes = variantesTelefone(evento.telefone);
    const agora = new Date();
    // O texto do eco pode voltar com outro fim de linha ou espaço sobrando: compara normalizado.
    const recentes = await tx.mensagem.findMany({
      where: {
        unidadeId,
        telefone: { in: variantes },
        direcao: 'saida',
        peloCelular: false,
        // Recém-gravada, recém-enviada (a segurada da madrugada sai horas depois de gravada) ou
        // ainda na fila (o eco pode chegar antes de o envio ser registrado).
        OR: [
          { criadoEm: { gte: new Date(agora.getTime() - JANELA_ECO_MS) } },
          { enviadaEm: { gte: new Date(agora.getTime() - JANELA_ECO_MS) } },
          { status: 'pendente' },
        ],
      },
      select: { texto: true },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    const alvo = textoDoEco(evento.texto);
    if (recentes.some((m) => textoDoEco(m.texto) === alvo)) return 'eco';
    const cliente = await tx.cliente.findFirst({
      where: { telefone: { in: variantes } },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    });
    await tx.mensagem.create({
      data: {
        unidadeId,
        clienteId: cliente?.id ?? null,
        telefone: evento.telefone,
        direcao: 'saida',
        texto: evento.texto,
        status: 'enviada',
        idExterno: evento.idExterno,
        enviadaEm: new Date(evento.recebidaEm),
        criadoEm: new Date(evento.recebidaEm),
        peloCelular: true,
      },
    });
    const salva = await tx.botSessao.findUnique({
      where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
    });
    const antes = (salva?.sessao as unknown as SessaoBot | undefined) ?? null;
    await origemDaConversa(tx, 'celular_respondeu');
    // A equipe assumiu: o bot para (e larga o agendamento ou o fluxo que estava no meio).
    const sessao: SessaoBot = {
      caminho: [],
      comAtendente: true,
      erros: 0,
      // As 2 horas do atendimento contam a partir da resposta da equipe.
      ultimaEm: agora.toISOString(),
      ...(antes?.pedido ? { pedido: antes.pedido } : {}),
      ...(antes?.agenda ? { pedido: antes.agenda } : {}),
      ...(antes?.respostasAnuncio ? { respostasAnuncio: antes.respostasAnuncio } : {}),
    };
    await tx.botSessao.upsert({
      where: { unidadeId_telefone: { unidadeId, telefone: evento.telefone } },
      create: {
        unidadeId,
        telefone: evento.telefone,
        clienteId: cliente?.id ?? null,
        sessao: json(sessao),
        atendenteDesde: null,
      },
      // Respondeu: ninguém está mais esperando.
      update: { sessao: json(sessao), atendenteDesde: null },
    });
    return 'equipe';
  });
}

/** Proteção do número para a tela do Bot: proativas de hoje, limite, aquecimento e pausa. */
export async function protecaoDoNumero(
  tx: Tx,
  unidadeId: string,
  agora: Date = new Date(),
): Promise<ProtecaoDoNumero | null> {
  const c = await tx.botConexao.findUnique({ where: { unidadeId } });
  if (!c || c.status !== 'conectado') return null;
  const hoje = dataLocal(agora);
  const proativasHoje = await tx.mensagem.count({
    where: { unidadeId, proativa: true, enviadaEm: { gte: new Date(`${hoje}T00:00:00-03:00`) } },
  });
  const pausado = c.pausadoAte && c.pausadoAte > agora;
  return {
    proativasHoje,
    limiteHoje: limiteProativasDoDia(c.conectadoEm, agora),
    aquecendoAte: fimDoAquecimento(c.conectadoEm, agora)?.toISOString() ?? null,
    pausadoAte: pausado ? c.pausadoAte!.toISOString() : null,
    pausaMotivo: pausado ? c.pausaMotivo : null,
  };
}

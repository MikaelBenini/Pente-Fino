// Agendamento pela conversa do WhatsApp (Etapa 11): cada mensagem do cliente avança um passo.
// Usa as mesmas regras da agenda do balcão e do site (agenda.ts) e grava com origem "bot".
import {
  agendaNova,
  dataLocal,
  DIAS_POR_VEZ,
  formatarDiaPorExtenso,
  formatarHora,
  HORARIOS_POR_VEZ,
  lerNumeros,
  textoAcoesDoHorario,
  textoConfirmarCancelamento,
  textoMeusHorarios,
  textoRemarcado,
  type HorarioDoCliente,
  rotuloDoDia,
  textoConfirmar,
  textoDias,
  textoHorarios,
  textoMarcado,
  textoProfissionais,
  textoServicos,
  type AgendaNaConversa,
  type RegrasAgendamento,
  type ResumoAgendamento,
  type ServicoParaAgendar,
} from '@pente-fino/shared';
import {
  calcularLivres,
  cancelarPeloCliente,
  regrasDaUnidade,
  criarAgendamentoNoBanco,
  duracaoDosServicos,
  ErroAgenda,
  moverAgendamento,
} from './agenda.js';
import type { Prisma } from './generated/prisma/client.js';
import { precoServicoVigente } from './vigencia.js';

type Tx = Prisma.TransactionClient;

export interface PassoDaAgenda {
  respostas: string[];
  /** null = terminou (marcou, desistiu ou não deu). */
  agenda: AgendaNaConversa | null;
  /** Desistiu ou não deu: quem chamou mostra o menu de novo. */
  voltarAoMenu: boolean;
  /** Marcou: a comanda prevista criada. */
  comandaId?: string;
  /** Marcou ou remarcou: para agendar os lembretes. */
  agendamento?: { id: string; inicio: string };
  /** O que mudou na agenda, para avisar o profissional (assistente da equipe). */
  mudanca?: { agendamentoId: string; tipo: 'novo' | 'remarcado' | 'cancelado' };
}

export interface DadosDaConversa {
  unidadeId: string;
  clienteId: string;
  barbearia: string;
  link: string | null;
  agora: Date;
  /** Regras de agendamento da unidade (antecedência, janela, limite, prazo). */
  regras: RegrasAgendamento;
  /** Simulador do painel: faz o passo a passo, mas não grava o agendamento. */
  simulacao?: boolean;
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0]!;
const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Quantos dias à frente procurar horário antes de desistir (o resto fica com a recepção). */
const DIAS_DE_BUSCA = 21;

/** Serviços que dá para marcar: ativos e com preço na unidade (principais primeiro). */
export async function servicosParaAgendar(
  tx: Tx,
  unidadeId: string,
  dia: string,
): Promise<ServicoParaAgendar[]> {
  const servicos = await tx.servico.findMany({
    where: { ativo: true },
    orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
  });
  const r: ServicoParaAgendar[] = [];
  for (const s of servicos) {
    const preco = await precoServicoVigente(tx, s.id, unidadeId, dia);
    if (preco !== undefined) r.push({ id: s.id, nome: s.nome, preco, duracaoMin: s.duracaoMin });
  }
  return r;
}

async function profissionaisDaUnidade(tx: Tx, unidadeId: string) {
  const ps = await tx.profissional.findMany({
    where: { unidadeId, ativo: true },
    include: { usuario: { select: { nome: true } } },
    orderBy: { usuario: { nome: 'asc' } },
  });
  return ps.map((p) => ({ id: p.id, nome: primeiroNome(p.usuario.nome) }));
}

/** A unidade agenda pela conversa (ligado nas regras, serviço com preço e alguém atendendo)? */
export async function podeAgendarPelaConversa(tx: Tx, unidadeId: string, dia: string) {
  if (!(await regrasDaUnidade(tx, unidadeId)).pelaConversa) return false;
  if ((await profissionaisDaUnidade(tx, unidadeId)).length === 0) return false;
  return (await servicosParaAgendar(tx, unidadeId, dia)).length > 0;
}

/** Horários livres do dia; em "sem preferência", cada horário fica com o primeiro livre. */
async function horariosDoDia(
  tx: Tx,
  a: AgendaNaConversa,
  d: DadosDaConversa,
  dia: string,
): Promise<{ inicio: string; profissionalId: string }[]> {
  const duracao = await duracaoDosServicos(tx, a.servicoIds);
  const livres = await calcularLivres(
    tx,
    d.unidadeId,
    dia,
    duracao,
    a.profissionalId ?? undefined,
    d.agora,
    { antecedenciaMin: d.regras.antecedenciaMin },
  );
  const porHorario = new Map<string, string>();
  for (const l of livres)
    for (const inicio of l.inicios)
      if (!porHorario.has(inicio)) porHorario.set(inicio, l.profissionalId);
  return [...porHorario]
    .map(([inicio, profissionalId]) => ({ inicio, profissionalId }))
    .sort((x, y) => x.inicio.localeCompare(y.inicio));
}

async function resumo(tx: Tx, a: AgendaNaConversa, d: DadosDaConversa): Promise<ResumoAgendamento> {
  const { inicio, profissionalId } = a.escolha!;
  const dia = dataLocal(new Date(inicio));
  const servicos = await tx.servico.findMany({ where: { id: { in: a.servicoIds } } });
  let total = 0;
  for (const id of a.servicoIds)
    total += (await precoServicoVigente(tx, id, d.unidadeId, dia)) ?? 0;
  const prof = await tx.profissional.findUniqueOrThrow({
    where: { id: profissionalId },
    include: { usuario: { select: { nome: true } } },
  });
  return {
    servicos: a.servicoIds.map((id) => servicos.find((s) => s.id === id)?.nome ?? 'Serviço'),
    profissional: primeiroNome(prof.usuario.nome),
    diaRotulo: rotuloDoDia(dia, dataLocal(d.agora)),
    inicio,
    total,
  };
}

const sair = (respostas: string[]): PassoDaAgenda => ({
  respostas,
  agenda: null,
  voltarAoMenu: true,
});
const seguir = (a: AgendaNaConversa, respostas: string[]): PassoDaAgenda => ({
  respostas,
  agenda: a,
  voltarAoMenu: false,
});

/** Mostra os próximos dias com horário (só os que têm). */
async function irParaDias(tx: Tx, a: AgendaNaConversa, d: DadosDaConversa, aviso?: string) {
  const hoje = dataLocal(d.agora);
  const duracao = await duracaoDosServicos(tx, a.servicoIds);
  const dias: string[] = [];
  for (
    let i = 0;
    i < Math.min(DIAS_DE_BUSCA, d.regras.janelaDias + 1) && dias.length < DIAS_POR_VEZ;
    i++
  ) {
    const dia = somarDias(hoje, i);
    const livres = await calcularLivres(
      tx,
      d.unidadeId,
      dia,
      duracao,
      a.profissionalId ?? undefined,
      d.agora,
      { antecedenciaMin: d.regras.antecedenciaMin },
    );
    if (livres.some((l) => l.inicios.length > 0)) dias.push(dia);
  }
  if (dias.length === 0)
    return sair([
      `Não achei horário livre nos próximos ${DIAS_DE_BUSCA} dias${a.profissionalId ? ' com esse profissional' : ''}. Responda ATENDENTE que a gente encaixa você.`,
    ]);
  const prox: AgendaNaConversa = {
    ...a,
    passo: 'dia',
    opcoes: dias,
    erros: 0,
    dia: null,
    pagina: 0,
  };
  return seguir(prox, [
    ...(aviso ? [aviso] : []),
    textoDias(dias.map((x) => rotuloDoDia(x, hoje))),
  ]);
}

async function irParaHorarios(
  tx: Tx,
  a: AgendaNaConversa,
  d: DadosDaConversa,
  dia: string,
  pagina: number,
  aviso?: string,
) {
  const todos = await horariosDoDia(tx, a, d, dia);
  if (todos.length === 0) return irParaDias(tx, a, d, 'Esse dia acabou de lotar. 😕');
  const inicioPagina = pagina * HORARIOS_POR_VEZ < todos.length ? pagina * HORARIOS_POR_VEZ : 0;
  const pedaco = todos.slice(inicioPagina, inicioPagina + HORARIOS_POR_VEZ);
  const temMais = inicioPagina + HORARIOS_POR_VEZ < todos.length;
  const prox: AgendaNaConversa = {
    ...a,
    passo: 'horario',
    dia,
    pagina: inicioPagina / HORARIOS_POR_VEZ,
    opcoes: pedaco.map((h) => `${h.inicio}|${h.profissionalId}`),
    erros: 0,
  };
  return seguir(prox, [
    ...(aviso ? [aviso] : []),
    textoHorarios(
      rotuloDoDia(dia, dataLocal(d.agora)),
      pedaco.map((h) => h.inicio),
      temMais,
    ),
  ]);
}

/** Resposta que não serviu: repete o pedido uma vez; na segunda, volta ao menu. */
function naoServiu(a: AgendaNaConversa, dica: string): PassoDaAgenda {
  if (a.erros >= 1) return sair(['Vamos recomeçar. 🙂']);
  return seguir({ ...a, erros: a.erros + 1 }, [dica]);
}

/** Horários futuros do cliente na unidade (os que ainda podem mudar), em ordem. */
async function horariosDoCliente(tx: Tx, d: DadosDaConversa) {
  if (!d.clienteId) return [];
  const ags = await tx.agendamento.findMany({
    where: {
      clienteId: d.clienteId,
      unidadeId: d.unidadeId,
      inicio: { gt: d.agora },
      status: { in: ['agendado', 'confirmado'] },
    },
    orderBy: { inicio: 'asc' },
    include: {
      profissional: { include: { usuario: { select: { nome: true } } } },
      comanda: { include: { itens: { include: { servico: { select: { nome: true } } } } } },
    },
  });
  return ags.map((a) => ({
    id: a.id,
    profissionalId: a.profissionalId,
    servicoIds: (a.comanda?.itens ?? [])
      .filter((i) => i.tipo === 'servico' && i.servicoId)
      .map((i) => i.servicoId!),
    texto: {
      inicio: a.inicio.toISOString(),
      servicos: (a.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
      profissional: primeiroNome(a.profissional.usuario.nome),
    } satisfies HorarioDoCliente,
  }));
}

/** Começa o "Meus horários": lista, ou mostra direto as ações quando há um só. */
async function iniciarMeusHorarios(tx: Tx, d: DadosDaConversa): Promise<PassoDaAgenda> {
  const hoje = dataLocal(d.agora);
  const hs = await horariosDoCliente(tx, d);
  if (hs.length === 0)
    return sair(['Você não tem horário marcado com a gente. Para marcar, responda AGENDAR.']);
  if (hs.length === 1) return mostrarAcoes(hs[0]!, { ...agendaNova(), opcoes: [hs[0]!.id] }, d);
  return seguir({ ...agendaNova(), passo: 'meus', opcoes: hs.map((h) => h.id) }, [
    textoMeusHorarios(
      hs.map((h) => h.texto),
      hoje,
    ),
  ]);
}

function mostrarAcoes(
  h: Awaited<ReturnType<typeof horariosDoCliente>>[number],
  a: AgendaNaConversa,
  d: DadosDaConversa,
): PassoDaAgenda {
  const hoje = dataLocal(d.agora);
  // Em cima da hora, só com a recepção (o barbeiro já se organizou para o horário).
  if (new Date(h.texto.inicio).getTime() - d.agora.getTime() < d.regras.prazoMudarMin * 60_000)
    return sair([
      `Seu horário é daqui a pouco (${formatarHora(h.texto.inicio)}). Para mudar agora, responda ATENDENTE.`,
    ]);
  return seguir({ ...a, passo: 'acao', remarcarId: h.id, erros: 0 }, [
    textoAcoesDoHorario(h.texto, hoje),
  ]);
}

/**
 * Resposta "2. Remarcar" ou "3. Cancelar" ao lembrete: vai direto ao horário lembrado, com
 * o mesmo prazo do "Meus horários".
 */
export async function mudarHorarioDoLembrete(
  tx: Tx,
  agendamentoId: string,
  acao: 'remarcar' | 'cancelar',
  d: DadosDaConversa,
): Promise<PassoDaAgenda> {
  const h = (await horariosDoCliente(tx, d)).find((x) => x.id === agendamentoId);
  if (!h) return sair(['Esse horário não está mais marcado. Para marcar, responda AGENDAR.']);
  const acoes = mostrarAcoes(h, { ...agendaNova(), opcoes: [h.id] }, d);
  if (!acoes.agenda) return acoes; // em cima da hora: com a recepção
  if (acao === 'cancelar')
    return seguir({ ...acoes.agenda, passo: 'cancelar' }, [
      textoConfirmarCancelamento(h.texto, dataLocal(d.agora)),
    ]);
  return irParaDias(
    tx,
    { ...acoes.agenda, servicoIds: h.servicoIds, profissionalId: h.profissionalId },
    d,
  );
}

/**
 * Um passo da conversa. Sem `agenda`, começa (lista os serviços); depois, cada resposta
 * escolhe pelo número. "0" volta (ou sai), e a escolha final grava o agendamento.
 */
export async function passoDaAgenda(
  tx: Tx,
  agenda: AgendaNaConversa | null,
  entrada: string | null,
  d: DadosDaConversa,
  comecar: 'agendar' | 'meus_horarios' = 'agendar',
): Promise<PassoDaAgenda> {
  const hoje = dataLocal(d.agora);

  if (!agenda && comecar === 'meus_horarios') return iniciarMeusHorarios(tx, d);
  if (!agenda) {
    const futuros = d.simulacao
      ? []
      : await tx.agendamento.findMany({
          where: {
            clienteId: d.clienteId,
            unidadeId: d.unidadeId,
            inicio: { gt: d.agora },
            status: { in: ['agendado', 'confirmado'] },
          },
          orderBy: { inicio: 'asc' },
        });
    if (futuros.length >= d.regras.maxFuturos)
      return sair([
        [
          'Você já tem horários marcados com a gente:',
          '',
          ...futuros.map(
            (f) => `📅 ${formatarDiaPorExtenso(f.inicio)}, às ${formatarHora(f.inicio)}`,
          ),
          '',
          'Para marcar mais um ou mudar algum, responda ATENDENTE.',
        ].join('\n'),
      ]);
    const servicos = await servicosParaAgendar(tx, d.unidadeId, hoje);
    if (servicos.length === 0)
      return sair([
        d.link
          ? `Por aqui ainda não dá para marcar. Marque pelo site: ${d.link}`
          : 'Por aqui ainda não dá para marcar. Responda ATENDENTE que a gente marca para você.',
      ]);
    return seguir({ ...agendaNova(), opcoes: servicos.map((s) => s.id) }, [
      textoServicos(servicos, d.link),
    ]);
  }

  const numeros = lerNumeros(entrada ?? '');
  const um = numeros.length === 1 ? numeros[0]! : null;

  switch (agenda.passo) {
    case 'meus': {
      if (um === 0) return sair([]);
      if (um === null || um > agenda.opcoes.length)
        return naoServiu(agenda, 'Responda com o número do horário, ou 0 para voltar ao menu.');
      const h = (await horariosDoCliente(tx, d)).find((x) => x.id === agenda.opcoes[um - 1]);
      if (!h) return iniciarMeusHorarios(tx, d);
      return mostrarAcoes(h, agenda, d);
    }
    case 'acao': {
      if (um === 0) return sair([]);
      const h = (await horariosDoCliente(tx, d)).find((x) => x.id === agenda.remarcarId);
      if (!h) return sair(['Esse horário não está mais marcado.']);
      if (um === 2)
        return seguir({ ...agenda, passo: 'cancelar', erros: 0 }, [
          textoConfirmarCancelamento(h.texto, hoje),
        ]);
      if (um !== 1)
        return naoServiu(agenda, 'Responda 1 para remarcar, 2 para cancelar ou 0 para voltar.');
      // Remarcar: mesmos serviços e mesmo profissional; o cliente escolhe dia e horário.
      return irParaDias(
        tx,
        { ...agenda, servicoIds: h.servicoIds, profissionalId: h.profissionalId },
        d,
      );
    }
    case 'cancelar': {
      if (um === 2) return sair(['Combinado, seu horário continua marcado.']);
      if (um !== 1)
        return naoServiu(agenda, 'Responda 1 para cancelar ou 2 para manter o horário.');
      if (d.simulacao)
        return {
          respostas: ['(Simulação: nada foi gravado.) O horário seria cancelado.'],
          agenda: null,
          voltarAoMenu: false,
        };
      try {
        await cancelarPeloCliente(tx, agenda.remarcarId!, 'WhatsApp');
      } catch (e) {
        if (e instanceof ErroAgenda) return sair([e.message]);
        throw e;
      }
      return {
        respostas: [
          'Pronto, horário cancelado. Quando quiser marcar de novo, é só responder AGENDAR.',
        ],
        agenda: null,
        voltarAoMenu: false,
        mudanca: { agendamentoId: agenda.remarcarId!, tipo: 'cancelado' },
      };
    }
    case 'servico': {
      if (um === 0) return sair([]);
      const validos =
        numeros.length > 0 && numeros.every((n) => n >= 1 && n <= agenda.opcoes.length);
      if (!validos)
        return naoServiu(agenda, 'Responda com o número do serviço (por exemplo: 1, ou 1 e 3).');
      const a = { ...agenda, servicoIds: numeros.map((n) => agenda.opcoes[n - 1]!), erros: 0 };
      const profs = await profissionaisDaUnidade(tx, d.unidadeId);
      if (profs.length === 1) return irParaDias(tx, { ...a, profissionalId: profs[0]!.id }, d);
      return seguir({ ...a, passo: 'profissional', opcoes: profs.map((p) => p.id) }, [
        textoProfissionais(profs.map((p) => p.nome)),
      ]);
    }
    case 'profissional': {
      if (um === null || um > agenda.opcoes.length)
        return naoServiu(
          agenda,
          'Responda com o número do profissional, ou 0 para sem preferência.',
        );
      return irParaDias(
        tx,
        { ...agenda, profissionalId: um === 0 ? null : agenda.opcoes[um - 1]! },
        d,
      );
    }
    case 'dia': {
      if (um === 0) return sair([]);
      if (um === null || um > agenda.opcoes.length)
        return naoServiu(agenda, 'Responda com o número do dia.');
      return irParaHorarios(tx, agenda, d, agenda.opcoes[um - 1]!, 0);
    }
    case 'horario': {
      if (um === 0) return irParaDias(tx, agenda, d);
      if (um === agenda.opcoes.length + 1)
        return irParaHorarios(tx, agenda, d, agenda.dia!, agenda.pagina + 1);
      if (um === null || um > agenda.opcoes.length)
        return naoServiu(agenda, 'Responda com o número do horário (ou 0 para outro dia).');
      const [inicio, profissionalId] = agenda.opcoes[um - 1]!.split('|') as [string, string];
      const a: AgendaNaConversa = {
        ...agenda,
        passo: 'confirmar',
        escolha: { inicio, profissionalId },
        opcoes: [],
        erros: 0,
      };
      return seguir(a, [textoConfirmar(await resumo(tx, a, d))]);
    }
    case 'confirmar': {
      if (um === 0) return sair(['Tudo bem, não marquei nada.']);
      if (um === 2) return irParaHorarios(tx, agenda, d, agenda.dia!, 0);
      if (um !== 1)
        return naoServiu(
          agenda,
          'Responda 1 para confirmar, 2 para outro horário ou 0 para cancelar.',
        );
      const r = await resumo(tx, agenda, d);
      if (d.simulacao)
        return {
          respostas: [
            `(Simulação: nada foi gravado.) O cliente receberia:\n\n${textoMarcado(r, d.barbearia)}`,
          ],
          agenda: null,
          voltarAoMenu: false,
        };
      try {
        // Ponto de salvamento: se o horário acabou de ser ocupado, o resto da transação segue.
        await tx.$executeRawUnsafe('SAVEPOINT agendar_bot');
        if (agenda.remarcarId) {
          const r2 = await moverAgendamento(
            tx,
            agenda.remarcarId,
            new Date(agenda.escolha!.inicio),
            agenda.escolha!.profissionalId,
          );
          await tx.auditoria.create({
            data: {
              usuarioId: null,
              entidade: 'agendamento',
              entidadeId: agenda.remarcarId,
              acao: 'remarcar_pelo_cliente',
              antes: {
                inicio: r2.antes.inicio.toISOString(),
                profissionalId: r2.antes.profissionalId,
              },
              depois: {
                inicio: agenda.escolha!.inicio,
                profissionalId: agenda.escolha!.profissionalId,
              },
              motivo: 'Remarcado pelo cliente (WhatsApp)',
            },
          });
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT agendar_bot');
          return {
            respostas: [textoRemarcado(r, d.barbearia)],
            agenda: null,
            voltarAoMenu: false,
            comandaId: r2.comandaId,
            agendamento: { id: agenda.remarcarId, inicio: agenda.escolha!.inicio },
            mudanca: { agendamentoId: agenda.remarcarId, tipo: 'remarcado' },
          };
        }
        const criado = await criarAgendamentoNoBanco(tx, {
          unidadeId: d.unidadeId,
          profissionalId: agenda.escolha!.profissionalId,
          clienteId: d.clienteId,
          inicio: new Date(agenda.escolha!.inicio),
          servicoIds: agenda.servicoIds,
          origem: 'bot',
          criadoPorId: null,
        });
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT agendar_bot');
        return {
          respostas: [textoMarcado(r, d.barbearia)],
          agenda: null,
          voltarAoMenu: false,
          comandaId: criado.comandaId,
          agendamento: { id: criado.agendamentoId, inicio: agenda.escolha!.inicio },
          mudanca: { agendamentoId: criado.agendamentoId, tipo: 'novo' },
        };
      } catch (e) {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT agendar_bot');
        const ocupado =
          (e instanceof ErroAgenda && e.codigo === 'conflito') ||
          (e as { code?: string }).code === 'P2010' ||
          /agendamento_sem_sobreposicao/.test(String((e as Error).message));
        if (!ocupado) throw e;
        return irParaHorarios(
          tx,
          { ...agenda, escolha: null },
          d,
          agenda.dia!,
          0,
          'Esse horário acabou de ser ocupado. 😕 Escolha outro:',
        );
      }
    }
  }
}

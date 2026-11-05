// Agendamento pela conversa do WhatsApp (Etapa 11): cada mensagem do cliente avança um passo.
// Usa as mesmas regras da agenda do balcão e do site (agenda.ts) e grava com origem "bot".
import {
  agendaNova,
  dataLocal,
  DIAS_POR_VEZ,
  formatarDiaPorExtenso,
  formatarHora,
  HORARIOS_POR_VEZ,
  JANELA_AGENDAMENTO_DIAS,
  lerNumeros,
  MAX_FUTUROS_POR_CLIENTE,
  rotuloDoDia,
  textoConfirmar,
  textoDias,
  textoHorarios,
  textoMarcado,
  textoProfissionais,
  textoServicos,
  type AgendaNaConversa,
  type ResumoAgendamento,
  type ServicoParaAgendar,
} from '@pente-fino/shared';
import {
  calcularLivres,
  criarAgendamentoNoBanco,
  duracaoDosServicos,
  ErroAgenda,
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
}

export interface DadosDaConversa {
  unidadeId: string;
  clienteId: string;
  barbearia: string;
  link: string | null;
  agora: Date;
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

/** A unidade tem como agendar pela conversa (serviço com preço e alguém atendendo)? */
export async function podeAgendarPelaConversa(tx: Tx, unidadeId: string, dia: string) {
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
    i < Math.min(DIAS_DE_BUSCA, JANELA_AGENDAMENTO_DIAS) && dias.length < DIAS_POR_VEZ;
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

/**
 * Um passo da conversa. Sem `agenda`, começa (lista os serviços); depois, cada resposta
 * escolhe pelo número. "0" volta (ou sai), e a escolha final grava o agendamento.
 */
export async function passoDaAgenda(
  tx: Tx,
  agenda: AgendaNaConversa | null,
  entrada: string | null,
  d: DadosDaConversa,
): Promise<PassoDaAgenda> {
  const hoje = dataLocal(d.agora);

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
    if (futuros.length >= MAX_FUTUROS_POR_CLIENTE)
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

// Lista de espera (Etapa 14): quando um horário vaga, oferece para quem cabe nele, na ordem de
// chegada (até OFERTAS_POR_VAGA ao mesmo tempo); o primeiro "1" leva e os outros recebem "já foi
// preenchido". Fonte única para o worker (oferta e resposta) e a API (balcão).
import {
  dataLocal,
  OFERTAS_POR_VAGA,
  ofertaValida,
  rotuloDoDia,
  TEXTO_VAGA_PREENCHIDA,
  textoOfertaVaga,
  cabeNaFaixa,
  variantesTelefone,
  type SessaoBot,
  type VagaLiberada,
} from '@pente-fino/shared';
import {
  calcularLivres,
  criarAgendamentoNoBanco,
  duracaoDosServicos,
  ErroAgenda,
  regrasDaUnidade,
} from './agenda.js';
import { json } from './bot.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';
import { remarcarPeloCliente } from './link-horario.js';

type Tx = Prisma.TransactionClient;

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const dataBanco = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
/** Minutos desde 00:00 em São Paulo (-03:00 fixo). */
const minutoLocal = (d: Date) => {
  const l = new Date(d.getTime() - 3 * 3_600_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

export interface OfertaGravada {
  inicio: string;
  profissionalId: string;
  enviadaEm: string;
}

export interface EnvioDeOferta {
  contaId: string;
  instancia: string;
  mensagemIds: string[];
}

/** Horário que vagou, para pôr na fila (o worker oferece para a lista). */
export function vagaDe(
  contaId: string,
  a: { unidadeId: string; profissionalId: string; inicio: Date; fim: Date },
): VagaLiberada {
  return {
    tipo: 'vaga',
    contaId,
    unidadeId: a.unidadeId,
    profissionalId: a.profissionalId,
    inicio: a.inicio.toISOString(),
    fim: a.fim.toISOString(),
  };
}

/**
 * Vagou um horário: escolhe, na ordem da lista, quem cabe nele (dia, faixa, profissional, a
 * duração dos serviços cabendo na agenda) e grava a oferta para até OFERTAS_POR_VAGA. Só para
 * quem aceitou mensagens e já conversou com a unidade (proteção do número).
 */
export async function oferecerVaga(
  prisma: PrismaClient,
  vaga: Omit<VagaLiberada, 'tipo'>,
  agora = new Date(),
): Promise<EnvioDeOferta | null> {
  return naConta(prisma, vaga.contaId, async (tx) => {
    const inicio = new Date(vaga.inicio);
    const regras = await regrasDaUnidade(tx, vaga.unidadeId);
    if (inicio.getTime() < agora.getTime() + regras.antecedenciaMin * 60_000) return null;
    const conexao = await tx.botConexao.findUnique({ where: { unidadeId: vaga.unidadeId } });
    if (conexao?.status !== 'conectado') return null;
    const dia = dataLocal(inicio);
    const minuto = minutoLocal(inicio);

    const pedidos = await tx.listaEspera.findMany({
      where: {
        unidadeId: vaga.unidadeId,
        dia: dataBanco(dia),
        status: { in: ['aguardando', 'oferecido'] },
        OR: [{ profissionalId: null }, { profissionalId: vaga.profissionalId }],
        cliente: { consentimentoMsg: true, telefone: { not: null } },
      },
      include: { cliente: true, agendamento: true },
      orderBy: { criadoEm: 'asc' },
    });
    const prof = await tx.profissional.findUniqueOrThrow({
      where: { id: vaga.profissionalId },
      include: { usuario: { select: { nome: true } } },
    });

    const escolhidos: typeof pedidos = [];
    for (const p of pedidos) {
      if (escolhidos.length >= OFERTAS_POR_VAGA) break;
      if (!cabeNaFaixa(minuto, p.deMin, p.ateMin)) continue;
      // Com oferta ainda valendo para outro horário, espera a resposta dela.
      const atual = p.oferta as OfertaGravada | null;
      if (
        p.status === 'oferecido' &&
        atual &&
        ofertaValida({
          enviadaEm: new Date(atual.enviadaEm),
          inicio: new Date(atual.inicio),
          agora,
        })
      )
        continue;
      // Antecipar: só se a vaga é antes do horário que ele tem, que segue marcado.
      if (p.origem === 'antecipar') {
        const ag = p.agendamento;
        if (!ag || !['agendado', 'confirmado'].includes(ag.status) || ag.inicio <= inicio) continue;
      }
      const duracao = p.agendamento
        ? Math.round((p.agendamento.fim.getTime() - p.agendamento.inicio.getTime()) / 60_000)
        : await duracaoDosServicos(tx, p.servicoIds).catch(() => 0);
      if (duracao <= 0) continue;
      const livres = await calcularLivres(
        tx,
        vaga.unidadeId,
        dia,
        duracao,
        vaga.profissionalId,
        agora,
        {
          antecedenciaMin: regras.antecedenciaMin,
          ...(p.agendamentoId ? { ignorar: p.agendamentoId } : {}),
        },
      );
      if (!livres.some((l) => l.inicios.includes(inicio.toISOString()))) continue;
      const falou = await tx.mensagem.findFirst({
        where: {
          unidadeId: vaga.unidadeId,
          telefone: { in: variantesTelefone(p.cliente.telefone!) },
          direcao: 'entrada',
        },
        select: { telefone: true },
      });
      if (!falou) continue;
      escolhidos.push(p);
    }
    if (escolhidos.length === 0) return null;

    const ids: string[] = [];
    for (const p of escolhidos) {
      const oferta: OfertaGravada = {
        inicio: inicio.toISOString(),
        profissionalId: vaga.profissionalId,
        enviadaEm: agora.toISOString(),
      };
      await tx.listaEspera.update({
        where: { id: p.id },
        data: { status: 'oferecido', oferta: json(oferta) },
      });
      const telefone = p.cliente.telefone!;
      const chave = { unidadeId: vaga.unidadeId, telefone };
      const salva = await tx.botSessao.findUnique({ where: { unidadeId_telefone: chave } });
      const anterior = (salva?.sessao ?? null) as SessaoBot | null;
      const sessao: SessaoBot = {
        caminho: anterior?.caminho ?? [],
        ultimaEm: anterior?.ultimaEm ?? agora.toISOString(),
        comAtendente: anterior?.comAtendente ?? false,
        erros: 0,
        oferta: { esperaId: p.id },
      };
      await tx.botSessao.upsert({
        where: { unidadeId_telefone: chave },
        create: { ...chave, clienteId: p.clienteId, sessao: json(sessao) },
        update: { clienteId: p.clienteId, sessao: json(sessao) },
      });
      const m = await tx.mensagem.create({
        data: {
          ...chave,
          clienteId: p.clienteId,
          direcao: 'saida',
          texto: textoOfertaVaga({
            cliente: primeiroNome(p.cliente.nome),
            diaRotulo: rotuloDoDia(dia, dataLocal(agora)),
            inicio: inicio.toISOString(),
            profissional: primeiroNome(prof.usuario.nome),
            antecipar: p.origem === 'antecipar',
          }),
          status: 'pendente',
          automacao: 'espera',
        },
        select: { id: true },
      });
      ids.push(m.id);
    }
    return { contaId: vaga.contaId, instancia: conexao.instancia, mensagemIds: ids };
  });
}

export interface RespostaAOferta {
  respostas: string[];
  /** Mensagens para os outros que receberam a mesma vaga ("já foi preenchido"). */
  outrasSaidas: string[];
  agendamento?: { id: string; inicio: string };
  mudanca?: { agendamentoId: string; tipo: 'novo' | 'remarcado' };
  /** Antecipou: o horário antigo dele vagou e vai para a lista. */
  vaga?: VagaLiberada;
}

/**
 * Resposta do cliente à oferta: "1" marca (ou antecipa o horário que ele tem); "2" recusa e
 * continua na lista. null = a resposta não é para a oferta (segue a conversa normal).
 */
export async function responderOferta(
  tx: Tx,
  d: { esperaId: string; entrada: number | null; agora: Date },
): Promise<RespostaAOferta | null> {
  if (d.entrada !== 1 && d.entrada !== 2) return null;
  const p = await tx.listaEspera.findUnique({
    where: { id: d.esperaId },
    include: { agendamento: true },
  });
  const oferta = p?.oferta as OfertaGravada | null;
  const valendo =
    p?.status === 'oferecido' &&
    oferta &&
    ofertaValida({
      enviadaEm: new Date(oferta.enviadaEm),
      inicio: new Date(oferta.inicio),
      agora: d.agora,
    });
  if (!p || !oferta || !valendo)
    return {
      respostas: ['Essa oferta não vale mais. Se vagar outro horário, eu aviso.'],
      outrasSaidas: [],
    };
  if (d.entrada === 2) {
    await tx.listaEspera.update({
      where: { id: p.id },
      data: { status: 'aguardando', oferta: Prisma.DbNull },
    });
    return {
      respostas: ['Tudo bem! Continuo de olho e aviso se vagar outro horário.'],
      outrasSaidas: [],
    };
  }

  const inicio = new Date(oferta.inicio);
  let resultado: Pick<RespostaAOferta, 'agendamento' | 'mudanca' | 'vaga'>;
  try {
    await tx.$executeRawUnsafe('SAVEPOINT oferta_espera');
    if (p.origem === 'antecipar' && p.agendamentoId && p.agendamento) {
      const antes = p.agendamento;
      await remarcarPeloCliente(tx, p.agendamentoId, inicio, 'WhatsApp', oferta.profissionalId);
      resultado = {
        agendamento: { id: p.agendamentoId, inicio: oferta.inicio },
        mudanca: { agendamentoId: p.agendamentoId, tipo: 'remarcado' },
        vaga: vagaDe(p.contaId, antes),
      };
    } else {
      const criado = await criarAgendamentoNoBanco(tx, {
        unidadeId: p.unidadeId,
        profissionalId: oferta.profissionalId,
        clienteId: p.clienteId,
        inicio,
        servicoIds: p.servicoIds,
        origem: 'bot',
        criadoPorId: null,
      });
      resultado = {
        agendamento: { id: criado.agendamentoId, inicio: oferta.inicio },
        mudanca: { agendamentoId: criado.agendamentoId, tipo: 'novo' },
      };
    }
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT oferta_espera');
  } catch (e) {
    if (!(e instanceof ErroAgenda)) throw e;
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT oferta_espera');
    await tx.listaEspera.update({
      where: { id: p.id },
      data: { status: 'aguardando', oferta: Prisma.DbNull },
    });
    return { respostas: [TEXTO_VAGA_PREENCHIDA], outrasSaidas: [] };
  }
  await tx.listaEspera.update({ where: { id: p.id }, data: { status: 'atendido' } });

  // Os outros que receberam a mesma vaga voltam a esperar e ficam sabendo.
  const outros = await tx.listaEspera.findMany({
    where: { id: { not: p.id }, unidadeId: p.unidadeId, status: 'oferecido' },
    include: { cliente: true },
  });
  const outrasSaidas: string[] = [];
  for (const o of outros) {
    const of = o.oferta as OfertaGravada | null;
    if (!of || of.inicio !== oferta.inicio || of.profissionalId !== oferta.profissionalId) continue;
    await tx.listaEspera.update({
      where: { id: o.id },
      data: { status: 'aguardando', oferta: Prisma.DbNull },
    });
    if (!o.cliente.telefone) continue;
    const m = await tx.mensagem.create({
      data: {
        unidadeId: o.unidadeId,
        clienteId: o.clienteId,
        telefone: o.cliente.telefone,
        direcao: 'saida',
        texto: TEXTO_VAGA_PREENCHIDA,
        status: 'pendente',
        automacao: 'espera',
      },
      select: { id: true },
    });
    outrasSaidas.push(m.id);
  }
  const quando = `${rotuloDoDia(dataLocal(inicio), dataLocal(d.agora))}, às ${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
  return {
    respostas: [
      p.origem === 'antecipar'
        ? `Pronto, seu horário foi antecipado para ${quando}. ✅`
        : `Pronto, horário marcado: ${quando}. ✅ Te esperamos!`,
    ],
    outrasSaidas,
    ...resultado,
  };
}

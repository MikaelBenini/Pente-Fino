// Automações do pós-atendimento (Etapa 12): a rotina diária do worker escolhe quem recebe o
// convite de retorno e o parabéns, grava as mensagens marcadas com a automação e devolve o que
// pôr na fila de saída. Também calcula os números de cada automação.
import {
  AGENDOU_ATE_DIAS,
  AUTOMACOES,
  AVISO_CLUBE_DIAS,
  formatarMoeda,
  pixCopiaECola,
  recebimentoPixSchema,
  dataLocal,
  deveConvidarRetorno,
  ehAniversario,
  intervaloHabitual,
  lerAutomacoes,
  LIMITE_AUTOMACOES_DIA,
  preencher,
  RESPOSTA_ATE_H,
  variantesTelefone,
  type Automacao,
  type NumerosAutomacao,
} from '@pente-fino/shared';
import { mensagensDoBot, situacaoDaUnidade } from './bot.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);
/** Coluna date do banco (meia-noite UTC). */
const dataBanco = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const somarDiasIso = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Contas com alguma automação ligada (política conta_rotina_automacoes). */
export async function contasComAutomacoes(prisma: PrismaClient): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.rotina', 'automacoes', true)`;
    const contas = await tx.conta.findMany({ select: { id: true } });
    return contas.map((c) => c.id);
  });
}

export interface EnvioDaRotina {
  contaId: string;
  instancia: string;
  mensagemIds: string[];
}

/**
 * Rotina do dia numa conta: retorno e aniversário para quem aceitou mensagens e já conversou
 * com a unidade (proteção do número), pela unidade da última visita, com WhatsApp conectado e
 * até LIMITE_AUTOMACOES_DIA por número no dia.
 */
export async function rodarAutomacoes(
  prisma: PrismaClient,
  contaId: string,
  agora = new Date(),
  appUrl = '',
): Promise<EnvioDaRotina[]> {
  return naConta(prisma, contaId, async (tx) => {
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: contaId } });
    const config = lerAutomacoes(conta.automacoes);
    if (!config.retorno && !config.aniversario && !config.avisoClube) return [];
    const hoje = dataLocal(agora);
    const mensagens = await mensagensDoBot(tx);

    // Visitas do último ano (comandas fechadas com cliente), da mais recente para a mais antiga.
    const fechadas = await tx.comanda.findMany({
      where: {
        status: 'fechada',
        clienteId: { not: null },
        fechadaEm: { gte: new Date(agora.getTime() - 365 * 86_400_000) },
      },
      select: { clienteId: true, unidadeId: true, fechadaEm: true },
      orderBy: { fechadaEm: 'desc' },
    });
    const visitas = new Map<string, { unidadeId: string; datas: Date[] }>();
    for (const c of fechadas) {
      const v = visitas.get(c.clienteId!) ?? { unidadeId: c.unidadeId, datas: [] };
      v.datas.push(c.fechadaEm!);
      visitas.set(c.clienteId!, v);
    }

    const unidades = new Map<
      string,
      { instancia: string; nome: string; link: string | null; enviadas: number; ids: string[] }
    >();
    const unidadeDoEnvio = async (unidadeId: string) => {
      if (unidades.has(unidadeId)) return unidades.get(unidadeId)!;
      const u = await tx.unidade.findUnique({
        where: { id: unidadeId },
        include: { botConexao: true, profissionais: { include: { horarios: true } } },
      });
      if (!u || u.botConexao?.status !== 'conectado') return null;
      const enviadas = await tx.mensagem.count({
        where: {
          unidadeId,
          automacao: { in: ['retorno', 'aniversario', 'clube'] },
          criadoEm: { gte: inicioDoDia(hoje) },
        },
      });
      const s = await situacaoDaUnidade(tx, u, agora, appUrl);
      const dados = {
        instancia: u.botConexao.instancia,
        nome: u.nome,
        link: s.link,
        enviadas,
        ids: [] as string[],
      };
      unidades.set(unidadeId, dados);
      return dados;
    };
    const conversou = async (unidadeId: string, telefone: string) =>
      !!(await tx.mensagem.findFirst({
        where: { unidadeId, telefone: { in: variantesTelefone(telefone) }, direcao: 'entrada' },
        select: { id: true },
      }));
    const enviar = async (
      unidadeId: string,
      cliente: { id: string; nome: string; telefone: string },
      automacao: Automacao,
      tipo: 'convite_retorno' | 'parabens' | 'aviso_clube',
      valores: Partial<Record<'plano' | 'valor' | 'vencimento', string>> = {},
      depois: string[] = [],
    ) => {
      const u = await unidadeDoEnvio(unidadeId);
      if (!u || u.enviadas >= LIMITE_AUTOMACOES_DIA) return false;
      if (!(await conversou(unidadeId, cliente.telefone))) return false;
      const texto = preencher(mensagens[tipo], {
        cliente: primeiroNome(cliente.nome),
        barbearia: conta.nome,
        unidade: u.nome,
        link: u.link,
        ...valores,
      });
      for (const t of [texto, ...depois]) {
        const m = await tx.mensagem.create({
          data: {
            unidadeId,
            clienteId: cliente.id,
            telefone: cliente.telefone,
            direcao: 'saida',
            texto: t,
            status: 'pendente',
            automacao,
          },
          select: { id: true },
        });
        u.ids.push(m.id);
      }
      u.enviadas++;
      return true;
    };

    const clientes = await tx.cliente.findMany({
      where: { consentimentoMsg: true, telefone: { not: null } },
      select: {
        id: true,
        nome: true,
        telefone: true,
        aniversario: true,
        retornoConvidadoEm: true,
        aniversarioEnviadoEm: true,
      },
    });
    const comHorario = new Set(
      (
        await tx.agendamento.findMany({
          where: {
            inicio: { gt: agora },
            status: { in: ['agendado', 'confirmado'] },
            clienteId: { not: null },
          },
          select: { clienteId: true },
        })
      ).map((a) => a.clienteId!),
    );

    for (const c of clientes) {
      const cliente = { id: c.id, nome: c.nome, telefone: c.telefone! };
      const v = visitas.get(c.id);
      // Aniversário: uma vez por ano, pela unidade da última visita.
      if (
        config.aniversario &&
        v &&
        c.aniversario &&
        ehAniversario(c.aniversario.toISOString().slice(0, 10), hoje) &&
        (!c.aniversarioEnviadoEm ||
          dataLocal(c.aniversarioEnviadoEm).slice(0, 4) !== hoje.slice(0, 4))
      ) {
        if (await enviar(v.unidadeId, cliente, 'aniversario', 'parabens')) {
          await tx.cliente.update({ where: { id: c.id }, data: { aniversarioEnviadoEm: agora } });
          continue; // no dia do parabéns, não manda o convite de retorno também
        }
      }
      if (
        config.retorno &&
        v &&
        deveConvidarRetorno({
          ultimaVisita: v.datas[0]!,
          intervaloDias: intervaloHabitual(v.datas, config.retornoDiasPadrao),
          convidadoEm: c.retornoConvidadoEm,
          temHorarioMarcado: comHorario.has(c.id),
          agora,
        }) &&
        (await enviar(v.unidadeId, cliente, 'retorno', 'convite_retorno'))
      )
        await tx.cliente.update({ where: { id: c.id }, data: { retornoConvidadoEm: agora } });
    }

    // Clube: aviso ao assinante até 3 dias antes de renovar, um por ciclo, com o Pix.
    if (config.avisoClube) {
      const limite = somarDiasIso(hoje, AVISO_CLUBE_DIAS);
      const adesoes = await tx.adesaoClube.findMany({
        where: {
          status: 'ativa',
          avisoVencimentoEm: null,
          vencimento: { gt: dataBanco(hoje), lte: dataBanco(limite) },
          cliente: { consentimentoMsg: true, telefone: { not: null } },
        },
        include: { cliente: true, itemClube: true },
      });
      const pix = recebimentoPixSchema.safeParse(conta.pix);
      for (const a of adesoes) {
        const vencimento = a.vencimento.toISOString().slice(0, 10);
        const copia = pix.success
          ? pixCopiaECola({
              ...pix.data,
              valor: a.itemClube.valor,
              identificador: `CLUBE${a.id.slice(0, 8)}`,
            })
          : null;
        const enviou = await enviar(
          a.itemClube.unidadeId,
          { id: a.cliente.id, nome: a.cliente.nome, telefone: a.cliente.telefone! },
          'clube',
          'aviso_clube',
          {
            plano: a.itemClube.nome,
            valor: formatarMoeda(a.itemClube.valor),
            vencimento: `${vencimento.slice(8, 10)}/${vencimento.slice(5, 7)}`,
          },
          copia ? [copia] : [],
        );
        if (enviou)
          await tx.adesaoClube.update({ where: { id: a.id }, data: { avisoVencimentoEm: agora } });
      }
    }
    return [...unidades.values()]
      .filter((u) => u.ids.length > 0)
      .map((u) => ({ contaId, instancia: u.instancia, mensagemIds: u.ids }));
  });
}

/**
 * Números de cada automação no período: mensagens que saíram (não descartadas), quantas o
 * cliente respondeu em até 48 h e quantos horários ele marcou em até 7 dias.
 */
export async function numerosDasAutomacoes(
  tx: Tx,
  filtro: Prisma.MensagemWhereInput,
  de: Date,
  ate: Date,
): Promise<NumerosAutomacao[]> {
  const saidas = await tx.mensagem.findMany({
    where: {
      ...filtro,
      direcao: 'saida',
      automacao: { in: [...AUTOMACOES] },
      status: { not: 'descartada' },
      criadoEm: { gte: de, lt: ate },
    },
    select: { unidadeId: true, telefone: true, clienteId: true, automacao: true, criadoEm: true },
  });
  const numeros = new Map<string, NumerosAutomacao>(
    AUTOMACOES.map((a) => [a, { automacao: a, enviadas: 0, respondidas: 0, agendamentos: 0 }]),
  );
  for (const m of saidas) {
    const n = numeros.get(m.automacao!)!;
    n.enviadas++;
    const respondeu = await tx.mensagem.findFirst({
      where: {
        unidadeId: m.unidadeId,
        telefone: { in: variantesTelefone(m.telefone) },
        direcao: 'entrada',
        criadoEm: {
          gt: m.criadoEm,
          lte: new Date(m.criadoEm.getTime() + RESPOSTA_ATE_H * 3_600_000),
        },
      },
      select: { id: true },
    });
    if (respondeu) n.respondidas++;
    if (m.clienteId) {
      const marcou = await tx.agendamento.findFirst({
        where: {
          clienteId: m.clienteId,
          criadoEm: {
            gt: m.criadoEm,
            lte: new Date(m.criadoEm.getTime() + AGENDOU_ATE_DIAS * 86_400_000),
          },
        },
        select: { id: true },
      });
      if (marcou) n.agendamentos++;
    }
  }
  return [...numeros.values()];
}

// Central de avisos (Etapa 15): comandas pendentes viram aviso para a recepção, uma vez.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dataParaBanco } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contasParaAvisos,
  criarPrisma,
  naConta,
  rotinaComandasPendentes,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
let unidadeId = '';
let profissionalId = '';
let recepcaoId = '';
let donoId = '';
let barbeiroId = '';
// Terça, 01/12/2026, 15:00 em São Paulo.
const agora = new Date('2026-12-01T18:00:00Z');
const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

async function comanda(fimLocal: string, status: 'prevista' | 'em_atendimento' | 'confirmada') {
  return naMinhaConta(async (tx) => {
    const fim = new Date(`2026-12-01T${fimLocal}:00-03:00`);
    const ag = await tx.agendamento.create({
      data: {
        unidadeId,
        profissionalId,
        inicio: new Date(fim.getTime() - 30 * 60_000),
        fim,
      },
    });
    return tx.comanda.create({
      data: { unidadeId, profissionalId, agendamentoId: ag.id, status },
    });
  });
}

const avisosDe = (usuarioId: string) =>
  naMinhaConta((tx) => tx.aviso.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }));

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Teste avisos' } });
    unidadeId = (await tx.unidade.create({ data: { nome: 'Centro' } })).id;
    const usuario = (nome: string) =>
      tx.usuario.create({ data: { nome, email: `${randomUUID()}@teste.dev` } });
    donoId = (await usuario('Dono')).id;
    recepcaoId = (await usuario('Recepção')).id;
    barbeiroId = (await usuario('Rafael Moura')).id;
    await tx.papelUsuario.createMany({
      data: [
        { usuarioId: donoId, papel: 'dono', unidadeId: null },
        { usuarioId: recepcaoId, papel: 'recepcao', unidadeId },
        { usuarioId: barbeiroId, papel: 'barbeiro', unidadeId },
      ],
    });
    profissionalId = (
      await tx.profissional.create({
        data: {
          usuarioId: barbeiroId,
          unidadeId,
          dataEntrada: dataParaBanco('2026-01-01'),
          horarios: { create: [{ diaSemana: 2, inicioMin: 9 * 60, fimMin: 19 * 60 }] },
        },
      })
    ).id;
  });
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('comandas pendentes', () => {
  it('a rotina enxerga a conta sem entrar nela', async () => {
    expect(await contasParaAvisos(prisma)).toContain(conta);
  });

  it('avisa a recepção das que passaram do fim sem confirmação, uma vez só', async () => {
    const atrasada = await comanda('14:00', 'em_atendimento');
    await comanda('14:50', 'em_atendimento'); // ainda na tolerância de 15 min
    await comanda('13:00', 'confirmada'); // confirmada: é da recepção fechar, não é pendente

    await rotinaComandasPendentes(prisma, conta, agora);
    const primeira = await avisosDe(recepcaoId);
    expect(primeira).toHaveLength(1);
    expect(primeira[0]).toMatchObject({
      tipo: 'comandas_pendentes',
      titulo: 'Comanda esperando confirmação',
      link: '/comandas',
      lidoEm: null,
    });
    expect(primeira[0]!.texto).toContain('Rafael, até 14:00');
    // Barbeiro e dono não recebem (há recepção na unidade).
    expect(await avisosDe(barbeiroId)).toHaveLength(0);
    expect(await avisosDe(donoId)).toHaveLength(0);
    const marcada = await naMinhaConta((tx) =>
      tx.comanda.findUniqueOrThrow({ where: { id: atrasada.id } }),
    );
    expect(marcada.pendenteAvisadaEm).not.toBeNull();

    // 15 min depois: a das 14:50 virou pendente; só ela entra no aviso novo.
    await rotinaComandasPendentes(prisma, conta, new Date(agora.getTime() + 15 * 60_000));
    const segunda = await avisosDe(recepcaoId);
    expect(segunda).toHaveLength(2);
    expect(segunda[1]!.texto).toContain('até 14:50');
    expect(segunda[1]!.texto).toContain('2 comandas pendentes');

    // Nada novo: não repete.
    await rotinaComandasPendentes(prisma, conta, new Date(agora.getTime() + 30 * 60_000));
    expect(await avisosDe(recepcaoId)).toHaveLength(2);
  });

  it('fora do expediente não roda', async () => {
    await comanda('08:00', 'prevista');
    // 23h: muito depois do último turno (19h).
    await rotinaComandasPendentes(prisma, conta, new Date('2026-12-02T02:00:00Z'));
    expect(await avisosDe(recepcaoId)).toHaveLength(2);
  });
});

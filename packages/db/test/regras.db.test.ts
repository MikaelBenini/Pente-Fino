// Regras guardadas no banco: agenda sem sobreposição, vigência, auditoria imutável e CHECKs.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dataParaBanco } from '@pente-fino/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  criarPrisma,
  naConta,
  precoDoProfissional,
  precoServicoVigente,
  regraComissaoVigente,
  type PrismaClient,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

let prisma: PrismaClient;
const conta = randomUUID();
let unidadeId = '';
let profissionalId = '';
let servicoId = '';
let usuarioId = '';

const naMinhaConta = <T>(fn: Parameters<typeof naConta<T>>[2]) => naConta(prisma, conta, fn);

beforeAll(async () => {
  prisma = criarPrisma();
  await naMinhaConta(async (tx) => {
    await tx.conta.create({ data: { id: conta, nome: 'Teste regras' } });
    unidadeId = (await tx.unidade.create({ data: { nome: 'Centro' } })).id;
    usuarioId = (
      await tx.usuario.create({ data: { nome: 'Barbeiro', email: `${randomUUID()}@teste.dev` } })
    ).id;
    profissionalId = (
      await tx.profissional.create({
        data: { usuarioId, unidadeId, dataEntrada: dataParaBanco('2026-01-01') },
      })
    ).id;
    servicoId = (
      await tx.servico.create({ data: { nome: 'Corte', duracaoMin: 30, unidadeIds: [unidadeId] } })
    ).id;
    await tx.precoServico.createMany({
      data: [
        { servicoId, unidadeId, valor: 4000, vigenciaInicio: dataParaBanco('2026-01-01') },
        { servicoId, unidadeId, valor: 4500, vigenciaInicio: dataParaBanco('2026-10-15') },
      ],
    });
    await tx.regraComissao.createMany({
      data: [
        {
          profissionalId,
          tipoItem: 'servico',
          percentualBp: 4000,
          vigenciaInicio: dataParaBanco('2026-01-01'),
        },
        {
          profissionalId,
          tipoItem: 'servico',
          percentualBp: 4500,
          vigenciaInicio: dataParaBanco('2026-10-15'),
        },
        {
          profissionalId,
          tipoItem: 'produto',
          valorFixo: 500,
          vigenciaInicio: dataParaBanco('2026-01-01'),
        },
      ],
    });
  });
});

afterAll(async () => {
  await naMinhaConta((tx) => tx.conta.deleteMany({ where: { id: conta } }));
  await prisma.$disconnect();
});

describe('preço por barbeiro', () => {
  it('vale o do barbeiro a partir da vigência; antes dela, ou depois de voltar (nulo), o da unidade', async () => {
    await naMinhaConta(async (tx) => {
      await tx.precoProfissional.createMany({
        data: [
          { profissionalId, servicoId, valor: 6000, vigenciaInicio: dataParaBanco('2026-11-01') },
          { profissionalId, servicoId, valor: null, vigenciaInicio: dataParaBanco('2026-12-01') },
        ],
      });
      const preco = (dia: string) =>
        precoDoProfissional(tx, servicoId, profissionalId, unidadeId, dia);
      expect(await preco('2026-10-20')).toBe(4500); // antes: o da unidade
      expect(await preco('2026-11-15')).toBe(6000); // o dele
      expect(await preco('2026-12-10')).toBe(4500); // voltou para o da unidade
      // Outro barbeiro (sem preço próprio) segue a unidade.
      expect(await precoDoProfissional(tx, servicoId, randomUUID(), unidadeId, '2026-11-15')).toBe(
        4500,
      );
    });
  });
});

describe('vigência de preço e comissão', () => {
  it('preço vigente é o da maior vigência até a data', async () => {
    await naMinhaConta(async (tx) => {
      expect(await precoServicoVigente(tx, servicoId, unidadeId, '2026-10-14')).toBe(4000);
      expect(await precoServicoVigente(tx, servicoId, unidadeId, '2026-10-15')).toBe(4500);
      expect(await precoServicoVigente(tx, servicoId, unidadeId, '2025-12-31')).toBeUndefined();
    });
  });

  it('regra de comissão vigente por tipo de item', async () => {
    await naMinhaConta(async (tx) => {
      expect(
        (await regraComissaoVigente(tx, profissionalId, 'servico', '2026-06-01'))?.percentualBp,
      ).toBe(4000);
      expect(
        (await regraComissaoVigente(tx, profissionalId, 'servico', '2026-11-03'))?.percentualBp,
      ).toBe(4500);
      expect(
        (await regraComissaoVigente(tx, profissionalId, 'produto', '2026-11-03'))?.valorFixo,
      ).toBe(500);
    });
  });

  it('a função SQL de comissão concorda com a consulta em TypeScript', async () => {
    await naMinhaConta(async (tx) => {
      const [linha] = await tx.$queryRaw<{ percentual_bp: number }[]>`
        SELECT percentual_bp FROM regra_comissao_vigente(${profissionalId}::uuid, 'servico', '2026-11-03')`;
      expect(linha?.percentual_bp).toBe(4500);
    });
  });

  it('não aceita duas regras do mesmo tipo na mesma data', async () => {
    await expect(
      naMinhaConta((tx) =>
        tx.regraComissao.create({
          data: {
            profissionalId,
            tipoItem: 'servico',
            percentualBp: 5000,
            vigenciaInicio: dataParaBanco('2026-10-15'),
          },
        }),
      ),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('regra precisa ser percentual ou valor fixo, não os dois', async () => {
    await expect(
      naMinhaConta((tx) =>
        tx.regraComissao.create({
          data: {
            profissionalId,
            tipoItem: 'servico',
            percentualBp: 4000,
            valorFixo: 100,
            vigenciaInicio: dataParaBanco('2026-12-01'),
          },
        }),
      ),
    ).rejects.toThrow(/regra_percentual_ou_fixo/);
  });
});

describe('agenda', () => {
  const agendar = (inicio: string, fim: string, status: 'agendado' | 'cancelado' = 'agendado') =>
    naMinhaConta((tx) =>
      tx.agendamento.create({
        data: { unidadeId, profissionalId, inicio: new Date(inicio), fim: new Date(fim), status },
      }),
    );

  it('recusa dois agendamentos sobrepostos do mesmo profissional', async () => {
    await agendar('2026-12-01T13:00:00Z', '2026-12-01T13:40:00Z');
    await expect(agendar('2026-12-01T13:30:00Z', '2026-12-01T14:00:00Z')).rejects.toThrow(
      /agendamento_sem_sobreposicao/,
    );
  });

  it('aceita um horário que começa quando o outro termina', async () => {
    await expect(agendar('2026-12-01T13:40:00Z', '2026-12-01T14:20:00Z')).resolves.toBeDefined();
  });

  it('agendamento cancelado libera o horário', async () => {
    await agendar('2026-12-02T13:00:00Z', '2026-12-02T13:40:00Z', 'cancelado');
    await expect(agendar('2026-12-02T13:00:00Z', '2026-12-02T13:40:00Z')).resolves.toBeDefined();
  });
});

describe('auditoria', () => {
  it('não pode ser alterada nem apagada', async () => {
    const registro = await naMinhaConta((tx) =>
      tx.auditoria.create({
        data: {
          usuarioId,
          entidade: 'comanda',
          entidadeId: randomUUID(),
          acao: 'reabrir',
          motivo: 'teste',
        },
      }),
    );
    await expect(
      naMinhaConta((tx) =>
        tx.auditoria.update({ where: { id: registro.id }, data: { motivo: 'apagando rastro' } }),
      ),
    ).rejects.toThrow(/permission denied|imutável/);
    await expect(
      naMinhaConta((tx) => tx.auditoria.delete({ where: { id: registro.id } })),
    ).rejects.toThrow(/permission denied|imutável/);
  });
});

describe('dinheiro e itens', () => {
  it('item de comanda de serviço exige o serviço', async () => {
    await expect(
      naMinhaConta(async (tx) => {
        const comanda = await tx.comanda.create({ data: { unidadeId, profissionalId } });
        return tx.itemComanda.create({
          data: { comandaId: comanda.id, tipo: 'servico', precoUnitario: 4500 },
        });
      }),
    ).rejects.toThrow(/item_tipo_consistente/);
  });

  it('total líquido precisa bater com bruto menos desconto', async () => {
    await expect(
      naMinhaConta((tx) =>
        tx.comanda.create({
          data: { unidadeId, profissionalId, totalBruto: 5000, desconto: 500, totalLiquido: 5000 },
        }),
      ),
    ).rejects.toThrow(/comanda_totais_validos/);
  });

  it('telefone de cliente só com dígitos e DDI', async () => {
    await expect(
      naMinhaConta((tx) =>
        tx.cliente.create({ data: { nome: 'Fulano', telefone: '(11) 99999-0000' } }),
      ),
    ).rejects.toThrow(/cliente_telefone_digitos/);
  });
});

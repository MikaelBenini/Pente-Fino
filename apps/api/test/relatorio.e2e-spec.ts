// Relatório do mês (Etapa 23.1): números do mês e do anterior, custo e lucro do barbeiro (com o
// valor fixo), mix de serviços e os 12 meses. Comandas fechadas gravadas direto no banco em dois meses.
import type { INestApplication } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient } from '@pente-fino/db';
import {
  compararMeses,
  custoELucroDoBarbeiro,
  dataLocal,
  mesAnteriorDe,
  type RelatorioDoMes,
} from '@pente-fino/shared';
import type request from 'supertest';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

const binario = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (c: Buffer) => partes.push(c));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

let app: INestApplication<App>;
let a: Cenario;
let prisma: PrismaClient;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let prof = '';
const mes = dataLocal(new Date()).slice(0, 7);
const anterior = mesAnteriorDe(mes);

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  prisma = criarPrisma();
  dono = await como(app, a.emails.dono);
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        nome: 'Rui Relatório',
        email: `rui-${Date.now()}@e2e.pentefino.dev`,
        dataEntrada: `${anterior}-01`,
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  await dono.patch(`/profissionais/${prof}`, { custoFixoMensal: 100_000 }).expect(200);
  const corte = (
    await dono
      .post('/servicos', {
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 500,
        ehExtra: false,
        pesoAtendimento: 1,
      })
      .expect(201)
  ).body.id as string;
  // Dois atendimentos no mês anterior e três neste (R$ 50,00 cada, custo R$ 5, comissão 40%), no
  // dia 1º: no mês corrente a comparação é com os mesmos dias do mês anterior.
  await naConta(prisma, a.contaId, async (tx) => {
    const fechar = async (dia: string) => {
      const cliente = await tx.cliente.create({
        data: { nome: `Cliente ${dia}`, telefone: `55119${Math.floor(Math.random() * 1e8)}` },
      });
      const c = await tx.comanda.create({
        data: {
          unidadeId: a.unidadeA,
          profissionalId: prof,
          clienteId: cliente.id,
          status: 'fechada',
          fechadaEm: new Date(`${dia}T15:00:00-03:00`),
          totalBruto: 5000,
          totalLiquido: 5000,
        },
      });
      await tx.itemComanda.create({
        data: {
          comandaId: c.id,
          tipo: 'servico',
          servicoId: corte,
          profissionalId: prof,
          quantidade: 1,
          precoUnitario: 5000,
          custoUnitario: 500,
          pesoAtendimento: 1,
          comissaoPercentualBp: 4000,
          comissaoValor: 2000,
        },
      });
    };
    for (const d of ['01', '01']) await fechar(`${anterior}-${d}`);
    for (const d of ['01', '01', '01']) await fechar(`${mes}-${d}`);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  await a.remover();
  await app.close();
});

describe('relatório do mês', () => {
  it('só dono e gestor; mês futuro é recusado', async () => {
    await (await como(app, a.emails.barbeiro)).get(`/relatorio/mes?mes=${mes}`).expect(403);
    const [ano, m] = mes.split('-').map(Number) as [number, number];
    const futuro = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`;
    await dono.get(`/relatorio/mes?mes=${futuro}`).expect(400);
  });

  it('compara o mês com o anterior, mostra o barbeiro com custo e lucro e o mix', async () => {
    const r = (await dono.get(`/relatorio/mes?mes=${mes}&unidadeId=${a.unidadeA}`).expect(200))
      .body as RelatorioDoMes;
    expect(r).toMatchObject({ mes, mesAnterior: anterior });
    expect(r.atual).toMatchObject({ faturamento: 15_000, clientes: 3, clientesNovos: 3 });
    expect(r.anterior).toMatchObject({ faturamento: 10_000, clientes: 2 });
    const fat = compararMeses(r.atual, r.anterior).find((l) => l.chave === 'faturamento')!;
    expect(fat).toMatchObject({ tendencia: 'melhorou' });
    expect(fat.variacao).toBeCloseTo(0.5);

    const rui = r.barbeiros.find((b) => b.profissionalId === prof)!;
    expect(rui).toMatchObject({
      faturamento: 15_000,
      comissao: 6_000,
      custoFixo: 100_000,
      custoProdutos: 1_500,
      faturamentoAnterior: 10_000,
      servicosMaisFeitos: [{ nome: 'Corte', quantidade: 3 }],
    });
    expect(custoELucroDoBarbeiro(rui)).toEqual({ custo: 106_000, lucro: 15_000 - 1_500 - 106_000 });
    expect(rui.ocupacao).toBeGreaterThanOrEqual(0);
    expect(rui.percentualNoPrazo).toBeGreaterThanOrEqual(0);
    // Mês corrente: projeção do faturamento no ritmo atual.
    expect(r.projecao).not.toBeNull();
    expect(r.projecao!.diasDoMes).toBeGreaterThanOrEqual(r.projecao!.diasTrabalhados);

    expect(r.mixAtual).toEqual([
      expect.objectContaining({ tipo: 'servico', nome: 'Corte', quantidade: 3, receita: 15_000 }),
    ]);
    // Painel M2: sem meses vazios antes de a conta existir; o mês anterior tem atendimento
    // (histórico importado), então entra mesmo a conta tendo sido criada agora.
    expect(r.historico.map((h) => h.mes)).toEqual([anterior, mes]);
    expect(r.historico.at(-1)).toMatchObject({ mes, faturamento: 15_000 });
    expect(r.historico.at(-2)).toMatchObject({ mes: anterior, faturamento: 10_000 });
  });

  it('ocupação da agenda: a mesma conta da tela de ocupação, no mesmo período', async () => {
    const r = (await dono.get(`/relatorio/mes?mes=${mes}&unidadeId=${a.unidadeA}`).expect(200))
      .body as RelatorioDoMes;
    const { de, ate } = r.periodoAnterior;
    const o = (await dono.get(`/ocupacao?unidadeId=${a.unidadeA}&de=${de}&ate=${ate}`).expect(200))
      .body as { total: { disponivelMin: number; fracao: number } };
    const esperado = o.total.disponivelMin > 0 ? o.total.fracao : null;
    if (esperado === null) expect(r.anterior.ocupacao).toBeNull();
    else expect(r.anterior.ocupacao).toBeCloseTo(esperado, 6);
    expect(compararMeses(r.atual, r.anterior).map((l) => l.chave)).toContain('ocupacao');
  });

  it('baixa o relatório em planilha e em PDF, com o mesmo conteúdo da tela', async () => {
    const csv = await dono
      .get(`/relatorio/mes/arquivo?mes=${mes}&unidadeId=${a.unidadeA}&formato=csv`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toBe(`attachment; filename="relatorio-${mes}.csv"`);
    const texto = (csv.body as Buffer).toString('utf-8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto).toContain('O MÊS EM NÚMEROS');
    expect(texto).toContain('Faturamento;R$ 150,00;R$ 100,00;+50%;Melhorou');
    expect(texto).toContain('Agenda ocupada;');
    expect(texto).toMatch(/Rui Relatório;150,00;\+50%;60,00;1\.000,00;1\.060,00;/);
    expect(texto).toMatch(/Corte;Serviço;3;100%;150,00;100%;\+50%/);

    const pdf = await dono
      .get(`/relatorio/mes/arquivo?mes=${mes}&formato=pdf`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('arquivo: só dono e gestor, formato conferido', async () => {
    await dono.get(`/relatorio/mes/arquivo?mes=${mes}&formato=xlsx`).expect(400);
    await dono.get(`/relatorio/mes/arquivo?mes=${mes}`).expect(400);
    await (
      await como(app, a.emails.recepcao)
    )
      .get(`/relatorio/mes/arquivo?mes=${mes}&formato=csv`)
      .expect(403);
    await (
      await como(app, a.emails.barbeiro)
    )
      .get(`/relatorio/mes/arquivo?mes=${mes}&formato=pdf`)
      .expect(403);
  });

  it('sem "Ficha e ranking" no plano, o relatório e o arquivo vêm sem os barbeiros', async () => {
    const plano = (p: 'basico' | 'premium') =>
      naConta(prisma, a.contaId, (tx) => tx.conta.updateMany({ data: { plano: p } }));
    await plano('basico');
    try {
      const r = (await dono.get(`/relatorio/mes?mes=${mes}`).expect(200)).body as RelatorioDoMes;
      expect(r).toMatchObject({ verBarbeiros: false, verLucro: false, barbeiros: [] });
      expect(r.atual.lucro).toBeNull();
      const csv = await dono
        .get(`/relatorio/mes/arquivo?mes=${mes}&formato=csv`)
        .buffer(true)
        .parse(binario)
        .expect(200);
      const texto = (csv.body as Buffer).toString('utf-8');
      expect(texto).not.toContain('BARBEIROS');
      expect(texto).not.toContain('Rui Relatório');
    } finally {
      await plano('premium');
    }
  });

  it('o valor fixo do barbeiro não aparece para quem não é da gestão', async () => {
    const lista = (await (await como(app, a.emails.recepcao)).get('/profissionais').expect(200))
      .body as { id: string; custoFixoMensal: number | null }[];
    expect(lista.find((p) => p.id === prof)?.custoFixoMensal ?? null).toBeNull();
    const doDono = (await dono.get('/profissionais').expect(200)).body as typeof lista;
    expect(doDono.find((p) => p.id === prof)?.custoFixoMensal).toBe(100_000);
  });
});

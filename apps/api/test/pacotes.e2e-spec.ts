// Fase 1d (E2): pacotes de sessões, igual ao clube nos números (decisão do dono, 28/11/2026).
import type { INestApplication } from '@nestjs/common';
import {
  dataLocal,
  type ComandaDetalhe,
  type Indicadores,
  type PacoteDetalhe,
  type PacoteDoCliente,
} from '@pente-fino/shared';
import type { App } from 'supertest/types.js';
import { como, criarApp, criarCenario, type Cenario } from './ajudantes.js';

let app: INestApplication<App>;
let a: Cenario;
type Cliente = Awaited<ReturnType<typeof como>>;
let dono: Cliente;
let recepcao: Cliente;
let barbeiro: Cliente;
let drenagem = '';
let limpeza = '';
let prof = '';
let clienteId = '';
let pacoteId = '';
const hoje = dataLocal(new Date());

const pacote = () => ({
  nome: '3 drenagens',
  unidadeId: a.unidadeA,
  servicoId: drenagem,
  sessoes: 3,
  validadeDias: 90,
  valor: 24000,
});

beforeAll(async () => {
  app = await criarApp();
  a = await criarCenario();
  dono = await como(app, a.emails.dono);
  recepcao = await como(app, a.emails.recepcao);
  barbeiro = await como(app, a.emails.barbeiro);
  const servico = async (nome: string) =>
    (
      await dono
        .post('/servicos', {
          nome,
          duracaoMin: 60,
          custoProduto: 0,
          ehExtra: false,
          pesoAtendimento: 1,
        })
        .expect(201)
    ).body.id as string;
  drenagem = await servico('Drenagem');
  limpeza = await servico('Limpeza de pele');
  await dono
    .post('/precos', {
      vigenciaInicio: hoje,
      precos: [
        { servicoId: drenagem, unidadeId: a.unidadeA, valor: 10000 },
        { servicoId: limpeza, unidadeId: a.unidadeA, valor: 15000 },
      ],
    })
    .expect(201);
  const usuarios = (await dono.get('/usuarios')).body as { id: string; email: string }[];
  prof = (
    await dono
      .post('/profissionais', {
        unidadeId: a.unidadeA,
        usuarioId: usuarios.find((u) => u.email === a.emails.barbeiro)!.id,
        dataEntrada: `${hoje.slice(0, 7)}-01`,
        comissaoServico: { percentualBp: 4000, valorFixo: null },
        comissaoProduto: { percentualBp: 1000, valorFixo: null },
      })
      .expect(201)
  ).body.id;
  clienteId = (
    await recepcao
      .post('/clientes', { nome: 'Cliente Pacote', telefone: '11977004001' })
      .expect(201)
  ).body.id;
});

afterAll(async () => {
  await a.remover();
  await app.close();
});

const comanda = async (servicoIds: string[]) =>
  (
    await dono
      .post('/comandas', { unidadeId: a.unidadeA, profissionalId: prof, clienteId, servicoIds })
      .expect(201)
  ).body as ComandaDetalhe;

describe('pacotes de sessões', () => {
  it('só com a função ligada; dono e gestor cadastram, a recepção não', async () => {
    await dono.put('/conta/funcoes', { funcoes: [] }).expect(200);
    const desligada = await dono.post('/pacotes', pacote()).expect(400);
    expect(desligada.body.erro.codigo).toBe('funcao_desligada');
    await dono.put('/conta/funcoes', { funcoes: ['pacotes'] }).expect(200);
    await recepcao.post('/pacotes', pacote()).expect(403);
    await dono.post('/pacotes', { ...pacote(), sessoes: 1 }).expect(400);
    pacoteId = (await dono.post('/pacotes', pacote()).expect(201)).body.id;
    const lista = (await recepcao.get('/pacotes').expect(200)).body as PacoteDetalhe[];
    expect(lista).toEqual([
      expect.objectContaining({ id: pacoteId, servico: 'Drenagem', sessoes: 3, ativos: 0 }),
    ]);
    await barbeiro.get('/pacotes').expect(403);
  });

  it('a recepção vende; o cliente vê o saldo e até quando vale', async () => {
    await recepcao.post('/pacotes/vender', { pacoteId, clienteId, forma: 'pix' }).expect(201);
    const [p] = (await barbeiro.get(`/pacotes/cliente/${clienteId}`).expect(200))
      .body as PacoteDoCliente[];
    expect(p).toMatchObject({
      nome: '3 drenagens',
      sessoes: 3,
      usadas: 0,
      saldo: 3,
      valorPago: 24000,
      vendidoEm: hoje,
      situacao: 'ativo',
    });
    expect(p!.validoAte > hoje).toBe(true);
  });

  it('a sessão sai com valor zero; o que passa do saldo e outro serviço entram com preço', async () => {
    const c1 = await comanda([drenagem, limpeza]);
    expect(c1.itens.map((i) => [i.descricao, i.precoUnitario, i.cobertoPacote])).toEqual([
      ['Drenagem', 0, true],
      ['Limpeza de pele', 15000, false],
    ]);
    await comanda([drenagem]);
    await comanda([drenagem]);
    // Quarta drenagem: o pacote (3) acabou, preço normal.
    const c4 = await comanda([drenagem]);
    expect(c4.itens[0]).toMatchObject({ precoUnitario: 10000, cobertoPacote: false });
    const [p] = (await recepcao.get(`/pacotes/cliente/${clienteId}`).expect(200))
      .body as PacoteDoCliente[];
    expect(p).toMatchObject({ usadas: 3, saldo: 0, situacao: 'esgotado' });

    // Comissão da sessão: 40% do preço de tabela (10000) = 4000.
    const fechada = (
      await dono
        .post(`/comandas/${c1.id}/fechar`, { pagamentos: [{ forma: 'pix', valor: 15000 }] })
        .expect(200)
    ).body as ComandaDetalhe;
    expect(fechada.itens.map((i) => [i.descricao, i.comissaoValor])).toEqual([
      ['Drenagem', 4000],
      ['Limpeza de pele', 6000],
    ]);
  });

  it('o pacote entra no faturamento do dia, numa linha própria; a sessão conta como atendimento', async () => {
    const periodo = `de=${hoje.slice(0, 7)}-01&ate=${hoje}&unidadeId=${a.unidadeA}`;
    const r = (await dono.get(`/indicadores?${periodo}`).expect(200)).body as {
      atual: Indicadores;
    };
    expect(r.atual).toMatchObject({
      receitaPacotes: 24000,
      receitaServicos: 15000,
      faturamento: 39000,
      clientes: 1,
      atendimentos: 2,
      atendimentosPacote: 1,
    });
  });

  it('cancelar pede motivo e tira o saldo; o que foi pago continua no mês', async () => {
    await recepcao.post('/pacotes/vender', { pacoteId, clienteId, forma: 'dinheiro' }).expect(201);
    const [novo] = (await recepcao.get(`/pacotes/cliente/${clienteId}`).expect(200))
      .body as PacoteDoCliente[];
    expect(novo).toMatchObject({ saldo: 3, situacao: 'ativo' });
    await recepcao.post(`/pacotes/vendidos/${novo!.id}/cancelar`, { motivo: 'x' }).expect(400);
    await recepcao
      .post(`/pacotes/vendidos/${novo!.id}/cancelar`, { motivo: 'Mudou de cidade' })
      .expect(204);
    const c = await comanda([drenagem]);
    expect(c.itens[0]).toMatchObject({ precoUnitario: 10000, cobertoPacote: false });
    const r = (await dono.get(`/indicadores?de=${hoje.slice(0, 7)}-01&ate=${hoje}`).expect(200))
      .body as { atual: Indicadores };
    expect(r.atual.receitaPacotes).toBe(48000);
  });
});

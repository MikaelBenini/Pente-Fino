import { describe, expect, it } from 'vitest';
import { converterLinha, gerarSlug, lerCsv, lerData, modeloCsv } from './importacao.js';

describe('lerCsv', () => {
  it('lê ponto e vírgula do Excel, com BOM, aspas e cabeçalho com acento', () => {
    const r = lerCsv('\uFEFFNome;Telefone;"Duração (min)"\r\n"Silva; João";11988887777;30\r\n\r\n');
    expect(r.colunas).toEqual(['nome', 'telefone', 'duracao_min']);
    expect(r.linhas).toEqual([{ nome: 'Silva; João', telefone: '11988887777', duracao_min: '30' }]);
  });

  it('lê vírgula e aspas duplas escapadas', () => {
    const r = lerCsv('nome,obs\n"Ana ""Aninha""",ok\n');
    expect(r.linhas[0]).toEqual({ nome: 'Ana "Aninha"', obs: 'ok' });
  });

  it('o modelo baixado volta como uma linha válida', () => {
    for (const tipo of ['clientes', 'servicos', 'precos', 'profissionais'] as const) {
      const { linhas } = lerCsv(modeloCsv(tipo));
      expect(converterLinha(tipo, linhas[0]!).ok).toBe(true);
    }
  });
});

describe('lerData', () => {
  it.each([
    ['25/12/1990', '1990-12-25'],
    ['1/3/2024', '2024-03-01'],
    ['2024-03-01', '2024-03-01'],
  ])('%s → %s', (t, d) => expect(lerData(t)).toBe(d));
  it.each(['31/02/2024', '2024-13-01', 'ontem'])('recusa %s', (t) => expect(lerData(t)).toBeNull());
});

describe('converterLinha', () => {
  it('cliente com telefone e aniversário', () => {
    expect(
      converterLinha('clientes', {
        nome: 'João',
        telefone: '(11) 98888-7777',
        email: '',
        aniversario: '25/12/1990',
      }),
    ).toEqual({
      ok: true,
      valor: {
        tipo: 'clientes',
        nome: 'João',
        telefone: '5511988887777',
        email: null,
        aniversario: '1990-12-25',
      },
    });
  });

  it('explica o erro da linha', () => {
    expect(converterLinha('clientes', { nome: 'João', telefone: '123' })).toEqual({
      ok: false,
      erro: 'Telefone inválido: "123". Use DDD e número.',
    });
    expect(converterLinha('servicos', { nome: 'Corte', duracao_min: 'meia hora' })).toMatchObject({
      ok: false,
      erro: expect.stringMatching(/Duração inválida/),
    });
    expect(
      converterLinha('precos', { servico: 'Corte', unidade: 'Centro', valor: 'grátis' }),
    ).toMatchObject({ ok: false });
  });

  it('serviço extra sem peso informado pesa 0', () => {
    const r = converterLinha('servicos', {
      nome: 'Sobrancelha',
      duracao_min: '10',
      custo_produto: '',
      extra: 'sim',
      peso: '',
    });
    expect(r).toMatchObject({
      ok: true,
      valor: { ehExtra: true, pesoAtendimento: 0, custoProduto: 0 },
    });
  });

  it('profissional: comissão em %, data em DD/MM/AAAA', () => {
    const r = converterLinha('profissionais', {
      nome: 'Rafa',
      email: 'RAFA@X.COM',
      telefone: '',
      unidade: 'Centro',
      data_entrada: '01/03/2024',
      comissao_servico: '42,5',
      comissao_produto: '10',
    });
    expect(r).toMatchObject({
      ok: true,
      valor: {
        email: 'rafa@x.com',
        comissaoServicoBp: 4250,
        comissaoProdutoBp: 1000,
        dataEntrada: '2024-03-01',
      },
    });
  });
});

describe('gerarSlug', () => {
  it('tira acento, espaço e símbolo', () => {
    expect(gerarSlug('  Barbearia São João – Centro!  ')).toBe('barbearia-sao-joao-centro');
  });
});

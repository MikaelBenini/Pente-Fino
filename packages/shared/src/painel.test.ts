import { describe, expect, it } from 'vitest';
import {
  mesesDoHistorico,
  pendenciasDoDia,
  porDiaParaMeta,
  resumoDasMetas,
  type DadosPainelDia,
  type MetaParaResumo,
} from './painel.js';

const base: DadosPainelDia = {
  totais: {
    pendentes: 0,
    aguardandoFechamento: 0,
    faltas: 0,
    aAtender: 3,
    primeiraVez: 0,
    aniversariantes: 0,
  },
  caixa: { situacao: 'aberto', divergencia: null },
  depoisDoMeioDia: true,
  esperandoAtendente: 0,
  whatsappCaido: [],
  notasBaixas: 0,
};

describe('painel do dia', () => {
  it('tudo em dia: nada a fazer', () => {
    expect(pendenciasDoDia(base)).toEqual([]);
  });

  it('ordena por urgência e leva à tela certa', () => {
    const r = pendenciasDoDia({
      ...base,
      totais: { ...base.totais, pendentes: 1, aguardandoFechamento: 3, faltas: 2, primeiraVez: 1 },
      esperandoAtendente: 2,
      whatsappCaido: ['Centro'],
      notasBaixas: 1,
    });
    expect(r.map((p) => p.chave)).toEqual([
      'whatsapp',
      'conversas',
      'notas',
      'confirmar',
      'fechar',
      'faltas',
      'novos',
    ]);
    expect(r.find((p) => p.chave === 'fechar')).toMatchObject({
      texto: '2 comandas prontas para receber e fechar',
      rota: '/comandas',
    });
    expect(r[1]!.texto).toBe('2 clientes esperando atendente no WhatsApp');
  });

  it('caixa: não aberto só vira aviso depois do meio-dia; fechado com diferença é alerta', () => {
    const naoAberto = { ...base, caixa: { situacao: 'nao_aberto' as const, divergencia: null } };
    expect(pendenciasDoDia({ ...naoAberto, depoisDoMeioDia: false })).toEqual([]);
    expect(pendenciasDoDia(naoAberto).map((p) => p.chave)).toEqual(['caixa']);
    expect(
      pendenciasDoDia({ ...base, caixa: { situacao: 'fechado', divergencia: -500 } })[0]!.tom,
    ).toBe('perigo');
    expect(pendenciasDoDia({ ...base, caixa: null })).toEqual([]);
  });

  it('quanto precisa entrar por dia para bater a meta', () => {
    // Meta R$ 30.000, R$ 12.000 feitos, 10 de 25 dias trabalhados: R$ 18.000 em 15 dias.
    expect(porDiaParaMeta({ objetivo: 3_000_000, atual: 1_200_000, fracaoDoMes: 0.4 }, 25)).toBe(
      120_000,
    );
    expect(porDiaParaMeta({ objetivo: 100, atual: 200, fracaoDoMes: 0.5 }, 25)).toBeNull();
    expect(porDiaParaMeta({ objetivo: 300, atual: 0, fracaoDoMes: 1 }, 25)).toBeNull();
  });
});

describe('resumo das metas de serviço (painel M1)', () => {
  const meta = (o: Partial<MetaParaResumo> = {}): MetaParaResumo => ({
    tipo: 'servico',
    servico: 'Corte',
    objetivo: 12,
    atual: 0,
    fracaoDoMes: 0.4,
    ...o,
  });

  it('a meta da auditoria: "Corte · 0 de 12" aparece, abaixo do ritmo', () => {
    expect(resumoDasMetas([meta()])).toEqual({
      valor: '0%',
      detalhe: 'Corte · 0 de 12 · abaixo do ritmo',
    });
    expect(resumoDasMetas([meta({ atual: 6 })])?.detalhe).toBe('Corte · 6 de 12 · no ritmo');
    expect(resumoDasMetas([meta({ atual: 13 })])).toEqual({
      valor: '100%',
      detalhe: 'Corte · 13 de 12 · batida',
    });
  });

  it('várias metas: quantas estão no ritmo; sem meta de serviço, nada', () => {
    expect(
      resumoDasMetas([
        meta({ atual: 6 }),
        meta({ servico: 'Barba' }),
        meta({ servico: 'Pigmentação', atual: 10 }),
      ]),
    ).toEqual({ valor: '2 de 3', detalhe: 'metas de serviço no ritmo · 1 abaixo' });
    expect(resumoDasMetas([meta({ tipo: 'faturamento' })])).toBeNull();
    expect(resumoDasMetas([])).toBeNull();
  });
});

describe('meses do histórico (painel M2)', () => {
  it('não começa antes do mês em que a conta foi criada', () => {
    expect(mesesDoHistorico('2026-11', '2026-11')).toEqual(['2026-11']);
    expect(mesesDoHistorico('2027-02', '2026-11')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('conta antiga: os 12 meses, virando o ano', () => {
    const m = mesesDoHistorico('2026-11', '2024-01');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-12');
    expect(m.at(-1)).toBe('2026-11');
    expect(mesesDoHistorico('2026-11', null)).toHaveLength(12);
  });
});

describe('saúde da conta no Início (seção 7)', () => {
  it('caixa de outro dia aberto, comandas paradas e link desligado', () => {
    const r = pendenciasDoDia({
      ...base,
      saude: { caixaAnterior: { data: '2026-11-13', unidade: 'Centro' }, comandasParadas: 3 },
      linkDesligado: ['Jardins'],
    });
    expect(r.map((p) => [p.chave, p.tom])).toEqual([
      ['caixa-anterior', 'perigo'],
      ['comandas-paradas', 'aviso'],
      ['link', 'neutro'],
    ]);
    expect(r[0]!.texto).toBe('O caixa de 13/11 (Centro) ficou aberto: feche para o dinheiro bater');
    expect(r[1]!.texto).toBe('3 comandas de dias anteriores sem fechar');
    expect(r[2]!.rota).toBe('/configuracoes?aba=link');
    expect(
      pendenciasDoDia({ ...base, saude: { caixaAnterior: null, comandasParadas: 0 } }),
    ).toEqual([]);
  });
});

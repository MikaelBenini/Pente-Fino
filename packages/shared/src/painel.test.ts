import { describe, expect, it } from 'vitest';
import { pendenciasDoDia, porDiaParaMeta, type DadosPainelDia } from './painel.js';

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

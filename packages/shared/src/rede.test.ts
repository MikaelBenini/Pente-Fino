import { describe, expect, it } from 'vitest';
import { destaquesDaRede, totalDaRede, valorDaMetrica, type LinhaDaRede } from './rede.js';

const linha = (id: string, o: Partial<LinhaDaRede>): LinhaDaRede => ({
  unidadeId: id,
  unidade: id,
  faturamento: 0,
  lucro: 0,
  clientes: 0,
  ticketMedio: 0,
  ocupacao: { disponivelMin: 0, agendadoMin: 0, fracao: 0 },
  nota: { media: null, respostas: 0 },
  retorno: { atendidos: 0, voltaramNoPrazo: 0, taxa: 0 },
  ...o,
});

const centro = linha('centro', {
  faturamento: 100000,
  lucro: 40000,
  clientes: 20,
  ticketMedio: 5000,
  ocupacao: { disponivelMin: 600, agendadoMin: 300, fracao: 0.5 },
  nota: { media: 4.5, respostas: 10 },
  retorno: { atendidos: 20, voltaramNoPrazo: 10, taxa: 0.5 },
});
const jardins = linha('jardins', {
  faturamento: 60000,
  lucro: 30000,
  clientes: 10,
  ticketMedio: 6000,
  ocupacao: { disponivelMin: 400, agendadoMin: 300, fracao: 0.75 },
  nota: { media: 4, respostas: 30 },
  retorno: { atendidos: 10, voltaramNoPrazo: 2, taxa: 0.2 },
});

describe('painel da rede', () => {
  it('total pesado pelo tamanho de cada unidade; despesa da conta só no lucro da rede', () => {
    const t = totalDaRede([centro, jardins], 5000);
    expect(t).toMatchObject({
      faturamento: 160000,
      lucro: 65000,
      clientes: 30,
      ticketMedio: 5333,
      ocupacao: { disponivelMin: 1000, agendadoMin: 600, fracao: 0.6 },
      nota: { media: 4.1, respostas: 40 },
      retorno: { atendidos: 30, voltaramNoPrazo: 12, taxa: 0.4 },
    });
  });

  it('destaque: a melhor unidade em cada indicador', () => {
    expect(destaquesDaRede([centro, jardins])).toEqual({
      faturamento: 'centro',
      lucro: 'centro',
      ticketMedio: 'jardins',
      ocupacao: 'jardins',
      nota: 'centro',
      retorno: 'centro',
    });
  });

  it('sem destaque com uma unidade, empate ou sem dado', () => {
    expect(destaquesDaRede([centro]).faturamento).toBeNull();
    const igual = linha('b', { faturamento: 100000 });
    expect(destaquesDaRede([centro, igual]).faturamento).toBeNull();
    expect(destaquesDaRede([linha('a', {}), linha('b', {})]).nota).toBeNull();
    expect(valorDaMetrica(linha('a', {}), 'ticketMedio')).toBeNull();
  });
});

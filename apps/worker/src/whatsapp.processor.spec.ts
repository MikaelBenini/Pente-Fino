import { INTERVALO_MINIMO_ENVIO_MS, type TrabalhoWhatsappSaida } from '@pente-fino/shared';
import { agendarRespostas, FalhasPorConta, type RelogioDeEnvio } from './whatsapp.processor.js';

const resultado = (saidas: string[]) => ({
  tipo: 'respondida' as const,
  contaId: 'conta',
  unidadeId: 'u',
  instancia: 'pf-u',
  clienteId: 'c',
  clienteNovo: false,
  saidas,
  acao: null,
  consentimento: null,
});

function relogioEmMemoria(inicial: number | null = null) {
  let valor = inicial;
  const r: RelogioDeEnvio = {
    ultimo: async () => valor,
    marcar: async (_i, q) => {
      valor = q;
    },
    reservarProativa: async (_i, agora, intervalo, livre) => {
      valor = valor !== null && agora - valor < livre ? Math.max(agora, valor + intervalo) : agora;
      return valor;
    },
  };
  return { r, valor: () => valor };
}

describe('agendarRespostas', () => {
  it('respostas saem em ordem, com o intervalo mínimo entre elas', async () => {
    const agendadas: [TrabalhoWhatsappSaida, number][] = [];
    const { r, valor } = relogioEmMemoria();
    await agendarRespostas(resultado(['m1', 'm2', 'm3']), {
      relogio: r,
      adicionar: async (t, atraso) => agendadas.push([t, atraso]),
      agora: () => 1_000,
      aleatorio: () => 0,
    });
    expect(agendadas).toEqual([
      [{ contaId: 'conta', mensagemId: 'm1' }, 0],
      [{ contaId: 'conta', mensagemId: 'm2' }, INTERVALO_MINIMO_ENVIO_MS],
      [{ contaId: 'conta', mensagemId: 'm3' }, 2 * INTERVALO_MINIMO_ENVIO_MS],
    ]);
    expect(valor()).toBe(1_000 + 2 * INTERVALO_MINIMO_ENVIO_MS);
  });

  it('outra conversa no mesmo número espera a fila de quem veio antes', async () => {
    const atrasos: number[] = [];
    const { r } = relogioEmMemoria(5_000);
    await agendarRespostas(resultado(['m1']), {
      relogio: r,
      adicionar: async (_t, atraso) => atrasos.push(atraso),
      agora: () => 1_000,
      aleatorio: () => 0,
    });
    expect(atrasos).toEqual([5_000 + INTERVALO_MINIMO_ENVIO_MS - 1_000]);
  });

  it('sem respostas não mexe no relógio', async () => {
    const { r, valor } = relogioEmMemoria(null);
    await agendarRespostas(resultado([]), { relogio: r, adicionar: async () => 0 });
    expect(valor()).toBeNull();
  });
});

describe('FalhasPorConta (verificação final, C3)', () => {
  it('sem erro, nada; com erro, quantas contas e o primeiro motivo', () => {
    const f = new FalhasPorConta();
    expect(f.resumo()).toBe('');
    f.anotar('0190a1b2-c3d4-7e5f', new Error('banco caiu'));
    f.anotar('0190a1b2-c3d4-7e5f', new Error('de novo'));
    f.anotar('0290a1b2-c3d4-7e5f', new Error('outro'));
    expect(f.resumo()).toBe(' · 2 contas com erro (0190a1b2: banco caiu)');
  });
});

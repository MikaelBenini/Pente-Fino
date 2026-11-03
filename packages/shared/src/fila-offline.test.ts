import { describe, expect, it } from 'vitest';
import { criarFilaOffline, type Lancamento, type ResultadoEnvio } from './fila-offline.js';

function memoria() {
  let dados: Lancamento[] = [];
  return { ler: async () => [...dados], gravar: async (l: Lancamento[]) => void (dados = l) };
}

const novo = (descricao: string) => ({
  caminho: 'comandas/1/itens',
  metodo: 'POST' as const,
  descricao,
});

describe('fila offline', () => {
  it('envia na ordem e esvazia', async () => {
    const enviados: string[] = [];
    const fila = criarFilaOffline(memoria(), async (l) => {
      enviados.push(l.descricao);
      return { tipo: 'ok' };
    });
    await fila.enfileirar(novo('a'), '1');
    await fila.enfileirar(novo('b'), '2');
    expect(await fila.sincronizar()).toEqual({ enviados: 2, pendentes: 0, recusados: 0 });
    expect(enviados).toEqual(['a', 'b']);
    expect(await fila.listar()).toEqual([]);
  });

  it('para no primeiro sem conexão e mantém a ordem', async () => {
    const respostas: ResultadoEnvio[] = [{ tipo: 'ok' }, { tipo: 'sem_conexao' }];
    const fila = criarFilaOffline(memoria(), async () => respostas.shift() ?? { tipo: 'ok' });
    for (const d of ['a', 'b', 'c']) await fila.enfileirar(novo(d), d);
    expect(await fila.sincronizar()).toEqual({ enviados: 1, pendentes: 2, recusados: 0 });
    expect((await fila.listar()).map((l) => [l.descricao, l.tentativas])).toEqual([
      ['b', 1],
      ['c', 0],
    ]);
  });

  it('recusado pela API fica marcado e não trava os outros', async () => {
    const fila = criarFilaOffline(memoria(), async (l) =>
      l.descricao === 'ruim'
        ? { tipo: 'recusado', mensagem: 'Comanda já fechada.' }
        : { tipo: 'ok' },
    );
    await fila.enfileirar(novo('ruim'), '1');
    await fila.enfileirar(novo('bom'), '2');
    expect(await fila.sincronizar()).toEqual({ enviados: 1, pendentes: 0, recusados: 1 });
    expect((await fila.listar())[0]?.erro).toBe('Comanda já fechada.');
    // Na próxima rodada o recusado não é reenviado.
    expect(await fila.sincronizar()).toEqual({ enviados: 0, pendentes: 0, recusados: 1 });
  });

  it('duas sincronizações ao mesmo tempo viram uma', async () => {
    let chamadas = 0;
    const fila = criarFilaOffline(memoria(), async () => {
      chamadas += 1;
      return { tipo: 'ok' };
    });
    await fila.enfileirar(novo('a'), '1');
    await Promise.all([fila.sincronizar(), fila.sincronizar()]);
    expect(chamadas).toBe(1);
  });
});

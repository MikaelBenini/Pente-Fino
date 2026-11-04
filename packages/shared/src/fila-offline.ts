// Fila de lançamentos feitos sem internet (app do barbeiro). Núcleo puro: o
// armazenamento (IndexedDB no navegador) e o envio são injetados.

export interface Lancamento {
  id: string;
  /** Caminho da API, ex.: "comandas/019a.../itens". */
  caminho: string;
  metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  /** Texto para a tela: "Extra: sobrancelha na comanda de João". */
  descricao: string;
  criadoEm: string;
  tentativas: number;
  /** Último erro que não é falta de conexão (o lançamento parou e precisa de atenção). */
  erro?: string;
}

export interface Armazenamento {
  ler(): Promise<Lancamento[]>;
  gravar(lancamentos: Lancamento[]): Promise<void>;
}

/** Resultado do envio: "ok", "sem_conexao" (tenta de novo depois) ou erro definitivo. */
export type ResultadoEnvio =
  { tipo: 'ok' } | { tipo: 'sem_conexao' } | { tipo: 'recusado'; mensagem: string };

export interface ResumoSincronizacao {
  enviados: number;
  pendentes: number;
  recusados: number;
}

export function criarFilaOffline(
  armazenamento: Armazenamento,
  enviar: (l: Lancamento) => Promise<ResultadoEnvio>,
) {
  let emAndamento: Promise<ResumoSincronizacao> | null = null;

  async function enfileirar(
    dados: Pick<Lancamento, 'caminho' | 'metodo' | 'corpo' | 'descricao'>,
    id: string,
  ) {
    const fila = await armazenamento.ler();
    fila.push({ ...dados, id, criadoEm: new Date().toISOString(), tentativas: 0 });
    await armazenamento.gravar(fila);
  }

  /**
   * Envia na ordem em que foram feitos. Para no primeiro "sem conexão" (a ordem
   * importa: o extra depende da comanda). Recusado pela API fica marcado com o erro e
   * não trava os seguintes.
   */
  async function executar(): Promise<ResumoSincronizacao> {
    const fila = await armazenamento.ler();
    const resumo: ResumoSincronizacao = { enviados: 0, pendentes: 0, recusados: 0 };
    const restantes: Lancamento[] = [];
    let semConexao = false;

    for (const lancamento of fila) {
      if (semConexao || lancamento.erro) {
        restantes.push(lancamento);
        continue;
      }
      const r = await enviar(lancamento);
      if (r.tipo === 'ok') {
        resumo.enviados += 1;
      } else if (r.tipo === 'sem_conexao') {
        semConexao = true;
        restantes.push({ ...lancamento, tentativas: lancamento.tentativas + 1 });
      } else {
        restantes.push({ ...lancamento, tentativas: lancamento.tentativas + 1, erro: r.mensagem });
      }
    }
    await armazenamento.gravar(restantes);
    resumo.recusados = restantes.filter((l) => l.erro).length;
    resumo.pendentes = restantes.length - resumo.recusados;
    return resumo;
  }

  /** Uma sincronização por vez: chamadas simultâneas esperam a que já está rodando. */
  function sincronizar(): Promise<ResumoSincronizacao> {
    emAndamento ??= executar().finally(() => {
      emAndamento = null;
    });
    return emAndamento;
  }

  async function descartar(id: string) {
    await armazenamento.gravar((await armazenamento.ler()).filter((l) => l.id !== id));
  }

  return { enfileirar, sincronizar, descartar, listar: () => armazenamento.ler() };
}

'use client';

// Sugestão aprovada em 13/11: a equipe edita as respostas prontas do chat. Os marcadores {basico},
// {pro}, {premium} e {dias} viram o preço e os dias de teste atuais na hora de usar.
import { MARCADORES_RESPOSTA, type RespostaPronta } from '@pente-fino/shared';
import { Botao, Campo, CampoTexto } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Aviso } from '../aviso';
import { Estado } from '../pagina';
import { adminApi } from './admin-api';

export function RespostasChatAdmin() {
  const cliente = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'config', 'respostas-chat'],
    queryFn: () => adminApi<RespostaPronta[]>('configuracoes/respostas-chat'),
  });
  return (
    <section aria-labelledby="titulo-respostas-chat" className="flex flex-col gap-3">
      <div>
        <h2 id="titulo-respostas-chat" className="text-2xl font-semibold">
          Respostas prontas do chat
        </h2>
        <p className="text-sm text-tinta-suave">
          A equipe usa na aba Chat e ajusta antes de mandar. Use {MARCADORES_RESPOSTA.join(', ')}{' '}
          para o preço e os dias de teste atuais.
        </p>
      </div>
      <Estado consulta={q}>
        {() => (
          <Editor
            inicial={q.data!}
            onSalvo={() => cliente.invalidateQueries({ queryKey: ['admin'] })}
          />
        )}
      </Estado>
    </section>
  );
}

function Editor({ inicial, onSalvo }: { inicial: RespostaPronta[]; onSalvo: () => void }) {
  const [itens, setItens] = useState(inicial);
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (i: number, campo: keyof RespostaPronta, valor: string) =>
    setItens((xs) => xs.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  async function salvar(lista: RespostaPronta[], mensagem: string) {
    setAviso(null);
    setSalvando(true);
    try {
      await adminApi('configuracoes/respostas-chat', { metodo: 'PUT', corpo: lista });
      setAviso({ tom: 'sucesso', texto: mensagem });
      onSalvo();
    } catch (e) {
      setAviso({ tom: 'erro', texto: e instanceof Error ? e.message : 'Não deu para salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3" aria-label="Respostas prontas">
        {itens.map((r, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-3"
          >
            <Campo
              id={`resposta-titulo-${i}`}
              rotulo="Título"
              value={r.titulo}
              maxLength={40}
              onChange={(e) => mudar(i, 'titulo', e.target.value)}
            />
            <CampoTexto
              id={`resposta-texto-${i}`}
              rotulo="Texto"
              value={r.texto}
              maxLength={1000}
              rows={3}
              onChange={(e) => mudar(i, 'texto', e.target.value)}
            />
            <Botao
              variante="secundario"
              className="self-start"
              onClick={() => setItens((xs) => xs.filter((_, j) => j !== i))}
            >
              Tirar esta resposta
            </Botao>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          disabled={itens.length >= 20}
          onClick={() => setItens((xs) => [...xs, { titulo: '', texto: '' }])}
        >
          Nova resposta
        </Botao>
        <Botao carregando={salvando} onClick={() => void salvar(itens, 'Respostas salvas.')}>
          Salvar respostas
        </Botao>
        <Botao
          variante="secundario"
          carregando={salvando}
          onClick={() => void salvar([], 'Voltaram as respostas de fábrica.')}
        >
          Voltar às de fábrica
        </Botao>
      </div>
      <div role="status">{aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}</div>
    </div>
  );
}

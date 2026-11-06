'use client';

import { formatarDataHora, type AvisoDetalhe } from '@pente-fino/shared';
import { Botao, cn, EstadoVazio } from '@pente-fino/ui';
import { BellOff } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { chaveAvisos, useAcao, useAvisos } from '@/lib/consultas';
import { CabecalhoPagina, Estado } from '../pagina';

/** Central de avisos: o que precisa da atenção de quem está logado, com histórico. */
export function TelaAvisos() {
  const avisos = useAvisos();
  const lerTodos = useAcao(() => api('avisos/lidos', { corpo: {} }), [chaveAvisos]);
  const ler = useAcao((id: string) => api(`avisos/${id}/lido`, { corpo: {} }), [chaveAvisos]);
  const naoLidos = avisos.data?.naoLidos ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Avisos"
        pergunta="O que precisa da minha atenção?"
        acao={
          naoLidos > 0 ? (
            <Botao
              variante="secundario"
              carregando={lerTodos.isPending}
              onClick={() => lerTodos.mutate(undefined)}
            >
              Marcar todos como lidos
            </Botao>
          ) : undefined
        }
      />
      <Estado consulta={avisos}>
        {() =>
          avisos.data!.avisos.length === 0 ? (
            <EstadoVazio
              icone={BellOff}
              titulo="Nenhum aviso por enquanto"
              texto="Quando algo precisar de você (comanda esperando o barbeiro, caixa com diferença), aparece aqui."
            />
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Meus avisos">
              {avisos.data!.avisos.map((a) => (
                <ItemAviso key={a.id} a={a} onLer={() => !a.lidoEm && ler.mutate(a.id)} />
              ))}
            </ul>
          )
        }
      </Estado>
    </div>
  );
}

function ItemAviso({ a, onLer }: { a: AvisoDetalhe; onLer: () => void }) {
  const novo = !a.lidoEm;
  const conteudo = (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex items-center gap-2 font-semibold">
          {novo && <span aria-hidden className="size-2 shrink-0 rounded-full bg-aviso" />}
          {a.titulo}
          {novo && <span className="sr-only"> (não lido)</span>}
        </span>
        <span className="text-sm text-tinta-suave tabular-nums">
          {formatarDataHora(a.criadoEm)}
        </span>
      </span>
      <span className="text-tinta-suave">{a.texto}</span>
    </>
  );
  const classe = cn(
    'flex flex-col gap-1 rounded-lg border p-4',
    novo ? 'border-borda-forte bg-superficie' : 'border-borda',
  );
  return (
    <li>
      {a.link ? (
        <Link
          href={a.link}
          onClick={onLer}
          className={cn(
            classe,
            'hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
          )}
        >
          {conteudo}
        </Link>
      ) : (
        <button type="button" onClick={onLer} className={cn(classe, 'w-full text-left')}>
          {conteudo}
        </button>
      )}
    </li>
  );
}

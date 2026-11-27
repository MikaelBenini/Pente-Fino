'use client';

import { ASSUNTO_AVISO, dataLocal, formatarDataHora, type AvisoDetalhe } from '@pente-fino/shared';
import { Botao, cn, EstadoVazio } from '@pente-fino/ui';
import { BellOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { chaveAvisos, useAcao, useAvisos } from '@/lib/consultas';
import { CabecalhoPagina, Estado } from '../pagina';
import { ConviteNotificacoes } from '../notificacoes-aparelho';

/** Central de avisos: o que precisa da atenção de quem está logado, com histórico. */
export function TelaAvisos() {
  const avisos = useAvisos();
  const lerTodos = useAcao(() => api('avisos/lidos', { corpo: {} }), [chaveAvisos]);
  const ler = useAcao((id: string) => api(`avisos/${id}/lido`, { corpo: {} }), [chaveAvisos]);
  const naoLidos = avisos.data?.naoLidos ?? 0;
  // Pedido do dono em 16/11/2026: filtrar e agrupar para achar o que importa.
  const [soNaoLidos, setSoNaoLidos] = useState(false);
  const [assunto, setAssunto] = useState<string | null>(null);

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
      <ConviteNotificacoes />
      <Estado consulta={avisos}>
        {() =>
          avisos.data!.avisos.length === 0 ? (
            <EstadoVazio
              icone={BellOff}
              titulo="Nenhum aviso por enquanto"
              texto="Quando algo precisar de você (cliente esperando no WhatsApp, comanda esperando confirmação, caixa com diferença, avaliação baixa), aparece aqui."
            />
          ) : (
            <ListaDeAvisos
              avisos={avisos.data!.avisos}
              soNaoLidos={soNaoLidos}
              onSoNaoLidos={setSoNaoLidos}
              assunto={assunto}
              onAssunto={setAssunto}
              onLer={(a) => !a.lidoEm && ler.mutate(a.id)}
            />
          )
        }
      </Estado>
    </div>
  );
}

/** "Hoje", "Ontem" ou a data, para agrupar os avisos por dia. */
function diaDoAviso(iso: string, hoje: string, ontem: string): string {
  const dia = dataLocal(new Date(iso));
  if (dia === hoje) return 'Hoje';
  if (dia === ontem) return 'Ontem';
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function ListaDeAvisos({
  avisos,
  soNaoLidos,
  onSoNaoLidos,
  assunto,
  onAssunto,
  onLer,
}: {
  avisos: AvisoDetalhe[];
  soNaoLidos: boolean;
  onSoNaoLidos: (v: boolean) => void;
  assunto: string | null;
  onAssunto: (v: string | null) => void;
  onLer: (a: AvisoDetalhe) => void;
}) {
  const assuntos = [...new Set(avisos.map((a) => ASSUNTO_AVISO[a.tipo]))];
  const visiveis = avisos.filter(
    (a) => (!soNaoLidos || !a.lidoEm) && (!assunto || ASSUNTO_AVISO[a.tipo] === assunto),
  );
  // O dia é lido uma vez, ao abrir a tela (não a cada desenho).
  const [hoje] = useState(() => dataLocal(new Date()));
  const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const grupos = new Map<string, AvisoDetalhe[]>();
  for (const a of visiveis) {
    const g = diaDoAviso(a.criadoEm, hoje, ontem);
    grupos.set(g, [...(grupos.get(g) ?? []), a]);
  }
  const chip = (ativo: boolean) =>
    cn(
      'min-h-11 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foco',
      ativo
        ? 'border-acao bg-acao/15 text-tinta'
        : 'border-borda text-tinta-suave hover:text-tinta',
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar avisos">
        <button
          type="button"
          aria-pressed={soNaoLidos}
          onClick={() => onSoNaoLidos(!soNaoLidos)}
          className={chip(soNaoLidos)}
        >
          Só os não lidos
        </button>
        {assuntos.length > 1 && (
          <>
            <button
              type="button"
              aria-pressed={assunto === null}
              onClick={() => onAssunto(null)}
              className={chip(assunto === null)}
            >
              Todos os assuntos
            </button>
            {assuntos.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={assunto === x}
                onClick={() => onAssunto(assunto === x ? null : x)}
                className={chip(assunto === x)}
              >
                {x}
              </button>
            ))}
          </>
        )}
      </div>
      {visiveis.length === 0 ? (
        <p className="text-tinta-suave">Nenhum aviso com esse filtro.</p>
      ) : (
        [...grupos].map(([dia, lista]) => (
          <section key={dia} aria-label={dia} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-tinta-suave">
              {dia}
            </h2>
            <ul className="flex flex-col gap-2" aria-label={`Avisos de ${dia.toLowerCase()}`}>
              {lista.map((a) => (
                <ItemAviso key={a.id} a={a} onLer={() => onLer(a)} />
              ))}
            </ul>
          </section>
        ))
      )}
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
          <span className="rounded-sm bg-superficie-3 px-1.5 py-0.5 text-xs font-semibold text-tinta-suave">
            {ASSUNTO_AVISO[a.tipo] ?? 'Aviso'}
          </span>
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

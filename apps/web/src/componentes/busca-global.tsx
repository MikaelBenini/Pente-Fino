'use client';

// Busca global (seção 7): Ctrl+K (⌘K no Mac) ou o botão "Procurar" abre uma caixa só para achar
// uma tela, um cliente ou uma comanda de hoje. Setas escolhem, Enter abre, Esc fecha.
import {
  buscaDeClienteValida,
  buscarTelas,
  dataLocal,
  formatarHora,
  formatarTelefone,
  normalizar,
  type ClienteResumo,
  type ComandaResumo,
} from '@pente-fino/shared';
import { cn, Dialogo } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { ReceiptText, Search, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useState, type ComponentType } from 'react';
import { api } from '@/lib/api';
import { chavesOperacao } from '@/lib/consultas';
import { useApp } from './contexto-app';
import { ICONES_MENU } from './icones-menu';

interface Resultado {
  id: string;
  grupo: 'Telas' | 'Comandas de hoje' | 'Clientes';
  titulo: string;
  detalhe?: string;
  rota: string;
  Icone: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/** Ctrl+K ou ⌘K em qualquer tela do painel abre a busca. */
function useAtalhoBusca(abrir: () => void) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [abrir]);
}

/** Espera a pessoa parar de digitar antes de perguntar ao servidor. */
function useAtrasado(valor: string, ms: number) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

const EVENTO = 'pf-buscar';

/** Botões de "Procurar" em qualquer canto da casca abrem a mesma caixa. */
export function abrirBusca() {
  window.dispatchEvent(new Event(EVENTO));
}

/** Fica uma vez na casca: escuta o Ctrl+K e os botões de "Procurar". */
export function BuscaGlobal() {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  useAtalhoBusca(abrir);
  useEffect(() => {
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, [abrir]);
  const onFechar = () => setAberto(false);
  return (
    <Dialogo aberto={aberto} titulo="Procurar" onFechar={onFechar}>
      {aberto && <CaixaDeBusca onFechar={onFechar} />}
    </Dialogo>
  );
}

function CaixaDeBusca({ onFechar }: { onFechar: () => void }) {
  const { menu, unidadeAtiva } = useApp();
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState('');
  const [marcado, setMarcado] = useState(0);
  const atrasado = useAtrasado(termo.trim(), 250);
  const buscarCliente = buscaDeClienteValida(atrasado);

  const clientes = useQuery({
    queryKey: [...chavesOperacao.clientes, 'lista', atrasado],
    queryFn: () => api<ClienteResumo[]>(`clientes?busca=${encodeURIComponent(atrasado)}`),
    enabled: buscarCliente,
  });
  // As comandas de hoje usam a mesma chave da tela de Comandas (o cache é um só).
  const unidadeId = unidadeAtiva === 'todas' ? null : unidadeAtiva;
  const hoje = dataLocal(new Date());
  const comandas = useQuery({
    queryKey: [...chavesOperacao.comandas, unidadeId, hoje],
    queryFn: () =>
      api<ComandaResumo[]>(`comandas?data=${hoje}${unidadeId ? `&unidadeId=${unidadeId}` : ''}`),
    enabled: menu.some((i) => i.id === 'comandas'),
  });

  const resultados = useMemo<Resultado[]>(() => {
    const telas = buscarTelas(menu, termo)
      .slice(0, termo.trim() ? 5 : 8)
      .map<Resultado>((i) => ({
        id: `tela-${i.id}`,
        grupo: 'Telas',
        titulo: i.rotulo,
        detalhe: i.grupo,
        rota: i.rota,
        Icone: ICONES_MENU[i.id],
      }));
    const t = normalizar(termo);
    const deHoje =
      t.length >= 2
        ? (comandas.data ?? [])
            .filter((c) => c.cliente && normalizar(c.cliente).includes(t))
            .slice(0, 5)
            .map<Resultado>((c) => ({
              id: `comanda-${c.id}`,
              grupo: 'Comandas de hoje',
              titulo: c.cliente!,
              detalhe: [c.inicio ? formatarHora(c.inicio) : null, c.profissional]
                .filter(Boolean)
                .join(' com '),
              rota: `/comandas?id=${c.id}`,
              Icone: ReceiptText,
            }))
        : [];
    const achados =
      buscarCliente && atrasado === termo.trim()
        ? (clientes.data ?? []).slice(0, 6).map<Resultado>((c) => ({
            id: `cliente-${c.id}`,
            grupo: 'Clientes',
            titulo: c.nome,
            detalhe: c.telefone ? formatarTelefone(c.telefone) : undefined,
            rota: `/clientes?id=${c.id}`,
            Icone: UserRound,
          }))
        : [];
    return [...telas, ...deHoje, ...achados];
  }, [menu, termo, comandas.data, clientes.data, buscarCliente, atrasado]);

  const indice = Math.min(marcado, Math.max(resultados.length - 1, 0));
  function abrir(r: Resultado | undefined) {
    if (!r) return;
    onFechar();
    router.push(r.rota);
  }

  const buscando = buscarCliente && (clientes.isFetching || atrasado !== termo.trim());
  return (
    <div className="-mt-2 flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-tinta-suave"
        />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={resultados.length > 0}
          aria-controls={`${id}-lista`}
          aria-activedescendant={resultados[indice] ? `${id}-${resultados[indice].id}` : undefined}
          aria-label="Tela, cliente ou comanda de hoje"
          placeholder="Tela, cliente ou comanda de hoje"
          autoComplete="off"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setMarcado(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMarcado((indice + 1) % Math.max(resultados.length, 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMarcado((indice - 1 + resultados.length) % Math.max(resultados.length, 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              abrir(resultados[indice]);
            }
          }}
          className="min-h-12 w-full rounded-md border border-borda bg-fundo pr-3 pl-10 text-base outline-none focus-visible:border-foco focus-visible:outline-2 focus-visible:outline-foco"
        />
      </div>
      <ul
        id={`${id}-lista`}
        role="listbox"
        aria-label="Resultados da busca"
        className="flex max-h-[min(24rem,60dvh)] flex-col overflow-y-auto"
      >
        {resultados.map((r, i) => (
          <li key={r.id} role="presentation">
            {(i === 0 || resultados[i - 1]!.grupo !== r.grupo) && (
              <p role="presentation" className="px-3 pt-3 pb-1 text-sm text-tinta-fraca">
                {r.grupo}
              </p>
            )}
            <div
              id={`${id}-${r.id}`}
              role="option"
              aria-selected={i === indice}
              onMouseMove={() => setMarcado(i)}
              onClick={() => abrir(r)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3',
                i === indice ? 'bg-superficie-2 text-tinta' : 'text-tinta-suave',
              )}
            >
              <r.Icone aria-hidden className="size-5 shrink-0" />
              <span className="min-w-0 truncate font-medium text-tinta">{r.titulo}</span>
              {r.detalhe && <span className="ml-auto shrink-0 text-sm">{r.detalhe}</span>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-tinta-suave" role="status">
        {buscando
          ? 'Procurando clientes…'
          : resultados.length === 0
            ? 'Nada encontrado. Tente o nome do cliente, o telefone ou o nome de uma tela.'
            : termo.trim() && !buscarCliente
              ? 'Digite 2 letras ou 4 números para procurar clientes.'
              : null}
      </p>
    </div>
  );
}

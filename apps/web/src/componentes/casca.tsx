'use client';

import { itemDaRota, menuPara, type ItemMenu } from '@pente-fino/shared';
import { Botao, Carregando, cn, EstadoVazio } from '@pente-fino/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronsUpDown,
  CircleSlash,
  CircleUserRound,
  CloudOff,
  Ellipsis,
  LogOut,
  MessageCircleOff,
  Moon,
  SunMedium,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useBot } from '@/lib/consultas';
import { useFilaOffline } from '@/lib/fila';
import {
  NOME_PAPEL,
  papeisAtivos,
  resolverUnidade,
  useUnidadeGuardada,
  useUnidades,
  useUsuario,
} from '@/lib/sessao';
import { useTema } from '@/lib/tema';
import { Contexto, nomeDaUnidade, useApp, type ContextoApp } from './contexto-app';
import { ICONES_MENU } from './icones-menu';
import { Marca } from './marca';

/** Telas que qualquer papel abre, mesmo fora do menu. */
const LIVRES = ['/app', '/unidade', '/perfil'];

export function Casca({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const unidades = useUnidades(usuario.isSuccess);
  const guardada = useUnidadeGuardada();
  const pathname = usePathname();
  const router = useRouter();

  const contexto = useMemo<ContextoApp | null>(() => {
    if (!usuario.data || !unidades.data) return null;
    const ativa = resolverUnidade(usuario.data, unidades.data, guardada);
    if (ativa === null) return null;
    const papeis = papeisAtivos(usuario.data, ativa);
    const naConta = usuario.data.papeis.some((p) => p.unidadeId === null);
    return {
      usuario: usuario.data,
      unidades: unidades.data,
      unidadeAtiva: ativa,
      papeis,
      menu: menuPara(papeis),
      podeTrocarUnidade: unidades.data.length + (naConta ? 1 : 0) > 1,
    };
  }, [usuario.data, unidades.data, guardada]);

  const precisaEscolher = !!usuario.data && !!unidades.data && contexto === null;
  useEffect(() => {
    if (precisaEscolher && pathname !== '/unidade') router.replace('/unidade');
  }, [precisaEscolher, pathname, router]);

  if (usuario.isError || unidades.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EstadoVazio
          icone={CloudOff}
          titulo="Não deu para carregar"
          texto="O servidor não respondeu. Confira a internet e tente de novo."
          acao={<Botao onClick={() => window.location.reload()}>Tentar de novo</Botao>}
        />
      </div>
    );
  }

  if (precisaEscolher && pathname === '/unidade' && usuario.data && unidades.data) {
    // Escolha de unidade sem casca: ainda não há menu.
    return (
      <Contexto
        value={{
          usuario: usuario.data,
          unidades: unidades.data,
          unidadeAtiva: '',
          papeis: [],
          menu: [],
          podeTrocarUnidade: true,
        }}
      >
        <main className="mx-auto max-w-lg px-[max(1rem,env(safe-area-inset-left))] py-10">
          {children}
        </main>
      </Contexto>
    );
  }

  if (!contexto) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Carregando />
      </div>
    );
  }

  const item = itemDaRota(pathname);
  const semAcesso =
    !!item && !LIVRES.includes(pathname) && !contexto.menu.some((i) => i.id === item.id);

  return (
    <Contexto value={contexto}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <MenuLateral />
        <div className="flex min-w-0 flex-col">
          <BarraTopo />
          <AvisoConexao />
          <AvisoWhatsapp />
          <main
            id="conteudo"
            className="mx-auto w-full max-w-6xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 lg:pb-12"
          >
            {semAcesso ? <SemAcesso /> : children}
          </main>
        </div>
        <MenuInferior />
      </div>
    </Contexto>
  );
}

function SemAcesso() {
  const { menu } = useApp();
  return (
    <EstadoVazio
      icone={CircleSlash}
      titulo="Esta tela não faz parte do seu acesso"
      texto="O menu mostra tudo o que o seu papel usa nesta unidade. Se precisar desta tela, fale com o dono da barbearia."
      acao={
        menu[0] && (
          <Link
            href={menu[0].rota}
            className="font-semibold text-tinta underline underline-offset-4 hover:decoration-modulo"
          >
            Ir para {menu[0].rotulo}
          </Link>
        )
      }
    />
  );
}

function ativo(pathname: string, item: ItemMenu) {
  return pathname === item.rota || pathname.startsWith(`${item.rota}/`);
}

// ─── Computador: menu lateral ─────────────────────────────────────────────

function MenuLateral() {
  const c = useApp();
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-borda bg-superficie py-5 pl-[max(1rem,env(safe-area-inset-left))] pr-3 lg:flex">
      <Link
        href="/app"
        className="rounded-md px-2 focus-visible:outline-2 focus-visible:outline-foco"
      >
        <Marca />
      </Link>
      <SeletorUnidade />
      <nav aria-label="Menu principal" className="-mr-3 flex-1 overflow-y-auto pr-3">
        <ul className="flex flex-col gap-0.5">
          {c.menu.map((item) => {
            const Icone = ICONES_MENU[item.id];
            const atual = ativo(pathname, item);
            return (
              <li key={item.id}>
                <Link
                  href={item.rota}
                  data-menu={item.id}
                  aria-current={atual ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.95rem] font-medium transition-colors',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
                    atual
                      ? 'bg-superficie-2 text-tinta'
                      : 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta',
                  )}
                >
                  {atual && (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-modulo"
                    />
                  )}
                  <Icone
                    aria-hidden
                    className={cn('size-5', atual && 'text-modulo-texto')}
                    strokeWidth={1.75}
                  />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <BlocoUsuario />
    </aside>
  );
}

function SeletorUnidade({ compacto = false }: { compacto?: boolean }) {
  const c = useApp();
  const nome = nomeDaUnidade(c);
  const conteudo = (
    <>
      <span className="flex min-w-0 flex-col items-start">
        {!compacto && (
          <span className="text-xs font-semibold uppercase tracking-wider text-tinta-fraca">
            Unidade
          </span>
        )}
        <span className="truncate font-semibold text-tinta">{nome}</span>
      </span>
      {c.podeTrocarUnidade && (
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-tinta-suave" />
      )}
    </>
  );
  const classe = cn(
    'flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md text-left',
    compacto ? 'px-2 text-sm' : 'border border-borda bg-fundo px-3 py-1.5',
  );
  if (!c.podeTrocarUnidade) return <div className={classe}>{conteudo}</div>;
  return (
    <Link
      href="/unidade"
      aria-label={`Unidade: ${nome}. Trocar unidade`}
      className={cn(
        classe,
        'hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-foco',
      )}
    >
      {conteudo}
    </Link>
  );
}

function useSair() {
  const cliente = useQueryClient();
  const [saindo, setSaindo] = useState(false);
  return {
    saindo,
    sair: async () => {
      setSaindo(true);
      await api('auth/sair', { corpo: {} }).catch(() => undefined);
      cliente.clear();
      // Recarga completa de propósito: nada da sessão anterior fica na memória da página.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/entrar');
    },
  };
}

function BotaoTema() {
  const [tema, definir] = useTema();
  const claro = tema === 'claro';
  return (
    <Botao
      variante="fantasma"
      className="min-h-12 justify-start gap-3 px-3 font-medium"
      aria-pressed={claro}
      onClick={() => definir(claro ? 'escuro' : 'claro')}
    >
      {claro ? (
        <Moon aria-hidden className="size-5" strokeWidth={1.75} />
      ) : (
        <SunMedium aria-hidden className="size-5" strokeWidth={1.75} />
      )}
      {claro ? 'Usar tema escuro' : 'Usar tema claro'}
    </Botao>
  );
}

function BlocoUsuario() {
  const c = useApp();
  const { sair, saindo } = useSair();
  const [tema, definirTema] = useTema();
  const claro = tema === 'claro';
  const botaoIcone =
    'grid size-11 shrink-0 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-55';
  return (
    <div className="flex items-center gap-1 border-t border-borda pt-3">
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate font-semibold text-tinta">{c.usuario.nome}</p>
        <p className="truncate text-sm text-tinta-suave">
          {c.papeis.map((p) => NOME_PAPEL[p]).join(' · ')}
        </p>
      </div>
      <Link href="/perfil" aria-label="Meu perfil" title="Meu perfil" className={botaoIcone}>
        <CircleUserRound aria-hidden className="size-5" strokeWidth={1.75} />
      </Link>
      <button
        type="button"
        aria-label={claro ? 'Usar tema escuro' : 'Usar tema claro'}
        title={claro ? 'Usar tema escuro' : 'Usar tema claro'}
        onClick={() => definirTema(claro ? 'escuro' : 'claro')}
        className={botaoIcone}
      >
        {claro ? (
          <Moon aria-hidden className="size-5" strokeWidth={1.75} />
        ) : (
          <SunMedium aria-hidden className="size-5" strokeWidth={1.75} />
        )}
      </button>
      <button
        type="button"
        aria-label="Sair"
        title="Sair"
        onClick={sair}
        disabled={saindo}
        className={botaoIcone}
      >
        <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ─── Celular e tablet: barra no topo e menu inferior ──────────────────────

function BarraTopo() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-borda bg-fundo/95 pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur lg:hidden">
      <Link href="/app" className="py-2" aria-label="Pente Fino, início">
        <Marca compacta />
      </Link>
      <SeletorUnidade compacto />
    </header>
  );
}

/** Até 4 atalhos + "Mais" (que também leva ao perfil, ao tema e a "Sair"). */
function MenuInferior() {
  const c = useApp();
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const cabem = c.menu.length <= 4;
  const atalhos = cabem ? c.menu : c.menu.slice(0, 4);
  const resto = cabem ? [] : c.menu.slice(4);
  const restoAtivo = resto.some((i) => ativo(pathname, i));

  const classeItem = (atual: boolean) =>
    cn(
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[0.72rem] font-semibold leading-tight',
      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
      atual ? 'text-tinta' : 'text-tinta-suave',
    );

  return (
    <>
      <nav
        aria-label="Menu rápido"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie/95 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pl-[max(0.25rem,env(safe-area-inset-left))] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {atalhos.map((item) => {
            const Icone = ICONES_MENU[item.id];
            const atual = ativo(pathname, item);
            return (
              <li key={item.id} className="flex flex-1">
                <Link
                  href={item.rota}
                  data-menu={item.id}
                  aria-current={atual ? 'page' : undefined}
                  className={classeItem(atual)}
                >
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full',
                      atual && 'bg-modulo text-sobre-modulo',
                    )}
                  >
                    <Icone aria-hidden className="size-5" strokeWidth={atual ? 2 : 1.75} />
                  </span>
                  <span className="max-w-full truncate">{item.rotulo}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
              onClick={() => setMaisAberto(true)}
              className={classeItem(restoAtivo)}
            >
              <span
                className={cn(
                  'grid h-7 w-12 place-items-center rounded-full',
                  restoAtivo && 'bg-modulo text-sobre-modulo',
                )}
              >
                <Ellipsis aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>
      <FolhaMais aberta={maisAberto} itens={resto} onFechar={() => setMaisAberto(false)} />
    </>
  );
}

function FolhaMais({
  aberta,
  itens,
  onFechar,
}: {
  aberta: boolean;
  itens: ItemMenu[];
  onFechar: () => void;
}) {
  const c = useApp();
  const pathname = usePathname();
  const dialogo = useRef<HTMLDialogElement>(null);
  const { sair, saindo } = useSair();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal?.();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  const classeLink =
    'flex min-h-12 items-center gap-3 rounded-md px-3 font-medium text-tinta hover:bg-superficie-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco';

  return (
    <dialog
      ref={dialogo}
      aria-label="Mais opções"
      onClose={onFechar}
      onClick={(e) => e.target === e.currentTarget && onFechar()}
      className="mt-auto mb-0 w-full max-w-none rounded-t-xl border-t border-borda bg-superficie p-0 text-tinta backdrop:bg-black/60 lg:hidden"
    >
      <div className="flex flex-col gap-2 px-[max(1rem,env(safe-area-inset-left))] pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate font-semibold">{c.usuario.nome}</p>
            <p className="text-sm text-tinta-suave">
              {c.papeis.map((p) => NOME_PAPEL[p]).join(' · ')} · {nomeDaUnidade(c)}
            </p>
          </div>
          <Botao variante="fantasma" aria-label="Fechar" onClick={onFechar} className="px-3">
            <X aria-hidden className="size-5" />
          </Botao>
        </div>
        {itens.length > 0 && (
          <nav aria-label="Mais itens do menu">
            <ul className="flex flex-col">
              {itens.map((item) => {
                const Icone = ICONES_MENU[item.id];
                const atual = ativo(pathname, item);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.rota}
                      data-menu={item.id}
                      onClick={onFechar}
                      aria-current={atual ? 'page' : undefined}
                      className={cn(classeLink, atual && 'bg-superficie-2')}
                    >
                      <Icone
                        aria-hidden
                        className={cn('size-5', atual ? 'text-modulo-texto' : 'text-tinta-suave')}
                        strokeWidth={1.75}
                      />
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="flex flex-col border-t border-borda pt-2">
          {!c.menu.some((i) => i.id === 'perfil') && (
            <Link href="/perfil" onClick={onFechar} className={classeLink}>
              <CircleUserRound aria-hidden className="size-5 text-tinta-suave" strokeWidth={1.75} />
              Meu perfil
            </Link>
          )}
          <BotaoTema />
          <Botao
            variante="fantasma"
            className="min-h-12 justify-start gap-3 px-3 font-medium"
            onClick={sair}
            carregando={saindo}
          >
            {!saindo && <LogOut aria-hidden className="size-5" strokeWidth={1.75} />}
            Sair
          </Botao>
        </div>
      </div>
    </dialog>
  );
}

// ─── Conexão ──────────────────────────────────────────────────────────────

/** Dono e gestor: o WhatsApp de uma unidade caiu e o bot parou de responder. */
function AvisoWhatsapp() {
  const { papeis } = useApp();
  const pathname = usePathname();
  const gestao = papeis.includes('dono') || papeis.includes('gestor');
  const bot = useBot(gestao);
  const caidas = (bot.data?.unidades ?? []).filter(
    (u) => u.conexao?.caiuEm && u.conexao.status !== 'conectado',
  );
  if (!gestao || caidas.length === 0 || pathname === '/bot') return null;
  const nomes = caidas.map((u) => u.nome).join(', ');
  return (
    <div
      role="alert"
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MessageCircleOff aria-hidden className="size-4 shrink-0 text-perigo-texto" />
        <span>
          O WhatsApp {caidas.length === 1 ? 'da' : 'das unidades'} {nomes} desconectou e o bot não
          está respondendo.
        </span>
        <Link href="/bot?aba=conexao" className="font-semibold text-acao-texto underline">
          Ver como reconectar
        </Link>
      </p>
    </div>
  );
}

function AvisoConexao() {
  const { online, pendentes, recusados } = useFilaOffline();
  if (online && pendentes.length === 0 && recusados.length === 0) return null;
  const n = pendentes.length;
  return (
    <div
      role="status"
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex items-center gap-2">
        <CloudOff aria-hidden className="size-4 shrink-0 text-aviso-texto" />
        {!online
          ? `Sem internet. ${n > 0 ? `${n} ${n === 1 ? 'lançamento aguarda' : 'lançamentos aguardam'} envio; ` : ''}o que você lançar fica guardado neste aparelho e sobe quando o sinal voltar.`
          : n > 0
            ? `Enviando ${n} ${n === 1 ? 'lançamento feito' : 'lançamentos feitos'} sem internet…`
            : `${recusados.length} ${recusados.length === 1 ? 'lançamento foi recusado' : 'lançamentos foram recusados'}. Confira em Comandas.`}
      </p>
    </div>
  );
}

'use client';

import {
  itemDaRota,
  menuEmGrupos,
  menuPara,
  type AvisoGeral as AvisoGeralTipo,
  type ItemMenu,
} from '@pente-fino/shared';
import { Botao, Carregando, cn, EstadoVazio } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronsUpDown,
  Bell,
  CircleSlash,
  CircleUserRound,
  CloudOff,
  Ellipsis,
  LogOut,
  MessageCircleOff,
  MessagesSquare,
  Lock,
  MailCheck,
  Moon,
  Search,
  SunMedium,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAvisos, useBot, useConversas, useSituacaoConta } from '@/lib/consultas';
import { notificar, tocarAviso, usePreferenciasAvisos } from '@/lib/avisos';
import { FaixaAvisoGeral } from './faixa-aviso-geral';
import { usePushAparelho } from './notificacoes-aparelho';
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
import { abrirBusca, BuscaGlobal } from './busca-global';

/** Telas que qualquer papel abre, mesmo fora do menu. */
const LIVRES = ['/app', '/unidade', '/perfil'];

/** Admin F5: a equipe do Pente Fino está vendo o painel com a permissão do dono, só para ler. */
function FaixaSuporte({ nome, ate }: { nome: string; ate: string }) {
  const hora = new Date(ate).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return (
    <div
      role="status"
      className="border-b border-modulo/50 bg-modulo/15 px-4 py-2 text-sm font-medium text-tinta"
    >
      Modo suporte: {nome}, do Pente Fino, está vendo o painel com a permissão do dono. Só leitura,
      até {hora}. Telefones de clientes e conversas do bot ficam escondidos.
    </div>
  );
}

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
          {usuario.data?.modoSuporte && <FaixaSuporte {...usuario.data.modoSuporte} />}
          <AvisoConexao />
          <AvisoGeral />
          <AvisoConfirmarEmail />
          <AvisoAssinatura />
          <AvisoWhatsapp />
          {/* As conversas do bot ficam fechadas no modo suporte (admin F5). */}
          {!usuario.data?.modoSuporte && <AvisoConversas />}
          <main
            id="conteudo"
            className="mx-auto w-full max-w-6xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 lg:pb-12"
          >
            {semAcesso ? <SemAcesso /> : children}
          </main>
        </div>
        <MenuInferior />
      </div>
      <BuscaGlobal />
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

/** "Dia a dia" → "dia-a-dia": id válido para aria-labelledby (sem espaço nem acento). */
const idGrupo = (grupo: string) =>
  grupo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');

function MenuLateral() {
  const c = useApp();
  const pathname = usePathname();
  const esperando = useEsperandoAtendente();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-borda bg-superficie py-5 pl-[max(1rem,env(safe-area-inset-left))] pr-3 lg:flex">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/app"
          className="rounded-md px-2 focus-visible:outline-2 focus-visible:outline-foco"
        >
          <Marca />
        </Link>
        <BotaoAvisos className="grid size-11 shrink-0 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco" />
      </div>
      <SeletorUnidade />
      <button
        type="button"
        onClick={abrirBusca}
        aria-keyshortcuts="Control+K Meta+K"
        className="-mt-3 flex min-h-11 items-center gap-3 rounded-md border border-borda px-3 text-[0.95rem] text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco"
      >
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
        Procurar
        <kbd className="ml-auto rounded border border-borda px-1.5 font-sans text-xs text-tinta-fraca">
          Ctrl K
        </kbd>
      </button>
      <nav
        aria-label="Menu principal"
        className="-mr-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-3"
      >
        {menuEmGrupos(c.menu).map(({ grupo, itens }) => (
          <div key={grupo ?? 'menu'} className="flex flex-col gap-1">
            {grupo && (
              <p
                id={`menu-${idGrupo(grupo)}`}
                className="px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-tinta-fraca"
              >
                {grupo}
              </p>
            )}
            <ul
              className="flex flex-col gap-0.5"
              aria-labelledby={grupo ? `menu-${idGrupo(grupo)}` : undefined}
            >
              {itens.map((item) => {
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
                      {item.id === 'conversas' && <Contador n={esperando} className="ml-auto" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
      // Telas guardadas para abrir sem internet ficam para a próxima pessoa: apaga.
      if ('caches' in window)
        await caches
          .keys()
          .then((chaves) => Promise.all(chaves.map((c) => caches.delete(c))))
          .catch(() => undefined);
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

/** Sino da central de avisos, com quantos ainda não foram lidos. */
function BotaoAvisos({ className }: { className: string }) {
  const n = useAvisos().data?.naoLidos ?? 0;
  const push = usePushAparelho();
  const rotulo = n > 0 ? `Avisos: ${n} não ${n === 1 ? 'lido' : 'lidos'}` : 'Avisos';
  return (
    <Link
      href="/avisos"
      aria-label={rotulo}
      title={rotulo}
      className={cn(className, 'relative')}
      // No primeiro toque no sino, o navegador pergunta se pode mandar notificações (precisa
      // ser num clique). Depois disso, o convite fica na tela de Avisos e no Perfil.
      onClick={() => {
        if (push.podePerguntar && !push.jaPerguntou()) void push.ligar();
      }}
    >
      <Bell aria-hidden className="size-5" strokeWidth={1.75} />
      {n > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-aviso px-1 text-[0.625rem] font-bold text-fundo tabular-nums"
        >
          {n > 9 ? '9+' : n}
        </span>
      )}
    </Link>
  );
}

// ─── Celular e tablet: barra no topo e menu inferior ──────────────────────

function BarraTopo() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-borda bg-fundo/95 pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur lg:hidden">
      <Link href="/app" className="py-2" aria-label="Pente Fino, início">
        <Marca compacta />
      </Link>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={abrirBusca}
          aria-label="Procurar"
          className="grid size-11 shrink-0 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco"
        >
          <Search aria-hidden className="size-5" />
        </button>
        <BotaoAvisos className="relative grid size-11 shrink-0 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco" />
        <SeletorUnidade compacto />
      </div>
    </header>
  );
}

/** Até 4 atalhos + "Mais" (que também leva ao perfil, ao tema e a "Sair"). */
function MenuInferior() {
  const c = useApp();
  const pathname = usePathname();
  const esperando = useEsperandoAtendente();
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
                      'relative grid h-7 w-12 place-items-center rounded-full',
                      atual && 'bg-modulo text-sobre-modulo',
                    )}
                  >
                    <Icone aria-hidden className="size-5" strokeWidth={atual ? 2 : 1.75} />
                    {item.id === 'conversas' && (
                      <Contador n={esperando} className="absolute -top-1 -right-0.5" />
                    )}
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
                  'relative grid h-7 w-12 place-items-center rounded-full',
                  restoAtivo && 'bg-modulo text-sobre-modulo',
                )}
              >
                <Ellipsis aria-hidden className="size-5" strokeWidth={1.75} />
                {resto.some((i) => i.id === 'conversas') && (
                  <Contador n={esperando} className="absolute -top-1 -right-0.5" />
                )}
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>
      <FolhaMais
        aberta={maisAberto}
        itens={resto}
        esperando={esperando}
        onFechar={() => setMaisAberto(false)}
      />
    </>
  );
}

function FolhaMais({
  aberta,
  itens,
  esperando,
  onFechar,
}: {
  aberta: boolean;
  itens: ItemMenu[];
  esperando: number;
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
                      {item.id === 'conversas' && <Contador n={esperando} className="ml-auto" />}
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
/**
 * Assinatura pedindo atenção: teste nos últimos 3 dias, terminado, fatura atrasada ou conta
 * só para consulta. O dono vai direto para a aba Assinatura; a equipe é orientada a falar com ele.
 */
/** Aviso da administração do sistema para todas as barbearias (manutenção, novidade). */
function AvisoGeral() {
  const aviso = useQuery({
    queryKey: ['sistema', 'aviso'],
    queryFn: () => api<{ aviso: AvisoGeralTipo | null }>('sistema/aviso'),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  }).data?.aviso;
  if (!aviso) return null;
  return <FaixaAvisoGeral aviso={aviso} />;
}

/** Cadastro pelo site sem e-mail confirmado: o que fica travado e o botão de reenviar o link. */
function AvisoConfirmarEmail() {
  const usuario = useUsuario().data;
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado' | 'erro'>('parado');
  if (!usuario || usuario.emailConfirmado !== false) return null;
  return (
    <div
      role="status"
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <MailCheck aria-hidden className="size-4 shrink-0 text-aviso-texto" />
        <span>
          Confirme seu e-mail (<strong>{usuario.email}</strong>) para liberar a agenda, os convites
          da equipe e o WhatsApp.
        </span>
        {estado === 'enviado' ? (
          <span className="text-acao-texto">
            Link enviado. Confira a caixa de entrada e o spam.
          </span>
        ) : (
          <button
            type="button"
            disabled={estado === 'enviando'}
            onClick={async () => {
              setEstado('enviando');
              try {
                await api('auth/reenviar-confirmacao', { corpo: {} });
                setEstado('enviado');
              } catch {
                setEstado('erro');
              }
            }}
            className="min-h-9 font-semibold underline underline-offset-4 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-60"
          >
            {estado === 'enviando'
              ? 'Enviando…'
              : estado === 'erro'
                ? 'Tentar de novo'
                : 'Reenviar e-mail'}
          </button>
        )}
      </p>
    </div>
  );
}

function AvisoAssinatura() {
  const { papeis } = useApp();
  const pathname = usePathname();
  const situacao = useSituacaoConta().data;
  if (!situacao) return null;
  const mostrar =
    situacao.somenteLeitura ||
    situacao.situacao === 'em_atraso' ||
    (situacao.situacao === 'teste' && (situacao.diasRestantesTeste ?? 99) <= 3);
  if (!mostrar) return null;
  const dono = papeis.includes('dono');
  return (
    <div
      role={situacao.somenteLeitura ? 'alert' : 'status'}
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Lock
          aria-hidden
          className={cn(
            'size-4 shrink-0',
            situacao.somenteLeitura ? 'text-perigo-texto' : 'text-aviso-texto',
          )}
        />
        <span>{situacao.mensagem}</span>
        {dono ? (
          pathname !== '/configuracoes' && (
            <Link
              href="/configuracoes?aba=assinatura"
              className="font-semibold text-acao-texto underline"
            >
              Ver assinatura
            </Link>
          )
        ) : (
          <span className="text-tinta-suave">Fale com o dono da barbearia.</span>
        )}
      </p>
    </div>
  );
}

/** Quantos clientes esperam atendente no WhatsApp (só para quem atende as conversas). */
function useEsperandoAtendente(): number {
  const { menu, unidadeAtiva } = useApp();
  const atende = menu.some((i) => i.id === 'conversas');
  return useConversas(unidadeAtiva, atende).data?.aguardando ?? 0;
}

function Contador({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      aria-label={`${n} esperando atendente`}
      className={cn(
        'grid h-5 min-w-5 place-items-center rounded-full bg-aviso px-1.5 text-xs font-bold text-fundo tabular-nums',
        className,
      )}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}

/** Cliente pediu atendente: faixa em qualquer tela até alguém abrir as Conversas. */
function AvisoConversas() {
  const pathname = usePathname();
  const n = useEsperandoAtendente();
  const [preferencias] = usePreferenciasAvisos();
  // Som e notificação só quando aumenta (alguém novo esperando), nunca ao abrir a página.
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = n;
    if (antes === null || n <= antes) return;
    if (preferencias.som) tocarAviso();
    if (preferencias.notificacao)
      notificar(
        'Cliente esperando atendente',
        n === 1
          ? '1 cliente está esperando no WhatsApp.'
          : `${n} clientes estão esperando no WhatsApp.`,
        '/conversas',
      );
  }, [n, preferencias]);
  if (n === 0 || pathname === '/conversas') return null;
  return (
    <div
      role="status"
      className="border-b border-borda bg-superficie-2 px-[max(1rem,env(safe-area-inset-left))] py-2 text-sm sm:px-8"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MessagesSquare aria-hidden className="size-4 shrink-0 text-aviso-texto" />
        <span>
          {n === 1
            ? '1 cliente está esperando atendente no WhatsApp.'
            : `${n} clientes estão esperando atendente no WhatsApp.`}
        </span>
        <Link href="/conversas" className="font-semibold text-acao-texto underline">
          Abrir conversas
        </Link>
      </p>
    </div>
  );
}

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
        <Link
          href="/bot?aba=conexao"
          className="inline-flex min-h-11 items-center font-semibold text-acao-texto underline"
        >
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

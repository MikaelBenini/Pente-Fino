'use client';

// Painel "Minha página" (seção 7, lote 7b; modelo aprovado pelo dono em 13/11): o dono monta o
// site da barbearia com blocos, como numa loja virtual. Rascunho salvo sozinho, prévia ao vivo no
// computador e no celular, e o site só muda para o cliente em "Publicar alterações".
import {
  BLOCOS_SITE,
  BOTOES_SITE,
  CAMINHO_PAGINA,
  FONTE_DO_TEMA,
  PALETAS_SITE,
  ROTULO_TEMA,
  TEMAS_SITE,
  PAGINAS_EXTRAS,
  blocosDaPagina,
  desligarPagina,
  ligarPagina,
  paginaLigada,
  visualAgendamentoSchema,
  type VisualAgendamento,
  LIMITE_CSS_SITE,
  cabecalhoDoSite,
  rodapeDoSite,
  type CabecalhoSite,
  type LinkSite,
  type RodapeSite,
  caminhoDoAgendamento,
  caminhoDoSite,
  enderecoSiteSchema,
  CORES_SITE,
  FONTES_SITE,
  PAGINAS_SITE,
  ROTULO_PAGINA,
  adicionarBloco,
  blocosParaAdicionar,
  editarBloco,
  formatarDataHora,
  moverBloco,
  removerBloco,
  siteBarbeariaSchema,
  type BlocoSite,
  type BotoesSite,
  type CorSite,
  type FotoEnviada,
  type FonteSite,
  type PaginaSite,
  type SiteBarbearia,
  type SitePainel,
  type SitePublico,
  type TipoBloco,
} from '@pente-fino/shared';
import { Abas, Botao, Campo, CampoTexto, cn, ModalConfirmacao, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { renovarSite } from '@/app/(app)/pagina/acoes';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado } from '../pagina';
import { CampoFoto } from '../site-barbearia/campo-foto';
import { SiteDaBarbearia } from '../site-barbearia/site';

const chave = (id: string) => ['unidades', id, 'site'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível salvar. Tente de novo.';

/** O que cada bloco automático mostra, para o dono saber de onde vem. */
const EXPLICACAO: Partial<Record<TipoBloco, string>> = {
  destaques:
    'Mostra a nota dos clientes (com 5 avaliações ou mais), o endereço e o horário, puxados do sistema.',
  servicos: 'Mostra os três primeiros serviços com preço desta unidade.',
  equipe: 'Mostra os barbeiros ativos da unidade, com a especialidade de cada um.',
  tabela: 'Lista os serviços com preço desta unidade, por categoria. O preço vem de Serviços.',
  barbeiros: 'Cada barbeiro ativo da unidade, com a especialidade e a apresentação abaixo.',
  contato:
    'Endereço e telefone vêm de Configurações, em Unidades; o horário, do expediente da equipe; o Instagram, da aba Tema.',
};

export function TelaMinhaPagina() {
  const { unidades, unidadeAtiva, usuario } = useApp();
  const permitidas = unidades.filter(
    (u) =>
      u.ativa &&
      usuario.papeis.some(
        (p) =>
          (p.papel === 'dono' && p.unidadeId === null) ||
          (p.papel === 'gestor' && (p.unidadeId === null || p.unidadeId === u.id)),
      ),
  );
  const [escolhida, setEscolhida] = useState(
    unidadeAtiva !== 'todas' && permitidas.some((u) => u.id === unidadeAtiva)
      ? unidadeAtiva
      : (permitidas[0]?.id ?? ''),
  );
  const painel = useQuery({
    queryKey: chave(escolhida),
    queryFn: () => api<SitePainel>(`unidades/${escolhida}/site`),
    enabled: !!escolhida,
  });
  const previa = useQuery({
    queryKey: [...chave(escolhida), 'previa'],
    queryFn: () => api<SitePublico>(`unidades/${escolhida}/site/previa`),
    enabled: !!escolhida,
  });
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Minha página"
        pergunta="O site da barbearia: monte com blocos, veja como fica e publique."
      />
      {permitidas.length > 1 && (
        <Selecao
          id="pagina-unidade"
          rotulo="Unidade"
          value={escolhida}
          onChange={(e) => setEscolhida(e.target.value)}
          opcoes={permitidas.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          className="max-w-xs"
        />
      )}
      {!escolhida ? (
        <p className="text-tinta-suave">Nenhuma unidade para montar a página.</p>
      ) : (
        <Estado consulta={painel.isPending || painel.isError ? painel : previa}>
          {() => (
            <Editor
              key={escolhida}
              unidadeId={escolhida}
              inicial={painel.data!}
              previa={previa.data!}
            />
          )}
        </Estado>
      )}
    </div>
  );
}

/** Unidade das fotos e as medidas das que acabaram de ser enviadas (para a prévia). */
const ContextoFotos = createContext<{ unidadeId: string; registrar: (f: FotoEnviada) => void }>({
  unidadeId: '',
  registrar: () => undefined,
});

type Situacao = Omit<SitePainel, 'rascunho'>;
const situacaoDe = (r: SitePainel): Situacao => ({
  publicado: r.publicado,
  publicadoEm: r.publicadoEm,
  alteracoesPendentes: r.alteracoesPendentes,
  slug: r.slug,
  linkLigado: r.linkLigado,
  siteSlug: r.siteSlug,
  sugestaoSiteSlug: r.sugestaoSiteSlug,
  dominio: r.dominio,
  dominioVerificado: r.dominioVerificado,
  dominioIps: r.dominioIps,
});

function Editor({
  unidadeId,
  inicial,
  previa,
}: {
  unidadeId: string;
  inicial: SitePainel;
  previa: SitePublico;
}) {
  const cliente = useQueryClient();
  const [site, setSite] = useState<SiteBarbearia>(inicial.rascunho);
  const [situacaoLocal, setSituacao] = useState<Situacao>(inicial);
  // O link vem sempre da consulta (trocado em Configurações, ela recarrega); o endereço do site,
  // da última resposta daqui ou da consulta.
  const situacao: Situacao = {
    ...situacaoLocal,
    slug: inicial.slug,
    linkLigado: inicial.linkLigado,
    siteSlug: situacaoLocal.siteSlug ?? inicial.siteSlug,
    sugestaoSiteSlug: inicial.sugestaoSiteSlug,
  };
  const [pagina, setPagina] = useState<PaginaSite>('inicio');
  const [aba, setAba] = useState('blocos');
  const [celular, setCelular] = useState(false);
  const [salvando, setSalvando] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [confirmarTirar, setConfirmarTirar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fotosNovas, setFotosNovas] = useState<SitePublico['fotos']>({});
  const [ultimoSalvo, setUltimoSalvo] = useState(inicial.rascunho);

  const validacao = useMemo(() => siteBarbeariaSchema.safeParse(site), [site]);
  const problema = validacao.success
    ? null
    : (validacao.error.issues[0]?.message ?? 'Revise os campos.');

  async function salvar(s: SiteBarbearia): Promise<boolean> {
    if (s === ultimoSalvo) return true;
    setSalvando('salvando');
    try {
      const r = await api<SitePainel>(`unidades/${unidadeId}/site`, { metodo: 'PUT', corpo: s });
      setUltimoSalvo(s);
      setSituacao(situacaoDe(r));
      setSalvando('salvo');
      setErro(null);
      return true;
    } catch (e) {
      setSalvando('erro');
      setErro(mensagemDe(e));
      return false;
    }
  }

  // Rascunho salvo sozinho, um instante depois da última mudança.
  useEffect(() => {
    if (site === ultimoSalvo || !validacao.success) return;
    const t = setTimeout(() => void salvar(site), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, validacao.success]);

  const mudar = (novo: SiteBarbearia) => {
    setAviso(null);
    setSite(novo);
  };

  async function publicar() {
    setPublicando(true);
    setAviso(null);
    try {
      if (!(await salvar(site))) return;
      const r = await api<SitePainel>(`unidades/${unidadeId}/site/publicar`, { metodo: 'POST' });
      setSituacao(situacaoDe(r));
      if (r.siteSlug) await renovarSite(r.siteSlug);
      setAviso('Publicado. O cliente já vê a página nova.');
      await cliente.invalidateQueries({ queryKey: chave(unidadeId) });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setPublicando(false);
    }
  }

  async function tirarDoAr() {
    setPublicando(true);
    try {
      const r = await api<SitePainel>(`unidades/${unidadeId}/site/publicado`, { metodo: 'DELETE' });
      setSituacao(situacaoDe(r));
      if (r.siteSlug) await renovarSite(r.siteSlug);
      setAviso('O site saiu do ar. O link voltou a abrir a página de agendamento.');
      setConfirmarTirar(false);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setPublicando(false);
    }
  }

  const semLink = !situacao.linkLigado || !situacao.slug;
  const pendente = situacao.alteracoesPendentes || site !== ultimoSalvo;
  const dadosDaPrevia: SitePublico = {
    ...previa,
    slug: situacao.siteSlug ?? situacao.sugestaoSiteSlug,
    site,
    fotos: { ...previa.fotos, ...fotosNovas },
    equipe: previa.equipe.map((p) => ({
      ...p,
      foco: site.equipe[p.id]?.foco ?? '',
      sobre: site.equipe[p.id]?.sobre ?? '',
    })),
  };
  const base = caminhoDoSite(situacao.siteSlug ?? situacao.sugestaoSiteSlug);

  // Links da prévia não saem do painel: os do site trocam a página editada.
  const naPrevia = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') ?? '';
    const destino = PAGINAS_SITE.find((p) => href === `${base}${CAMINHO_PAGINA[p]}`);
    if (destino) setPagina(destino);
  };

  const contextoFotos = {
    unidadeId,
    registrar: (f: FotoEnviada) =>
      setFotosNovas((atual) => ({ ...atual, [f.id]: { largura: f.largura, altura: f.altura } })),
  };

  return (
    <ContextoFotos.Provider value={contextoFotos}>
      <div className="flex flex-col gap-4">
        <section
          aria-label="Situação da página"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-superficie p-4"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-semibold">
              {situacao.publicado
                ? `No ar desde ${formatarDataHora(situacao.publicadoEm!)}`
                : 'Ainda não publicada'}
            </p>
            <p className="text-sm text-tinta-suave" aria-live="polite">
              {!situacao.publicado
                ? 'Até publicar, o cliente não vê o site. O link de agendamento funciona normalmente.'
                : pendente
                  ? 'Há alterações que o cliente ainda não vê.'
                  : 'O cliente vê exatamente esta versão.'}{' '}
              {salvando === 'salvando'
                ? 'Salvando o rascunho…'
                : salvando === 'erro'
                  ? 'O rascunho não foi salvo.'
                  : 'Rascunho salvo.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {situacao.publicado && situacao.siteSlug && (
              <a
                href={caminhoDoSite(situacao.siteSlug)}
                target="_blank"
                rel="noopener noreferrer"
                className="toque inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3"
              >
                Ver página
                <ExternalLink aria-hidden className="size-4" />
                <span className="sr-only">(abre em outra aba)</span>
              </a>
            )}
            {situacao.publicado && (
              <Botao variante="fantasma" onClick={() => setConfirmarTirar(true)}>
                Tirar do ar
              </Botao>
            )}
            <Botao
              onClick={publicar}
              carregando={publicando}
              disabled={!!problema || (situacao.publicado && !pendente)}
            >
              {situacao.publicado ? 'Publicar alterações' : 'Publicar página'}
            </Botao>
          </div>
        </section>

        {semLink && (
          <Aviso tom="info">
            O link de agendamento desta unidade está desligado: o site funciona normalmente, mas no
            lugar de &ldquo;Agendar horário&rdquo; aparece &ldquo;Falar no WhatsApp&rdquo;. Para o
            cliente marcar pelo site, ligue o link em{' '}
            <Link href="/configuracoes?aba=link" className="font-semibold underline">
              Configurações, Link de agendamento
            </Link>
            .
          </Aviso>
        )}
        <Enderecos
          unidadeId={unidadeId}
          situacao={situacao}
          onMudou={(r) => {
            setSituacao(situacaoDe(r));
            void cliente.invalidateQueries({ queryKey: chave(unidadeId) });
          }}
        />
        <VisualDoAgendamento unidadeId={unidadeId} slug={situacao.slug} />
        <DominioProprio
          unidadeId={unidadeId}
          situacao={situacao}
          onMudou={(r) => {
            setSituacao(situacaoDe(r));
            void cliente.invalidateQueries({ queryKey: chave(unidadeId) });
          }}
        />
        {problema && <Aviso tom="erro">{problema}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex w-full max-w-md min-w-0 flex-[1_1_340px] flex-col gap-4">
            <Selecao
              id="pagina-editada"
              rotulo="Página"
              value={pagina}
              onChange={(e) => setPagina(e.target.value as PaginaSite)}
              opcoes={PAGINAS_SITE.filter((p) => paginaLigada(site, p)).map((p) => ({
                valor: p,
                rotulo: ROTULO_PAGINA[p],
              }))}
            />
            <fieldset className="flex flex-col gap-1 rounded-md border border-borda p-3">
              <legend className="px-1 text-sm font-medium">Páginas extras</legend>
              {PAGINAS_EXTRAS.map((p) => (
                <Marcar
                  key={p}
                  id={`pagina-extra-${p}`}
                  rotulo={
                    p === 'galeria'
                      ? 'Galeria: fotos dos trabalhos'
                      : 'Clube: os planos de assinatura, com o botão Assinar'
                  }
                  marcado={paginaLigada(site, p)}
                  onMudar={(v) => {
                    if (v) {
                      mudar(ligarPagina(site, p));
                      setPagina(p);
                    } else {
                      if (pagina === p) setPagina('inicio');
                      mudar(desligarPagina(site, p));
                    }
                  }}
                />
              ))}
              <p className="text-sm text-tinta-suave">
                Ligada, a página entra no menu do site. Desligar apaga o que estava nela.
              </p>
            </fieldset>
            <Abas
              rotulo="Montar a página"
              atual={aba}
              onTrocar={setAba}
              abas={[
                {
                  id: 'blocos',
                  rotulo: 'Blocos',
                  conteudo: (
                    <ListaDeBlocos
                      site={site}
                      pagina={pagina}
                      barbearia={previa.barbearia}
                      equipe={previa.equipe}
                      onMudar={mudar}
                    />
                  ),
                },
                { id: 'tema', rotulo: 'Tema', conteudo: <Tema site={site} onMudar={mudar} /> },
                {
                  id: 'cabecalho-rodape',
                  rotulo: 'Cabeçalho e rodapé',
                  conteudo: <CabecalhoERodape site={site} onMudar={mudar} />,
                },
              ]}
            />
          </div>

          <section aria-label="Prévia" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Prévia: {ROTULO_PAGINA[pagina]}</h2>
              <div
                role="group"
                aria-label="Ver como"
                className="inline-flex overflow-hidden rounded-md border border-borda"
              >
                {[
                  { cel: false, rotulo: 'Computador', Icone: Monitor },
                  { cel: true, rotulo: 'Celular', Icone: Smartphone },
                ].map(({ cel, rotulo, Icone }) => (
                  <button
                    key={rotulo}
                    type="button"
                    aria-pressed={celular === cel}
                    onClick={() => setCelular(cel)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium',
                      celular === cel
                        ? 'bg-tinta text-fundo'
                        : 'bg-superficie text-tinta-suave hover:text-tinta',
                    )}
                  >
                    <Icone aria-hidden className="size-4" />
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div
              onClickCapture={naPrevia}
              className={cn(
                'mx-auto h-[78vh] w-full overflow-y-auto border border-borda bg-white shadow-sm transition-[max-width] duration-[var(--ritmo)]',
                celular ? 'max-w-[390px] rounded-[28px]' : 'max-w-none rounded-lg',
              )}
            >
              <SiteDaBarbearia dados={dadosDaPrevia} pagina={pagina} base={base} />
            </div>
          </section>
        </div>

        <ModalConfirmacao
          aberto={confirmarTirar}
          titulo="Tirar o site do ar?"
          descricao="O link da barbearia volta a abrir só a página de agendamento. O que você montou fica guardado para publicar de novo."
          textoConfirmar="Tirar do ar"
          tom="perigo"
          carregando={publicando}
          onConfirmar={tirarDoAr}
          onCancelar={() => setConfirmarTirar(false)}
        />
      </div>
    </ContextoFotos.Provider>
  );
}

function ListaDeBlocos({
  site,
  pagina,
  barbearia,
  equipe,
  onMudar,
}: {
  site: SiteBarbearia;
  pagina: PaginaSite;
  barbearia: string;
  equipe: SitePublico['equipe'];
  onMudar: (s: SiteBarbearia) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const blocos = blocosDaPagina(site, pagina);
  const faltam = blocosParaAdicionar(site, pagina);
  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-tinta-suave">
        Cada faixa da página é um bloco. Mude a ordem com as setas, esconda com o olho e clique no
        nome para editar.
      </p>
      <ol className="flex flex-col gap-2">
        <li className="flex min-h-11 items-center justify-between rounded-md bg-superficie-2 px-3 text-sm text-tinta-suave">
          Cabeçalho e menu <span>fixo</span>
        </li>
        {blocos.map((b, i) => (
          <ItemBloco
            key={b.id}
            bloco={b}
            primeiro={i === 0}
            ultimo={i === blocos.length - 1}
            aberto={aberto === b.id}
            equipe={equipe}
            site={site}
            onAbrir={() => setAberto(aberto === b.id ? null : b.id)}
            onMover={(d) => onMudar(moverBloco(site, pagina, b.id, d))}
            onEditar={(m) => onMudar(editarBloco(site, pagina, b.id, m))}
            onRemover={() => onMudar(removerBloco(site, pagina, b.id))}
            onEquipe={(id, campo, valor) =>
              onMudar({
                ...site,
                equipe: {
                  ...site.equipe,
                  [id]: { foco: '', sobre: '', ...site.equipe[id], [campo]: valor },
                },
              })
            }
          />
        ))}
        <li className="flex min-h-11 items-center justify-between rounded-md bg-superficie-2 px-3 text-sm text-tinta-suave">
          Rodapé <span>fixo</span>
        </li>
      </ol>
      {faltam.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-borda-forte p-3">
          <p className="text-sm font-medium">Adicionar bloco</p>
          <div className="flex flex-wrap gap-2">
            {faltam.map((t) => (
              <Botao
                key={t}
                variante="secundario"
                onClick={() => onMudar(adicionarBloco(site, pagina, t, barbearia))}
              >
                {BLOCOS_SITE[t].rotulo}
              </Botao>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemBloco({
  bloco,
  primeiro,
  ultimo,
  aberto,
  equipe,
  site,
  onAbrir,
  onMover,
  onEditar,
  onRemover,
  onEquipe,
}: {
  bloco: BlocoSite;
  primeiro: boolean;
  ultimo: boolean;
  aberto: boolean;
  equipe: SitePublico['equipe'];
  site: SiteBarbearia;
  onAbrir: () => void;
  onMover: (d: -1 | 1) => void;
  onEditar: (m: Partial<Omit<BlocoSite, 'id' | 'tipo'>>) => void;
  onRemover: () => void;
  onEquipe: (id: string, campo: 'foco' | 'sobre' | 'foto', valor: string | undefined) => void;
}) {
  const { unidadeId, registrar } = useContext(ContextoFotos);
  const comFoto = (aplicar: (id: string | undefined) => void) => (f: FotoEnviada | null) => {
    if (f) registrar(f);
    aplicar(f?.id);
  };
  const def = BLOCOS_SITE[bloco.tipo] as {
    rotulo: string;
    titulo?: boolean;
    texto?: boolean;
    foto?: boolean;
    itens?: { titulo: string; texto: string; foto?: boolean };
  };
  const idPainel = `bloco-${bloco.id}`;
  const itens = bloco.itens ?? [];
  const icone =
    'size-9 inline-flex items-center justify-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta disabled:opacity-30';
  return (
    <li
      className={cn(
        'rounded-md border bg-superficie',
        aberto ? 'border-acao-texto' : 'border-borda',
        !bloco.visivel && 'border-dashed',
      )}
    >
      <div className="flex items-center gap-1 py-1 pr-1 pl-1">
        <button
          type="button"
          className={icone}
          aria-label={`Subir ${def.rotulo}`}
          disabled={primeiro}
          onClick={() => onMover(-1)}
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          className={icone}
          aria-label={`Descer ${def.rotulo}`}
          disabled={ultimo}
          onClick={() => onMover(1)}
        >
          <ArrowDown aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={idPainel}
          onClick={onAbrir}
          className="min-h-11 flex-1 px-2 text-left font-medium"
        >
          {def.rotulo}
          {!bloco.visivel && (
            <span className="ml-2 text-sm font-normal text-tinta-suave">escondido</span>
          )}
        </button>
        <button
          type="button"
          className={cn(icone, 'size-11')}
          aria-label={bloco.visivel ? `Esconder ${def.rotulo}` : `Mostrar ${def.rotulo}`}
          aria-pressed={bloco.visivel}
          onClick={() => onEditar({ visivel: !bloco.visivel })}
        >
          {bloco.visivel ? (
            <Eye aria-hidden className="size-5" />
          ) : (
            <EyeOff aria-hidden className="size-5" />
          )}
        </button>
      </div>
      {aberto && (
        <div id={idPainel} className="flex flex-col gap-4 border-t border-borda p-4">
          {EXPLICACAO[bloco.tipo] && (
            <p className="text-sm text-tinta-suave">{EXPLICACAO[bloco.tipo]}</p>
          )}
          {def.foto && (
            <CampoFoto
              rotulo="Foto"
              unidadeId={unidadeId}
              valor={bloco.foto}
              dica={
                bloco.tipo === 'banner'
                  ? 'Foto deitada do salão ou de um corte. O texto fica por cima, com um véu escuro.'
                  : undefined
              }
              onMudar={comFoto((foto) => onEditar({ foto }))}
            />
          )}
          {def.titulo && (
            <Campo
              id={`${idPainel}-titulo`}
              rotulo="Título"
              value={bloco.titulo ?? ''}
              maxLength={120}
              onChange={(e) => onEditar({ titulo: e.target.value })}
            />
          )}
          {def.texto && (
            <CampoTexto
              id={`${idPainel}-texto`}
              rotulo="Texto"
              rows={3}
              value={bloco.texto ?? ''}
              maxLength={600}
              onChange={(e) => onEditar({ texto: e.target.value })}
            />
          )}
          {def.itens && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-medium">{def.rotulo}</legend>
              {itens.map((it, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md bg-superficie-2 p-3">
                  {def.itens!.foto && (
                    <CampoFoto
                      rotulo={`Foto ${i + 1}`}
                      unidadeId={unidadeId}
                      valor={it.foto}
                      onMudar={comFoto((foto) =>
                        onEditar({ itens: itens.map((x, j) => (j === i ? { ...x, foto } : x)) }),
                      )}
                    />
                  )}
                  <Campo
                    id={`${idPainel}-item-${i}-titulo`}
                    rotulo={def.itens!.titulo}
                    value={it.titulo}
                    maxLength={160}
                    onChange={(e) =>
                      onEditar({
                        itens: itens.map((x, j) =>
                          j === i ? { ...x, titulo: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  {def.itens!.texto && (
                    <CampoTexto
                      id={`${idPainel}-item-${i}-texto`}
                      rotulo={def.itens!.texto}
                      rows={2}
                      value={it.texto}
                      maxLength={600}
                      onChange={(e) =>
                        onEditar({
                          itens: itens.map((x, j) =>
                            j === i ? { ...x, texto: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  )}
                  <Botao
                    variante="fantasma"
                    className="self-start"
                    onClick={() => onEditar({ itens: itens.filter((_, j) => j !== i) })}
                  >
                    Remover
                  </Botao>
                </div>
              ))}
              {itens.length < 12 && (
                <Botao
                  variante="secundario"
                  className="self-start"
                  onClick={() =>
                    onEditar({ itens: [...itens, { titulo: '', texto: '' }], visivel: true })
                  }
                >
                  Adicionar
                </Botao>
              )}
              {bloco.tipo === 'depoimentos' && (
                <p className="text-sm text-tinta-suave">
                  Use só depoimentos reais, com a permissão de quem disse.
                </p>
              )}
            </fieldset>
          )}
          {bloco.tipo === 'barbeiros' &&
            (equipe.length ? (
              <div className="flex flex-col gap-3">
                {equipe.map((p) => (
                  <fieldset
                    key={p.id}
                    className="flex flex-col gap-2 rounded-md bg-superficie-2 p-3"
                  >
                    <legend className="font-medium">{p.nome}</legend>
                    <CampoFoto
                      rotulo="Foto"
                      unidadeId={unidadeId}
                      valor={site.equipe[p.id]?.foto}
                      onMudar={comFoto((foto) => onEquipe(p.id, 'foto', foto))}
                    />
                    <Campo
                      id={`${idPainel}-${p.id}-foco`}
                      rotulo="Especialidade"
                      placeholder="Ex.: Degradê e desenho"
                      value={site.equipe[p.id]?.foco ?? ''}
                      maxLength={80}
                      onChange={(e) => onEquipe(p.id, 'foco', e.target.value)}
                    />
                    <CampoTexto
                      id={`${idPainel}-${p.id}-sobre`}
                      rotulo="Apresentação"
                      rows={3}
                      value={site.equipe[p.id]?.sobre ?? ''}
                      maxLength={600}
                      onChange={(e) => onEquipe(p.id, 'sobre', e.target.value)}
                    />
                  </fieldset>
                ))}
              </div>
            ) : (
              <p className="text-sm text-tinta-suave">Nenhum barbeiro ativo nesta unidade.</p>
            ))}
          <Botao variante="fantasma" className="self-start" onClick={onRemover}>
            Tirar bloco da página
          </Botao>
        </div>
      )}
    </li>
  );
}

function Tema({ site, onMudar }: { site: SiteBarbearia; onMudar: (s: SiteBarbearia) => void }) {
  const { unidadeId, registrar } = useContext(ContextoFotos);
  return (
    <div className="flex flex-col gap-5 pt-4">
      <CampoFoto
        rotulo="Logotipo"
        unidadeId={unidadeId}
        valor={site.logo}
        dica="Aparece no topo, ao lado do nome. Sem logotipo, vai a inicial da barbearia."
        onMudar={(f) => {
          if (f) registrar(f);
          onMudar({ ...site, logo: f?.id });
        }}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Estilo</legend>
        <p className="text-sm text-tinta-suave">
          Os quatro usam os mesmos blocos e textos: trocar não apaga nada.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMAS_SITE.map((t) => {
            const p = PALETAS_SITE[t];
            return (
              <label
                key={t}
                className="flex cursor-pointer flex-col gap-2 rounded-md border border-borda p-3 has-[:checked]:border-acao-texto has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foco"
              >
                <input
                  type="radio"
                  name="tema-site"
                  value={t}
                  checked={site.tema === t}
                  onChange={() => onMudar({ ...site, tema: t, fonte: FONTE_DO_TEMA[t] })}
                  className="sr-only"
                />
                <span aria-hidden className="flex h-10 overflow-hidden rounded-sm">
                  <span className="flex-1" style={{ background: p.escuro }} />
                  <span className="flex-1" style={{ background: p.papel }} />
                  <span className="w-6" style={{ background: CORES_SITE[site.cor].hex }} />
                </span>
                <span className="font-medium">{ROTULO_TEMA[t].nome}</span>
                <span className="text-sm text-tinta-suave">{ROTULO_TEMA[t].descricao}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Cor de destaque</legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(CORES_SITE) as CorSite[]).map((c) => (
            <label key={c} className="flex cursor-pointer flex-col items-center gap-1 text-xs">
              <input
                type="radio"
                name="cor-site"
                value={c}
                checked={site.cor === c}
                onChange={() => onMudar({ ...site, cor: c })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="size-11 rounded-full border-2 border-superficie shadow-[0_0_0_1px_var(--color-borda)] peer-checked:shadow-[0_0_0_3px_var(--color-tinta)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco"
                style={{ background: CORES_SITE[c].hex }}
              />
              {CORES_SITE[c].rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <Selecao
        id="tema-fonte"
        rotulo="Fonte dos títulos"
        value={site.fonte}
        onChange={(e) => onMudar({ ...site, fonte: e.target.value as FonteSite })}
        opcoes={(Object.keys(FONTES_SITE) as FonteSite[]).map((f) => ({
          valor: f,
          rotulo: FONTES_SITE[f],
        }))}
      />
      <Selecao
        id="tema-botoes"
        rotulo="Botões"
        value={site.botoes}
        onChange={(e) => onMudar({ ...site, botoes: e.target.value as BotoesSite })}
        opcoes={(Object.keys(BOTOES_SITE) as BotoesSite[]).map((b) => ({
          valor: b,
          rotulo: BOTOES_SITE[b],
        }))}
      />
      <Campo
        id="tema-slogan"
        rotulo="Frase do rodapé"
        value={site.slogan}
        maxLength={160}
        onChange={(e) => onMudar({ ...site, slogan: e.target.value })}
      />
      <Campo
        id="tema-instagram"
        rotulo="Instagram"
        dica="Só o usuário, com ou sem @. Aparece no Contato e no rodapé."
        value={site.instagram}
        maxLength={31}
        onChange={(e) => onMudar({ ...site, instagram: e.target.value.replace(/^@/, '') })}
      />
      <details className="rounded-md border border-borda p-3">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          Avançado: CSS personalizado
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          <CampoTexto
            id="tema-css"
            rotulo="CSS"
            rows={8}
            spellCheck={false}
            className="font-mono text-sm"
            dica={`Para quem conhece CSS: vale só no seu site. Não aceita buscar arquivos de fora (url, @import). Até ${LIMITE_CSS_SITE} letras.`}
            value={site.css ?? ''}
            maxLength={LIMITE_CSS_SITE}
            onChange={(e) => onMudar({ ...site, css: e.target.value })}
          />
        </div>
      </details>
    </div>
  );
}

/**
 * Os dois endereços da unidade (lote 7d): o do site, que o dono escolhe aqui, e o do link de
 * agendamento, que fica em Configurações. Trocar um não muda o outro; o antigo leva ao novo.
 */
function Enderecos({
  unidadeId,
  situacao,
  onMudou,
}: {
  unidadeId: string;
  situacao: Situacao;
  onMudou: (r: SitePainel) => void;
}) {
  const atual = situacao.siteSlug ?? situacao.sugestaoSiteSlug;
  const [valor, setValor] = useState(atual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const origem = typeof window === 'undefined' ? '' : window.location.origin;
  const mudou = valor.trim().toLowerCase() !== (situacao.siteSlug ?? '');

  async function salvar() {
    const r = enderecoSiteSchema.safeParse({ slug: valor });
    if (!r.success) {
      setErro(r.error.issues[0]?.message ?? 'Endereço inválido.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const antigo = situacao.siteSlug;
      const novo = await api<SitePainel>(`unidades/${unidadeId}/site/endereco`, {
        metodo: 'PUT',
        corpo: r.data,
      });
      if (antigo) await renovarSite(antigo);
      if (novo.siteSlug) await renovarSite(novo.siteSlug);
      setValor(novo.siteSlug ?? r.data.slug);
      onMudou(novo);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  async function copiar(rotulo: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(rotulo);
    } catch {
      setCopiado(null);
    }
  }

  const linkSite = `${origem}${caminhoDoSite(atual)}`;
  const linkAgenda = situacao.slug ? `${origem}${caminhoDoAgendamento(situacao.slug)}` : null;
  return (
    <section
      aria-label="Endereços"
      className="grid gap-4 rounded-lg border border-borda bg-superficie p-4 md:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="font-semibold">Endereço do site</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo
              id="endereco-site"
              rotulo={`${origem.replace(/^https?:\/\//, '')}/s/`}
              value={valor}
              maxLength={60}
              onChange={(e) => {
                setErro(null);
                setValor(e.target.value);
              }}
              erro={erro ?? undefined}
            />
          </div>
          <Botao
            variante="secundario"
            onClick={salvar}
            carregando={salvando}
            disabled={!mudou || !valor.trim()}
          >
            Salvar endereço
          </Botao>
        </div>
        <p className="text-sm text-tinta-suave">
          {situacao.siteSlug
            ? 'Se trocar, quem tiver o endereço antigo é levado ao novo.'
            : 'Sugestão. Fica valendo quando você salvar ou publicar.'}
        </p>
        {situacao.publicado && situacao.siteSlug && (
          <Botao
            variante="fantasma"
            className="self-start"
            onClick={() => copiar('site', linkSite)}
          >
            {copiado === 'site' ? 'Endereço do site copiado' : 'Copiar endereço do site'}
          </Botao>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="font-semibold">Link de agendamento</h2>
        {linkAgenda ? (
          <>
            <p className="break-all">{linkAgenda.replace(/^https?:\/\//, '')}</p>
            <p className="text-sm text-tinta-suave">
              É para onde vão os botões &ldquo;Agendar&rdquo; do site. Para trocar, vá em{' '}
              <Link href="/configuracoes?aba=link" className="font-semibold underline">
                Configurações, Link de agendamento
              </Link>
              ; o site não muda.
            </p>
            <Botao
              variante="fantasma"
              className="self-start"
              onClick={() => copiar('agenda', linkAgenda)}
            >
              {copiado === 'agenda' ? 'Link copiado' : 'Copiar link de agendamento'}
            </Botao>
          </>
        ) : (
          <p className="text-sm text-tinta-suave">
            Ainda sem link. Crie em{' '}
            <Link href="/configuracoes?aba=link" className="font-semibold underline">
              Configurações, Link de agendamento
            </Link>
            .
          </p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {copiado ? 'Copiado.' : ''}
      </p>
    </section>
  );
}

/**
 * Domínio próprio (lote 7e): o dono informa o domínio, vê o registro de DNS para criar onde
 * comprou o domínio e o sistema confere. Conferido, o site abre nele com HTTPS.
 */
function DominioProprio({
  unidadeId,
  situacao,
  onMudou,
}: {
  unidadeId: string;
  situacao: Situacao;
  onMudou: (r: SitePainel) => void;
}) {
  const [valor, setValor] = useState('');
  const [ocupado, setOcupado] = useState<'ligar' | 'conferir' | 'tirar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conferido, setConferido] = useState(false);
  const alvo = typeof window === 'undefined' ? '' : window.location.hostname;

  async function chamar(tipo: 'ligar' | 'conferir' | 'tirar', fn: () => Promise<SitePainel>) {
    setOcupado(tipo);
    setErro(null);
    try {
      const r = await fn();
      onMudou(r);
      if (tipo === 'conferir') setConferido(true);
      if (tipo === 'ligar') setValor('');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(null);
    }
  }
  const ligar = () =>
    chamar('ligar', () =>
      api<SitePainel>(`unidades/${unidadeId}/site/dominio`, {
        metodo: 'PUT',
        corpo: { dominio: valor },
      }),
    );
  const conferir = () =>
    chamar('conferir', () =>
      api<SitePainel>(`unidades/${unidadeId}/site/dominio/verificar`, { metodo: 'POST' }),
    );
  const tirar = () =>
    chamar('tirar', () =>
      api<SitePainel>(`unidades/${unidadeId}/site/dominio`, { metodo: 'DELETE' }),
    );

  return (
    <section
      aria-label="Domínio próprio"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 className="font-semibold">Domínio próprio</h2>
      {!situacao.dominio ? (
        <>
          <p className="text-sm text-tinta-suave">
            Tem um endereço só da barbearia, como barbeariadocarlos.com.br? Ligue aqui e o site abre
            nele, com o cadeado de site seguro. É opcional.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo
                id="dominio-proprio"
                rotulo="Domínio"
                placeholder="barbeariadocarlos.com.br"
                value={valor}
                maxLength={260}
                onChange={(e) => {
                  setErro(null);
                  setValor(e.target.value);
                }}
                erro={erro ?? undefined}
              />
            </div>
            <Botao
              variante="secundario"
              onClick={ligar}
              carregando={ocupado === 'ligar'}
              disabled={!valor.trim()}
            >
              Ligar domínio
            </Botao>
          </div>
        </>
      ) : situacao.dominioVerificado ? (
        <>
          <p>
            {situacao.publicado ? (
              <>
                No ar em{' '}
                <a
                  href={`https://${situacao.dominio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                >
                  {situacao.dominio}
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>
                .
              </>
            ) : (
              <>{situacao.dominio} está pronto. O site abre nele assim que você publicar.</>
            )}
          </p>
          <p className="text-sm text-tinta-suave">
            No domínio, /servicos, /equipe e /contato são as páginas do site, e /agendar é o
            agendamento. No primeiro acesso, o cadeado pode levar alguns segundos.
          </p>
          <Botao
            variante="fantasma"
            className="self-start"
            onClick={tirar}
            carregando={ocupado === 'tirar'}
          >
            Tirar domínio
          </Botao>
        </>
      ) : (
        <>
          <p>
            <strong>{situacao.dominio}</strong>: esperando o DNS apontar para o Pente Fino.
          </p>
          <div className="flex flex-col gap-1 rounded-md bg-superficie-2 p-3 text-sm">
            <p>
              No site onde você comprou o domínio (Registro.br, GoDaddy, Hostinger…), na parte de
              DNS, crie:
            </p>
            <ul className="list-disc pl-5">
              {situacao.dominioIps.length > 0 ? (
                <li>
                  um registro <strong>A</strong> em <strong>{situacao.dominio}</strong> apontando
                  para <strong className="break-all">{situacao.dominioIps.join(' e ')}</strong>;
                </li>
              ) : null}
              <li>
                um registro <strong>CNAME</strong> em <strong>www</strong> apontando para{' '}
                <strong className="break-all">{alvo}</strong>.
              </li>
            </ul>
            <p className="text-tinta-suave">
              A mudança costuma valer em minutos, mas pode levar até um dia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={conferir} carregando={ocupado === 'conferir'}>
              Conferir agora
            </Botao>
            <Botao variante="fantasma" onClick={tirar} carregando={ocupado === 'tirar'}>
              Tirar domínio
            </Botao>
          </div>
          <p className="text-sm text-tinta-suave" aria-live="polite">
            {conferido && !situacao.dominioVerificado
              ? 'Ainda não aponta para o Pente Fino. Confira o registro e tente de novo daqui a pouco.'
              : ''}
          </p>
        </>
      )}
      {erro && situacao.dominio && <Aviso tom="erro">{erro}</Aviso>}
    </section>
  );
}

function Marcar({
  id,
  rotulo,
  marcado,
  onMudar,
}: {
  id: string;
  rotulo: string;
  marcado: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        onChange={(e) => onMudar(e.target.checked)}
        className="size-5 accent-[var(--color-acao)]"
      />
      <span>{rotulo}</span>
    </label>
  );
}

/** Links próprios (texto e endereço), com limite. */
function EditorDeLinks({
  id,
  links,
  maximo,
  onMudar,
}: {
  id: string;
  links: LinkSite[];
  maximo: number;
  onMudar: (l: LinkSite[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {links.map((l, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md bg-superficie-2 p-3">
          <Campo
            id={`${id}-${i}-rotulo`}
            rotulo={`Link ${i + 1}: texto`}
            value={l.rotulo}
            maxLength={40}
            onChange={(e) =>
              onMudar(links.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))
            }
          />
          <Campo
            id={`${id}-${i}-url`}
            rotulo={`Link ${i + 1}: endereço`}
            placeholder="https://"
            inputMode="url"
            value={l.url}
            maxLength={500}
            onChange={(e) =>
              onMudar(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
            }
          />
          <Botao
            variante="fantasma"
            className="self-start"
            onClick={() => onMudar(links.filter((_, j) => j !== i))}
          >
            Remover link
          </Botao>
        </div>
      ))}
      {links.length < maximo && (
        <Botao
          variante="secundario"
          className="self-start"
          onClick={() => onMudar([...links, { rotulo: '', url: 'https://' }])}
        >
          Adicionar link
        </Botao>
      )}
    </div>
  );
}

/** Cabeçalho e rodapé editáveis (lote 7n): o dono edita tudo, inclusive a linha do Pente Fino. */
function CabecalhoERodape({
  site,
  onMudar,
}: {
  site: SiteBarbearia;
  onMudar: (s: SiteBarbearia) => void;
}) {
  const c = cabecalhoDoSite(site);
  const r = rodapeDoSite(site);
  const mudarC = (m: Partial<CabecalhoSite>) => onMudar({ ...site, cabecalho: { ...c, ...m } });
  const mudarR = (m: Partial<RodapeSite>) => onMudar({ ...site, rodape: { ...r, ...m } });
  const moverMenu = (i: number, d: -1 | 1) => {
    const menu = [...c.menu];
    const j = i + d;
    if (j < 0 || j >= menu.length) return;
    [menu[i], menu[j]] = [menu[j]!, menu[i]!];
    mudarC({ menu });
  };
  const icone =
    'size-9 inline-flex items-center justify-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta disabled:opacity-30';
  return (
    <div className="flex flex-col gap-6 pt-4">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-semibold">Cabeçalho</legend>
        <Selecao
          id="cab-mostrar"
          rotulo="No canto do topo"
          value={c.mostrar}
          onChange={(e) => mudarC({ mostrar: e.target.value as CabecalhoSite['mostrar'] })}
          opcoes={[
            { valor: 'ambos', rotulo: 'Logotipo e nome' },
            { valor: 'logo', rotulo: 'Só o logotipo' },
            { valor: 'nome', rotulo: 'Só o nome' },
          ]}
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Menu</p>
          <ol className="flex flex-col gap-2">
            {c.menu.map((m, i) => (
              <li key={m.pagina} className="flex flex-col gap-1 rounded-md border border-borda p-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={icone}
                    aria-label={`Subir ${ROTULO_PAGINA[m.pagina]} no menu`}
                    disabled={i === 0}
                    onClick={() => moverMenu(i, -1)}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={icone}
                    aria-label={`Descer ${ROTULO_PAGINA[m.pagina]} no menu`}
                    disabled={i === c.menu.length - 1}
                    onClick={() => moverMenu(i, 1)}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <Campo
                      id={`cab-menu-${m.pagina}`}
                      rotulo={`Texto de ${ROTULO_PAGINA[m.pagina]}`}
                      placeholder={ROTULO_PAGINA[m.pagina]}
                      value={m.rotulo}
                      maxLength={30}
                      onChange={(e) =>
                        mudarC({
                          menu: c.menu.map((x) =>
                            x.pagina === m.pagina ? { ...x, rotulo: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
                <Marcar
                  id={`cab-menu-${m.pagina}-visivel`}
                  rotulo={`Mostrar ${ROTULO_PAGINA[m.pagina]} no menu`}
                  marcado={m.visivel}
                  onMudar={(v) =>
                    mudarC({
                      menu: c.menu.map((x) => (x.pagina === m.pagina ? { ...x, visivel: v } : x)),
                    })
                  }
                />
              </li>
            ))}
          </ol>
          <p className="text-sm text-tinta-suave">
            Esconder do menu não apaga a página: quem tiver o endereço continua abrindo.
          </p>
        </div>
        <Campo
          id="cab-botao"
          rotulo="Texto do botão principal"
          placeholder="Agendar horário"
          value={c.botao}
          maxLength={30}
          onChange={(e) => mudarC({ botao: e.target.value })}
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Links no menu (até 3)</p>
          <EditorDeLinks
            id="cab-links"
            links={c.links}
            maximo={3}
            onMudar={(links) => mudarC({ links })}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-semibold">Rodapé</legend>
        <Marcar
          id="rod-endereco"
          rotulo="Mostrar o endereço"
          marcado={r.endereco}
          onMudar={(v) => mudarR({ endereco: v })}
        />
        <Marcar
          id="rod-horario"
          rotulo="Mostrar o horário"
          marcado={r.horario}
          onMudar={(v) => mudarR({ horario: v })}
        />
        <Marcar
          id="rod-contato"
          rotulo="Mostrar WhatsApp e redes sociais"
          marcado={r.contato}
          onMudar={(v) => mudarR({ contato: v })}
        />
        <CampoTexto
          id="rod-texto"
          rotulo="Texto livre"
          dica="Por exemplo: CNPJ, formas de pagamento, estacionamento."
          rows={3}
          value={r.texto}
          maxLength={400}
          onChange={(e) => mudarR({ texto: e.target.value })}
        />
        <Campo
          id="rod-facebook"
          rotulo="Facebook (endereço)"
          placeholder="https://facebook.com/..."
          inputMode="url"
          value={r.facebook}
          maxLength={300}
          onChange={(e) => mudarR({ facebook: e.target.value })}
        />
        <Campo
          id="rod-tiktok"
          rotulo="TikTok (endereço)"
          placeholder="https://tiktok.com/@..."
          inputMode="url"
          value={r.tiktok}
          maxLength={300}
          onChange={(e) => mudarR({ tiktok: e.target.value })}
        />
        <Campo
          id="rod-youtube"
          rotulo="YouTube (endereço)"
          placeholder="https://youtube.com/@..."
          inputMode="url"
          value={r.youtube}
          maxLength={300}
          onChange={(e) => mudarR({ youtube: e.target.value })}
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Links no rodapé (até 6)</p>
          <EditorDeLinks
            id="rod-links"
            links={r.links}
            maximo={6}
            onMudar={(links) => mudarR({ links })}
          />
        </div>
        <Marcar
          id="rod-creditos"
          rotulo="Mostrar “Site e agenda pelo Pente Fino”"
          marcado={r.creditos}
          onMudar={(v) => mudarR({ creditos: v })}
        />
      </fieldset>
    </div>
  );
}

/**
 * Lote 7l: a página de agendamento (/b/<link>) com a cara da barbearia. Separada do site: salva e
 * já vale, sem "Publicar".
 */
function VisualDoAgendamento({ unidadeId, slug }: { unidadeId: string; slug: string | null }) {
  const consulta = useQuery({
    queryKey: ['unidades', unidadeId, 'agendamento-visual'],
    queryFn: () => api<VisualAgendamento>(`unidades/${unidadeId}/agendamento-visual`),
  });
  return (
    <section
      aria-label="Página de agendamento"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 className="font-semibold">Página de agendamento</h2>
      <Estado consulta={consulta}>
        {() => <FormVisual unidadeId={unidadeId} slug={slug} inicial={consulta.data!} />}
      </Estado>
    </section>
  );
}

function FormVisual({
  unidadeId,
  slug,
  inicial,
}: {
  unidadeId: string;
  slug: string | null;
  inicial: VisualAgendamento;
}) {
  const cliente = useQueryClient();
  const [v, setV] = useState(inicial);
  const [estado, setEstado] = useState<'salvo' | 'mudou' | 'salvando'>('salvo');
  const [erro, setErro] = useState<string | null>(null);
  const mudar = (m: Partial<VisualAgendamento>) => {
    setV({ ...v, ...m });
    setEstado('mudou');
    setErro(null);
  };
  async function salvar() {
    const r = visualAgendamentoSchema.safeParse(v);
    if (!r.success) {
      setErro(r.error.issues[0]?.message ?? 'Revise os campos.');
      return;
    }
    setEstado('salvando');
    try {
      await api(`unidades/${unidadeId}/agendamento-visual`, { metodo: 'PUT', corpo: r.data });
      setEstado('salvo');
      await cliente.invalidateQueries({ queryKey: ['unidades', unidadeId, 'agendamento-visual'] });
    } catch (e) {
      setEstado('mudou');
      setErro(mensagemDe(e));
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">
        A página onde o cliente marca o horário pode ter a cara da barbearia: cor, logotipo, foto de
        capa e um recado. Vale assim que salvar; não depende de publicar o site.
      </p>
      <Marcar
        id="visual-ativo"
        rotulo="Usar o visual da barbearia na página de agendamento"
        marcado={v.ativo}
        onMudar={(ativo) => mudar({ ativo })}
      />
      {v.ativo && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Cor dos botões</legend>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(CORES_SITE) as CorSite[]).map((c) => (
                <label key={c} className="flex cursor-pointer flex-col items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="cor-agendamento"
                    value={c}
                    checked={v.cor === c}
                    onChange={() => mudar({ cor: c })}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="size-11 rounded-full border-2 border-superficie shadow-[0_0_0_1px_var(--color-borda)] peer-checked:shadow-[0_0_0_3px_var(--color-tinta)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco"
                    style={{ background: CORES_SITE[c].hex }}
                  />
                  {CORES_SITE[c].rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          <CampoFoto
            rotulo="Logotipo"
            unidadeId={unidadeId}
            valor={v.logo}
            onMudar={(f) => mudar({ logo: f?.id })}
          />
          <CampoFoto
            rotulo="Foto de capa"
            unidadeId={unidadeId}
            valor={v.capa}
            dica="Foto deitada, aparece no topo da página."
            onMudar={(f) => mudar({ capa: f?.id })}
          />
          <Campo
            id="visual-titulo"
            rotulo="Título (opcional)"
            placeholder="Marque seu horário"
            value={v.titulo}
            maxLength={80}
            onChange={(e) => mudar({ titulo: e.target.value })}
          />
          <CampoTexto
            id="visual-texto"
            rotulo="Recado (opcional)"
            rows={2}
            value={v.texto}
            maxLength={300}
            onChange={(e) => mudar({ texto: e.target.value })}
          />
          <Marcar
            id="visual-link-site"
            rotulo="Mostrar o link “Ver o site da barbearia” (quando o site estiver publicado)"
            marcado={v.linkSite}
            onMudar={(linkSite) => mudar({ linkSite })}
          />
        </>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap items-center gap-2">
        <Botao onClick={salvar} carregando={estado === 'salvando'} disabled={estado === 'salvo'}>
          Salvar página de agendamento
        </Botao>
        {slug && (
          <a
            href={caminhoDoAgendamento(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="toque inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3"
          >
            Ver página de agendamento
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
        )}
        <span className="text-sm text-tinta-suave" aria-live="polite">
          {estado === 'salvo' ? 'Salvo.' : estado === 'mudou' ? 'Alterações não salvas.' : ''}
        </span>
      </div>
    </div>
  );
}

'use client';

// Painel "Minha página" (seção 7, lote 7b; modelo aprovado pelo dono em 13/11): o dono monta o
// site da barbearia com blocos, como numa loja virtual. Rascunho salvo sozinho, prévia ao vivo no
// computador e no celular, e o site só muda para o cliente em "Publicar alterações".
import {
  BLOCOS_SITE,
  BOTOES_SITE,
  CAMINHO_PAGINA,
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
  const [situacao, setSituacao] = useState<Situacao>(inicial);
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
      if (r.slug) await renovarSite(r.slug);
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
      if (r.slug) await renovarSite(r.slug);
      setAviso('O site saiu do ar. O link voltou a abrir a página de agendamento.');
      setConfirmarTirar(false);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setPublicando(false);
    }
  }

  const podePublicar = situacao.linkLigado && !!situacao.slug;
  const pendente = situacao.alteracoesPendentes || site !== ultimoSalvo;
  const dadosDaPrevia: SitePublico = {
    ...previa,
    site,
    fotos: { ...previa.fotos, ...fotosNovas },
    equipe: previa.equipe.map((p) => ({
      ...p,
      foco: site.equipe[p.id]?.foco ?? '',
      sobre: site.equipe[p.id]?.sobre ?? '',
    })),
  };
  const base = `/b/${situacao.slug ?? previa.slug}`;

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
                ? 'Até publicar, o link da barbearia abre a página de agendamento.'
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
            {situacao.publicado && situacao.slug && (
              <a
                href={`/b/${situacao.slug}`}
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
              disabled={!podePublicar || !!problema || (situacao.publicado && !pendente)}
            >
              {situacao.publicado ? 'Publicar alterações' : 'Publicar página'}
            </Botao>
          </div>
        </section>

        {!podePublicar && (
          <Aviso tom="aviso">
            Para publicar, ligue o link de agendamento desta unidade em{' '}
            <Link href="/configuracoes?aba=link" className="font-semibold underline">
              Configurações, Link de agendamento
            </Link>
            . Você pode montar a página antes.
          </Aviso>
        )}
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
              opcoes={PAGINAS_SITE.map((p) => ({ valor: p, rotulo: ROTULO_PAGINA[p] }))}
            />
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
  const blocos = site.paginas[pagina];
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
          <p className="text-sm font-medium">Pôr de volta</p>
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
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Estilo</p>
        <p className="text-sm text-tinta-suave">
          Tradicional. Os estilos Clube, Letreiro e Estúdio chegam em breve, com os mesmos blocos:
          trocar não apaga nada.
        </p>
      </div>
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
    </div>
  );
}

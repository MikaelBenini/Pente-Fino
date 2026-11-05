'use client';

import {
  ACOES_BOT,
  formatarDataHora,
  formatarTelefone,
  MAXIMO_OPCOES,
  NOME_ACAO_BOT,
  SOBRE_MENSAGEM_BOT,
  TIPOS_MENSAGEM_BOT,
  validarMenu,
  VARIAVEIS_BOT,
  type AcaoBot,
  type ConexaoBot,
  type EstadoBot,
  type GrupoPalavrasChave,
  type MensagensBot,
  type MenuBot,
  type MenuNo,
  type OpcaoMenu,
  type RespostaSimulacao,
  type SessaoBot,
  type TurnoBot,
  type UnidadeDoBot,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  Campo,
  CampoTexto,
  cn,
  Marcador,
  ModalConfirmacao,
  Selecao,
} from '@pente-fino/ui';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  MessageSquareText,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaveBot, useAcao, useBot, useConexaoBot } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';
const novoId = () => Math.random().toString(36).slice(2, 10);
const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function TelaBot() {
  const bot = useBot();
  // O aviso de queda no topo do painel abre direto na aba Conexão.
  const abaInicial = useSearchParams().get('aba') === 'conexao' ? 'conexao' : 'menu';
  const [aba, setAba] = useState(abaInicial);
  // Fora do editor: o editor é recriado quando a versão publicada muda e a confirmação continua.
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Bot do WhatsApp"
        pergunta="O que o bot responde, e quando? Sem inteligência artificial: só o que você escrever."
      />
      <Estado consulta={bot}>
        {() => {
          const e = bot.data!;
          return (
            <Abas
              rotulo="Bot"
              atual={aba}
              onTrocar={setAba}
              abas={[
                {
                  id: 'menu',
                  rotulo: 'Menu',
                  conteudo: (
                    <EditorDoBot
                      key={e.publicado.publicadoEm ?? 'padrao'}
                      e={e}
                      retorno={retorno}
                      onRetorno={setRetorno}
                      onTestar={() => setAba('testar')}
                    />
                  ),
                },
                { id: 'mensagens', rotulo: 'Mensagens prontas', conteudo: <Mensagens e={e} /> },
                { id: 'horario', rotulo: 'Horário', conteudo: <Horarios e={e} /> },
                { id: 'testar', rotulo: 'Testar', conteudo: <Simulador e={e} /> },
                { id: 'conexao', rotulo: 'Conexão', conteudo: <Conexao e={e} /> },
              ]}
            />
          );
        }}
      </Estado>
    </div>
  );
}

// ─── Editor do menu ───────────────────────────────────────────────────────

type OQueFaz = 'texto' | 'submenu' | AcaoBot;
const OPCOES_O_QUE_FAZ = (comSubmenu: boolean) => [
  { valor: 'texto', rotulo: 'Responder com o texto abaixo' },
  ...ACOES_BOT.map((a) => ({ valor: a, rotulo: NOME_ACAO_BOT[a] })),
  ...(comSubmenu ? [{ valor: 'submenu', rotulo: 'Abrir outro menu' }] : []),
];
const DICA_ACAO: Record<AcaoBot, string> = {
  agendar:
    'O bot marca pela conversa (serviço, profissional, dia e horário); sem serviço com preço ou profissional, manda o link do site.',
  meus_horarios: 'O bot mostra os horários marcados do cliente e deixa remarcar ou cancelar.',
  ver_precos: 'O bot manda o texto e a tabela de preços vigente da unidade.',
  endereco: 'Use {endereco} e {horario} no texto.',
  falar_com_atendente: 'O bot avisa e fica quieto até a recepção devolver a conversa.',
  voltar_menu: 'Mostra o menu principal de novo.',
};

interface Retorno {
  tom: 'erro' | 'sucesso';
  texto: string;
}

function EditorDoBot({
  e,
  retorno,
  onRetorno,
  onTestar,
}: {
  e: EstadoBot;
  retorno: Retorno | null;
  onRetorno: (r: Retorno | null) => void;
  onTestar: () => void;
}) {
  const base = e.rascunho?.menu ?? e.publicado.menu;
  const [menu, setMenu] = useState<MenuBot>(() => structuredClone(base));
  const [restaurar, setRestaurar] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const leitura = !e.podeEditar;
  const naoSalvo = !iguais(menu, base);
  const problemas = validarMenu(menu);
  const salvar = useAcao((m: MenuBot) => api('bot/menu', { metodo: 'PUT', corpo: m }), [chaveBot]);
  const publicar = useAcao(
    async (m: MenuBot) => {
      await api('bot/menu', { metodo: 'PUT', corpo: m });
      await api('bot/menu/publicar', { corpo: {} });
    },
    [chaveBot],
  );
  const voltar = useAcao(() => api('bot/menu/restaurar', { corpo: {} }), [chaveBot]);
  const jogarFora = useAcao(() => api('bot/menu/rascunho', { metodo: 'DELETE' }), [chaveBot]);
  const executar = async (fn: () => Promise<unknown>, sucesso: string) => {
    onRetorno(null);
    try {
      await fn();
      onRetorno({ tom: 'sucesso', texto: sucesso });
    } catch (err) {
      onRetorno({ tom: 'erro', texto: mensagemDe(err) });
    }
  };
  const temRascunho = !!e.rascunho || naoSalvo;

  return (
    <div className="flex flex-col gap-6">
      {leitura && (
        <Aviso tom="info">
          Só o dono edita o menu. Você pode ver e testar como o bot responde.
        </Aviso>
      )}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
          temRascunho ? 'border-aviso-texto/50 bg-superficie' : 'border-borda bg-superficie',
        )}
      >
        <p className="flex items-start gap-2">
          {temRascunho ? (
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-aviso-texto" />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-acao-texto" />
          )}
          <span>
            {temRascunho ? (
              <>
                <span className="font-semibold">Alterações ainda não estão no WhatsApp.</span>{' '}
                <span className="text-tinta-suave">
                  {naoSalvo ? 'Há mudanças não salvas.' : 'O rascunho está salvo.'} Teste e publique
                  quando estiver pronto.
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold">Este é o menu que o bot usa.</span>{' '}
                <span className="text-tinta-suave">
                  {e.publicado.publicadoEm
                    ? `Publicado em ${formatarDataHora(e.publicado.publicadoEm)}${e.publicado.publicadoPor ? ` por ${e.publicado.publicadoPor}` : ''}.`
                    : 'Menu padrão do Pente Fino.'}
                </span>
              </>
            )}
          </span>
        </p>
        {!leitura && (
          <div className="flex flex-wrap gap-2">
            {naoSalvo && (
              <Botao
                variante="secundario"
                carregando={salvar.isPending}
                onClick={() => executar(() => salvar.mutateAsync(menu), 'Rascunho salvo.')}
              >
                Salvar rascunho
              </Botao>
            )}
            {temRascunho && (
              <Botao
                disabled={problemas.length > 0}
                carregando={publicar.isPending}
                onClick={() =>
                  executar(() => publicar.mutateAsync(menu), 'Publicado. O bot já responde assim.')
                }
              >
                Publicar
              </Botao>
            )}
            {temRascunho && (
              <Botao variante="fantasma" onClick={() => setDescartar(true)}>
                Descartar alterações
              </Botao>
            )}
            {!temRascunho && e.temAnterior && (
              <Botao variante="fantasma" onClick={() => setRestaurar(true)}>
                <RotateCcw aria-hidden className="size-4" /> Voltar à versão anterior
              </Botao>
            )}
            <Botao variante="fantasma" onClick={onTestar}>
              <MessageSquareText aria-hidden className="size-4" /> Testar
            </Botao>
          </div>
        )}
      </div>
      {retorno && <Aviso tom={retorno.tom}>{retorno.texto}</Aviso>}
      {problemas.length > 0 && !leitura && (
        <Aviso tom="aviso">
          <p className="font-semibold">Corrija antes de publicar:</p>
          <ul className="mt-1 list-disc pl-5">
            {problemas.map((p) => (
              <li key={`${p.onde}${p.mensagem}`}>
                <span className="font-medium">{p.onde}:</span> {p.mensagem}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <fieldset disabled={leitura} className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="bot-menu" className="flex flex-col gap-3">
          <div>
            <h2 id="bot-menu" className="text-xl font-semibold">
              Menu principal
            </h2>
            <p className="text-tinta-suave">
              Vem logo depois da mensagem de boas-vindas. O cliente responde com o número.
            </p>
          </div>
          <EditorMenu
            menu={menu.menu}
            nivel={1}
            prefixo="menu"
            onChange={(m) => setMenu({ ...menu, menu: m })}
          />
        </section>

        <section aria-labelledby="bot-palavras" className="flex flex-col gap-3">
          <div>
            <h2 id="bot-palavras" className="text-xl font-semibold">
              Palavras-chave
            </h2>
            <p className="text-tinta-suave">
              Valem em qualquer ponto da conversa, sem diferença de acento e maiúscula. Ex.: quem
              escreve “quanto custa a barba?” recebe a tabela de preços.
            </p>
          </div>
          <ul className="animar-escalonado flex flex-col gap-3">
            {menu.palavrasChave.map((g, i) => (
              <li key={g.id}>
                <EditorGrupo
                  grupo={g}
                  indice={i}
                  onChange={(novo) =>
                    setMenu({
                      ...menu,
                      palavrasChave: menu.palavrasChave.map((x) => (x.id === g.id ? novo : x)),
                    })
                  }
                  onRemover={() =>
                    setMenu({
                      ...menu,
                      palavrasChave: menu.palavrasChave.filter((x) => x.id !== g.id),
                    })
                  }
                />
              </li>
            ))}
          </ul>
          {!leitura && (
            <Botao
              variante="secundario"
              className="self-start"
              onClick={() =>
                setMenu({
                  ...menu,
                  palavrasChave: [
                    ...menu.palavrasChave,
                    { id: novoId(), palavras: [], resposta: '', acao: null },
                  ],
                })
              }
            >
              <Plus aria-hidden className="size-4" /> Adicionar palavras-chave
            </Botao>
          )}
        </section>
      </fieldset>
      <Variaveis />

      <ModalConfirmacao
        aberto={restaurar}
        titulo="Voltar à versão anterior?"
        descricao="O menu publicado antes deste volta a valer no WhatsApp na hora. O atual fica guardado."
        textoConfirmar="Usar a versão anterior"
        carregando={voltar.isPending}
        onCancelar={() => setRestaurar(false)}
        onConfirmar={async () => {
          await executar(() => voltar.mutateAsync(undefined), 'Versão anterior publicada.');
          setRestaurar(false);
        }}
      />
      <ModalConfirmacao
        aberto={descartar}
        titulo="Descartar as alterações?"
        descricao="O rascunho é apagado e o editor volta ao menu publicado."
        textoConfirmar="Descartar"
        tom="perigo"
        carregando={jogarFora.isPending}
        onCancelar={() => setDescartar(false)}
        onConfirmar={async () => {
          if (e.rascunho)
            await executar(() => jogarFora.mutateAsync(undefined), 'Alterações descartadas.');
          setMenu(structuredClone(e.publicado.menu));
          setDescartar(false);
        }}
      />
    </div>
  );
}

function EditorMenu({
  menu,
  nivel,
  prefixo,
  onChange,
}: {
  menu: MenuNo;
  nivel: number;
  prefixo: string;
  onChange: (m: MenuNo) => void;
}) {
  const mover = (i: number, d: -1 | 1) => {
    const opcoes = [...menu.opcoes];
    const [o] = opcoes.splice(i, 1);
    opcoes.splice(i + d, 0, o!);
    onChange({ ...menu, opcoes });
  };
  return (
    <div className={cn('flex flex-col gap-3', nivel > 1 && 'border-l-2 border-borda-forte pl-4')}>
      <CampoTexto
        id={`${prefixo}-texto`}
        rotulo={nivel === 1 ? 'Texto acima das opções' : 'Texto do submenu'}
        rows={2}
        value={menu.texto}
        onChange={(ev) => onChange({ ...menu, texto: ev.target.value })}
      />
      <ol className="animar-escalonado flex flex-col gap-3">
        {menu.opcoes.map((o, i) => (
          <li key={o.id}>
            <EditorOpcao
              opcao={o}
              numero={i + 1}
              nivel={nivel}
              prefixo={`${prefixo}-${o.id}`}
              primeira={i === 0}
              ultima={i === menu.opcoes.length - 1}
              onMover={(d) => mover(i, d)}
              onChange={(nova) =>
                onChange({ ...menu, opcoes: menu.opcoes.map((x) => (x.id === o.id ? nova : x)) })
              }
              onRemover={() =>
                onChange({ ...menu, opcoes: menu.opcoes.filter((x) => x.id !== o.id) })
              }
            />
          </li>
        ))}
      </ol>
      <Botao
        variante="secundario"
        className="self-start"
        disabled={menu.opcoes.length >= MAXIMO_OPCOES}
        onClick={() =>
          onChange({
            ...menu,
            opcoes: [
              ...menu.opcoes,
              { id: novoId(), rotulo: '', resposta: '', acao: null, submenu: null },
            ],
          })
        }
      >
        <Plus aria-hidden className="size-4" />
        {menu.opcoes.length >= MAXIMO_OPCOES
          ? `Máximo de ${MAXIMO_OPCOES} opções`
          : 'Adicionar opção'}
      </Botao>
    </div>
  );
}

function EditorOpcao({
  opcao,
  numero,
  nivel,
  prefixo,
  primeira,
  ultima,
  onMover,
  onChange,
  onRemover,
}: {
  opcao: OpcaoMenu;
  numero: number;
  nivel: number;
  prefixo: string;
  primeira: boolean;
  ultima: boolean;
  onMover: (d: -1 | 1) => void;
  onChange: (o: OpcaoMenu) => void;
  onRemover: () => void;
}) {
  const oQueFaz: OQueFaz = opcao.submenu ? 'submenu' : (opcao.acao ?? 'texto');
  const mudarOQueFaz = (v: OQueFaz) =>
    onChange({
      ...opcao,
      acao: v === 'texto' || v === 'submenu' ? null : v,
      submenu:
        v === 'submenu'
          ? (opcao.submenu ?? {
              texto: 'Escolha uma opção:',
              opcoes: [{ id: novoId(), rotulo: '', resposta: '', acao: null, submenu: null }],
            })
          : null,
    });
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-denso text-2xl font-bold text-modulo-texto tabular-nums">
          {numero}.
        </span>
        <div className="flex gap-1">
          <Botao
            variante="fantasma"
            className="px-3"
            aria-label={`Subir a opção ${numero}`}
            disabled={primeira}
            onClick={() => onMover(-1)}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Botao>
          <Botao
            variante="fantasma"
            className="px-3"
            aria-label={`Descer a opção ${numero}`}
            disabled={ultima}
            onClick={() => onMover(1)}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Botao>
          <Botao
            variante="fantasma"
            className="px-3"
            aria-label={`Remover a opção ${numero}`}
            onClick={onRemover}
          >
            <Trash2 aria-hidden className="size-4" />
          </Botao>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo
          id={`${prefixo}-rotulo`}
          rotulo="Nome na lista"
          placeholder="Ex.: Ver preços"
          maxLength={60}
          value={opcao.rotulo}
          onChange={(ev) => onChange({ ...opcao, rotulo: ev.target.value })}
        />
        <Selecao
          id={`${prefixo}-faz`}
          rotulo="O que faz"
          value={oQueFaz}
          onChange={(ev) => mudarOQueFaz(ev.target.value as OQueFaz)}
          opcoes={OPCOES_O_QUE_FAZ(nivel < 3)}
          dica={oQueFaz !== 'texto' && oQueFaz !== 'submenu' ? DICA_ACAO[oQueFaz] : undefined}
        />
      </div>
      {oQueFaz !== 'voltar_menu' && (
        <CampoTexto
          id={`${prefixo}-resposta`}
          rotulo={oQueFaz === 'submenu' ? 'Texto antes do submenu (opcional)' : 'Resposta'}
          value={opcao.resposta}
          onChange={(ev) => onChange({ ...opcao, resposta: ev.target.value })}
        />
      )}
      {opcao.submenu && (
        <EditorMenu
          menu={opcao.submenu}
          nivel={nivel + 1}
          prefixo={prefixo}
          onChange={(m) => onChange({ ...opcao, submenu: m })}
        />
      )}
    </div>
  );
}

function EditorGrupo({
  grupo,
  indice,
  onChange,
  onRemover,
}: {
  grupo: GrupoPalavrasChave;
  indice: number;
  onChange: (g: GrupoPalavrasChave) => void;
  onRemover: () => void;
}) {
  const [texto, setTexto] = useState(grupo.palavras.join(', '));
  const oQueFaz: OQueFaz = grupo.acao ?? 'texto';
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
        <Campo
          id={`kw-${grupo.id}-palavras`}
          rotulo={`Grupo ${indice + 1}: palavras`}
          dica="Separe por vírgula."
          value={texto}
          onChange={(ev) => {
            setTexto(ev.target.value);
            onChange({
              ...grupo,
              palavras: ev.target.value
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
            });
          }}
        />
        <Selecao
          id={`kw-${grupo.id}-faz`}
          rotulo="O que faz"
          value={oQueFaz}
          onChange={(ev) => {
            const v = ev.target.value as OQueFaz;
            onChange({ ...grupo, acao: v === 'texto' ? null : (v as AcaoBot) });
          }}
          opcoes={OPCOES_O_QUE_FAZ(false)}
        />
        <Botao
          variante="fantasma"
          className="px-3 md:mt-7"
          aria-label={`Remover o grupo ${indice + 1}`}
          onClick={onRemover}
        >
          <Trash2 aria-hidden className="size-4" />
        </Botao>
      </div>
      {oQueFaz !== 'voltar_menu' && (
        <CampoTexto
          id={`kw-${grupo.id}-resposta`}
          rotulo="Resposta"
          rows={2}
          value={grupo.resposta}
          onChange={(ev) => onChange({ ...grupo, resposta: ev.target.value })}
        />
      )}
    </div>
  );
}

function Variaveis() {
  return (
    <details className="rounded-lg border border-borda bg-superficie px-4">
      <summary className="min-h-11 cursor-pointer content-center font-medium">
        Variáveis que você pode usar nos textos
      </summary>
      <dl className="grid gap-2 pb-4 sm:grid-cols-2">
        {Object.entries(VARIAVEIS_BOT).map(([nome, sobre]) => (
          <div key={nome} className="flex flex-col">
            <dt className="font-denso text-lg font-semibold text-modulo-texto">{`{${nome}}`}</dt>
            <dd className="text-sm text-tinta-suave">{sobre}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

// ─── Mensagens prontas ────────────────────────────────────────────────────

function Mensagens({ e }: { e: EstadoBot }) {
  const [textos, setTextos] = useState<MensagensBot>(e.mensagens);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const salvar = useAcao(
    (m: MensagensBot) => api('bot/mensagens', { metodo: 'PUT', corpo: { mensagens: m } }),
    [chaveBot],
  );
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setErro(null);
    setOk(false);
    try {
      await salvar.mutateAsync(textos);
      setOk(true);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  };
  return (
    <form onSubmit={enviar} className="flex max-w-3xl flex-col gap-5">
      <PesquisaLigada e={e} />
      <p className="text-tinta-suave">
        Valem para todas as unidades. Use {'{cliente}'}, {'{barbearia}'}, {'{unidade}'},{' '}
        {'{horario}'}, {'{endereco}'} e {'{link}'}; na pesquisa, também {'{profissional}'}.
      </p>
      <fieldset disabled={!e.podeEditar} className="flex min-w-0 flex-col gap-5">
        {TIPOS_MENSAGEM_BOT.map((t) => (
          <CampoTexto
            key={t}
            id={`msg-${t}`}
            rotulo={SOBRE_MENSAGEM_BOT[t].nome}
            dica={SOBRE_MENSAGEM_BOT[t].quando}
            rows={2}
            value={textos[t]}
            onChange={(ev) => setTextos({ ...textos, [t]: ev.target.value })}
          />
        ))}
      </fieldset>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && <Aviso tom="sucesso">Mensagens salvas. O bot já usa os textos novos.</Aviso>}
      {e.podeEditar && (
        <Botao
          type="submit"
          className="self-start"
          carregando={salvar.isPending}
          disabled={iguais(textos, e.mensagens)}
        >
          Salvar mensagens
        </Botao>
      )}
    </form>
  );
}

/** Pesquisa de 1 a 5 depois do atendimento: o dono liga e desliga para a conta toda. */
function PesquisaLigada({ e }: { e: EstadoBot }) {
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (ativa: boolean) => api('bot/pesquisa', { metodo: 'PUT', corpo: { ativa } }),
    [chaveBot],
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
      <Marcador
        id="pesquisa-ativa"
        rotulo="Mandar a pesquisa de 1 a 5 depois do atendimento"
        checked={e.pesquisaAtiva}
        disabled={!e.podeEditar || salvar.isPending}
        onChange={async (ev) => {
          setErro(null);
          try {
            await salvar.mutateAsync(ev.target.checked);
          } catch (err) {
            setErro(mensagemDe(err));
          }
        }}
      />
      <p className="text-sm text-tinta-suave">
        Uma hora depois de fechar a comanda, para quem aceitou avisos e já conversou com o WhatsApp
        da barbearia; no máximo uma a cada 7 dias por cliente. As notas aparecem na ficha do
        profissional e em Métricas.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}

// ─── Horário ──────────────────────────────────────────────────────────────

const DIAS = [
  { dia: 1, nome: 'Segunda' },
  { dia: 2, nome: 'Terça' },
  { dia: 3, nome: 'Quarta' },
  { dia: 4, nome: 'Quinta' },
  { dia: 5, nome: 'Sexta' },
  { dia: 6, nome: 'Sábado' },
  { dia: 0, nome: 'Domingo' },
];
const paraHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const paraMin = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return (a ?? 0) * 60 + (b ?? 0);
};

function Horarios({ e }: { e: EstadoBot }) {
  return (
    <div className="animar-escalonado grid gap-4 xl:grid-cols-2">
      {e.unidades.map((u) => (
        <HorarioUnidade key={`${u.id}${JSON.stringify(u.horario)}`} u={u} />
      ))}
    </div>
  );
}

function HorarioUnidade({ u }: { u: UnidadeDoBot }) {
  const [proprio, setProprio] = useState(u.horario !== null);
  const [turnos, setTurnos] = useState<TurnoBot[]>(() => u.horario ?? u.expediente);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (t: TurnoBot[] | null) => api(`bot/horario/${u.id}`, { metodo: 'PUT', corpo: { turnos: t } }),
    [chaveBot],
  );
  const doDia = (d: number) => turnos.find((t) => t.diaSemana === d);
  const mudar = (d: number, t: TurnoBot | null) =>
    setTurnos([...turnos.filter((x) => x.diaSemana !== d), ...(t ? [t] : [])]);
  return (
    <section
      aria-labelledby={`horario-${u.id}`}
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`horario-${u.id}`} className="text-xl font-semibold">
            {u.nome}
          </h2>
          <p className="text-tinta-suave">Funciona {u.descricao}.</p>
        </div>
        <Ficha tom={u.aberto ? 'acao' : 'neutro'}>
          {u.aberto ? 'Aberto agora' : 'Fechado agora'}
        </Ficha>
      </div>
      <fieldset className="min-w-0">
        <legend className="sr-only">Horário do bot em {u.nome}</legend>
        <div className="flex flex-col gap-2">
          {[
            {
              v: false,
              t: 'Seguir o expediente da equipe',
              d: 'Do primeiro barbeiro que chega ao último que sai, nos dias da unidade.',
            },
            {
              v: true,
              t: 'Horário próprio do bot',
              d: 'Para quando o balcão abre e fecha em outro horário.',
            },
          ].map((o) => (
            <label key={o.t} className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="radio"
                name={`modo-${u.id}`}
                checked={proprio === o.v}
                onChange={() => setProprio(o.v)}
                className="mt-1 size-5 accent-[var(--modulo)]"
              />
              <span>
                <span className="font-medium">{o.t}</span>
                <span className="block text-sm text-tinta-suave">{o.d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {proprio && (
        <ul className="flex flex-col divide-y divide-borda">
          {DIAS.map(({ dia, nome }) => {
            const t = doDia(dia);
            return (
              <li key={dia} className="flex flex-wrap items-center gap-3 py-2">
                <label className="flex min-h-11 w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!t}
                    onChange={(ev) =>
                      mudar(
                        dia,
                        ev.target.checked ? { diaSemana: dia, inicioMin: 540, fimMin: 1140 } : null,
                      )
                    }
                    className="size-5 accent-[var(--modulo)]"
                  />
                  {nome}
                </label>
                {t ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${nome}: abre às`}
                      value={paraHora(t.inicioMin)}
                      onChange={(ev) => mudar(dia, { ...t, inicioMin: paraMin(ev.target.value) })}
                      className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                    />
                    <span className="text-tinta-suave">até</span>
                    <input
                      type="time"
                      aria-label={`${nome}: fecha às`}
                      value={paraHora(t.fimMin)}
                      onChange={(ev) => mudar(dia, { ...t, fimMin: paraMin(ev.target.value) })}
                      className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                    />
                  </span>
                ) : (
                  <span className="text-tinta-fraca">Fechado</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Botao
        className="self-start"
        carregando={salvar.isPending}
        onClick={async () => {
          setErro(null);
          try {
            await salvar.mutateAsync(proprio ? turnos : null);
          } catch (err) {
            setErro(mensagemDe(err));
          }
        }}
      >
        Salvar horário
      </Botao>
    </section>
  );
}

// ─── Simulador ────────────────────────────────────────────────────────────

interface Fala {
  de: 'cliente' | 'bot';
  texto: string;
  nota?: string;
}
const NOTA_ACAO: Partial<Record<string, string>> = {
  falar_com_atendente: 'Aqui a conversa iria para a recepção, na tela Conversas.',
  agendar: 'O cliente abriria o link de agendamento.',
};

function Simulador({ e }: { e: EstadoBot }) {
  const [unidadeId, setUnidadeId] = useState(e.unidades[0]?.id ?? '');
  const [versao, setVersao] = useState<'rascunho' | 'publicado'>(
    e.rascunho ? 'rascunho' : 'publicado',
  );
  const [cliente, setCliente] = useState('João Silva');
  const [fechado, setFechado] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [sessao, setSessao] = useState<SessaoBot | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const reiniciar = () => {
    setFalas([]);
    setSessao(null);
  };
  const enviar = async (entrada: string) => {
    if (!entrada.trim() || enviando) return;
    setErro(null);
    setEnviando(true);
    setFalas((f) => [...f, { de: 'cliente', texto: entrada }]);
    setTexto('');
    try {
      const r = await api<RespostaSimulacao>('bot/simular', {
        corpo: {
          unidadeId,
          entrada,
          sessao,
          versao,
          cliente: cliente.trim() || null,
          foraDoHorario: fechado,
        },
      });
      setSessao(r.sessao);
      const respostas: Fala[] = r.respostas.map((t) => ({ de: 'bot', texto: t }));
      const nota =
        r.consentimento === false
          ? 'O cliente deixaria de receber lembretes e avisos.'
          : r.consentimento === true
            ? 'O cliente voltaria a receber lembretes e avisos.'
            : r.acao
              ? NOTA_ACAO[r.acao]
              : undefined;
      if (r.respostas.length === 0)
        respostas.push({
          de: 'bot',
          texto: '',
          nota: 'O bot fica quieto: a conversa está com um atendente.',
        });
      else if (nota) respostas[respostas.length - 1]!.nota = nota;
      setFalas((f) => [...f, ...respostas]);
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setEnviando(false);
    }
  };
  // Atalhos: os números do último menu que o bot mandou.
  const ultimoBot = [...falas].reverse().find((f) => f.de === 'bot' && f.texto)?.texto ?? '';
  const atalhos = [...ultimoBot.matchAll(/^(\d)\. (.+)$/gm)].map((m) => ({
    n: m[1]!,
    rotulo: m[2]!,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Selecao
          id="sim-unidade"
          rotulo="Unidade"
          value={unidadeId}
          onChange={(ev) => {
            setUnidadeId(ev.target.value);
            reiniciar();
          }}
          opcoes={e.unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
        />
        <Selecao
          id="sim-versao"
          rotulo="Testar"
          value={versao}
          onChange={(ev) => {
            setVersao(ev.target.value as 'rascunho' | 'publicado');
            reiniciar();
          }}
          opcoes={[
            ...(e.rascunho
              ? [{ valor: 'rascunho', rotulo: 'O rascunho (ainda não publicado)' }]
              : []),
            { valor: 'publicado', rotulo: 'O menu publicado' },
          ]}
          dica={!e.rascunho ? 'Salve o rascunho no Menu para testá-lo aqui.' : undefined}
        />
        <Campo
          id="sim-cliente"
          rotulo="Cliente cadastrado como"
          dica="Deixe vazio para testar com um número novo."
          value={cliente}
          onChange={(ev) => setCliente(ev.target.value)}
        />
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={fechado}
            onChange={(ev) => {
              setFechado(ev.target.checked);
              reiniciar();
            }}
            className="size-5 accent-[var(--modulo)]"
          />
          Simular fora do horário
        </label>
        <Botao variante="secundario" onClick={reiniciar}>
          <RotateCcw aria-hidden className="size-4" /> Recomeçar conversa
        </Botao>
      </div>

      <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-lg border border-borda bg-fundo">
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversa de teste"
          className="flex flex-1 flex-col gap-2 overflow-y-auto p-4"
        >
          {falas.length === 0 && (
            <p className="m-auto max-w-xs text-center text-tinta-suave">
              Escreva como se fosse o cliente (“oi”, “quanto custa?”, “2”). Nada é enviado de
              verdade.
            </p>
          )}
          {falas.map((f, i) => (
            <div
              key={i}
              className={cn(
                'flex flex-col gap-1',
                f.de === 'cliente' ? 'items-end' : 'items-start',
              )}
            >
              {f.texto && (
                <p
                  className={cn(
                    'animar-entrada max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2',
                    f.de === 'cliente'
                      ? 'rounded-br-sm bg-acao/20 text-tinta'
                      : 'rounded-bl-sm border border-borda bg-superficie',
                  )}
                >
                  {f.texto}
                </p>
              )}
              {f.nota && (
                <p className="animar-entrada max-w-[85%] text-sm text-tinta-suave italic">
                  {f.nota}
                </p>
              )}
            </div>
          ))}
        </div>
        {atalhos.length > 0 && (
          <div
            className="flex flex-wrap gap-2 border-t border-borda px-4 pt-3"
            aria-label="Respostas rápidas"
          >
            {atalhos.map((a) => (
              <button
                key={a.n}
                type="button"
                onClick={() => enviar(a.n)}
                className="toque min-h-9 rounded-full border border-borda-forte px-3 text-sm hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
              >
                {a.n}. {a.rotulo}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void enviar(texto);
          }}
        >
          <label htmlFor="sim-texto" className="sr-only">
            Mensagem do cliente
          </label>
          <input
            id="sim-texto"
            value={texto}
            maxLength={500}
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Mensagem do cliente"
            className="min-h-11 flex-1 rounded-md border border-borda bg-superficie px-3"
          />
          <Botao type="submit" carregando={enviando} aria-label="Enviar">
            <Send aria-hidden className="size-4" />
          </Botao>
        </form>
        {erro && (
          <Aviso tom="erro" className="mx-4 mb-4">
            {erro}
          </Aviso>
        )}
      </div>
    </div>
  );
}

// ─── Conexão ──────────────────────────────────────────────────────────────

const NOME_STATUS: Record<ConexaoBot['status'], string> = {
  conectado: 'Conectado',
  aguardando_qr: 'Esperando o QR Code',
  desconectado: 'Desconectado',
};

/** Passo a passo para ler o QR Code (também serve para reconectar quando cai). */
export function PassosParaConectar() {
  return (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
      <li>No celular da barbearia, abra o WhatsApp do número da unidade.</li>
      <li>
        Toque em <strong>⋮</strong> (Android) ou em <strong>Configurações</strong> (iPhone) e depois
        em <strong>Aparelhos conectados</strong>.
      </li>
      <li>
        Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code.
      </li>
    </ol>
  );
}

function Conexao({ e }: { e: EstadoBot }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-tinta-suave">
        Cada unidade usa um número de WhatsApp próprio, conectado por QR Code como o WhatsApp Web.
        Sem custo por mensagem e sem aprovação da Meta. Use um número só da barbearia: o bot
        responde todas as conversas dele.
      </p>
      <ul className="animar-escalonado flex flex-col gap-3">
        {e.unidades.map((u) => (
          <ConexaoUnidade key={u.id} u={u} />
        ))}
      </ul>
      <Aviso tom="info">
        Para não arriscar o número, o bot só responde quem escreveu, espaça as mensagens e nunca
        manda nada em massa.
      </Aviso>
    </div>
  );
}

function ConexaoUnidade({ u }: { u: UnidadeDoBot }) {
  const [aberta, setAberta] = useState(u.conexao?.status === 'aguardando_qr');
  const [confirmar, setConfirmar] = useState(false);
  const consulta = useConexaoBot(u.id, aberta);
  const cliente = useQueryClient();
  const chave = [...chaveBot, 'conexao', u.id];
  const guardar = (c: ConexaoBot) => {
    cliente.setQueryData(chave, c);
    void cliente.invalidateQueries({ queryKey: chaveBot, exact: true });
  };
  const conectar = useMutation({
    mutationFn: () => api<ConexaoBot>(`bot/conexao/${u.id}`, { metodo: 'POST' }),
    onSuccess: (c) => {
      setAberta(true);
      guardar(c);
    },
  });
  const desconectar = useMutation({
    mutationFn: () => api<ConexaoBot>(`bot/conexao/${u.id}`, { metodo: 'DELETE' }),
    onSuccess: (c) => {
      setConfirmar(false);
      guardar(c);
    },
  });

  // O que a tela mostra: a consulta ao vivo (aberta) ou o último estado conhecido.
  const c: Pick<ConexaoBot, 'status' | 'numero' | 'caiuEm'> & Partial<ConexaoBot> =
    consulta.data ??
    (u.conexao ? { ...u.conexao } : { status: 'desconectado', numero: null, caiuEm: null });
  const conectado = c.status === 'conectado';
  const caiu = !conectado && !!c.caiuEm;
  // Conectou com o QR na tela: o resto do painel (estado das unidades) se atualiza.
  const status = consulta.data?.status;
  useEffect(() => {
    if (status === 'conectado') void cliente.invalidateQueries({ queryKey: chaveBot, exact: true });
  }, [status, cliente]);

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">{u.nome}</span>
          <span className="text-sm text-tinta-suave tabular-nums">
            {c.numero ? formatarTelefone(c.numero) : 'Nenhum número conectado'}
          </span>
        </span>
        <Ficha
          tom={
            conectado ? 'acao' : caiu ? 'perigo' : c.status === 'aguardando_qr' ? 'aviso' : 'neutro'
          }
        >
          {caiu ? 'Caiu' : NOME_STATUS[c.status]}
        </Ficha>
      </div>

      {caiu && (
        <Aviso tom="erro">
          <p className="font-semibold">
            A conexão caiu em {formatarDataHora(c.caiuEm!)}. O bot não está respondendo.
          </p>
          <p className="mt-1">
            Toque em “Reconectar” e leia o QR Code de novo. Se o celular ficou sem internet ou
            desligado, ligue-o antes.
          </p>
        </Aviso>
      )}

      {c.status === 'aguardando_qr' && aberta && (
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="grid size-56 shrink-0 place-items-center rounded-md border border-borda bg-white p-2">
            {c.qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL gerada pela API
              <img
                src={c.qr}
                alt={`QR Code para conectar o WhatsApp da ${u.nome}`}
                className="size-full"
              />
            ) : (
              <span className="text-sm text-tinta-suave">Gerando o QR Code…</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <PassosParaConectar />
            <p className="text-sm text-tinta-suave">
              O QR Code muda sozinho a cada poucos segundos. Esta tela avisa quando conectar.
            </p>
            {c.teste && (
              <Ficha tom="aviso">WhatsApp de teste: este QR Code não conecta de verdade</Ficha>
            )}
          </div>
        </div>
      )}

      {conectado && conectar.isSuccess && (
        <Aviso tom="sucesso">Conectado! O bot já responde as mensagens deste número.</Aviso>
      )}

      {(c.erro || conectar.error || desconectar.error) && (
        <Aviso tom="erro">{c.erro ?? mensagemDe(conectar.error ?? desconectar.error)}</Aviso>
      )}

      <div className="flex flex-wrap gap-2">
        {!conectado && (
          <Botao carregando={conectar.isPending} onClick={() => conectar.mutate()}>
            {caiu || c.status === 'aguardando_qr' ? 'Reconectar' : 'Conectar pelo QR Code'}
          </Botao>
        )}
        {conectado && !aberta && (
          <Botao variante="secundario" onClick={() => setAberta(true)}>
            Conferir conexão
          </Botao>
        )}
        {(conectado || c.status === 'aguardando_qr') && (
          <Botao variante="secundario" onClick={() => setConfirmar(true)}>
            Desconectar
          </Botao>
        )}
      </div>

      <ModalConfirmacao
        aberto={confirmar}
        titulo={`Desconectar o WhatsApp da ${u.nome}?`}
        descricao="O bot para de responder neste número até alguém conectar de novo pelo QR Code. As conversas no celular não são apagadas."
        textoConfirmar="Desconectar"
        tom="perigo"
        carregando={desconectar.isPending}
        onConfirmar={() => desconectar.mutate()}
        onCancelar={() => setConfirmar(false)}
      />
    </li>
  );
}

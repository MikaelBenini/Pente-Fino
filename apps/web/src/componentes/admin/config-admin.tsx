'use client';

import {
  formatarDataHora,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
  type ResultadoTesteSmtp,
  type SmtpNaTela,
  emailDoModelo,
  EXEMPLO_VARIAVEIS,
  type ChaveModeloEmail,
  type ModeloEmailNaTela,
  formatarData,
  lerMoeda,
  type TabelaPrecosPlanos,
  type CupomNaTela,
} from '@pente-fino/shared';
import { Botao, Campo, CampoTexto, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';
import { useTabelasAdmin } from './precos-admin';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível salvar.';
/** datetime-local (horário de São Paulo) ↔ ISO. */
const paraCampo = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
const deCampo = (v: string) => new Date(`${v}:00-03:00`).toISOString();

function Salvar({ rotulo, enviar }: { rotulo: string; enviar: () => Promise<void> }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Botao
        className="self-start"
        carregando={enviando}
        onClick={async () => {
          setErro(null);
          setOk(false);
          setEnviando(true);
          try {
            await enviar();
            setOk(true);
          } catch (e) {
            setErro(mensagemDe(e));
          } finally {
            setEnviando(false);
          }
        }}
      >
        {rotulo}
      </Botao>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && (
        <p role="status" className="text-sm text-acao-texto">
          Salvo.
        </p>
      )}
    </div>
  );
}

/** Aviso geral para todas as barbearias e o teste grátis do cadastro pelo site. */
export function ConfiguracoesAdmin() {
  const config = useQuery({
    queryKey: ['admin', 'configuracoes'],
    queryFn: () => adminApi<ConfiguracaoPublica>('configuracoes'),
  });
  return (
    <div className="flex flex-col gap-6">
      <Estado consulta={config}>{() => <Formularios c={config.data!} />}</Estado>
      <SmtpAdmin />
      <PrecosAdmin />
      <CuponsAdmin />
      <ModelosEmailAdmin />
    </div>
  );
}

function Formularios({ c }: { c: ConfiguracaoPublica }) {
  const cliente = useQueryClient();
  const agora = new Date();
  const [texto, setTexto] = useState(c.avisoGeral?.texto ?? '');
  const [tom, setTom] = useState(c.avisoGeral?.tom ?? 'info');
  const [inicio, setInicio] = useState(paraCampo(c.avisoGeral?.inicio ?? agora.toISOString()));
  const [fim, setFim] = useState(
    paraCampo(c.avisoGeral?.fim ?? new Date(agora.getTime() + 86_400_000).toISOString()),
  );
  const [dias, setDias] = useState(String(c.teste.dias));
  const [versao, setVersao] = useState(c.teste.versaoTermos);
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'configuracoes'] });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="titulo-aviso-geral"
        className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
      >
        <h2 id="titulo-aviso-geral" className="text-lg font-semibold">
          Aviso geral
        </h2>
        <p className="text-sm text-tinta-suave">
          Aparece no topo do painel de todas as barbearias entre o início e o fim.
        </p>
        <Campo
          id="aviso-texto"
          rotulo="Texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Selecao
            id="aviso-tom"
            rotulo="Tipo"
            value={tom}
            onChange={(e) => setTom(e.target.value as typeof tom)}
            opcoes={[
              { valor: 'info', rotulo: 'Novidade' },
              { valor: 'manutencao', rotulo: 'Manutenção' },
            ]}
          />
          <Campo
            id="aviso-inicio"
            rotulo="De"
            type="datetime-local"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Campo
            id="aviso-fim"
            rotulo="Até"
            type="datetime-local"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Salvar
            rotulo="Publicar aviso"
            enviar={async () => {
              await adminApi('configuracoes/aviso-geral', {
                metodo: 'PUT',
                corpo: { aviso: { texto, tom, inicio: deCampo(inicio), fim: deCampo(fim) } },
              });
              await atualizar();
            }}
          />
          {c.avisoGeral && (
            <Salvar
              rotulo="Tirar o aviso"
              enviar={async () => {
                await adminApi('configuracoes/aviso-geral', {
                  metodo: 'PUT',
                  corpo: { aviso: null },
                });
                setTexto('');
                await atualizar();
              }}
            />
          )}
        </div>
      </section>

      <section
        aria-labelledby="titulo-teste-gratis"
        className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
      >
        <h2 id="titulo-teste-gratis" className="text-lg font-semibold">
          Teste grátis e termos
        </h2>
        <p className="text-sm text-tinta-suave">
          Vale para quem se cadastra pelo site a partir de agora. Quem já está em teste não muda.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="teste-dias"
            rotulo="Dias de teste"
            inputMode="numeric"
            value={dias}
            onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="teste-versao"
            rotulo="Versão dos termos em vigor"
            type="date"
            dica="O cadastro grava o aceite desta versão."
            value={versao}
            onChange={(e) => setVersao(e.target.value)}
          />
        </div>
        <Salvar
          rotulo="Salvar teste e termos"
          enviar={async () => {
            await adminApi('configuracoes/teste', {
              metodo: 'PUT',
              corpo: { dias: Number(dias) || 0, versaoTermos: versao },
            });
            await atualizar();
          }}
        />
      </section>
    </div>
  );
}

/** Saúde do sistema: banco, filas, WhatsApp que caiu e erros das últimas 24 h. */
export function SaudeAdmin() {
  const s = useQuery({
    queryKey: ['admin', 'saude'],
    queryFn: () => adminApi<SaudeDoSistema>('saude'),
    refetchInterval: 30_000,
  });
  return (
    <Estado consulta={s}>
      {() => {
        const d = s.data!;
        return (
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2">
              Banco de dados:{' '}
              <Ficha tom={d.banco === 'ok' ? 'acao' : 'perigo'}>
                {d.banco === 'ok' ? 'No ar' : 'Falha'}
              </Ficha>
            </p>
            <Tabela rotulo="Filas">
              <thead>
                <tr className="border-b border-borda">
                  {['Fila', 'Esperando', 'Agendados', 'Rodando', 'Falhas guardadas'].map((c) => (
                    <th key={c} scope="col" className={th}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.filas.map((f) => (
                  <tr key={f.fila} className="border-b border-borda">
                    <th scope="row" className={`${td} font-semibold`}>
                      {f.fila}
                    </th>
                    <td className={`${td} tabular-nums`}>{f.esperando}</td>
                    <td className={`${td} tabular-nums`}>{f.agendados}</td>
                    <td className={`${td} tabular-nums`}>{f.ativos}</td>
                    <td className={`${td} tabular-nums`}>{f.falhas}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <section aria-labelledby="titulo-caidas" className="flex flex-col gap-2">
              <h2 id="titulo-caidas" className="text-lg font-semibold">
                WhatsApp que caiu
              </h2>
              {d.conexoesCaidas.length === 0 ? (
                <p className="text-sm text-tinta-suave">Nenhuma conexão caída.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm" aria-label="Conexões caídas">
                  {d.conexoesCaidas.map((c) => (
                    <li
                      key={`${c.contaId}-${c.unidade}`}
                      className="flex justify-between gap-3 border-b border-borda py-1"
                    >
                      <span>
                        {c.conta} · {c.unidade}
                        {c.numero ? ` · ${c.numero}` : ''}
                      </span>
                      <span className="tabular-nums text-tinta-suave">
                        desde {formatarDataHora(c.caiuEm)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="titulo-erros" className="flex flex-col gap-2">
              <h2 id="titulo-erros" className="text-lg font-semibold">
                Erros das últimas 24 h
              </h2>
              {d.errosRecentes.length === 0 ? (
                <p className="text-sm text-tinta-suave">Nenhum erro.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm" aria-label="Erros recentes">
                  {d.errosRecentes.map((e, i) => (
                    <li key={i} className="flex flex-col border-b border-borda py-1">
                      <span>
                        <strong>{e.fila}</strong> · {e.tipo} ·{' '}
                        <span className="tabular-nums text-tinta-suave">
                          {formatarDataHora(e.quando)}
                        </span>
                      </span>
                      <span className="text-tinta-suave">{e.motivo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      }}
    </Estado>
  );
}

/** SMTP da administração: a senha vai cifrada e nunca volta; sem configuração, vale o .env. */
export function SmtpAdmin() {
  const q = useQuery({
    queryKey: ['admin', 'smtp'],
    queryFn: () => adminApi<{ smtp: SmtpNaTela | null }>('configuracoes/smtp'),
  });
  return <Estado consulta={q}>{() => <FormSmtp atual={q.data!.smtp} />}</Estado>;
}

interface Resultado {
  ok: boolean;
  texto: string;
  detalhe?: string | undefined;
}

function FormSmtp({ atual }: { atual: SmtpNaTela | null }) {
  const cliente = useQueryClient();
  const [host, setHost] = useState(atual?.host ?? '');
  const [porta, setPorta] = useState(String(atual?.porta ?? 587));
  const [seguro, setSeguro] = useState(atual?.seguro ?? false);
  const [usuario, setUsuario] = useState(atual?.usuario ?? '');
  const [senha, setSenha] = useState('');
  const [remetente, setRemetente] = useState(
    atual?.remetente ?? 'Pente Fino <nao-responda@pentefino.com.br>',
  );
  const [acao, setAcao] = useState<'salvar' | 'conexao' | 'email' | 'env' | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'smtp'] });
  const dados = () => ({
    host,
    porta: Number(porta) || 0,
    seguro,
    usuario,
    remetente,
    senha: senha === '' ? (atual?.temSenha ? null : '') : senha,
  });

  async function executar(qual: NonNullable<typeof acao>, f: () => Promise<Resultado>) {
    setAcao(qual);
    setResultado(null);
    try {
      setResultado(await f());
    } catch (e) {
      setResultado({ ok: false, texto: mensagemDe(e) });
    } finally {
      setAcao(null);
    }
  }
  const salvar = async (): Promise<Resultado> => {
    await adminApi('configuracoes/smtp', { metodo: 'PUT', corpo: dados() });
    setSenha('');
    await atualizar();
    return { ok: true, texto: 'SMTP salvo. Os próximos e-mails já saem por ele.' };
  };
  const testarConexao = async (): Promise<Resultado> => {
    const r = await adminApi<ResultadoTesteSmtp>('configuracoes/smtp/conexao', {
      corpo: dados(),
    });
    return { ok: r.ok, texto: r.mensagem, detalhe: `${(r.ms / 1000).toFixed(1)} s` };
  };
  const mandarTeste = async (): Promise<Resultado> => {
    const r = await adminApi<ResultadoTesteSmtp>('configuracoes/smtp/teste', { corpo: {} });
    return {
      ok: r.ok,
      texto: atual || r.ok ? r.mensagem : `${r.mensagem} (usando o SMTP do .env)`,
      detalhe: r.resposta ? `Resposta do servidor: ${r.resposta}` : undefined,
    };
  };
  const voltarAoEnv = async (): Promise<Resultado> => {
    await adminApi('configuracoes/smtp', { metodo: 'DELETE' });
    await atualizar();
    return { ok: true, texto: 'Voltou a usar o SMTP do .env do servidor.' };
  };
  return (
    <section
      aria-labelledby="titulo-smtp"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4 lg:col-span-2"
    >
      <h2 id="titulo-smtp" className="text-lg font-semibold">
        E-mail (SMTP)
      </h2>
      <p className="text-sm text-tinta-suave">
        {atual
          ? `Enviando por ${atual.host}.`
          : 'Sem configuração aqui: os e-mails saem pelo SMTP do .env do servidor.'}{' '}
        A senha fica cifrada e não aparece de novo.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          id="smtp-host"
          rotulo="Servidor"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <Campo
          id="smtp-porta"
          rotulo="Porta"
          inputMode="numeric"
          value={porta}
          onChange={(e) => setPorta(e.target.value.replace(/\D/g, ''))}
        />
        <label className="flex min-h-11 items-center gap-2 self-end">
          <input
            type="checkbox"
            checked={seguro}
            onChange={(e) => setSeguro(e.target.checked)}
            className="size-5 accent-[var(--modulo)]"
          />
          TLS desde o início (porta 465)
        </label>
        <Campo
          id="smtp-usuario"
          rotulo="Usuário"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <Campo
          id="smtp-senha"
          rotulo="Senha"
          type="password"
          autoComplete="new-password"
          dica={atual?.temSenha ? 'Em branco: mantém a senha guardada.' : undefined}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Campo
          id="smtp-remetente"
          rotulo="Remetente"
          value={remetente}
          onChange={(e) => setRemetente(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao
          carregando={acao === 'salvar'}
          disabled={!!acao}
          onClick={() => executar('salvar', salvar)}
        >
          Salvar SMTP
        </Botao>
        <Botao
          variante="secundario"
          carregando={acao === 'conexao'}
          disabled={!!acao}
          onClick={() => executar('conexao', testarConexao)}
        >
          Testar conexão
        </Botao>
        <Botao
          variante="secundario"
          carregando={acao === 'email'}
          disabled={!!acao}
          onClick={() => executar('email', mandarTeste)}
        >
          Mandar e-mail de teste
        </Botao>
        {atual && (
          <Botao
            variante="secundario"
            carregando={acao === 'env'}
            disabled={!!acao}
            onClick={() => executar('env', voltarAoEnv)}
          >
            Voltar ao SMTP do .env
          </Botao>
        )}
      </div>
      <div aria-live="polite">
        {acao === 'conexao' && (
          <p className="text-sm text-tinta-suave">Conectando ao servidor (até 10 segundos)…</p>
        )}
        {acao === 'email' && <p className="text-sm text-tinta-suave">Enviando…</p>}
        {!acao && resultado && (
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
            <span className="flex flex-col gap-1">
              <span>{resultado.texto}</span>
              {resultado.detalhe && (
                <span className="font-mono text-xs text-tinta-suave">{resultado.detalhe}</span>
              )}
            </span>
          </Aviso>
        )}
      </div>
    </section>
  );
}

/** Modelos de e-mail: texto com variáveis, pré-visualização ao vivo e volta ao padrão. */
export function ModelosEmailAdmin() {
  const q = useQuery({
    queryKey: ['admin', 'modelos-email'],
    queryFn: () => adminApi<ModeloEmailNaTela[]>('configuracoes/modelos-email'),
  });
  const [chave, setChave] = useState<ChaveModeloEmail>('ativacao_conta');
  return (
    <section
      aria-labelledby="titulo-modelos-email"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 id="titulo-modelos-email" className="text-lg font-semibold">
        Modelos de e-mail
      </h2>
      <Estado consulta={q}>
        {() => {
          const m = q.data!.find((x) => x.chave === chave)!;
          return (
            <>
              <Selecao
                id="modelo-email"
                rotulo="E-mail"
                value={chave}
                onChange={(e) => setChave(e.target.value as ChaveModeloEmail)}
                opcoes={q.data!.map((x) => ({
                  valor: x.chave,
                  rotulo: `${x.nome}${x.personalizado ? ' (personalizado)' : ''}`,
                }))}
              />
              <EditorModelo key={`${chave}-${m.personalizado ? 'p' : 'd'}`} m={m} />
            </>
          );
        }}
      </Estado>
    </section>
  );
}

function EditorModelo({ m }: { m: ModeloEmailNaTela }) {
  const cliente = useQueryClient();
  const base = m.personalizado ?? m.padrao;
  const [assunto, setAssunto] = useState(base.assunto);
  const [corpo, setCorpo] = useState(base.corpo);
  const [botao, setBotao] = useState(base.botao ?? '');
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'modelos-email'] });
  const previa = emailDoModelo(
    m.chave,
    { assunto, corpo, botao: m.padrao.botao === null ? null : botao || m.padrao.botao },
    EXEMPLO_VARIAVEIS,
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-tinta-suave">{m.quando}</p>
        <p className="text-sm">
          Variáveis:{' '}
          {m.variaveis.map((v) => (
            <code key={v} className="mr-2 rounded-sm bg-superficie-2 px-1.5 py-0.5 font-denso">
              {`{{${v}}}`}
            </code>
          ))}
        </p>
        <Campo
          id="modelo-assunto"
          rotulo="Assunto"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
        />
        <CampoTexto
          id="modelo-corpo"
          rotulo="Texto"
          dica="Uma linha em branco separa os parágrafos."
          rows={8}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
        />
        {m.padrao.botao !== null && (
          <Campo
            id="modelo-botao"
            rotulo="Texto do botão"
            value={botao}
            onChange={(e) => setBotao(e.target.value)}
          />
        )}
        <div className="flex flex-wrap gap-3">
          <Salvar
            rotulo="Salvar modelo"
            enviar={async () => {
              await adminApi(`configuracoes/modelos-email/${m.chave}`, {
                metodo: 'PUT',
                corpo: {
                  assunto,
                  corpo,
                  botao: m.padrao.botao === null ? null : botao || m.padrao.botao,
                },
              });
              await atualizar();
            }}
          />
          {m.personalizado && (
            <Salvar
              rotulo="Voltar ao padrão"
              enviar={async () => {
                await adminApi(`configuracoes/modelos-email/${m.chave}`, { metodo: 'DELETE' });
                await atualizar();
              }}
            />
          )}
        </div>
      </div>
      <figure
        aria-label="Pré-visualização"
        className="flex flex-col gap-2 rounded-md bg-white p-5 text-[#18181b]"
      >
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">
          Pré-visualização (com dados de exemplo)
        </figcaption>
        <p className="font-semibold">{previa.assunto}</p>
        {previa.paragrafos.map((p, i) => (
          <p key={i} className="leading-relaxed">
            {p}
          </p>
        ))}
        {previa.botao && (
          <span className="self-start rounded-md bg-[#18181b] px-4 py-2 font-semibold text-white">
            {previa.botao}
          </span>
        )}
      </figure>
    </div>
  );
}

const NOMES_PLANOS: Record<'basico' | 'pro' | 'premium', string> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
};
const reais = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

/** Planos e preços: tabelas com vigência; quem já assinou segue na tabela que contratou. */
export function PrecosAdmin() {
  const cliente = useQueryClient();
  const { consulta, vigente } = useTabelasAdmin();
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'precos'] });
  return (
    <section
      aria-labelledby="titulo-precos"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 id="titulo-precos" className="text-lg font-semibold">
        Planos e preços
      </h2>
      <p className="text-sm text-tinta-suave">
        Uma tabela nova vale a partir da data escolhida para quem assina ou troca de plano. Quem já
        assinou continua pagando a tabela que contratou.
      </p>
      <Estado consulta={consulta}>
        {() => {
          const { tabelas, hoje } = consulta.data!;
          const atual = vigente()!;
          return (
            <>
              <Tabela rotulo="Tabelas de preço">
                <thead>
                  <tr className="border-b border-borda">
                    {['Vale desde', 'Básico', 'Pro', 'Premium', 'Unidade extra', ''].map((c) => (
                      <th key={c} scope="col" className={th}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabelas.map((t) => (
                    <tr key={t.desde} className="border-b border-borda">
                      <th scope="row" className={`${td} font-semibold tabular-nums`}>
                        {formatarData(`${t.desde}T12:00:00Z`)}
                        {t.desde === atual.desde && (
                          <span className="ml-2">
                            <Ficha tom="acao">Em vigor</Ficha>
                          </span>
                        )}
                        {t.desde > hoje && (
                          <span className="ml-2">
                            <Ficha tom="aviso">Futura</Ficha>
                          </span>
                        )}
                      </th>
                      {(['basico', 'pro', 'premium'] as const).map((p) => (
                        <td key={p} className={`${td} tabular-nums`}>
                          R$ {reais(t.planos[p].mensal)} · anual {reais(t.planos[p].anualPorMes)}
                        </td>
                      ))}
                      <td className={`${td} tabular-nums`}>
                        R$ {reais(t.unidadeExtra.mensal)} · anual{' '}
                        {reais(t.unidadeExtra.anualPorMes)}
                      </td>
                      <td className={td}>
                        {t.desde > hoje && (
                          <Botao
                            variante="fantasma"
                            onClick={async () => {
                              await adminApi(`configuracoes/precos/${t.desde}`, {
                                metodo: 'DELETE',
                              });
                              await atualizar();
                            }}
                          >
                            Desistir
                          </Botao>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <NovaTabela base={atual} hoje={hoje} onSalvo={atualizar} />
            </>
          );
        }}
      </Estado>
    </section>
  );
}

function NovaTabela({
  base,
  hoje,
  onSalvo,
}: {
  base: TabelaPrecosPlanos;
  hoje: string;
  onSalvo: () => Promise<void>;
}) {
  const [desde, setDesde] = useState(hoje);
  const [valores, setValores] = useState(() => {
    const v: Record<string, string> = {};
    for (const p of ['basico', 'pro', 'premium'] as const) {
      v[`${p}.mensal`] = reais(base.planos[p].mensal);
      v[`${p}.anualPorMes`] = reais(base.planos[p].anualPorMes);
    }
    v['extra.mensal'] = reais(base.unidadeExtra.mensal);
    v['extra.anualPorMes'] = reais(base.unidadeExtra.anualPorMes);
    return v;
  });
  const ler = (k: string) => lerMoeda(valores[k] ?? '') ?? 0;
  const campo = (k: string, rotulo: string) => (
    <Campo
      key={k}
      id={`preco-${k.replace('.', '-')}`}
      rotulo={rotulo}
      inputMode="decimal"
      value={valores[k] ?? ''}
      onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
    />
  );
  return (
    <form
      aria-label="Nova tabela de preços"
      className="flex flex-col gap-3 border-t border-borda pt-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <h3 className="font-semibold">Nova tabela</h3>
      <div className="w-48">
        <Campo
          id="preco-desde"
          rotulo="Vale a partir de"
          type="date"
          min={hoje}
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {(['basico', 'pro', 'premium'] as const).flatMap((p) => [
          campo(`${p}.mensal`, `${NOMES_PLANOS[p]} mensal (R$)`),
          campo(`${p}.anualPorMes`, `${NOMES_PLANOS[p]} anual, por mês (R$)`),
        ])}
        {campo('extra.mensal', 'Unidade extra mensal (R$)')}
        {campo('extra.anualPorMes', 'Unidade extra anual, por mês (R$)')}
      </div>
      <Salvar
        rotulo="Salvar tabela"
        enviar={async () => {
          const plano = (p: string) => ({
            mensal: ler(`${p}.mensal`),
            anualPorMes: ler(`${p}.anualPorMes`),
          });
          await adminApi('configuracoes/precos', {
            metodo: 'PUT',
            corpo: {
              desde,
              planos: { basico: plano('basico'), pro: plano('pro'), premium: plano('premium') },
              unidadeExtra: plano('extra'),
            },
          });
          await onSalvo();
        }}
      />
    </form>
  );
}

/** Cupons de desconto: código, desconto, prazo e vagas; o desconto vale enquanto a assinatura existir. */
export function CuponsAdmin() {
  const cliente = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'cupons'],
    queryFn: () => adminApi<CupomNaTela[]>('configuracoes/cupons'),
  });
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [desconto, setDesconto] = useState('30');
  const [validoAte, setValidoAte] = useState('');
  const [vagas, setVagas] = useState('');
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'cupons'] });
  const salvar = (c: Partial<CupomNaTela> & { codigo: string }) =>
    adminApi('configuracoes/cupons', { metodo: 'PUT', corpo: c }).then(atualizar);
  return (
    <section
      aria-labelledby="titulo-cupons"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 id="titulo-cupons" className="text-lg font-semibold">
        Cupons
      </h2>
      <p className="text-sm text-tinta-suave">
        Valem no cadastro pelo site (campo ou link com <code>?cupom=</code>) e na venda presencial.
        Desativar não tira o desconto de quem já usa.
      </p>
      <Estado consulta={q}>
        {() =>
          q.data!.length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhum cupom.</p>
          ) : (
            <Tabela rotulo="Cupons">
              <thead>
                <tr className="border-b border-borda">
                  {['Código', 'Desconto', 'Usados', 'Vale até', 'Situação', ''].map((c) => (
                    <th key={c} scope="col" className={th}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data!.map((c) => (
                  <tr key={c.codigo} className="border-b border-borda">
                    <th scope="row" className={`${td} font-semibold`}>
                      {c.codigo}
                      {c.descricao && (
                        <span className="block text-xs font-normal text-tinta-suave">
                          {c.descricao}
                        </span>
                      )}
                    </th>
                    <td className={`${td} tabular-nums`}>{c.descontoBp / 100}%</td>
                    <td className={`${td} tabular-nums`}>
                      {c.usados}
                      {c.vagas !== null ? ` de ${c.vagas}` : ''}
                    </td>
                    <td className={`${td} tabular-nums`}>
                      {c.validoAte ? formatarData(`${c.validoAte}T12:00:00Z`) : 'Sem prazo'}
                    </td>
                    <td className={td}>
                      <Ficha tom={c.ativo ? 'acao' : 'neutro'}>
                        {c.ativo ? 'Ativo' : 'Desativado'}
                      </Ficha>
                    </td>
                    <td className={td}>
                      <Botao variante="fantasma" onClick={() => salvar({ ...c, ativo: !c.ativo })}>
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </Botao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        }
      </Estado>
      <form
        aria-label="Novo cupom"
        className="flex flex-col gap-3 border-t border-borda pt-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <h3 className="font-semibold">Novo cupom (ou mudar pelo mesmo código)</h3>
        <div className="grid gap-3 sm:grid-cols-5">
          <Campo
            id="cupom-codigo"
            rotulo="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          />
          <Campo
            id="cupom-descricao"
            rotulo="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Campo
            id="cupom-desconto"
            rotulo="Desconto (%)"
            inputMode="numeric"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="cupom-ate"
            rotulo="Vale até (opcional)"
            type="date"
            value={validoAte}
            onChange={(e) => setValidoAte(e.target.value)}
          />
          <Campo
            id="cupom-vagas"
            rotulo="Vagas (opcional)"
            inputMode="numeric"
            value={vagas}
            onChange={(e) => setVagas(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Salvar
          rotulo="Salvar cupom"
          enviar={async () => {
            await salvar({
              codigo,
              descricao,
              descontoBp: Math.round(Number(desconto || 0) * 100),
              validoAte: validoAte || null,
              vagas: vagas ? Number(vagas) : null,
              ativo: true,
            });
            setCodigo('');
          }}
        />
      </form>
    </section>
  );
}

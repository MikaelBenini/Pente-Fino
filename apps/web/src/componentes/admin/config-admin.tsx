'use client';

import {
  formatarDataHora,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
  type SmtpNaTela,
  emailDoModelo,
  EXEMPLO_VARIAVEIS,
  type ChaveModeloEmail,
  type ModeloEmailNaTela,
} from '@pente-fino/shared';
import { Botao, Campo, CampoTexto, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';

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
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && (
        <p role="status" className="text-sm text-acao-texto">
          Salvo.
        </p>
      )}
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
  const [teste, setTeste] = useState<string | null>(null);
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'smtp'] });
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
      {teste && (
        <p role="status" className="text-sm text-acao-texto">
          {teste}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Salvar
          rotulo="Salvar SMTP"
          enviar={async () => {
            await adminApi('configuracoes/smtp', {
              metodo: 'PUT',
              corpo: {
                host,
                porta: Number(porta) || 0,
                seguro,
                usuario,
                remetente,
                senha: senha === '' ? (atual?.temSenha ? null : '') : senha,
              },
            });
            setSenha('');
            await atualizar();
          }}
        />
        <Salvar
          rotulo="Mandar e-mail de teste"
          enviar={async () => {
            const r = await adminApi<{ para: string; via: string }>('configuracoes/smtp/teste', {
              corpo: {},
            });
            setTeste(`E-mail de teste a caminho de ${r.para}. Confira a caixa de entrada.`);
          }}
        />
        {atual && (
          <Salvar
            rotulo="Voltar ao SMTP do .env"
            enviar={async () => {
              await adminApi('configuracoes/smtp', { metodo: 'DELETE' });
              await atualizar();
            }}
          />
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

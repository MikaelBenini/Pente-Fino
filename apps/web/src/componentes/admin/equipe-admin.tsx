'use client';

import {
  formatarDataHora,
  NOME_PAPEL_PLATAFORMA,
  ROTULO_ACAO_PLATAFORMA,
  type AcessoTemporario,
  type ContaNaPlataforma,
  type EventoDaAuditoria,
  type MembroDaPlataforma,
  type UsuarioPlataformaSessao,
  csvDaAuditoria,
  DESCRICAO_PAPEL_PLATAFORMA,
  PAPEIS_PLATAFORMA,
  type PapelPlataforma,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

function useEquipe() {
  return useQuery({
    queryKey: ['admin', 'equipe'],
    queryFn: () => adminApi<MembroDaPlataforma[]>('equipe'),
  });
}

/** Senha temporária: aparece uma vez, com botão de copiar e o que dizer à pessoa. */
function SenhaUmaVez({
  acesso,
  onFechar,
}: {
  acesso: AcessoTemporario | null;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Dialogo
      aberto={!!acesso}
      titulo="Acesso pronto"
      descricao="A senha aparece só agora. Mande para a pessoa por um canal seguro."
      onFechar={() => {
        setCopiado(false);
        onFechar();
      }}
    >
      {acesso && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-tinta-suave">E-mail</dt>
            <dd className="break-all">{acesso.email}</dd>
            <dt className="text-tinta-suave">Senha</dt>
            <dd>
              <code className="break-all font-denso text-lg">{acesso.senha}</code>
            </dd>
          </dl>
          <p className="text-sm text-tinta-suave">
            No primeiro acesso a /admin, a pessoa configura o aplicativo autenticador pelo QR code.
          </p>
          <div className="flex flex-wrap gap-3">
            <Botao
              onClick={async () => {
                await navigator.clipboard
                  .writeText(`E-mail: ${acesso.email}\nSenha: ${acesso.senha}`)
                  .catch(() => undefined);
                setCopiado(true);
              }}
            >
              {copiado ? 'Copiado' : 'Copiar e-mail e senha'}
            </Botao>
          </div>
        </div>
      )}
    </Dialogo>
  );
}

/** Equipe da plataforma: dar acesso, trocar papel, desativar e redefinir, sem o servidor. */
export function EquipeAdmin({ u }: { u: UsuarioPlataformaSessao }) {
  const q = useEquipe();
  const cliente = useQueryClient();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<PapelPlataforma>('vendedor');
  // Admin U6: desativar pede o motivo.
  const [desativar, setDesativar] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [acesso, setAcesso] = useState<AcessoTemporario | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'equipe'] });

  async function acao(id: string, f: () => Promise<unknown>) {
    setErro(null);
    setOcupado(id);
    try {
      await f();
      await atualizar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Equipe</h1>
        <p className="text-tinta-suave">
          Quem opera o Pente Fino. Cada papel só vê o que precisa: vendedor, as contas que vendeu;
          suporte, as contas e a saúde do sistema; financeiro, a cobrança e a nota fiscal; admin,
          tudo.
        </p>
      </div>
      <form
        aria-label="Dar acesso"
        noValidate
        className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setEnviando(true);
          try {
            const r = await adminApi<AcessoTemporario>('equipe', {
              corpo: { nome, email, papel },
            });
            setNome('');
            setEmail('');
            setAcesso(r);
            await atualizar();
          } catch (er) {
            setErro(mensagemDe(er));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Dar acesso</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Campo
            id="membro-nome"
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Campo
            id="membro-email"
            rotulo="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Selecao
            id="membro-papel"
            rotulo="Papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value as PapelPlataforma)}
            dica={DESCRICAO_PAPEL_PLATAFORMA[papel]}
            opcoes={PAPEIS_PLATAFORMA.map((p) => ({ valor: p, rotulo: NOME_PAPEL_PLATAFORMA[p] }))}
          />
        </div>
        <Botao type="submit" className="self-start" carregando={enviando}>
          Criar acesso
        </Botao>
      </form>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Estado consulta={q}>
        {() => (
          <Tabela rotulo="Equipe da plataforma">
            <thead>
              <tr className="border-b border-borda">
                {[
                  'Nome',
                  'Papel',
                  'Situação',
                  'Autenticador',
                  'Último acesso',
                  'Senha trocada em',
                  'Contas vendidas',
                  '',
                ].map((c, i) => (
                  <th key={i} scope="col" className={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data!.map((m) => {
                const eu = m.id === u.id;
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-borda ${m.ativo ? '' : 'text-tinta-suave'}`}
                  >
                    <th scope="row" className={`${td} font-semibold`}>
                      {m.nome}
                      {eu && <span className="font-normal text-tinta-suave"> (você)</span>}
                      <span className="block text-sm font-normal text-tinta-suave">{m.email}</span>
                    </th>
                    <td className={td}>
                      {eu ? (
                        NOME_PAPEL_PLATAFORMA[m.papel]
                      ) : (
                        <select
                          id={`papel-${m.id}`}
                          aria-label={`Papel de ${m.nome}`}
                          value={m.papel}
                          disabled={!!ocupado}
                          onChange={(e) =>
                            acao(m.id, () =>
                              adminApi(`equipe/${m.id}`, {
                                metodo: 'PUT',
                                corpo: { papel: e.target.value },
                              }),
                            )
                          }
                          className="min-h-11 rounded-md border border-borda-forte bg-fundo px-2 text-tinta focus-visible:outline-2 focus-visible:outline-foco"
                        >
                          {PAPEIS_PLATAFORMA.map((p) => (
                            <option key={p} value={p}>
                              {NOME_PAPEL_PLATAFORMA[p]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={td}>
                      <Ficha tom={m.ativo ? 'acao' : 'neutro'}>
                        {m.ativo ? 'Ativo' : 'Desativado'}
                      </Ficha>
                    </td>
                    <td className={td}>
                      {m.segundoFatorConfigurado ? 'Configurado' : 'Falta configurar'}
                    </td>
                    <td className={`${td} tabular-nums`}>
                      {m.ultimoAcessoEm ? formatarDataHora(m.ultimoAcessoEm) : '—'}
                    </td>
                    <td className={`${td} tabular-nums`}>
                      {m.senhaTrocadaEm ? formatarDataHora(m.senhaTrocadaEm) : '—'}
                    </td>
                    <td className={`${td} tabular-nums`}>{m.contasVendidas}</td>
                    <td className={td}>
                      {!eu && (
                        <div className="flex flex-wrap gap-2">
                          <Botao
                            variante="secundario"
                            disabled={!!ocupado}
                            onClick={() =>
                              acao(m.id, async () =>
                                setAcesso(
                                  await adminApi<AcessoTemporario>(`equipe/${m.id}/redefinir`, {
                                    corpo: {},
                                  }),
                                ),
                              )
                            }
                          >
                            Redefinir acesso
                          </Botao>
                          <Botao
                            variante={m.ativo ? 'perigo' : 'secundario'}
                            disabled={!!ocupado}
                            onClick={() =>
                              m.ativo
                                ? setDesativar({ id: m.id, nome: m.nome })
                                : acao(m.id, () =>
                                    adminApi(`equipe/${m.id}`, {
                                      metodo: 'PUT',
                                      corpo: { ativo: true },
                                    }),
                                  )
                            }
                          >
                            {m.ativo ? 'Desativar' : 'Reativar'}
                          </Botao>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Estado>
      <SenhaUmaVez acesso={acesso} onFechar={() => setAcesso(null)} />
      <Dialogo
        aberto={desativar !== null}
        titulo={`Desativar ${desativar?.nome ?? ''}?`}
        descricao="A pessoa sai na hora (as sessões abertas acabam). O motivo fica na auditoria."
        onFechar={() => {
          setDesativar(null);
          setMotivo('');
        }}
      >
        <form
          method="post"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!desativar || motivo.trim().length < 5) return;
            const { id } = desativar;
            setDesativar(null);
            await acao(id, () =>
              adminApi(`equipe/${id}`, {
                metodo: 'PUT',
                corpo: { ativo: false, motivo: motivo.trim() },
              }),
            );
            setMotivo('');
          }}
        >
          <Campo
            id="desativar-motivo"
            rotulo="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Saiu da empresa, trocou de função…"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setDesativar(null)}>
              Voltar
            </Botao>
            <Botao type="submit" variante="perigo" disabled={motivo.trim().length < 5}>
              Desativar
            </Botao>
          </div>
        </form>
      </Dialogo>
    </div>
  );
}

/** Auditoria da plataforma: quem fez o quê, quando e em que conta. */
export function AuditoriaAdmin({ onAbrirConta }: { onAbrirConta: (id: string) => void }) {
  const equipe = useEquipe();
  const contas = useQuery({
    queryKey: ['admin', 'contas'],
    queryFn: () => adminApi<ContaNaPlataforma[]>('contas'),
  });
  const [usuario, setUsuario] = useState('');
  const [acao, setAcao] = useState('');
  const [conta, setConta] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const filtro = new URLSearchParams(
    Object.entries({ usuario, acao, conta, de, ate }).filter(([, v]) => v),
  ).toString();
  const q = useQuery({
    queryKey: ['admin', 'auditoria', filtro],
    queryFn: () => adminApi<EventoDaAuditoria[]>(`auditoria${filtro ? `?${filtro}` : ''}`),
  });
  // Admin U7: "Carregar mais" (300 por vez) e exportar até 2000 em CSV, no mesmo filtro.
  const [mais, setMais] = useState<{ filtro: string; eventos: EventoDaAuditoria[]; fim: boolean }>({
    filtro: '',
    eventos: [],
    fim: false,
  });
  const extras = mais.filtro === filtro ? mais.eventos : [];
  const todos = [...(q.data ?? []), ...extras];
  const acabou = (mais.filtro === filtro && mais.fim) || (q.data?.length ?? 0) < 300;
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const comFiltro = (extra: Record<string, string>) => {
    const p = new URLSearchParams(filtro);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `auditoria?${p.toString()}`;
  };
  async function carregarMais() {
    const ultimo = todos.at(-1);
    if (!ultimo) return;
    setCarregando(true);
    setErro(null);
    try {
      const novos = await adminApi<EventoDaAuditoria[]>(
        comFiltro({ antesDe: ultimo.quando, antesDeId: ultimo.id }),
      );
      setMais({ filtro, eventos: [...extras, ...novos], fim: novos.length < 300 });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }
  async function exportar() {
    setErro(null);
    try {
      const eventos = await adminApi<EventoDaAuditoria[]>(comFiltro({ limite: '2000' }));
      const url = URL.createObjectURL(
        new Blob([csvDaAuditoria(eventos)], { type: 'text/csv;charset=utf-8' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-pente-fino-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível exportar.');
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Auditoria</h1>
        <p className="text-tinta-suave">
          Toda ação da administração fica aqui e não pode ser apagada. Horários de Brasília; 300 por
          vez (use &ldquo;Carregar mais&rdquo;). O CSV leva até 2000 do filtro.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Selecao
          id="aud-usuario"
          rotulo="Quem"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Todos' },
            ...(equipe.data ?? []).map((m) => ({ valor: m.id, rotulo: m.nome })),
          ]}
        />
        <Selecao
          id="aud-acao"
          rotulo="Ação"
          value={acao}
          onChange={(e) => setAcao(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Todas' },
            ...Object.entries(ROTULO_ACAO_PLATAFORMA).map(([valor, rotulo]) => ({ valor, rotulo })),
          ]}
        />
        <Selecao
          id="aud-conta"
          rotulo="Conta"
          value={conta}
          onChange={(e) => setConta(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Todas' },
            ...(contas.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome })),
          ]}
        />
        <Campo
          id="aud-de"
          rotulo="De"
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <Campo
          id="aud-ate"
          rotulo="Até"
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
        <Botao variante="secundario" onClick={() => void exportar()}>
          Exportar CSV
        </Botao>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Estado consulta={q}>
        {() =>
          q.data!.length === 0 ? (
            <p className="rounded-lg border border-borda bg-superficie p-6 text-tinta-suave">
              Nenhuma ação com esse filtro.
            </p>
          ) : (
            <Tabela rotulo="Auditoria da plataforma">
              <thead>
                <tr className="border-b border-borda">
                  {['Quando', 'Quem', 'Ação', 'Conta', 'Detalhe'].map((c) => (
                    <th key={c} scope="col" className={th}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todos.map((e) => (
                  <tr key={e.id} className="border-b border-borda align-top">
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {formatarDataHora(e.quando)}
                    </td>
                    <td className={td}>
                      {e.quem ?? '—'}
                      {e.ip && <span className="block text-xs text-tinta-suave">{e.ip}</span>}
                    </td>
                    <td className={td}>{ROTULO_ACAO_PLATAFORMA[e.acao] ?? e.acao}</td>
                    <td className={td}>
                      {e.contaId ? (
                        <button
                          type="button"
                          onClick={() => onAbrirConta(e.contaId!)}
                          className="text-left underline decoration-borda-forte underline-offset-4 hover:decoration-modulo focus-visible:outline-2 focus-visible:outline-foco"
                        >
                          {e.conta ?? 'Conta removida'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${td} max-w-md text-sm`}>
                      {e.motivo && <span className="block">Motivo: {e.motivo}</span>}
                      {e.detalhe && (
                        <span className="block break-words text-tinta-suave">{e.detalhe}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        }
      </Estado>
      {(q.data?.length ?? 0) > 0 && !acabou && (
        <Botao
          variante="secundario"
          className="self-start"
          carregando={carregando}
          onClick={() => void carregarMais()}
        >
          Carregar mais
        </Botao>
      )}
    </div>
  );
}

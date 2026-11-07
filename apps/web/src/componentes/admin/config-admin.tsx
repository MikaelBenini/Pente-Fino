'use client';

import {
  formatarDataHora,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
} from '@pente-fino/shared';
import { Botao, Campo, Selecao } from '@pente-fino/ui';
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
  return <Estado consulta={config}>{() => <Formularios c={config.data!} />}</Estado>;
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

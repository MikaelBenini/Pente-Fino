'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  contaSchema,
  dataLocal,
  diasRestantesTeste,
  formatarData,
  formatarTelefone,
  NOME_PLANO,
  NOMES_DIAS,
  NOMES_DIAS_CURTOS,
  podeNaUnidade,
  unidadeSchema,
  type ContaEntrada,
  type UnidadeDetalhe,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  Campo,
  CampoQuantidade,
  Dialogo,
  EstadoVazio,
  Marcador,
  Selecao,
} from '@pente-fino/ui';
import { CalendarOff, MapPin, Phone, Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { api } from '@/lib/api';
import { chaves, useAcao, useCalendario, useConta, useUnidadesDetalhe } from '@/lib/consultas';
import { aplicarErroDaApi } from '@/lib/formularios';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';
import { Assinatura } from './assinatura';
import { RegrasDeAgendamento } from './regras-agendamento';
import { ImportarPlanilha, LinkAgendamento } from './link-e-importacao';

export function TelaConfiguracoes() {
  const { papeis } = useApp();
  // Avisos do painel abrem direto na aba (?aba=assinatura, ?aba=link).
  const abaDoLink = useSearchParams().get('aba');
  const ehDono = papeis.includes('dono');
  const [aba, setAba] = useState(
    abaDoLink === 'assinatura' && ehDono
      ? 'assinatura'
      : abaDoLink === 'link'
        ? 'link'
        : 'barbearia',
  );
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Configurações" pergunta="Como a barbearia funciona?" />
      <Abas
        rotulo="Configurações"
        atual={aba}
        onTrocar={setAba}
        abas={[
          { id: 'barbearia', rotulo: 'Barbearia', conteudo: <Barbearia /> },
          { id: 'unidades', rotulo: 'Unidades', conteudo: <Unidades /> },
          { id: 'calendario', rotulo: 'Folgas e feriados', conteudo: <Calendario /> },
          { id: 'link', rotulo: 'Link de agendamento', conteudo: <LinkAgendamento /> },
          { id: 'agendamento', rotulo: 'Agendamento', conteudo: <RegrasDeAgendamento /> },
          ...(ehDono
            ? [
                { id: 'importar', rotulo: 'Importar planilha', conteudo: <ImportarPlanilha /> },
                { id: 'assinatura', rotulo: 'Assinatura', conteudo: <Assinatura /> },
              ]
            : []),
        ]}
      />
    </div>
  );
}

// ─── Barbearia ────────────────────────────────────────────────────────────

function Barbearia() {
  const conta = useConta();
  const { papeis } = useApp();
  const ehDono = papeis.includes('dono');
  return (
    <Estado consulta={conta}>
      {() => {
        const c = conta.data!;
        const limite = (uso: number, max: number | null) =>
          max === null ? `${uso} (sem limite)` : `${uso} de ${max}`;
        return (
          <div className="grid max-w-3xl gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
            {ehDono ? (
              <NomeConta nome={c.nome} />
            ) : (
              <p className="text-xl font-semibold">{c.nome}</p>
            )}
            <dl className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Plano
                </dt>
                <dd className="text-xl font-semibold">
                  {NOME_PLANO[c.plano]}{' '}
                  <span className="text-base font-normal text-tinta-suave">
                    · {c.ciclo === 'anual' ? 'anual' : 'mensal'}
                  </span>
                </dd>
              </div>
              {c.status === 'teste' && c.testeAte && <AvisoTeste ate={c.testeAte} />}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Unidades ativas
                </dt>
                <dd className="font-denso text-lg tabular-nums">
                  {limite(c.uso.unidades, c.limites.unidades)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  Profissionais ativos
                </dt>
                <dd className="font-denso text-lg tabular-nums">
                  {limite(c.uso.profissionais, c.limites.profissionais)}
                </dd>
              </div>
            </dl>
          </div>
        );
      }}
    </Estado>
  );
}

/** Dias que faltam do teste grátis, contados pelo calendário de São Paulo. */
function AvisoTeste({ ate }: { ate: string }) {
  const dias = diasRestantesTeste(new Date(ate), new Date());
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        Teste grátis
      </dt>
      <dd className={dias <= 3 ? 'font-semibold text-aviso-texto' : 'font-semibold'}>
        {dias > 1
          ? `Faltam ${dias} dias`
          : dias === 1
            ? 'Termina amanhã'
            : dias === 0
              ? 'Termina hoje'
              : 'Terminou'}
        <span className="block text-sm font-normal text-tinta-suave">até {formatarData(ate)}</span>
      </dd>
    </div>
  );
}

function NomeConta({ nome }: { nome: string }) {
  const [ok, setOk] = useState(false);
  const salvar = useAcao(
    (d: ContaEntrada) => api('conta', { metodo: 'PATCH', corpo: d }),
    [chaves.conta],
  );
  const { register, handleSubmit, setError, formState } = useForm<ContaEntrada>({
    resolver: zodResolver(contaSchema),
    values: { nome },
  });
  const enviar = handleSubmit(async (d) => {
    setOk(false);
    try {
      await salvar.mutateAsync(d);
      setOk(true);
    } catch (e) {
      aplicarErroDaApi(e, setError);
    }
  });
  return (
    <form method="post" noValidate onSubmit={enviar} className="flex flex-col gap-4">
      <Campo
        id="conta-nome"
        rotulo="Nome da barbearia"
        erro={formState.errors.nome?.message}
        {...register('nome')}
      />
      {ok && <Aviso tom="sucesso">Nome salvo.</Aviso>}
      <Botao type="submit" className="self-start" carregando={formState.isSubmitting}>
        Salvar nome
      </Botao>
    </form>
  );
}

// ─── Unidades ─────────────────────────────────────────────────────────────

function Unidades() {
  const unidades = useUnidadesDetalhe();
  const { papeis } = useApp();
  const ehDono = papeis.includes('dono');
  const [editando, setEditando] = useState<UnidadeDetalhe | 'nova' | null>(null);
  return (
    <Estado consulta={unidades}>
      {() => (
        <div className="flex flex-col gap-4">
          {ehDono && (
            <Botao className="self-start" onClick={() => setEditando('nova')}>
              <Plus aria-hidden className="size-5" /> Nova unidade
            </Botao>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {unidades.data!.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Store aria-hidden className="size-5 text-modulo-texto" strokeWidth={1.75} />
                    {u.nome}
                  </h2>
                  {!u.ativa && <Ficha tom="neutro">Desativada</Ficha>}
                </div>
                <div className="flex flex-col gap-1 text-sm text-tinta-suave">
                  {u.endereco && (
                    <span className="flex items-center gap-2">
                      <MapPin aria-hidden className="size-4" /> {u.endereco}
                    </span>
                  )}
                  {u.telefone && (
                    <span className="flex items-center gap-2">
                      <Phone aria-hidden className="size-4" /> {formatarTelefone(u.telefone)}
                    </span>
                  )}
                </div>
                <p
                  className="flex flex-wrap gap-1"
                  aria-label={`Abre: ${u.diasTrabalho.map((d) => NOMES_DIAS[d]).join(', ')}`}
                >
                  {NOMES_DIAS_CURTOS.map((d, i) => (
                    <span
                      key={d}
                      aria-hidden
                      className={`rounded-sm px-2 py-0.5 font-denso text-sm font-semibold ${u.diasTrabalho.includes(i) ? 'bg-superficie-3 text-tinta' : 'text-tinta-fraca line-through'}`}
                    >
                      {d}
                    </span>
                  ))}
                </p>
                <p className="text-sm text-tinta-suave">
                  {u.capacidade} {u.capacidade === 1 ? 'cadeira' : 'cadeiras'} atendendo ao mesmo
                  tempo
                </p>
                {ehDono && (
                  <Botao
                    variante="secundario"
                    className="self-start"
                    onClick={() => setEditando(u)}
                  >
                    Editar unidade
                  </Botao>
                )}
              </li>
            ))}
          </ul>
          <FormularioUnidade unidade={editando} onFechar={() => setEditando(null)} />
        </div>
      )}
    </Estado>
  );
}

const formUnidade = unidadeSchema.extend({
  telefone: z.string().optional(),
  ativa: z.boolean().optional(),
});
type FormUnidade = z.input<typeof formUnidade>;

function FormularioUnidade({
  unidade,
  onFechar,
}: {
  unidade: UnidadeDetalhe | 'nova' | null;
  onFechar: () => void;
}) {
  const atual = unidade && unidade !== 'nova' ? unidade : null;
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const salvar = useAcao(
    (d: object) =>
      atual
        ? api(`unidades/${atual.id}`, { metodo: 'PATCH', corpo: d })
        : api('unidades', { corpo: d }),
    [chaves.unidades, chaves.conta],
  );
  const { register, handleSubmit, setError, control, setValue, formState } = useForm<FormUnidade>({
    resolver: zodResolver(formUnidade),
    values: atual
      ? {
          ...atual,
          endereco: atual.endereco ?? '',
          telefone: atual.telefone ? formatarTelefone(atual.telefone) : '',
        }
      : {
          nome: '',
          endereco: '',
          telefone: '',
          diasTrabalho: [1, 2, 3, 4, 5, 6],
          capacidade: 2,
          ativa: true,
        },
  });
  const dias = useWatch({ control, name: 'diasTrabalho' }) ?? [];

  const enviar = handleSubmit(async (d) => {
    setErroGeral(null);
    try {
      await salvar.mutateAsync({ ...d, telefone: d.telefone ?? '' });
      onFechar();
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <Dialogo
      aberto={unidade !== null}
      titulo={atual ? `Editar ${atual.nome}` : 'Nova unidade'}
      onFechar={onFechar}
    >
      <form method="post" noValidate onSubmit={enviar} className="flex flex-col gap-4">
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
        <Campo
          id="unidade-nome"
          rotulo="Nome"
          dica="Como a equipe chama: Centro, Shopping, Jardins"
          erro={formState.errors.nome?.message}
          {...register('nome')}
        />
        <Campo
          id="unidade-endereco"
          rotulo="Endereço"
          erro={formState.errors.endereco?.message}
          {...register('endereco')}
        />
        <Campo
          id="unidade-telefone"
          rotulo="Telefone"
          inputMode="tel"
          erro={formState.errors.telefone?.message}
          {...register('telefone')}
        />
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium">Dias de trabalho</legend>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {NOMES_DIAS_CURTOS.map((d, i) => (
                <Marcador
                  key={d}
                  id={`unidade-dia-${i}`}
                  forma="ficha"
                  rotulo={d}
                  aria-label={NOMES_DIAS[i]}
                  checked={dias.includes(i)}
                  onChange={(e) =>
                    setValue(
                      'diasTrabalho',
                      e.target.checked ? [...dias, i] : dias.filter((x) => x !== i),
                      { shouldValidate: true },
                    )
                  }
                />
              ))}
            </div>
            {formState.errors.diasTrabalho && (
              <p className="text-sm text-perigo-texto">{formState.errors.diasTrabalho.message}</p>
            )}
            <p className="text-sm text-tinta-suave">
              Base da projeção do mês. Feriados e folgas ficam na aba ao lado.
            </p>
          </div>
        </fieldset>
        <Controller
          control={control}
          name="capacidade"
          render={({ field, fieldState }) => (
            <CampoQuantidade
              id="unidade-capacidade"
              rotulo="Cadeiras"
              dica="Quantos atendem ao mesmo tempo (ocupação)"
              min={1}
              max={50}
              valor={field.value ?? null}
              onMudar={field.onChange}
              erro={fieldState.error?.message}
            />
          )}
        />
        {atual && <Marcador id="unidade-ativa" rotulo="Unidade ativa" {...register('ativa')} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={formState.isSubmitting}>
            {atual ? 'Salvar' : 'Criar unidade'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Calendário ───────────────────────────────────────────────────────────

function somarMeses(data: string, meses: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function Calendario() {
  const { usuario, unidadeAtiva } = useApp();
  const unidades = useUnidadesDetalhe();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const lista = unidades.data ?? [];
  const unidadeId = escolhida ?? (unidadeAtiva !== 'todas' ? unidadeAtiva : (lista[0]?.id ?? null));
  const hoje = dataLocal(new Date());
  const ate = somarMeses(hoje, 12);
  const dias = useCalendario(unidadeId, hoje, ate);
  const podeEditar = !!unidadeId && podeNaUnidade(usuario.papeis, unidadeId, ['dono', 'gestor']);
  const [nova, setNova] = useState({ data: '', motivo: '', trabalha: false });
  const [erro, setErro] = useState<string | null>(null);
  const invalidar = [['calendario']];
  const marcar = useAcao(
    (d: typeof nova) =>
      api(`unidades/${unidadeId}/calendario/${d.data}`, {
        metodo: 'PUT',
        corpo: { trabalha: d.trabalha, motivo: d.motivo },
      }),
    invalidar,
  );
  const desmarcar = useAcao(
    (data: string) => api(`unidades/${unidadeId}/calendario/${data}`, { metodo: 'DELETE' }),
    invalidar,
  );

  if (unidades.isPending) return <Estado consulta={unidades}>{() => null}</Estado>;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {lista.length > 1 && (
        <div className="max-w-xs">
          <Selecao
            id="calendario-unidade"
            rotulo="Unidade"
            value={unidadeId ?? ''}
            onChange={(e) => setEscolhida(e.target.value)}
            opcoes={lista.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          />
        </div>
      )}
      {podeEditar && (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            if (!nova.data) return setErro('Escolha a data.');
            try {
              await marcar.mutateAsync(nova);
              setNova({ data: '', motivo: '', trabalha: false });
            } catch (er) {
              setErro(er instanceof Error ? er.message : 'Não foi possível salvar.');
            }
          }}
        >
          <div className="sm:w-44">
            <Campo
              id="calendario-data"
              rotulo="Data"
              type="date"
              min={hoje}
              value={nova.data}
              onChange={(e) => setNova({ ...nova, data: e.target.value })}
            />
          </div>
          <div className="sm:flex-1">
            <Campo
              id="calendario-motivo"
              rotulo="Motivo"
              placeholder="Feriado municipal, reforma…"
              value={nova.motivo}
              onChange={(e) => setNova({ ...nova, motivo: e.target.value })}
            />
          </div>
          <Marcador
            id="calendario-trabalha"
            rotulo="Dia extra (abre fora do normal)"
            checked={nova.trabalha}
            onChange={(e) => setNova({ ...nova, trabalha: e.target.checked })}
          />
          <Botao type="submit" carregando={marcar.isPending}>
            Marcar
          </Botao>
          {erro && (
            <Aviso tom="erro" className="w-full">
              {erro}
            </Aviso>
          )}
        </form>
      )}
      <Estado consulta={dias}>
        {() =>
          dias.data!.length === 0 ? (
            <EstadoVazio
              icone={CalendarOff}
              titulo="Nenhuma folga ou feriado marcado"
              texto="Marque aqui os dias em que a unidade não abre. A projeção do mês desconta esses dias."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
              {dias.data!.map((d) => (
                <li
                  key={d.data}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="flex flex-col">
                    <span className="font-denso text-lg font-semibold tabular-nums">
                      {formatarData(`${d.data}T12:00:00Z`)}
                    </span>
                    <span className="text-sm text-tinta-suave">
                      {d.motivo ?? (d.trabalha ? 'Dia extra' : 'Fechado')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {d.trabalha ? (
                      <Ficha tom="acao">Abre</Ficha>
                    ) : (
                      <Ficha tom="perigo">Fechado</Ficha>
                    )}
                    {podeEditar && (
                      <Botao
                        variante="fantasma"
                        aria-label={`Remover ${formatarData(`${d.data}T12:00:00Z`)}`}
                        onClick={() => desmarcar.mutate(d.data)}
                      >
                        Remover
                      </Botao>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Estado>
    </div>
  );
}

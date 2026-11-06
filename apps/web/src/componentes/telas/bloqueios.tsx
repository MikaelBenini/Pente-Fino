'use client';

import {
  dataLocal,
  formatarData,
  formatarDataHora,
  NOMES_DIAS,
  textoFaixa,
  type BloqueioRecorrente,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { INVALIDAR_OPERACAO, useAcao } from '@/lib/consultas';
import { Aviso } from '../aviso';

type Tipo = 'uma' | 'semana' | 'ferias';
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível salvar.';
const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

interface BloqueioPontual {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
}

/**
 * Bloquear horário (balcão): uma vez, toda semana (almoço de toda terça) ou férias/folga de
 * vários dias. A agenda, o site e o bot deixam de oferecer esses horários.
 */
export function Bloqueios({
  profissionais,
  dia,
  aberto,
  onFechar,
}: {
  profissionais: readonly { id: string; nome: string }[];
  dia: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [profissionalId, setProfissionalId] = useState(profissionais[0]?.id ?? '');
  const prof = profissionalId || profissionais[0]?.id || '';
  const [tipo, setTipo] = useState<Tipo>('uma');
  const [quando, setQuando] = useState(dia);
  const [ateDia, setAteDia] = useState(somarDias(dia, 6));
  const [diaSemana, setDiaSemana] = useState(String(new Date(`${dia}T12:00:00Z`).getUTCDay()));
  const [de, setDe] = useState('12:00');
  const [ate, setAte] = useState('13:00');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const hoje = dataLocal(new Date());
  const chaveRec = ['bloqueios-recorrentes', prof] as const;
  const chavePont = ['bloqueios', prof] as const;
  const recorrentes = useQuery({
    queryKey: chaveRec,
    queryFn: () => api<BloqueioRecorrente[]>(`profissionais/${prof}/bloqueios-recorrentes`),
    enabled: aberto && !!prof,
  });
  const pontuais = useQuery({
    queryKey: chavePont,
    queryFn: () =>
      api<BloqueioPontual[]>(
        `profissionais/${prof}/bloqueios?de=${hoje}&ate=${somarDias(hoje, 120)}`,
      ),
    enabled: aberto && !!prof,
  });
  const invalidar = [...INVALIDAR_OPERACAO, chaveRec, chavePont];
  const salvar = useAcao(async () => {
    if (tipo === 'semana')
      return api(`profissionais/${prof}/bloqueios-recorrentes`, {
        corpo: {
          diaSemana: Number(diaSemana),
          inicioMin: minutos(de),
          fimMin: minutos(ate),
          desde: quando,
          ate: null,
          motivo: motivo.trim() || null,
        },
      });
    const inicio = tipo === 'ferias' ? `${quando}T00:00:00-03:00` : `${quando}T${de}:00-03:00`;
    const fim =
      tipo === 'ferias' ? `${somarDias(ateDia, 1)}T00:00:00-03:00` : `${quando}T${ate}:00-03:00`;
    return api(`profissionais/${prof}/bloqueios`, {
      corpo: {
        inicio: new Date(inicio).toISOString(),
        fim: new Date(fim).toISOString(),
        motivo: motivo.trim() || (tipo === 'ferias' ? 'Férias' : null),
      },
    });
  }, invalidar);
  const removerRec = useAcao(
    (id: string) => api(`profissionais/${prof}/bloqueios-recorrentes/${id}`, { metodo: 'DELETE' }),
    invalidar,
  );
  const removerPont = useAcao(
    (id: string) => api(`profissionais/${prof}/bloqueios/${id}`, { metodo: 'DELETE' }),
    invalidar,
  );

  return (
    <Dialogo
      aberto={aberto}
      titulo="Bloquear horário"
      descricao="A agenda, o site e o WhatsApp deixam de oferecer esses horários."
      onFechar={onFechar}
      largura="larga"
    >
      <div className="flex flex-col gap-5">
        <form
          method="post"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setSalvo(null);
            try {
              await salvar.mutateAsync(undefined);
              setSalvo('Bloqueio salvo.');
              setMotivo('');
            } catch (er) {
              setErro(mensagemDe(er));
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              id="bloqueio-prof"
              rotulo="Barbeiro"
              value={prof}
              onChange={(e) => setProfissionalId(e.target.value)}
              opcoes={profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            />
            <Selecao
              id="bloqueio-tipo"
              rotulo="Bloquear"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
              opcoes={[
                { valor: 'uma', rotulo: 'Uma vez (compromisso, folga de horas)' },
                { valor: 'semana', rotulo: 'Toda semana (almoço, por exemplo)' },
                { valor: 'ferias', rotulo: 'Férias ou folga de dias' },
              ]}
            />
            {tipo === 'semana' ? (
              <Selecao
                id="bloqueio-semana"
                rotulo="Dia da semana"
                value={diaSemana}
                onChange={(e) => setDiaSemana(e.target.value)}
                opcoes={NOMES_DIAS.map((n, i) => ({ valor: String(i), rotulo: n }))}
              />
            ) : null}
            <Campo
              id="bloqueio-dia"
              rotulo={tipo === 'semana' ? 'A partir de' : tipo === 'ferias' ? 'De' : 'Dia'}
              type="date"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
            {tipo === 'ferias' ? (
              <Campo
                id="bloqueio-ate-dia"
                rotulo="Até (inclusive)"
                type="date"
                value={ateDia}
                onChange={(e) => setAteDia(e.target.value)}
              />
            ) : (
              <>
                <Campo
                  id="bloqueio-de"
                  rotulo="Das"
                  type="time"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                />
                <Campo
                  id="bloqueio-ate"
                  rotulo="Até"
                  type="time"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                />
              </>
            )}
            <Campo
              id="bloqueio-motivo"
              rotulo="Motivo (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {salvo && <p className="text-sm text-acao-texto">{salvo}</p>}
          <Botao
            type="submit"
            className="self-start"
            carregando={salvar.isPending}
            disabled={!prof}
          >
            Bloquear
          </Botao>
        </form>

        <section className="flex flex-col gap-2" aria-labelledby="titulo-bloq-semana">
          <h3 id="titulo-bloq-semana" className="font-semibold">
            Toda semana
          </h3>
          {(recorrentes.data ?? []).length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhum bloqueio que repete.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Bloqueios que repetem">
              {recorrentes.data!.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borda p-3"
                >
                  <span>
                    {NOMES_DIAS[b.diaSemana]}, {textoFaixa(b.inicioMin, b.fimMin)}
                    {b.motivo ? ` · ${b.motivo}` : ''}
                    <span className="block text-sm text-tinta-suave">
                      Desde {formatarData(`${b.desde}T12:00:00Z`)}
                      {b.ate ? ` até ${formatarData(`${b.ate}T12:00:00Z`)}` : ''}
                    </span>
                  </span>
                  <Botao variante="fantasma" onClick={() => removerRec.mutate(b.id)}>
                    Remover
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="titulo-bloq-proximos">
          <h3 id="titulo-bloq-proximos" className="font-semibold">
            Próximos bloqueios e férias
          </h3>
          {(pontuais.data ?? []).length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhum nos próximos meses.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Próximos bloqueios">
              {pontuais.data!.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borda p-3"
                >
                  <span>
                    {formatarDataHora(b.inicio)} até {formatarDataHora(b.fim)}
                    {b.motivo ? ` · ${b.motivo}` : ''}
                  </span>
                  <Botao variante="fantasma" onClick={() => removerPont.mutate(b.id)}>
                    Remover
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialogo>
  );
}

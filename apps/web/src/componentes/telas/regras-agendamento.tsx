'use client';

import { REGRAS_AGENDAMENTO_PADRAO, type RegrasAgendamento } from '@pente-fino/shared';
import { Botao, CampoQuantidade, Marcador, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { Estado } from '../pagina';

const chave = (unidadeId: string) => ['unidades', unidadeId, 'regras-agendamento'] as const;

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível salvar. Tente de novo.';

/** Aba "Agendamento" de Configurações: as regras de cada unidade para o bot e o site. */
export function RegrasDeAgendamento() {
  const { unidades, unidadeAtiva, usuario } = useApp();
  const permitidas = unidades.filter(
    (u) =>
      u.ativa &&
      usuario.papeis.some(
        (p) =>
          (p.papel === 'dono' && p.unidadeId === null) ||
          (p.papel === 'gestor' && p.unidadeId === u.id),
      ),
  );
  const [escolhida, setEscolhida] = useState(
    unidadeAtiva !== 'todas' && permitidas.some((u) => u.id === unidadeAtiva)
      ? unidadeAtiva
      : (permitidas[0]?.id ?? ''),
  );
  const regras = useQuery({
    queryKey: chave(escolhida),
    queryFn: () => api<RegrasAgendamento>(`unidades/${escolhida}/regras-agendamento`),
    enabled: !!escolhida,
  });
  if (!escolhida) return <p className="text-tinta-suave">Nenhuma unidade para configurar.</p>;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-tinta-suave">
        Valem quando o cliente marca sozinho, pelo WhatsApp ou pelo link do site. O balcão marca
        livre para encaixes e só respeita o intervalo entre atendimentos.
      </p>
      {permitidas.length > 1 && (
        <Selecao
          id="regras-unidade"
          rotulo="Unidade"
          value={escolhida}
          onChange={(e) => setEscolhida(e.target.value)}
          opcoes={permitidas.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          className="max-w-xs"
        />
      )}
      <Estado consulta={regras}>
        {() => <Formulario key={escolhida} unidadeId={escolhida} inicial={regras.data!} />}
      </Estado>
    </div>
  );
}

function Formulario({ unidadeId, inicial }: { unidadeId: string; inicial: RegrasAgendamento }) {
  const [f, setF] = useState(inicial);
  const [lembrete1, setLembrete1] = useState(inicial.lembretesHoras[0] ?? null);
  const [lembrete2, setLembrete2] = useState(inicial.lembretesHoras[1] ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const salvar = useAcao(
    (corpo: RegrasAgendamento) =>
      api<RegrasAgendamento>(`unidades/${unidadeId}/regras-agendamento`, {
        metodo: 'PUT',
        corpo,
      }),
    [chave(unidadeId)],
  );
  const numero = (v: number | null, padrao: number) => v ?? padrao;
  const mudar = <K extends keyof RegrasAgendamento>(k: K, v: RegrasAgendamento[K]) => {
    setOk(false);
    setF({ ...f, [k]: v });
  };

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        setOk(false);
        const lembretesHoras = [lembrete1, lembrete2].filter((h): h is number => h !== null);
        try {
          const salvo = await salvar.mutateAsync({ ...f, lembretesHoras });
          setF(salvo);
          setOk(true);
        } catch (er) {
          setErro(mensagemDe(er));
        }
      }}
    >
      <fieldset className="grid gap-4 rounded-lg border border-borda bg-superficie p-5 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Cliente marcando sozinho</legend>
        <CampoQuantidade
          id="regra-antecedencia"
          rotulo="Antecedência mínima (minutos)"
          dica="Não oferece horários mais perto que isso"
          min={0}
          max={2880}
          passo={15}
          valor={f.antecedenciaMin}
          onMudar={(v) => mudar('antecedenciaMin', numero(v, 0))}
        />
        <CampoQuantidade
          id="regra-janela"
          rotulo="Até quantos dias à frente"
          min={1}
          max={180}
          valor={f.janelaDias}
          onMudar={(v) => mudar('janelaDias', numero(v, 1))}
        />
        <CampoQuantidade
          id="regra-futuros"
          rotulo="Horários marcados por cliente"
          dica="Acima disso, só com a recepção"
          min={1}
          max={10}
          valor={f.maxFuturos}
          onMudar={(v) => mudar('maxFuturos', numero(v, 1))}
        />
        <CampoQuantidade
          id="regra-prazo"
          rotulo="Remarca ou cancela até (minutos antes)"
          dica="120 = até 2 horas antes; depois, com a recepção"
          min={0}
          max={2880}
          passo={30}
          valor={f.prazoMudarMin}
          onMudar={(v) => mudar('prazoMudarMin', numero(v, 0))}
        />
        <CampoQuantidade
          id="regra-tolerancia"
          rotulo="Tolerância de atraso (minutos)"
          dica="Avisada na confirmação e no lembrete; depois, o barbeiro confirma se o cliente não veio"
          min={0}
          max={60}
          passo={5}
          valor={f.toleranciaAtrasoMin}
          onMudar={(v) => mudar('toleranciaAtrasoMin', numero(v, 0))}
        />
        <CampoQuantidade
          id="regra-faltas"
          rotulo="Faltas para marcar só com a recepção"
          dica="0 = desligado. O balcão continua marcando"
          min={0}
          max={10}
          valor={f.faltasParaBloquear}
          onMudar={(v) => mudar('faltasParaBloquear', numero(v, 0))}
        />
        <CampoQuantidade
          id="regra-faltas-dias"
          rotulo="Contando faltas dos últimos (dias)"
          min={7}
          max={365}
          passo={15}
          valor={f.faltasJanelaDias}
          onMudar={(v) => mudar('faltasJanelaDias', numero(v, 7))}
        />
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-borda bg-superficie p-5 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Agenda</legend>
        <CampoQuantidade
          id="regra-intervalo"
          rotulo="Intervalo entre atendimentos (minutos)"
          dica="Folga do profissional entre um cliente e outro (vale também no balcão)"
          min={0}
          max={60}
          passo={5}
          valor={f.intervaloMin}
          onMudar={(v) => mudar('intervaloMin', numero(v, 0))}
        />
        <div className="flex flex-col gap-2">
          <Marcador
            id="regra-conversa"
            rotulo="Agendar pela conversa do WhatsApp"
            checked={f.pelaConversa}
            onChange={(e) => mudar('pelaConversa', e.target.checked)}
          />
          <p className="text-sm text-tinta-suave">
            Desligado, a opção “Agendar” do bot manda o link do site. O link liga e desliga na aba
            “Link de agendamento”.
          </p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-borda bg-superficie p-5 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Lembretes pelo WhatsApp</legend>
        <LembreteHoras
          id="regra-lembrete-1"
          rotulo="Primeiro lembrete"
          dica="Confirma, remarca ou cancela"
          valor={lembrete1}
          padrao={REGRAS_AGENDAMENTO_PADRAO.lembretesHoras[0]!}
          onMudar={(v) => {
            setOk(false);
            setLembrete1(v);
          }}
        />
        <LembreteHoras
          id="regra-lembrete-2"
          rotulo="Segundo lembrete"
          dica="Em cima da hora: só confirma"
          valor={lembrete2}
          padrao={REGRAS_AGENDAMENTO_PADRAO.lembretesHoras[1]!}
          onMudar={(v) => {
            setOk(false);
            setLembrete2(v);
          }}
        />
        <p className="text-sm text-tinta-suave sm:col-span-2">
          Só para quem aceitou receber avisos e já conversou com o WhatsApp da barbearia.
        </p>
      </fieldset>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && <Aviso tom="sucesso">Regras salvas. Já valem para o bot e o site.</Aviso>}
      <Botao type="submit" className="self-start" carregando={salvar.isPending}>
        Salvar regras
      </Botao>
    </form>
  );
}

function LembreteHoras({
  id,
  rotulo,
  dica,
  valor,
  padrao,
  onMudar,
}: {
  id: string;
  rotulo: string;
  dica: string;
  valor: number | null;
  padrao: number;
  onMudar: (v: number | null) => void;
}) {
  const ligado = valor !== null;
  return (
    <div className="flex flex-col gap-2">
      <Marcador
        id={`${id}-ligado`}
        rotulo={rotulo}
        checked={ligado}
        onChange={(e) => onMudar(e.target.checked ? padrao : null)}
      />
      {ligado && (
        <CampoQuantidade
          id={id}
          rotulo="Horas antes do horário"
          dica={dica}
          min={1}
          max={72}
          valor={valor}
          onMudar={(v) => onMudar(v ?? 1)}
        />
      )}
    </div>
  );
}

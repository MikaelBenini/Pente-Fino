'use client';

import {
  AUTOMACOES_PADRAO,
  NOME_AUTOMACAO,
  type AutomacoesConta,
  type EstadoAutomacoes,
} from '@pente-fino/shared';
import { Botao, CampoQuantidade, Marcador } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { Estado, Tabela, td, th } from '../pagina';

const chave = ['bot', 'automacoes'] as const;
const pct = (parte: number, total: number) =>
  total === 0 ? '—' : `${Math.round((parte / total) * 100)}%`;

/**
 * Bot → Automações: o dono liga o convite de retorno e o parabéns (começam desligados) e
 * todos veem quantas mensagens saíram, quantas tiveram resposta e quantos horários geraram.
 */
export function Automacoes({ podeEditar }: { podeEditar: boolean }) {
  const estado = useQuery({
    queryKey: chave,
    queryFn: () => api<EstadoAutomacoes>('bot/automacoes'),
  });
  return (
    <Estado consulta={estado}>
      {() => (
        <div className="flex flex-col gap-8">
          <Configurar inicial={estado.data!.config} podeEditar={podeEditar} />
          <Numeros numeros={estado.data!.numeros} />
        </div>
      )}
    </Estado>
  );
}

function Configurar({ inicial, podeEditar }: { inicial: AutomacoesConta; podeEditar: boolean }) {
  const [f, setF] = useState<AutomacoesConta>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const salvar = useAcao(
    (corpo: AutomacoesConta) => api('bot/automacoes', { metodo: 'PUT', corpo }),
    [chave],
  );
  const mudar = <K extends keyof AutomacoesConta>(k: K, v: AutomacoesConta[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSalvo(false);
  };
  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        try {
          await salvar.mutateAsync(f);
          setSalvo(true);
        } catch (er) {
          setErro(er instanceof ErroApi ? er.message : 'Não foi possível salvar.');
        }
      }}
    >
      <p className="text-tinta-suave">
        Todo dia às 10 h, pelo WhatsApp da unidade onde o cliente veio por último. Só para quem
        aceitou receber mensagens e já conversou com a barbearia, e no máximo 20 por número por dia.
        Os textos ficam em “Mensagens prontas”.
      </p>
      <div className="flex flex-col gap-2">
        <Marcador
          id="automacao-retorno"
          rotulo="Convidar para voltar quem passou do tempo de costume"
          checked={f.retorno}
          disabled={!podeEditar}
          onChange={(e) => mudar('retorno', e.target.checked)}
        />
        <p className="text-sm text-tinta-suave">
          O tempo de costume sai do histórico de cada cliente (o intervalo entre as últimas
          visitas). Um convite por ciclo: só de novo depois de outra visita. Quem já tem horário
          marcado não recebe.
        </p>
        {f.retorno && (
          <CampoQuantidade
            id="automacao-retorno-dias"
            rotulo="Para quem veio uma vez só, convidar depois de (dias)"
            min={14}
            max={120}
            passo={5}
            valor={f.retornoDiasPadrao}
            onMudar={(v) => mudar('retornoDiasPadrao', v ?? AUTOMACOES_PADRAO.retornoDiasPadrao)}
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Marcador
          id="automacao-aniversario"
          rotulo="Mandar parabéns no aniversário"
          checked={f.aniversario}
          disabled={!podeEditar}
          onChange={(e) => mudar('aniversario', e.target.checked)}
        />
        <p className="text-sm text-tinta-suave">
          Para quem tem a data de aniversário no cadastro. Uma vez por ano.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Marcador
          id="automacao-clube"
          rotulo="Avisar o assinante do clube 3 dias antes de renovar"
          checked={f.avisoClube}
          disabled={!podeEditar}
          onChange={(e) => mudar('avisoClube', e.target.checked)}
        />
        <p className="text-sm text-tinta-suave">
          Com o valor, a data e o Pix copia e cola (se a chave estiver cadastrada em Clube). Um
          aviso por mês.
        </p>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {salvo && <p className="text-sm text-acao-texto">Automações salvas.</p>}
      {podeEditar ? (
        <Botao type="submit" className="self-start" carregando={salvar.isPending}>
          Salvar automações
        </Botao>
      ) : (
        <p className="text-sm text-tinta-suave">Só o dono liga e desliga as automações.</p>
      )}
    </form>
  );
}

function Numeros({ numeros }: { numeros: EstadoAutomacoes['numeros'] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-numeros-automacoes">
      <div>
        <h2 id="titulo-numeros-automacoes" className="text-xl font-semibold">
          Resultado no mês
        </h2>
        <p className="text-tinta-suave">
          “Responderam” é quem escreveu de volta em até 48 h; “Marcaram” é quem marcou horário em
          até 7 dias.
        </p>
      </div>
      <Tabela rotulo="Resultado das automações no mês">
        <thead className="bg-superficie-2">
          <tr>
            <th className={th}>Automação</th>
            <th className={`${th} text-right`}>Enviadas</th>
            <th className={`${th} text-right`}>Responderam</th>
            <th className={`${th} text-right`}>Marcaram</th>
          </tr>
        </thead>
        <tbody>
          {numeros.map((n) => (
            <tr key={n.automacao} className="border-t border-borda">
              <th scope="row" className={`${td} font-medium`}>
                {NOME_AUTOMACAO[n.automacao]}
              </th>
              <td className={`${td} text-right font-denso tabular-nums`}>{n.enviadas}</td>
              <td className={`${td} text-right font-denso tabular-nums`}>
                {n.respondidas}{' '}
                <span className="text-sm text-tinta-suave">({pct(n.respondidas, n.enviadas)})</span>
              </td>
              <td className={`${td} text-right font-denso tabular-nums`}>
                {n.agendamentos}{' '}
                <span className="text-sm text-tinta-suave">
                  ({pct(n.agendamentos, n.enviadas)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </section>
  );
}

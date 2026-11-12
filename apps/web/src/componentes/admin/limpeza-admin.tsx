// Saúde do sistema: o que a rotina diária de limpeza (Etapa 15.4) apagou em cada execução e as
// contas retidas por terem cobrança ativa no Asaas.
import {
  DIAS_GUARDA,
  formatarData,
  formatarDataHora,
  NOME_TIPO_LIMPEZA,
  TIPOS_LIMPEZA,
  type ExecucaoLimpezaNaTela,
} from '@pente-fino/shared';
import { Aviso } from '../aviso';
import { Tabela, td, th } from '../pagina';

export function LimpezaNaSaude({ execucoes }: { execucoes: ExecucaoLimpezaNaTela[] }) {
  const ultima = execucoes[0];
  return (
    <section aria-labelledby="titulo-limpeza" className="flex flex-col gap-2">
      <h2 id="titulo-limpeza" className="text-lg font-semibold">
        Limpeza de dados
      </h2>
      <p className="text-sm text-tinta-suave">
        Todo dia às 3h30: conversas do bot, logins vencidos, avisos lidos e filas com mais de{' '}
        {DIAS_GUARDA} dias saem; contas sem confirmar o e-mail saem em 7 dias e contas paradas em 90
        (com aviso por e-mail antes). Comandas, caixa e auditoria ficam.
      </p>
      <p className="text-sm">
        <strong>Conta parada</strong> é só a cancelada ou a de teste que venceu sem nenhum
        pagamento. Conta que paga e conta em cortesia <strong>nunca</strong> são apagadas.
      </p>
      {!ultima ? (
        <p className="text-sm text-tinta-suave">A rotina ainda não rodou.</p>
      ) : (
        <>
          {ultima.erro && <Aviso tom="erro">Última execução com erro: {ultima.erro}</Aviso>}
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">Saem nos próximos 7 dias</h3>
            {(ultima.proximas ?? []).length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhuma conta.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm" aria-label="Contas que saem em 7 dias">
                {ultima.proximas.map((c) => (
                  <li
                    key={c.contaId}
                    className="flex flex-wrap justify-between gap-x-3 border-b border-borda py-1"
                  >
                    <span>
                      {c.conta} ·{' '}
                      {c.motivo === 'sem_confirmar' ? 'e-mail sem confirmar' : 'conta parada'}
                      {c.retencao && (
                        <span className="block text-aviso-texto">Retida: {c.retencao}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-tinta-suave">
                      em {formatarData(`${c.apagaEm}T12:00:00Z`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {ultima.retidas.length > 0 && (
            <Aviso tom="erro">
              Contas no prazo de saída, mas com cobrança ativa no Asaas (cancele lá; a rotina tenta
              de novo amanhã): {ultima.retidas.map((r) => `${r.conta} — ${r.motivo}`).join('; ')}
            </Aviso>
          )}
          <Tabela rotulo="Execuções da limpeza">
            <thead>
              <tr className="border-b border-borda">
                <th scope="col" className={th}>
                  O que saiu
                </th>
                {execucoes.map((e) => (
                  <th key={e.iniciadaEm} scope="col" className={`${th} tabular-nums`}>
                    {formatarDataHora(e.iniciadaEm)}
                    {!e.terminadaEm && ' (rodando)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIPOS_LIMPEZA.map((t) => (
                <tr key={t} className="border-b border-borda">
                  <th scope="row" className={`${td} font-normal`}>
                    {NOME_TIPO_LIMPEZA[t]}
                  </th>
                  {execucoes.map((e) => (
                    <td key={e.iniciadaEm} className={`${td} tabular-nums`}>
                      {e.apagados[t] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Tabela>
        </>
      )}
    </section>
  );
}

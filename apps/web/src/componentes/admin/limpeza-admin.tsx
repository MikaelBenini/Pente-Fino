// Saúde do sistema: o que a rotina diária de limpeza (Etapa 15.4) apagou em cada execução e as
// contas retidas por terem cobrança ativa no Asaas.
import {
  DIAS_GUARDA,
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
      {!ultima ? (
        <p className="text-sm text-tinta-suave">A rotina ainda não rodou.</p>
      ) : (
        <>
          {ultima.erro && <Aviso tom="erro">Última execução com erro: {ultima.erro}</Aviso>}
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

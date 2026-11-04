import { incluiRecurso, NOME_PLANO, PLANOS, RECURSOS_PLANO } from '@pente-fino/shared';
import { Check, Minus } from 'lucide-react';

const LIMITES = [
  { nome: 'Unidades', valores: ['1', '1', 'Ilimitadas'] },
  { nome: 'Profissionais', valores: ['Até 3', 'Até 10', 'Ilimitados'] },
] as const;

/** Tabela de recursos por plano. O que ainda está em construção aparece como "em breve". */
export function ComparativoPlanos() {
  return (
    <div className="overflow-x-auto rounded-xl border border-borda">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <caption className="sr-only">Recursos de cada plano</caption>
        <thead className="bg-superficie-2">
          <tr>
            <th scope="col" className="p-3 font-semibold sm:p-4">
              Recurso
            </th>
            {PLANOS.map((p) => (
              <th
                key={p}
                scope="col"
                className="w-[18%] p-3 text-center font-denso text-lg font-bold uppercase sm:p-4"
              >
                {NOME_PLANO[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {LIMITES.map((l) => (
            <tr key={l.nome}>
              <th scope="row" className="p-3 font-medium sm:p-4">
                {l.nome}
              </th>
              {l.valores.map((v, i) => (
                <td key={PLANOS[i]} className="p-3 text-center tabular-nums sm:p-4">
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {RECURSOS_PLANO.map((r) => (
            <tr key={r.nome}>
              <th scope="row" className="p-3 font-normal sm:p-4">
                {r.nome}
                {!r.disponivel && (
                  <span className="ml-2 inline-block rounded-sm bg-superficie-3 px-1.5 text-xs font-semibold tracking-wide text-aviso-texto uppercase">
                    Em breve
                  </span>
                )}
              </th>
              {PLANOS.map((p) => (
                <td key={p} className="p-3 text-center sm:p-4">
                  {incluiRecurso(p, r) ? (
                    <Check
                      role="img"
                      aria-label={r.disponivel ? 'Incluído' : 'Incluído quando lançar'}
                      className="mx-auto size-5 text-acao-texto"
                    />
                  ) : (
                    <Minus
                      role="img"
                      aria-label="Não incluído"
                      className="mx-auto size-5 text-tinta-fraca"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

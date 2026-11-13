'use client';

// Admin F9: resultado de cada cupom. Contas que usaram, quantas pagam, a receita das faturas
// pagas, o desconto concedido e o uso por mês de cadastro (6 meses).
import { formatarMoeda, type ResultadoDoCupom } from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { Estado, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';

const NOME_MES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Barrinhas do uso por mês (o mais alto ocupa a altura toda). */
function UsoPorMes({ porMes }: { porMes: ResultadoDoCupom['porMes'] }) {
  const maior = Math.max(1, ...porMes.map((m) => m.contas));
  const texto = porMes
    .map((m) => `${NOME_MES[Number(m.mes.slice(5, 7)) - 1]}: ${m.contas}`)
    .join(', ');
  return (
    <span
      role="img"
      aria-label={`Cadastros por mês: ${texto}`}
      className="flex h-8 items-end gap-1"
    >
      {porMes.map((m) => (
        <span
          key={m.mes}
          title={`${NOME_MES[Number(m.mes.slice(5, 7)) - 1]}: ${m.contas}`}
          className="w-3 rounded-sm bg-modulo"
          style={{
            height: `${Math.max(8, (m.contas / maior) * 100)}%`,
            opacity: m.contas ? 1 : 0.25,
          }}
        />
      ))}
    </span>
  );
}

export function ResultadoCupons() {
  const q = useQuery({
    queryKey: ['admin', 'cupons', 'relatorio'],
    queryFn: () => adminApi<ResultadoDoCupom[]>('configuracoes/cupons/relatorio'),
  });
  return (
    <Estado consulta={q}>
      {() =>
        q.data!.length === 0 ? null : (
          <Tabela rotulo="Resultado dos cupons">
            <thead>
              <tr className="border-b border-borda">
                {[
                  'Cupom',
                  'Contas',
                  'Pagantes',
                  'Receita',
                  'Desconto concedido',
                  'Uso (6 meses)',
                ].map((c) => (
                  <th key={c} scope="col" className={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data!.map((r) => (
                <tr key={r.codigo} className="border-b border-borda">
                  <th scope="row" className={`${td} font-semibold`}>
                    {r.codigo}
                  </th>
                  <td className={`${td} tabular-nums`}>{r.contas}</td>
                  <td className={`${td} tabular-nums`}>{r.pagantes}</td>
                  <td className={`${td} tabular-nums`}>{formatarMoeda(r.receita)}</td>
                  <td className={`${td} tabular-nums text-tinta-suave`}>
                    {formatarMoeda(r.desconto)}
                  </td>
                  <td className={td}>
                    <UsoPorMes porMes={r.porMes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )
      }
    </Estado>
  );
}

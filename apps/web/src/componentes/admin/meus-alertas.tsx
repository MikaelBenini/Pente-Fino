'use client';

// Admin F3: cada pessoa da equipe escolhe os alertas que recebe por e-mail. A rotina do worker
// confere de hora em hora e manda um e-mail só com o que ela marcou.
import {
  ALERTAS_EQUIPE,
  TIPOS_ALERTA_EQUIPE,
  type AlertasDaEquipeEntrada,
  type TipoAlertaEquipe,
} from '@pente-fino/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Estado } from '../pagina';
import { adminApi } from './admin-api';

export function MeusAlertas() {
  const cliente = useQueryClient();
  const chave = ['admin', 'eu', 'alertas'];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => adminApi<AlertasDaEquipeEntrada>('eu/alertas'),
  });
  const [aviso, setAviso] = useState<string | null>(null);

  async function trocar(tipo: TipoAlertaEquipe, ligado: boolean) {
    const atuais = q.data?.alertas ?? [];
    const alertas = ligado ? [...atuais, tipo] : atuais.filter((t) => t !== tipo);
    cliente.setQueryData(chave, { alertas });
    try {
      await adminApi('eu/alertas', { metodo: 'PUT', corpo: { alertas } });
      setAviso('Alertas salvos.');
    } catch {
      setAviso('Não deu para salvar. Tente de novo.');
      await cliente.invalidateQueries({ queryKey: chave });
    }
  }

  return (
    <section aria-labelledby="titulo-meus-alertas" className="flex flex-col gap-3">
      <div>
        <h2 id="titulo-meus-alertas" className="text-2xl font-semibold">
          Meus alertas por e-mail
        </h2>
        <p className="text-sm text-tinta-suave">
          Conferidos de hora em hora. Cada alerta chega uma vez só.
        </p>
      </div>
      <Estado consulta={q}>
        {() => (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Alertas que eu recebo</legend>
            {TIPOS_ALERTA_EQUIPE.map((t) => (
              <label
                key={t}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-borda bg-superficie p-3"
              >
                <input
                  type="checkbox"
                  checked={q.data!.alertas.includes(t)}
                  onChange={(e) => void trocar(t, e.target.checked)}
                  className="mt-1 size-4 accent-modulo"
                />
                <span>
                  <span className="block font-medium">{ALERTAS_EQUIPE[t].nome}</span>
                  <span className="block text-sm text-tinta-suave">{ALERTAS_EQUIPE[t].quando}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </Estado>
      <p role="status" className="text-sm text-tinta-suave">
        {aviso}
      </p>
    </section>
  );
}

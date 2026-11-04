'use client';

import { formatarTelefone } from '@pente-fino/shared';
import { Botao, Campo, cn } from '@pente-fino/ui';
import { Check, UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useClientes } from '@/lib/consultas';

export type ClienteEscolhido =
  | { clienteId: string; nome: string }
  | { clienteNovo: { nome: string; telefone?: string }; nome: string };

/** Busca por nome ou telefone; se não achar, cadastra na hora. */
export function BuscaCliente({
  id,
  valor,
  onEscolher,
}: {
  id: string;
  valor: ClienteEscolhido | null;
  onEscolher: (c: ClienteEscolhido | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const [telefone, setTelefone] = useState('');
  const termo = useDeferredValue(busca.trim());
  const clientes = useClientes(termo.length >= 2 ? termo : '');

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-borda bg-superficie-2 px-3 py-2">
        <span className="flex items-center gap-2 font-semibold">
          <Check aria-hidden className="size-4 text-acao-texto" /> {valor.nome}
          {'clienteNovo' in valor && (
            <span className="text-sm font-normal text-tinta-suave">(novo)</span>
          )}
        </span>
        <Botao variante="fantasma" onClick={() => onEscolher(null)}>
          Trocar
        </Botao>
      </div>
    );
  }

  if (novo) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-borda p-3">
        <Campo
          id={`${id}-novo-nome`}
          rotulo="Nome do cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Campo
          id={`${id}-novo-telefone`}
          rotulo="WhatsApp (opcional)"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            disabled={busca.trim().length < 2}
            onClick={() =>
              onEscolher({
                clienteNovo: { nome: busca.trim(), telefone: telefone || undefined },
                nome: busca.trim(),
              })
            }
          >
            Usar este cliente
          </Botao>
          <Botao variante="fantasma" onClick={() => setNovo(false)}>
            Voltar à busca
          </Botao>
        </div>
      </div>
    );
  }

  const lista = termo.length >= 2 ? (clientes.data ?? []) : [];
  return (
    <div className="flex flex-col gap-2">
      <Campo
        id={`${id}-busca`}
        rotulo="Cliente"
        placeholder="Nome ou telefone"
        autoComplete="off"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {lista.length > 0 && (
        <ul className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-borda">
          {lista.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onEscolher({ clienteId: c.id, nome: c.nome })}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left hover:bg-superficie-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
                )}
              >
                <span className="font-medium">{c.nome}</span>
                {c.telefone && (
                  <span className="font-denso text-sm tabular-nums text-tinta-suave">
                    {formatarTelefone(c.telefone)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {termo.length >= 2 && !clientes.isFetching && lista.length === 0 && (
        <p className="text-sm text-tinta-suave">Nenhum cliente encontrado.</p>
      )}
      <Botao variante="fantasma" className="self-start" onClick={() => setNovo(true)}>
        <UserPlus aria-hidden className="size-4" /> Cadastrar cliente novo
      </Botao>
    </div>
  );
}

/** O que a API espera: cliente existente ou dados do novo. */
export function clienteParaApi(c: ClienteEscolhido) {
  return 'clienteId' in c ? { clienteId: c.clienteId } : { clienteNovo: c.clienteNovo };
}

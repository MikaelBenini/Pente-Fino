'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Botao } from './botao.js';

export interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** O que vai acontecer, com os números que importam (ex.: o total da comanda). */
  descricao: ReactNode;
  textoConfirmar: string;
  tom?: 'acao' | 'perigo';
  /** Pede um motivo (alterar comanda fechada, cancelar). Mínimo de 5 caracteres. */
  exigirMotivo?: boolean;
  carregando?: boolean;
  onConfirmar: (motivo?: string) => void;
  onCancelar: () => void;
}

/** Confirmação que não deixa perder dinheiro: diz o que vai acontecer e, se preciso, pede motivo. */
export function ModalConfirmacao({
  aberto,
  titulo,
  descricao,
  textoConfirmar,
  tom = 'acao',
  exigirMotivo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}: ModalConfirmacaoProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState('');
  const id = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const motivoValido = !exigirMotivo || motivo.trim().length >= 5;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-borda bg-superficie p-0 text-tinta backdrop:bg-black/70"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (motivoValido) onConfirmar(exigirMotivo ? motivo.trim() : undefined);
        }}
      >
        <h2 id={`${id}-titulo`} className="text-xl font-semibold text-balance">
          {titulo}
        </h2>
        <div className="text-tinta-suave">{descricao}</div>
        {exigirMotivo && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-motivo`} className="text-sm font-medium">
              Motivo (fica registrado)
            </label>
            <textarea
              id={`${id}-motivo`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
              minLength={5}
              className="rounded-md border border-borda bg-fundo px-3 py-2 text-base text-tinta focus-visible:outline-2 focus-visible:outline-foco"
            />
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={onCancelar} disabled={carregando}>
            Voltar
          </Botao>
          <Botao type="submit" variante={tom} carregando={carregando} disabled={!motivoValido}>
            {textoConfirmar}
          </Botao>
        </div>
      </form>
    </dialog>
  );
}

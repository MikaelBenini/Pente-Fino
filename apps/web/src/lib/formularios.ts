import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErroApi } from './api';

/**
 * Leva o erro da API para o formulário: campos inválidos vão para cada campo;
 * o resto vira a mensagem geral (devolvida para a tela mostrar).
 */
export function aplicarErroDaApi<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (erro instanceof ErroApi) {
    for (const c of erro.campos) setError(c.campo as Path<T>, { message: c.mensagem });
    return erro.campos.length > 0 ? null : erro.message;
  }
  return 'Não foi possível concluir. Tente de novo.';
}

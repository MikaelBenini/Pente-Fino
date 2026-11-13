// Admin F5: na sessão de suporte, todo telefone e WhatsApp de cliente sai escondido em qualquer
// resposta (o suporte vê o que o dono vê, menos o contato das pessoas).
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { Contexto } from '../comum/contexto.js';

export const CONTATO_OCULTO = 'oculto no modo suporte';
const CAMPOS = /^(telefone|whatsapp|celular|telefoneCliente|whatsappCliente)$/i;

/** Copia o valor trocando os campos de contato (com texto) por CONTATO_OCULTO. */
export function ocultarContato(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ocultarContato);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [
        k,
        CAMPOS.test(k) && typeof v === 'string' && v ? CONTATO_OCULTO : ocultarContato(v),
      ]),
    );
  }
  return valor;
}

@Injectable()
export class OcultarContatoInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!Contexto.atual()?.usuario?.suporte) return next.handle();
    return next.handle().pipe(map(ocultarContato));
  }
}

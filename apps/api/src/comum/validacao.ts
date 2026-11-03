// Validação com os esquemas zod do packages/shared. O mesmo esquema documenta a rota no OpenAPI.
import { Body, type PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import { Erros } from './erros.js';

export class PipeZod<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly esquema: S) {}

  transform(valor: unknown): z.output<S> {
    const r = this.esquema.safeParse(valor ?? {});
    if (r.success) return r.data;
    throw Erros.validacao(
      r.error.issues.map((i) => ({ campo: i.path.join('.') || '(corpo)', mensagem: i.message })),
    );
  }
}

/** Tipo do esquema OpenAPI aceito pelo @nestjs/swagger (o pacote não exporta o nome). */
type SchemaObject = NonNullable<
  Extract<Parameters<typeof ApiBody>[0], { schema?: unknown }>['schema']
>;

function paraOpenApi(esquema: z.ZodType): SchemaObject {
  return z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' }) as SchemaObject;
}

/** Corpo validado por zod e documentado no OpenAPI: `@Corpo(loginSchema) dados: LoginEntrada`. */
export function Corpo(esquema: z.ZodType): ParameterDecorator {
  return (alvo, chave, indice) => {
    Body(new PipeZod(esquema))(alvo, chave, indice);
    if (chave === undefined) return;
    const descritor = Object.getOwnPropertyDescriptor(alvo, chave);
    if (descritor) ApiBody({ schema: paraOpenApi(esquema) })(alvo, chave, descritor);
  };
}

/** Query string validada por zod. */
export function Consulta(esquema: z.ZodObject): ParameterDecorator {
  return (alvo, chave, indice) => {
    Query(new PipeZod(esquema))(alvo, chave, indice);
    if (chave === undefined) return;
    const descritor = Object.getOwnPropertyDescriptor(alvo, chave);
    if (!descritor) return;
    for (const [nome, campo] of Object.entries(esquema.shape)) {
      ApiQuery({
        name: nome,
        required: !(campo as z.ZodType).safeParse(undefined).success,
        schema: paraOpenApi(campo as z.ZodType),
      })(alvo, chave, descritor);
    }
  };
}

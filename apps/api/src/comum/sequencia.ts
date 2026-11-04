/**
 * Como Promise.all, mas uma consulta de cada vez. Dentro de uma transação a conexão é
 * uma só e o driver pg não aceita consultas simultâneas. Serve para consultas do
 * Prisma, que só começam a rodar no await; para funções async, use um laço.
 */
export async function emSequencia<T extends readonly unknown[] | []>(
  valores: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const r: unknown[] = [];
  for (const v of valores) r.push(await v);
  return r as { -readonly [P in keyof T]: Awaited<T[P]> };
}

/** Aplica fn a cada item, um de cada vez (transação aberta). */
export async function umPorVez<E, S>(
  itens: readonly E[],
  fn: (item: E) => Promise<S>,
): Promise<S[]> {
  const r: S[] = [];
  for (const i of itens) r.push(await fn(i));
  return r;
}

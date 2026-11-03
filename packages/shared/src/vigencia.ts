// Preço e regra de comissão valem a partir de uma data (vigência).
// Mudar o preço hoje nunca altera o passado: a consulta pega a maior vigência até a data.

/** Data sem hora no formato AAAA-MM-DD (dia local da unidade). */
export type DataISO = string;

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function exigirData(nome: string, data: DataISO): void {
  if (!FORMATO_DATA.test(data)) {
    throw new RangeError(`${nome} deve estar no formato AAAA-MM-DD (recebido: ${data})`);
  }
}

/**
 * Escolhe o registro vigente numa data: o de maior `vigenciaInicio` que não passa da data.
 * Devolve `undefined` se nada estava vigente ainda.
 */
export function selecionarVigente<T extends { vigenciaInicio: DataISO }>(
  registros: readonly T[],
  data: DataISO,
): T | undefined {
  exigirData('data', data);
  let escolhido: T | undefined;
  for (const registro of registros) {
    exigirData('vigenciaInicio', registro.vigenciaInicio);
    if (registro.vigenciaInicio > data) continue;
    if (!escolhido || registro.vigenciaInicio > escolhido.vigenciaInicio) escolhido = registro;
  }
  return escolhido;
}

// O adaptador do Prisma para o pg (@prisma/adapter-pg) manda consultas de um mesmo
// `include` em paralelo dentro da transação. O pg 8 avisa que isso deixará de ser aceito
// no pg 9; enquanto o Prisma não muda, o aviso só polui o terminal (nosso código usa
// `emSequencia`). Este filtro cala só essa frase; qualquer outro aviso continua saindo.
const AVISO_PG = 'when the client is already executing a query';

let instalado = false;

export function silenciarAvisoDoPgNoPrisma(): void {
  if (instalado) return;
  instalado = true;
  const original = process.emitWarning.bind(process) as (...args: unknown[]) => void;
  process.emitWarning = ((aviso: unknown, ...resto: unknown[]) => {
    const texto = typeof aviso === 'string' ? aviso : aviso instanceof Error ? aviso.message : '';
    if (texto.includes(AVISO_PG)) return;
    original(aviso, ...resto);
  }) as typeof process.emitWarning;
}

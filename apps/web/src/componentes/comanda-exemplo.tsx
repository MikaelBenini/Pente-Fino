import { formatarMoeda } from '@pente-fino/shared';

// Uma comanda de verdade mostra a proposta melhor que um slogan: entrou R$ 70,
// sobrou R$ 35. Mesmos números da conta de demonstração (Corte + Barba, 45%).
const ITENS = [
  { rotulo: 'Corte + Barba', valor: 7000 },
  { rotulo: 'Produto usado', valor: -350 },
  { rotulo: 'Comissão do barbeiro (45%)', valor: -3150 },
];
const SOBRA = ITENS.reduce((s, i) => s + i.valor, 0);

export function ComandaExemplo() {
  return (
    <figure
      aria-label="Exemplo de comanda: entrou R$ 70,00 e sobrou R$ 35,00"
      className="w-full max-w-sm rotate-[-1.5deg] border-x border-borda bg-superficie font-denso text-tinta shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]"
    >
      <div
        aria-hidden
        className="h-2 bg-[radial-gradient(circle_at_6px_0,transparent_5px,var(--superficie)_5.5px)] bg-[length:12px_8px] [background-color:var(--fundo)]"
      />
      <div className="flex flex-col gap-3 px-6 pt-4 pb-6">
        <div className="flex items-center justify-between text-sm uppercase tracking-widest text-tinta-suave">
          <span>Comanda 0412 · Centro</span>
          <span className="rounded-sm bg-superficie-3 px-1.5 text-tinta">Fechada</span>
        </div>
        <ul className="flex flex-col gap-1.5 border-b border-dashed border-borda-forte pb-3 text-lg tabular-nums">
          {ITENS.map((i) => (
            <li key={i.rotulo} className="flex justify-between gap-4">
              <span className={i.valor < 0 ? 'text-tinta-suave' : undefined}>{i.rotulo}</span>
              <span className={i.valor < 0 ? 'text-tinta-suave' : undefined}>
                {formatarMoeda(i.valor)}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between gap-4">
          <span className="text-lg font-semibold uppercase tracking-wide">Sobra para a casa</span>
          <span className="text-3xl font-bold tabular-nums text-modulo-texto">
            {formatarMoeda(SOBRA)}
          </span>
        </p>
      </div>
    </figure>
  );
}

import { CalculadoraSobra } from '@/componentes/site/calculadora-sobra';
import { metadadosCalculadora, PaginaCalculadora } from '@/componentes/site/pagina-calculadora';

const caminho = '/calculadora/lucro-por-corte';
export const metadata = metadadosCalculadora(
  'Calculadora de lucro por corte de cabelo',
  'Calculadora grátis: ponha o preço do corte, a comissão e o produto e veja quanto sobra para a barbearia em cada corte e no mês.',
  caminho,
);

export default function Pagina() {
  return (
    <PaginaCalculadora
      caminho={caminho}
      nome="Lucro por corte"
      h1="Quanto sobra de cada corte?"
      intro="O corte custa R$ 45, mas não é isso que fica na barbearia. Ponha o preço, a comissão do barbeiro e o produto usado e veja quanto sobra em cada corte e no mês, antes das despesas fixas."
      formula={[
        'Comissão = preço × percentual de comissão.',
        'Sobra do corte = preço − comissão − produto usado.',
        'Sobra do mês = sobra do corte × cortes no mês. Dela ainda saem aluguel, luz e as outras despesas fixas.',
      ]}
      exemplo="Corte de R$ 60 com 45% de comissão (R$ 27) e R$ 3,50 de produto: sobram R$ 29,50 por corte. Com 400 cortes no mês, são R$ 11.800 para pagar as despesas fixas e dar lucro."
    >
      <CalculadoraSobra />
    </PaginaCalculadora>
  );
}

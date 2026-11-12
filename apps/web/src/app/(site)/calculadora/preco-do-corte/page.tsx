import { CalculadoraPreco } from '@/componentes/site/calculadoras-extras';
import { metadadosCalculadora, PaginaCalculadora } from '@/componentes/site/pagina-calculadora';

const caminho = '/calculadora/preco-do-corte';
export const metadata = metadadosCalculadora(
  'Quanto cobrar pelo corte: calculadora de preço mínimo',
  'Calculadora grátis do preço mínimo do corte de cabelo: custos fixos, cortes no mês, comissão, produto e a margem que você quer.',
  caminho,
);

export default function Pagina() {
  return (
    <PaginaCalculadora
      caminho={caminho}
      nome="Preço do corte"
      h1="Quanto cobrar pelo corte?"
      intro="O preço mínimo é o que paga a comissão, o produto, a parte de cada corte nos custos fixos e ainda deixa a margem que você quer. Cobrar abaixo disso é trabalhar de graça."
      formula={[
        'Custo fixo por corte = custos fixos do mês ÷ cortes no mês.',
        'O que sobra do preço depois da comissão e da margem = 100% − comissão − margem.',
        'Preço mínimo = (produto + custo fixo por corte) ÷ o que sobra.',
      ]}
      exemplo="R$ 6.000 de custos fixos e 400 cortes no mês dão R$ 15 de custo fixo por corte. Com R$ 3,50 de produto, 45% de comissão e 20% de margem, sobram 35% do preço para pagar R$ 18,50: o preço mínimo é R$ 52,86."
    >
      <CalculadoraPreco />
    </PaginaCalculadora>
  );
}

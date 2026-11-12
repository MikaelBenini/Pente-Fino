import { CalculadoraComissao } from '@/componentes/site/calculadoras-extras';
import { metadadosCalculadora, PaginaCalculadora } from '@/componentes/site/pagina-calculadora';

const caminho = '/calculadora/comissao-de-barbeiro';
export const metadata = metadadosCalculadora(
  'Calculadora de comissão de barbeiro',
  'Calculadora grátis de comissão de barbeiro: preço, percentual e produto usado, sobre o valor cheio ou descontando o produto. Veja quanto fica para o barbeiro e para a casa.',
  caminho,
);

export default function Pagina() {
  return (
    <PaginaCalculadora
      caminho={caminho}
      nome="Comissão de barbeiro"
      h1="Calculadora de comissão de barbeiro"
      intro="Quanto o barbeiro recebe e quanto fica para a casa em cada serviço. Compare a comissão sobre o preço cheio com a comissão calculada depois de descontar o produto usado."
      formula={[
        'Base da comissão = preço do serviço, ou preço − produto usado (se você desconta o produto antes).',
        'Comissão do barbeiro = base × percentual.',
        'Fica para a casa = preço − comissão − produto.',
      ]}
      exemplo="Serviço de R$ 50 com 40% de comissão e R$ 5 de produto. Sobre o preço cheio, o barbeiro recebe R$ 20 e a casa fica com R$ 25. Descontando o produto antes, a base é R$ 45: o barbeiro recebe R$ 18 e a casa, R$ 27."
    >
      <CalculadoraComissao />
    </PaginaCalculadora>
  );
}

import { DIAS_TESTE, NOME_PLANO, PLANOS, precoPorMes } from '@pente-fino/shared';
import type { Metadata } from 'next';
import { CartoesPlanos } from '@/componentes/site/cartoes-planos';
import { ComparativoPlanos } from '@/componentes/site/comparativo-planos';
import { LinkBotao } from '@/componentes/site/link-botao';
import { type Pergunta, Perguntas } from '@/componentes/site/perguntas';
import { URL_SITE } from '@/lib/site';
import { OfertaLancamento } from '@/componentes/site/oferta-lancamento';

export const metadata: Metadata = {
  title: 'Planos e preços',
  description: `Básico, Pro e Premium a partir de R$ 66,90/mês no anual. ${DIAS_TESTE} dias grátis, sem cartão e sem fidelidade.`,
  alternates: { canonical: '/planos' },
};

const PERGUNTAS: readonly Pergunta[] = [
  {
    pergunta: 'Preciso de cartão para testar?',
    resposta: `Não. São ${DIAS_TESTE} dias com tudo do plano escolhido. No fim do teste você decide se assina; nada é cobrado sozinho.`,
  },
  {
    pergunta: 'Tem fidelidade ou multa para cancelar?',
    resposta:
      'Não. No mensal, você cancela quando quiser e usa até o fim do mês pago. No anual, o valor é cobrado de uma vez com o desconto de dois meses.',
  },
  {
    pergunta: 'Posso trocar de plano depois?',
    resposta:
      'Pode, para cima ou para baixo, falando com o suporte. Para descer, a conta precisa caber no limite do plano novo (unidades e profissionais ativos).',
  },
  {
    pergunta: 'O que conta como profissional?',
    resposta:
      'Cada barbeiro ativo que atende na agenda. Dono, gestor e recepção não contam no limite.',
  },
  {
    pergunta: 'O bot de WhatsApp cobra por mensagem?',
    resposta:
      'Não. Ele usa o WhatsApp da própria barbearia, conectado por QR Code, e responde com menus que você mesmo programa. Não usa inteligência artificial. O bot está em construção e chega para os planos Pro e Premium sem custo extra.',
  },
  {
    pergunta: 'E os meus dados se eu sair?',
    resposta:
      'São seus. O dono exporta clientes, comandas e despesas em planilha a qualquer momento. Depois de cancelar, os dados ficam guardados por 90 dias para você pedir a exportação; então são apagados.',
  },
  {
    pergunta: 'Já uso uma planilha. Perco o histórico?',
    resposta:
      'Não. A configuração guiada importa clientes, serviços e preços da sua planilha antes do primeiro atendimento.',
  },
];

function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Pente Fino',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android, iOS',
    url: `${URL_SITE}/planos`,
    offers: PLANOS.map((p) => ({
      '@type': 'Offer',
      name: `Plano ${NOME_PLANO[p]}`,
      price: (precoPorMes(p, 'mensal') / 100).toFixed(2),
      priceCurrency: 'BRL',
      url: `${URL_SITE}/cadastro?plano=${p}`,
    })),
  };
}

export default function Pagina() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON montado aqui, sem dado de usuário; "<" escapado para não fechar o <script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }}
      />
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
            Planos e preços
          </p>
          <h1 className="font-denso text-5xl leading-[0.95] font-bold uppercase sm:text-6xl">
            Um preço por barbearia, não por cadeira vazia
          </h1>
          <p className="text-lg text-tinta-suave">
            {DIAS_TESTE} dias grátis com tudo do plano. Sem cartão, sem fidelidade, sem taxa de
            implantação.
          </p>
        </div>
        <CartoesPlanos />
      </section>

      <OfertaLancamento />

      <section
        aria-labelledby="comparativo"
        className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6"
      >
        <h2 id="comparativo" className="font-denso text-4xl font-bold uppercase">
          O que vem em cada plano
        </h2>
        <div className="revelar">
          <ComparativoPlanos />
        </div>
        <p className="text-sm text-tinta-suave">
          “Em breve” é recurso em construção: entra no plano indicado sem aumento de preço quando
          for lançado.
        </p>
      </section>

      <section
        aria-labelledby="duvidas"
        className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 sm:px-6"
      >
        <h2 id="duvidas" className="font-denso text-4xl font-bold uppercase">
          Dúvidas sobre os planos
        </h2>
        <Perguntas itens={PERGUNTAS} />
      </section>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pb-20 text-center sm:px-6">
        <h2 className="font-denso text-4xl font-bold uppercase">Comece hoje, decida depois</h2>
        <LinkBotao href="/cadastro" grande>
          Criar conta grátis
        </LinkBotao>
      </section>
    </>
  );
}

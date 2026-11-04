import { DIAS_TESTE, formatarMoeda } from '@pente-fino/shared';
import {
  CalendarCheck,
  ClipboardCheck,
  HandCoins,
  LineChart,
  Smartphone,
  Store,
  UserCog,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ComandaExemplo } from '@/componentes/comanda-exemplo';
import { CartoesPlanos } from '@/componentes/site/cartoes-planos';
import { LinkBotao } from '@/componentes/site/link-botao';
import { type Pergunta, Perguntas } from '@/componentes/site/perguntas';
import { URL_SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: 'Pente Fino · Gestão de barbearia que mostra o lucro real' },
  description:
    'Agenda, comanda, caixa, comissão e lucro por serviço, barbeiro e unidade. O barbeiro lança no celular, a recepção fecha, o dono vê quanto sobrou.',
  alternates: { canonical: '/' },
};

const PASSOS = [
  {
    icone: CalendarCheck,
    titulo: 'Agendou, a comanda existe',
    texto: 'Pelo balcão ou pelo link de agendamento, o horário marcado já abre a comanda prevista.',
  },
  {
    icone: Smartphone,
    titulo: 'O barbeiro lança no celular',
    texto: 'Inclui barba, sobrancelha ou pomada e confirma. Funciona mesmo sem internet.',
  },
  {
    icone: ClipboardCheck,
    titulo: 'A recepção fecha',
    texto: 'Confere, recebe em uma ou mais formas de pagamento e o caixa do dia bate sozinho.',
  },
  {
    icone: LineChart,
    titulo: 'O dono vê o que sobrou',
    texto: 'Faturamento, comissão, despesas e lucro por serviço, sem planilha no fim do mês.',
  },
] as const;

const PAPEIS = [
  {
    icone: UserCog,
    titulo: 'Dono',
    texto: 'Lucro real, projeção do mês, metas e despesas. Reabre comanda com motivo registrado.',
  },
  {
    icone: Store,
    titulo: 'Recepção',
    texto: 'Agenda do dia, fechamento rápido e caixa com divergência apontada na hora.',
  },
  {
    icone: Users,
    titulo: 'Barbeiro',
    texto:
      'Só os próprios atendimentos e a própria comissão. Telefone do cliente pode ficar oculto.',
  },
] as const;

// Números de exemplo (fictícios) para ilustrar o painel do dono.
const PAINEL = {
  faturamento: 3_842_000,
  comissoes: 1_652_000,
  produtos: 118_000,
  despesas: 905_000,
  projecao: 5_380_000,
};
const LUCRO = PAINEL.faturamento - PAINEL.comissoes - PAINEL.produtos - PAINEL.despesas;

const SERVICOS = [
  { nome: 'Corte', preco: 4500, sobra: 2350 },
  { nome: 'Barba', preco: 3500, sobra: 1720 },
  { nome: 'Corte + Barba', preco: 7000, sobra: 3500 },
  { nome: 'Pigmentação', preco: 6000, sobra: 2100 },
] as const;

const DIFERENCIAIS = [
  {
    titulo: 'Lançamento único',
    texto:
      'Ninguém digita o mesmo atendimento duas vezes. A comanda nasce na agenda e vai até o caixa.',
  },
  {
    titulo: 'O passado não muda',
    texto:
      'Preço e comissão têm vigência. Aumentou o corte hoje? As comandas de ontem continuam certas.',
  },
  {
    titulo: 'Conta que fecha',
    texto:
      'Retirada do dono, investimento e cartão ficam fora do % de despesas operacionais. Sobra é sobra.',
  },
  {
    titulo: 'Seus dados, sua barbearia',
    texto:
      'Cada barbearia isolada no banco de dados, exportação em planilha quando quiser e LGPD desde o início.',
  },
] as const;

const PERGUNTAS: readonly Pergunta[] = [
  {
    pergunta: 'Funciona no celular?',
    resposta:
      'Sim. O painel abre no computador ou no celular, e o app do barbeiro pode ser instalado na tela inicial, sem loja de aplicativos.',
  },
  {
    pergunta: 'Quanto tempo leva para começar?',
    resposta:
      'A configuração guiada pede unidade, serviços, preços e equipe, e importa sua planilha de clientes. Dá para atender no mesmo dia.',
  },
  {
    pergunta: 'O cliente consegue agendar sozinho?',
    resposta:
      'Sim, pelo link de agendamento da unidade. Ele escolhe serviço, barbeiro e horário livre; a comanda já fica prevista.',
  },
  {
    pergunta: 'Tem inteligência artificial respondendo meus clientes?',
    resposta:
      'Não. O bot de WhatsApp (em construção) responde só com menus e palavras-chave que você programa. Nada é inventado.',
  },
];

function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Pente Fino',
    url: URL_SITE,
    logo: `${URL_SITE}/icones/icone-512.png`,
  };
}

export default function Pagina() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }}
      />

      {/* Abertura: a promessa e a prova (uma comanda que mostra a sobra). */}
      <section className="border-b border-borda bg-[linear-gradient(160deg,var(--superficie-2),var(--fundo)_60%)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div className="flex flex-col items-start gap-6">
            <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
              Gestão de barbearia
            </p>
            <h1 className="font-denso text-5xl leading-[0.92] font-bold uppercase sm:text-7xl">
              Saiba quanto sobra, <span className="text-modulo-texto">não só quanto entrou.</span>
            </h1>
            <p className="max-w-xl text-lg text-tinta-suave">
              Agenda, comanda, caixa e comissão num lugar só. O barbeiro lança uma vez, a recepção
              fecha e você vê o lucro real por serviço, por barbeiro e por unidade.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <LinkBotao href="/cadastro" grande>
                Testar {DIAS_TESTE} dias grátis
              </LinkBotao>
              <LinkBotao href="/planos" variante="contorno" grande>
                Ver planos e preços
              </LinkBotao>
            </div>
            <p className="text-sm text-tinta-suave">Sem cartão de crédito. Sem fidelidade.</p>
          </div>
          <div className="flex justify-center md:justify-end">
            <ComandaExemplo />
          </div>
        </div>
      </section>

      <section aria-labelledby="como" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2
          id="como"
          className="mb-10 max-w-2xl font-denso text-4xl font-bold uppercase sm:text-5xl"
        >
          Do agendamento ao lucro, sem digitar duas vezes
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-borda bg-borda sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex flex-col gap-3 bg-superficie p-6">
              <span className="flex items-center justify-between">
                <p.icone aria-hidden className="size-7 text-modulo-texto" />
                <span className="font-denso text-4xl font-bold text-tinta-fraca tabular-nums">
                  {i + 1}
                </span>
              </span>
              <h3 className="text-xl font-semibold">{p.titulo}</h3>
              <p className="text-tinta-suave">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Painel do dono com números de exemplo. */}
      <section aria-labelledby="painel" className="border-y border-borda bg-superficie">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.2fr] md:py-24">
          <div className="flex flex-col gap-4">
            <h2 id="painel" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
              O mês inteiro numa tela
            </h2>
            <p className="text-lg text-tinta-suave">
              Faturamento só de comanda fechada, comissão calculada item a item e despesas separadas
              do que é investimento ou retirada. A projeção usa o calendário da sua unidade, não 30
              dias genéricos.
            </p>
            <Link
              href="/cadastro"
              className="font-semibold text-acao-texto underline underline-offset-4"
            >
              Ver com os dados da minha barbearia
            </Link>
          </div>
          <figure className="flex flex-col gap-4 rounded-xl border border-borda bg-fundo p-5 sm:p-6">
            <figcaption className="flex items-center justify-between text-sm text-tinta-suave">
              <span className="font-semibold text-tinta">Resultado do mês · Centro</span>
              <span className="rounded-sm bg-superficie-3 px-1.5">Exemplo fictício</span>
            </figcaption>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Faturamento', PAINEL.faturamento],
                ['Projeção do mês', PAINEL.projecao],
                ['Comissões', PAINEL.comissoes],
                ['Despesas operacionais', PAINEL.despesas],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-lg bg-superficie p-3">
                  <dt className="text-sm text-tinta-suave">{rotulo}</dt>
                  <dd className="font-denso text-2xl font-bold tabular-nums">
                    {formatarMoeda(valor as number)}
                  </dd>
                </div>
              ))}
              <div className="col-span-2 rounded-lg border border-modulo/40 bg-superficie p-3">
                <dt className="text-sm text-tinta-suave">Sobrou até hoje</dt>
                <dd className="font-denso text-4xl font-bold text-modulo-texto tabular-nums">
                  {formatarMoeda(LUCRO)}
                </dd>
              </div>
            </dl>
            <table className="w-full text-left">
              <caption className="mb-2 text-left text-sm font-semibold">
                Quanto sobra de cada serviço
              </caption>
              <thead className="text-sm text-tinta-suave">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Serviço
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Preço
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Sobra
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda tabular-nums">
                {SERVICOS.map((s) => (
                  <tr key={s.nome}>
                    <th scope="row" className="py-2 font-normal">
                      {s.nome}
                    </th>
                    <td className="py-2 text-right text-tinta-suave">{formatarMoeda(s.preco)}</td>
                    <td className="py-2 text-right font-semibold">{formatarMoeda(s.sobra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </div>
      </section>

      <section aria-labelledby="papeis" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 id="papeis" className="mb-10 font-denso text-4xl font-bold uppercase sm:text-5xl">
          Cada um vê o que precisa
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PAPEIS.map((p) => (
            <li key={p.titulo} className="flex flex-col gap-3 rounded-xl border border-borda p-6">
              <p.icone aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="text-xl font-semibold">{p.titulo}</h3>
              <p className="text-tinta-suave">{p.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="diferenciais" className="border-y border-borda bg-superficie">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2
            id="diferenciais"
            className="mb-10 flex items-center gap-3 font-denso text-4xl font-bold uppercase sm:text-5xl"
          >
            <HandCoins aria-hidden className="size-9 text-modulo-texto" />
            Feito para a conta fechar
          </h2>
          <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {DIFERENCIAIS.map((d) => (
              <div key={d.titulo} className="border-l-2 border-modulo pl-4">
                <dt className="text-xl font-semibold">{d.titulo}</dt>
                <dd className="mt-1 text-tinta-suave">{d.texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="precos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mb-10 flex flex-col gap-3 text-center">
          <h2 id="precos" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
            Planos para cada tamanho de barbearia
          </h2>
          <p className="text-tinta-suave">
            <Link href="/planos" className="text-tinta underline underline-offset-4">
              Compare tudo o que vem em cada plano
            </Link>
          </p>
        </div>
        <CartoesPlanos compacto />
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <h2 id="faq" className="mb-6 font-denso text-4xl font-bold uppercase">
          Perguntas frequentes
        </h2>
        <Perguntas itens={PERGUNTAS} />
      </section>

      <section className="border-t border-borda bg-[linear-gradient(200deg,var(--superficie-2),var(--fundo)_60%)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-3xl font-denso text-5xl leading-[0.95] font-bold uppercase">
            Este mês você vai saber quanto sobrou
          </h2>
          <p className="text-lg text-tinta-suave">
            {DIAS_TESTE} dias grátis, configuração guiada e importação da sua planilha.
          </p>
          <LinkBotao href="/cadastro" grande>
            Criar conta grátis
          </LinkBotao>
        </div>
      </section>
    </>
  );
}

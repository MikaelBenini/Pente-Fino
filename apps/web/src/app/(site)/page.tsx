import {
  DIAS_TESTE,
  LUCRO_POR_SERVICO_NO_PRO,
  textoEconomiaAnual,
  type PlanoConta,
  type Recurso,
} from '@pente-fino/shared';
import {
  BellRing,
  Building2,
  CalendarCheck,
  Check,
  ClipboardCheck,
  Crown,
  FileSpreadsheet,
  ListOrdered,
  MessageCircle,
  Minus,
  Printer,
  ShieldCheck,
  Smartphone,
  Star,
  Store,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ComandaExemplo } from '@/componentes/comanda-exemplo';
import { CalculadoraSobra } from '@/componentes/site/calculadora-sobra';
import { CartoesPlanos } from '@/componentes/site/cartoes-planos';
import { BotaoVideo } from '@/componentes/site/botao-video';
import { Depoimentos } from '@/componentes/site/depoimentos';
import {
  BotaoTesteOferta,
  LinkCadastro,
  OfertaLancamento,
} from '@/componentes/site/oferta-lancamento';
import { SeloPlano } from '@/componentes/site/selo-plano';
import { type Pergunta, Perguntas } from '@/componentes/site/perguntas';
import { VideoApresentacao } from '@/componentes/site/video-apresentacao';
import { Celular, ConversaWhatsapp, Janela, TELAS, Vitrine } from '@/componentes/site/vitrine';
import { ofertasJsonLd, URL_SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: 'Pente Fino · Gestão de barbearia que mostra o lucro real' },
  description:
    'Agenda, comanda, caixa, comissão e WhatsApp num lugar só. O barbeiro lança no celular, a recepção fecha e você vê quanto sobrou por serviço, barbeiro e unidade. 14 dias grátis.',
  alternates: { canonical: '/' },
};

const SELOS = [
  `${DIAS_TESTE} dias grátis, sem cartão`,
  'WhatsApp no Pro e no Premium, sem custo por mensagem',
  'Sem cobrança por barbeiro',
  'Funciona no celular, sem baixar app',
] as const;

/** Perto de cada botão de teste (briefing do site, C5): só o que o produto já cumpre. */
const IMPLANTACAO = 'Configuração guiada · atende no mesmo dia · importamos sua planilha';

const ANTES = [
  'Comanda de papel que some ou chega rasgada no caixa',
  'A recepção digita tudo de novo na planilha à noite',
  'Agenda num app, caixa em outro, comissão na calculadora',
  'Faturamento bonito e nenhuma ideia de quanto sobrou',
] as const;
const DEPOIS = [
  'O horário marcado já vira comanda; o barbeiro só completa',
  'Lançou uma vez: entra no caixa, na comissão e no lucro',
  'Agenda, caixa, comissão e WhatsApp na mesma tela',
  'Lucro do mês e de cada serviço, sem planilha',
] as const;

const EXTRAS: {
  icone: typeof BellRing;
  titulo: string;
  texto: string;
  recurso?: Recurso;
  plano?: PlanoConta;
}[] = [
  {
    icone: BellRing,
    titulo: 'Lembretes automáticos',
    texto: '24 h e 2 h antes, com confirmação.',
    recurso: 'bot',
  },
  {
    icone: ListOrdered,
    titulo: 'Lista de espera',
    texto: 'Vagou? O bot oferece na ordem.',
    recurso: 'listaEspera',
  },
  {
    icone: Star,
    titulo: 'Avaliação no WhatsApp',
    texto: 'Nota baixa avisa você na hora.',
    recurso: 'avaliacoes',
  },
  {
    icone: Crown,
    titulo: 'Clube de assinatura',
    texto: 'A comanda reconhece o assinante.',
    recurso: 'clube',
  },
  { icone: Wallet, titulo: 'Caixa do dia', texto: 'Divergência apontada no fechamento.' },
  {
    icone: Building2,
    titulo: 'Várias unidades',
    texto: 'Unidades lado a lado e preço por unidade.',
    recurso: 'rede',
  },
  { icone: Printer, titulo: 'Comanda impressa', texto: 'PDF com QR code, 4 ou 6 por folha.' },
  { icone: FileSpreadsheet, titulo: 'Relatório do contador', texto: 'Planilha e PDF do mês.' },
];

type Celula = boolean | 'parcial';
const COMPARATIVO: {
  recurso: string;
  nos: Celula;
  agenda: Celula;
  planilha: Celula;
  /** No Pente Fino, depende do plano. */
  plano?: Recurso;
}[] = [
  {
    recurso: 'Agenda online e link para o cliente marcar',
    nos: true,
    agenda: true,
    planilha: false,
  },
  {
    recurso: 'Bot de WhatsApp que agenda, incluso no plano',
    nos: true,
    plano: 'bot',
    agenda: 'parcial',
    planilha: false,
  },
  {
    recurso: 'Comanda criada pelo agendamento (lança uma vez)',
    nos: true,
    agenda: false,
    planilha: false,
  },
  {
    recurso: 'Comissão calculada item a item, com vigência',
    nos: true,
    plano: 'comissoes',
    agenda: 'parcial',
    planilha: 'parcial',
  },
  {
    recurso: 'Lucro do mês e margem de cada serviço e produto',
    nos: true,
    plano: 'lucroReal',
    agenda: false,
    planilha: 'parcial',
  },
  {
    recurso: 'Preço novo não muda o que já foi vendido',
    nos: true,
    agenda: 'parcial',
    planilha: false,
  },
  {
    recurso: 'Barbeiro vê só a própria comissão, no celular',
    nos: true,
    plano: 'comissoes',
    agenda: 'parcial',
    planilha: false,
  },
  { recurso: 'Sem cobrança extra por barbeiro', nos: true, agenda: false, planilha: true },
];

const PAPEIS: {
  icone: typeof UserCog;
  titulo: string;
  pergunta: string;
  itens: { texto: string; recurso?: Recurso }[];
}[] = [
  {
    icone: UserCog,
    titulo: 'Dono',
    pergunta: 'Quanto sobrou?',
    itens: [
      { texto: 'Lucro do mês e projeção' },
      { texto: 'Margem por serviço e produto', recurso: 'lucroReal' },
      { texto: 'Metas e resultados do mês', recurso: 'metas' },
    ],
  },
  {
    icone: Store,
    titulo: 'Recepção',
    pergunta: 'Quem é o próximo?',
    itens: [
      { texto: 'Agenda de todos e encaixes' },
      { texto: 'Fechamento em segundos' },
      { texto: 'Caixa do dia que bate' },
    ],
  },
  {
    icone: Users,
    titulo: 'Barbeiro',
    pergunta: 'Quanto ganhei hoje?',
    itens: [
      { texto: 'Agenda e comandas no celular' },
      { texto: 'Comissão em tempo real', recurso: 'comissoes' },
      { texto: 'Só os próprios dados' },
    ],
  },
];

const PERGUNTAS: readonly Pergunta[] = [
  {
    pergunta: 'Preciso instalar alguma coisa?',
    resposta:
      'Não. Abre no navegador do computador ou do celular. O barbeiro pode pôr o app na tela inicial do celular, sem loja de aplicativos.',
  },
  {
    pergunta: 'Quanto tempo leva para começar?',
    resposta:
      'A configuração guiada pede unidade, serviços, preços e equipe e importa sua planilha de clientes. Dá para atender no mesmo dia.',
  },
  {
    pergunta: 'O bot de WhatsApp usa inteligência artificial?',
    resposta:
      'Não. Ele responde com o menu e as palavras-chave que você escreve, agenda, remarca e cancela pela conversa e chama alguém da equipe quando o cliente pede. Nada é inventado, e não há custo por mensagem.',
  },
  {
    pergunta: 'Cobram por barbeiro?',
    resposta:
      'Não. O limite de profissionais muda de plano para plano, mas não existe valor por cabeça. No Premium, os profissionais são ilimitados.',
  },
  {
    pergunta: 'E se eu quiser cancelar?',
    resposta:
      'Cancela quando quiser, sem multa. Os dados continuam disponíveis para consulta e você exporta tudo em planilha.',
  },
  {
    pergunta: 'Meus dados ficam seguros?',
    resposta:
      'Cada barbearia fica isolada no banco de dados, com acesso por papel, auditoria das alterações, backup diário criptografado e LGPD desde o início.',
  },
];

function jsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Pente Fino',
      url: URL_SITE,
      logo: `${URL_SITE}/icones/icone-512.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Pente Fino',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      url: URL_SITE,
      offers: ofertasJsonLd(),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: PERGUNTAS.map((p) => ({
        '@type': 'Question',
        name: p.pergunta,
        acceptedAnswer: { '@type': 'Answer', text: p.resposta },
      })),
    },
  ];
}

const Sobretitulo = ({ children }: { children: React.ReactNode }) => (
  <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
    {children}
  </p>
);

function Marca({ valor }: { valor: Celula }) {
  if (valor === true)
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-acao/15 text-acao-texto">
        <Check aria-hidden className="size-4" />
        <span className="sr-only">Sim</span>
      </span>
    );
  if (valor === 'parcial')
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-superficie-3 text-tinta-suave">
        <Minus aria-hidden className="size-4" />
        <span className="sr-only">Em parte ou pago à parte</span>
      </span>
    );
  return (
    <span className="inline-flex size-7 items-center justify-center text-tinta-fraca">
      <X aria-hidden className="size-4" />
      <span className="sr-only">Não</span>
    </span>
  );
}

export default function Pagina() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }}
      />

      {/* Abertura: a promessa e o produto de verdade. */}
      <section className="relative overflow-hidden border-b border-borda">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_20%,color-mix(in_oklch,var(--modulo)_14%,transparent),transparent_70%),radial-gradient(40%_40%_at_10%_90%,color-mix(in_oklch,var(--acao)_10%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1fr_1.15fr]">
          <div className="animar-escalonado flex flex-col items-start gap-6">
            <Sobretitulo>Gestão de barbearia</Sobretitulo>
            <h1 className="font-denso text-5xl leading-[0.92] font-bold uppercase sm:text-7xl">
              Saiba quanto sobra, <span className="text-modulo-texto">não só quanto entrou.</span>
            </h1>
            <p className="max-w-xl text-lg text-tinta-suave">
              {LUCRO_POR_SERVICO_NO_PRO
                ? 'Agenda, comanda, caixa, comissão e WhatsApp num lugar só. O barbeiro lança uma vez no celular, a recepção fecha e você vê o lucro real por serviço, por barbeiro e por unidade.'
                : 'Agenda, comanda, caixa, comissão e WhatsApp num lugar só. O barbeiro lança uma vez no celular, a recepção fecha e você vê quanto sobrou no mês. No Premium, o lucro real por serviço, por barbeiro e por unidade.'}
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <LinkCadastro grande>Testar {DIAS_TESTE} dias grátis</LinkCadastro>
              <BotaoVideo>Ver em 1 minuto</BotaoVideo>
            </div>
            <p className="text-sm text-tinta-suave">{IMPLANTACAO}</p>
            <ul className="grid gap-x-6 gap-y-2 text-sm text-tinta-suave sm:grid-cols-2">
              {SELOS.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <Check aria-hidden className="size-4 shrink-0 text-acao-texto" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <Vitrine />
        </div>
      </section>

      {/* O problema que a planilha não resolve. */}
      <section aria-labelledby="problema" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mb-12 grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="flex max-w-3xl flex-col gap-3">
            <Sobretitulo>Faturamento não é lucro</Sobretitulo>
            <h2 id="problema" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
              Entrou bastante. E quanto ficou?
            </h2>
            <p className="text-lg text-tinta-suave">
              A maioria dos sistemas mostra a agenda cheia e o faturamento do mês. O que paga as
              contas é o que sobra depois da comissão, do produto e das despesas.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <ComandaExemplo />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="revelar rounded-2xl border border-borda bg-superficie p-6">
            <h3 className="mb-4 text-lg font-semibold text-tinta-suave">Hoje, sem o Pente Fino</h3>
            <ul className="flex flex-col gap-3">
              {ANTES.map((t) => (
                <li key={t} className="flex gap-3">
                  <X aria-hidden className="mt-0.5 size-5 shrink-0 text-perigo-texto" />
                  <span className="text-tinta-suave">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="revelar rounded-2xl border border-modulo/40 bg-superficie p-6 shadow-[0_0_60px_-30px_var(--modulo)]">
            <h3 className="mb-4 text-lg font-semibold">Com o Pente Fino</h3>
            <ul className="flex flex-col gap-3">
              {DEPOIS.map((t) => (
                <li key={t} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-acao-texto" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* O sistema funcionando, em 1 minuto. */}
      <section aria-labelledby="video" className="scroll-mt-24 border-y border-borda bg-superficie">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-8 flex flex-col items-start gap-3">
            <Sobretitulo>Ver em 1 minuto</Sobretitulo>
            <h2
              id="video"
              className="max-w-3xl font-denso text-4xl font-bold uppercase sm:text-5xl"
            >
              Do horário marcado ao lucro do mês
            </h2>
            <p className="max-w-2xl text-lg text-tinta-suave">
              O barbeiro lança no celular, a recepção fecha, você vê quanto sobrou e o cliente marca
              sozinho pelo WhatsApp. Tudo na mesma comanda.
            </p>
          </div>
          <VideoApresentacao />
        </div>
      </section>

      {/* Recursos, com as telas de verdade. */}
      <section aria-labelledby="recursos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mb-12 flex max-w-3xl flex-col gap-3">
          <Sobretitulo>Tudo num lugar só</Sobretitulo>
          <h2 id="recursos" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
            Do balcão ao lucro, sem digitar duas vezes
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <article className="revelar flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 lg:col-span-7">
            <div className="flex flex-col gap-2">
              <CalendarCheck aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="text-2xl font-semibold">A comanda nasce na agenda</h3>
              <p className="text-tinta-suave">
                Marcou pelo balcão, pelo link ou pelo WhatsApp: o horário já abre a comanda
                prevista, com cliente, barbeiro e serviços. Arraste para remarcar e avise o cliente
                com um toque.
              </p>
            </div>
            <Janela
              tela={TELAS.agenda}
              alt="Agenda do dia com os barbeiros em colunas e os horários de cada um"
            />
          </article>

          <article className="revelar flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 lg:col-span-5">
            <div className="flex flex-col gap-2">
              <Smartphone aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="text-2xl font-semibold">O barbeiro lança no celular</h3>
              <p className="text-tinta-suave">
                Barba, sobrancelha ou pomada em um toque e confirma. A recepção já vê pronta para
                receber, e ele acompanha a própria comissão em tempo real{' '}
                <SeloPlano recurso="comissoes" />
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <Celular
                tela={TELAS.celularComanda}
                alt="Comanda no celular com os extras para lançar"
                className="w-[46%]"
              />
              <Celular
                tela={TELAS.celularDesempenho}
                alt="Desempenho do barbeiro no celular"
                className="mt-10 w-[46%]"
              />
            </div>
          </article>

          <article className="revelar flex flex-col gap-5 rounded-2xl border border-modulo/40 bg-superficie p-6 lg:col-span-12 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex flex-col gap-3 lg:w-[38%]">
              <ClipboardCheck aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
                O que dá lucro, e o que só dá trabalho <SeloPlano recurso="lucroReal" />
              </h3>
              <p className="text-tinta-suave">
                Lucro e margem de cada serviço e produto, com o que fazer: investir, divulgar ou
                rever o preço. Comissão e custo de produto já descontados, item a item.
              </p>
              <p className="text-tinta-suave">
                Mudou o preço do corte? As comandas de ontem continuam certas: preço e comissão têm
                vigência.
              </p>
            </div>
            <Janela
              tela={TELAS.lucroProdutos}
              alt="Métricas de outubro: lucro e margem por serviço e por produto, com as situações Investir, Divulgar e Rever preço"
              className="lg:flex-1"
            />
          </article>

          <article className="revelar flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 lg:col-span-5">
            <div className="flex flex-col gap-2">
              <MessageCircle aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
                WhatsApp que agenda sozinho <SeloPlano recurso="bot" />
              </h3>
              <p className="text-tinta-suave">
                O cliente marca, soma serviços, remarca e cancela pela conversa, 24 horas. Sem
                inteligência artificial inventando resposta e sem custo por mensagem.
              </p>
            </div>
            <ConversaWhatsapp />
          </article>

          <article className="revelar flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 lg:col-span-7">
            <div className="flex flex-col gap-2">
              <ShieldCheck aria-hidden className="size-7 text-modulo-texto" />
              <h3 className="text-2xl font-semibold">O mês inteiro numa tela</h3>
              <p className="text-tinta-suave">
                Faturamento só de comanda fechada, lucro, clientes, ticket médio, % de extras e
                despesas sobre o faturamento, comparados com o mês anterior. A projeção usa o
                calendário da sua unidade, não 30 dias genéricos.
              </p>
            </div>
            <Janela
              tela={TELAS.metas}
              alt="Métricas e metas de outubro: faturamento, lucro, clientes, ticket médio, atendimentos e extras"
            />
          </article>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXTRAS.map((e) => (
            <li
              key={e.titulo}
              className="revelar flex items-start gap-3 rounded-xl border border-borda bg-superficie p-4"
            >
              <e.icone aria-hidden className="mt-0.5 size-5 shrink-0 text-modulo-texto" />
              <span>
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {e.titulo} <SeloPlano recurso={e.recurso} plano={e.plano} />
                </span>
                <span className="text-sm text-tinta-suave">{e.texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <ChamadaTeste />
      </section>

      {/* A conta que o sistema faz sozinho. */}
      <section
        aria-labelledby="calculadora"
        className="border-y border-borda bg-[linear-gradient(180deg,var(--superficie-2),var(--fundo))]"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-10 flex max-w-3xl flex-col gap-3">
            <Sobretitulo>Faça a conta</Sobretitulo>
            <h2 id="calculadora" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
              Quanto sobra de cada corte?
            </h2>
            <p className="text-lg text-tinta-suave">
              Ponha os números da sua barbearia. É a mesma conta que o Pente Fino faz em cada
              comanda, sem você abrir a calculadora.
            </p>
          </div>
          <CalculadoraSobra />
          <ChamadaTeste />
        </div>
      </section>

      {/* Comparação honesta, sem citar marcas. */}
      <section
        aria-labelledby="comparativo"
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24"
      >
        <div className="mb-10 flex flex-col gap-3">
          <Sobretitulo>Por que o Pente Fino</Sobretitulo>
          <h2 id="comparativo" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
            Mais que uma agenda bonita
          </h2>
        </div>
        <div className="revelar overflow-x-auto rounded-2xl border border-borda">
          <table className="w-full min-w-[36rem] text-left">
            <caption className="sr-only">
              Comparação entre o Pente Fino, um app de agenda comum e a planilha
            </caption>
            <thead className="bg-superficie text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium text-tinta-suave">
                  Recurso
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center font-denso text-base font-bold text-modulo-texto uppercase"
                >
                  Pente Fino
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium text-tinta-suave">
                  App de agenda comum
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium text-tinta-suave">
                  Planilha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {COMPARATIVO.map((l) => (
                <tr key={l.recurso}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    {l.recurso}
                  </th>
                  <td className="bg-modulo/5 px-4 py-3 text-center">
                    <span className="inline-flex flex-col items-center gap-1">
                      <Marca valor={l.nos} />
                      {l.plano && <SeloPlano recurso={l.plano} />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Marca valor={l.agenda} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Marca valor={l.planilha} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-tinta-suave">
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-full bg-superficie-3"
          >
            <Minus className="size-3.5" />
          </span>
          Em parte, depende do plano ou é pago à parte. No Pente Fino, o selo mostra o plano.
        </p>
      </section>

      {/* Cada papel, a sua pergunta. */}
      <section aria-labelledby="papeis" className="border-y border-borda bg-superficie">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 id="papeis" className="mb-10 font-denso text-4xl font-bold uppercase sm:text-5xl">
            Cada um vê o que precisa
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {PAPEIS.map((p) => (
              <li
                key={p.titulo}
                className="revelar flex flex-col gap-4 rounded-2xl border border-borda bg-fundo p-6"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-modulo/10">
                    <p.icone aria-hidden className="size-6 text-modulo-texto" />
                  </span>
                  <span>
                    <span className="block text-xl font-semibold">{p.titulo}</span>
                    <span className="text-sm text-tinta-suave">“{p.pergunta}”</span>
                  </span>
                </span>
                <ul className="flex flex-col gap-2">
                  {p.itens.map((i) => (
                    <li
                      key={i.texto}
                      className="flex flex-wrap items-center gap-2 text-tinta-suave"
                    >
                      <Check aria-hidden className="size-4 shrink-0 text-acao-texto" />
                      {i.texto}
                      <SeloPlano recurso={i.recurso} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Depoimentos />

      <section aria-labelledby="precos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Sobretitulo>Planos</Sobretitulo>
          <h2 id="precos" className="font-denso text-4xl font-bold uppercase sm:text-5xl">
            Preço justo, sem cobrar por barbeiro
          </h2>
          <p className="max-w-2xl text-tinta-suave">
            WhatsApp incluso no Pro e no Premium, sem custo por mensagem. No anual,{' '}
            {textoEconomiaAnual()}.{' '}
            <Link href="/planos" className="text-tinta underline underline-offset-4">
              Compare tudo o que vem em cada plano
            </Link>
          </p>
        </div>
        <div className="revelar">
          <CartoesPlanos compacto />
        </div>
      </section>
      <OfertaLancamento />

      <section aria-labelledby="faq" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <h2 id="faq" className="mb-6 font-denso text-4xl font-bold uppercase">
          Perguntas frequentes
        </h2>
        <Perguntas itens={PERGUNTAS} />
      </section>

      <section className="relative overflow-hidden border-t border-borda">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_100%,color-mix(in_oklch,var(--modulo)_16%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 md:py-28">
          <h2 className="max-w-3xl font-denso text-5xl leading-[0.95] font-bold uppercase sm:text-6xl">
            Este mês você vai saber <span className="text-modulo-texto">quanto sobrou</span>
          </h2>
          <p className="max-w-xl text-lg text-tinta-suave">
            {DIAS_TESTE} dias grátis, sem cartão. Configuração guiada e importação da sua planilha:
            dá para atender no mesmo dia.
          </p>
          <LinkCadastro grande>Criar conta grátis</LinkCadastro>
        </div>
      </section>
    </>
  );
}

/** Chamada no fim dos blocos longos (briefing do site, C6). */
function ChamadaTeste() {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 text-center">
      <BotaoTesteOferta extra="origem=meio-da-pagina" />
      <p className="text-sm text-tinta-suave">{IMPLANTACAO}</p>
    </div>
  );
}

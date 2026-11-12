// Site N2: comparação justa com um concorrente (ou com todos), só com fatos conferidos na página
// oficial de cada um, com a data e o link. Os preços do Pente Fino saem da tabela de planos.
import {
  DIAS_TESTE,
  formatarMoeda,
  LIMITES_PLANO,
  NOME_PLANO,
  PLANOS,
  precoPorMes,
} from '@pente-fino/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CONCORRENTES, CONFERIDO_EM, type Concorrente, PENTE_FINO } from '@/conteudo/comparativos';
import { LinkCadastro } from './oferta-lancamento';
import { TrilhaGoogle } from './trilha-google';

const EQUIPES = [1, 3, 5] as const;

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Plano mais barato do Pente Fino que cabe a equipe, com o preço mensal. */
function penteFinoPara(n: number) {
  const plano = PLANOS.find((p) => LIMITES_PLANO[p].profissionais >= n) ?? 'premium';
  return `${formatarMoeda(precoPorMes(plano, 'mensal'))} (${NOME_PLANO[plano]})`;
}

export function metadadosComparativo(titulo: string, descricao: string, caminho: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: { title: titulo, description: descricao, url: caminho },
  };
}

const Cabecalho = ({ sobre, titulo, texto }: { sobre: string; titulo: string; texto: string }) => (
  <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
    <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
      {sobre}
    </p>
    <h1 className="font-denso text-4xl leading-[0.95] font-bold uppercase sm:text-6xl">{titulo}</h1>
    <p className="max-w-3xl text-lg text-tinta-suave">{texto}</p>
  </section>
);

function Tabela({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: readonly string[];
  linhas: readonly (readonly string[])[];
}) {
  return (
    // Site D4: no celular a tabela rola para o lado; a área recebe foco para rolar pelo teclado.
    <div
      role="region"
      aria-label={`${legenda}, role para o lado`}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-borda focus-visible:outline-2 focus-visible:outline-foco"
    >
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead className="bg-superficie-2">
          <tr>
            {colunas.map((c, i) => (
              <th key={c} scope="col" className={`px-4 py-3 font-semibold ${i ? '' : 'w-44'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {linhas.map(([rotulo, ...valores]) => (
            <tr key={rotulo}>
              <th scope="row" className="px-4 py-3 align-top font-medium">
                {rotulo}
              </th>
              {valores.map((v, i) => (
                <td key={i} className="px-4 py-3 align-top text-tinta-suave">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fontes({ itens }: { itens: readonly Concorrente[] }) {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-10 text-sm text-tinta-suave sm:px-6">
      <h2 className="mb-2 font-semibold text-tinta">Fontes</h2>
      <p className="mb-2">
        Conferido em {dataBr(CONFERIDO_EM)} nas páginas oficiais. Preço e plano mudam: confira
        sempre na fonte. “Não citado” quer dizer que a página de preços não fala do assunto. As
        marcas citadas pertencem aos seus donos.
      </p>
      <ul className="flex flex-col gap-1">
        {itens.map((c) => (
          <li key={c.slug}>
            {c.nome}:{' '}
            <a href={c.fonte} rel="nofollow noopener" className="underline underline-offset-4">
              {c.fonte}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chamada() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pb-16 text-center sm:px-6">
      <h2 className="font-denso text-4xl font-bold uppercase">Teste e compare você mesmo</h2>
      <p className="text-tinta-suave">{DIAS_TESTE} dias grátis, sem cartão e sem fidelidade.</p>
      <LinkCadastro grande>Criar conta grátis</LinkCadastro>
    </section>
  );
}

function OutrosComparativos({ atual }: { atual?: string }) {
  const links = [
    ...CONCORRENTES.filter((c) => c.slug !== atual).map((c) => ({
      href: `/comparativo/${c.slug}`,
      rotulo: `Pente Fino ou ${c.nome}`,
    })),
    ...(atual
      ? [{ href: '/melhor-sistema-para-barbearia', rotulo: 'Como escolher o sistema' }]
      : []),
  ];
  return (
    <nav
      aria-label="Outras comparações"
      className="mx-auto max-w-6xl border-t border-borda px-4 py-10 sm:px-6"
    >
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-9 items-center text-tinta underline underline-offset-4"
            >
              {l.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const Lista = ({ titulo, itens }: { titulo: string; itens: readonly string[] }) => (
  <div className="flex flex-col gap-3">
    <h2 className="font-denso text-3xl font-bold uppercase">{titulo}</h2>
    <ul className="flex list-disc flex-col gap-2 pl-5 text-tinta-suave">
      {itens.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  </div>
);

/** /comparativo/<slug>: Pente Fino ou um concorrente. */
export function PaginaComparativo({ c }: { c: Concorrente }) {
  const caminho = `/comparativo/${c.slug}`;
  return (
    <>
      <TrilhaGoogle pagina={`Pente Fino ou ${c.nome}`} caminho={caminho} />
      <Cabecalho
        sobre="Comparação"
        titulo={`Pente Fino ou ${c.nome}?`}
        texto={`Os dois organizam a agenda da barbearia. A diferença está no que cada um mostra depois do atendimento e em como cobra. Aqui vai o que cada página oficial diz, com o que o ${c.nome} faz melhor.`}
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-12 px-4 pb-14 sm:px-6">
        <section className="flex flex-col gap-4" aria-labelledby="lado-a-lado">
          <h2 id="lado-a-lado" className="font-denso text-3xl font-bold uppercase">
            Lado a lado
          </h2>
          <Tabela
            legenda={`Pente Fino e ${c.nome} lado a lado`}
            colunas={['', 'Pente Fino', c.nome]}
            linhas={[
              [
                'Como cobra',
                `Por plano: ${PLANOS.map((p) => `${NOME_PLANO[p]} ${formatarMoeda(precoPorMes(p, 'mensal'))}`).join(', ')} no mensal, com desconto no anual.`,
                c.comoCobra,
              ],
              ...EQUIPES.map((n) => [
                `${n} ${n === 1 ? 'barbeiro' : 'barbeiros'}, por mês`,
                penteFinoPara(n),
                c.custo[n] ?? 'Veja na página de planos',
              ]),
              ['Teste grátis', `${DIAS_TESTE} dias, sem cartão`, c.teste],
              ['WhatsApp', PENTE_FINO.whatsapp, c.whatsapp],
              ['Comissão', PENTE_FINO.comissao, c.comissao],
              ['Lucro por serviço', PENTE_FINO.lucroPorServico, c.lucroPorServico],
              ['Nota fiscal', PENTE_FINO.notaFiscal, c.notaFiscal],
              ['App nas lojas', PENTE_FINO.appNasLojas, c.appNasLojas],
            ]}
          />
        </section>
        <Lista titulo={`Onde o ${c.nome} é melhor`} itens={c.ondeEleEMelhor} />
        <Lista titulo="Onde o Pente Fino é melhor" itens={c.ondePenteFinoEMelhor} />
      </div>
      <Fontes itens={[c]} />
      <Chamada />
      <OutrosComparativos atual={c.slug} />
    </>
  );
}

/** /melhor-sistema-para-barbearia: como escolher e a tabela com todos. */
export function PaginaComparativoGeral() {
  const col = (f: (c: Concorrente) => string) => CONCORRENTES.map(f);
  return (
    <>
      <TrilhaGoogle
        pagina="Melhor sistema para barbearia"
        caminho="/melhor-sistema-para-barbearia"
      />
      <Cabecalho
        sobre="Como escolher"
        titulo="Melhor sistema para barbearia: como escolher o seu"
        texto="Não existe um melhor para todo mundo. Existe o que cabe no tamanho da sua equipe e responde a pergunta que importa para você. Antes de testar, faça estas perguntas e compare com a tabela."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-12 px-4 pb-14 sm:px-6">
        <Lista
          titulo="Cinco perguntas antes de escolher"
          itens={[
            'Quanto vou pagar com a equipe que tenho hoje e com a que quero ter? Some as taxas por profissional e os itens adicionais.',
            'O lembrete e o WhatsApp vêm no plano ou são cobrados à parte?',
            'A comissão sai sozinha, item a item, ou ainda vou precisar de planilha?',
            'O sistema mostra só o faturamento ou também quanto sobra depois de comissão, produto e despesas?',
            'O teste dá tempo de usar num mês de verdade? Precisa de cartão?',
          ]}
        />
        <section className="flex flex-col gap-4" aria-labelledby="tabela-geral">
          <h2 id="tabela-geral" className="font-denso text-3xl font-bold uppercase">
            Os sistemas lado a lado
          </h2>
          <Tabela
            legenda="Pente Fino, AppBarber, Trinks e Booksy lado a lado"
            colunas={['', 'Pente Fino', ...col((c) => c.nome)]}
            linhas={[
              ...EQUIPES.map((n) => [
                `${n} ${n === 1 ? 'barbeiro' : 'barbeiros'}, por mês`,
                penteFinoPara(n),
                ...col((c) => c.custo[n] ?? 'Veja na página de planos'),
              ]),
              ['Teste grátis', `${DIAS_TESTE} dias`, ...col((c) => c.teste)],
              ['WhatsApp', PENTE_FINO.whatsapp, ...col((c) => c.whatsapp)],
              ['Comissão', PENTE_FINO.comissao, ...col((c) => c.comissao)],
              ['Lucro por serviço', PENTE_FINO.lucroPorServico, ...col((c) => c.lucroPorServico)],
              ['Nota fiscal', PENTE_FINO.notaFiscal, ...col((c) => c.notaFiscal)],
              ['App nas lojas', PENTE_FINO.appNasLojas, ...col((c) => c.appNasLojas)],
            ]}
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-denso text-3xl font-bold uppercase">Para quem é cada um</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-tinta-suave">
            <li>
              Quer saber quanto sobra no fim do mês, com comissão e caixa sem planilha: o Pente Fino
              foi feito para isso.
            </li>
            <li>Quer o teste mais longo e app nas lojas: o AppBarber dá 30 dias.</li>
            <li>Precisa emitir nota fiscal pelo sistema: o Trinks tem, como item adicional.</li>
            <li>
              Quer ser encontrado por clientes novos num aplicativo: o Booksy tem marketplace.
            </li>
          </ul>
        </section>
      </div>
      <Fontes itens={CONCORRENTES} />
      <Chamada />
      <OutrosComparativos />
    </>
  );
}

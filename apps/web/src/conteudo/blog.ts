// Site N4: posts do blog. Post com `publicadoEm` aparece em /blog e tem a própria pasta em
// app/(site)/blog/<slug>/page.tsx; sem data, é rascunho (título e tópicos) e não vai ao ar.
// Regras: frases curtas, números de barbearia, nada que o plano não entregue.

export type BlocoPost =
  | { tipo: 'p'; texto: string }
  | { tipo: 'h2'; texto: string }
  | { tipo: 'lista'; itens: readonly string[] }
  /** Chamada para o teste grátis no meio do texto. */
  | { tipo: 'chamada' };

export interface PostBlog {
  slug: string;
  titulo: string;
  descricao: string;
  /** AAAA-MM-DD; null = rascunho. */
  publicadoEm: string | null;
  /** Rascunho: o que o post vai cobrir. */
  topicos?: readonly string[];
  blocos: readonly BlocoPost[];
  /** Páginas do site ligadas ao assunto (calculadoras, páginas por termo). */
  relacionados: readonly { href: string; rotulo: string }[];
}

export const POSTS: readonly PostBlog[] = [
  {
    slug: 'faturamento-nao-e-lucro',
    titulo: 'Faturamento não é lucro: como saber quanto sobra na barbearia',
    descricao:
      'A barbearia faturou R$ 30 mil e mesmo assim falta dinheiro? Veja, com números de verdade, como sair do faturamento e chegar ao lucro do mês.',
    publicadoEm: '2026-11-12',
    blocos: [
      {
        tipo: 'p',
        texto:
          'Todo dono de barbearia sabe quanto entrou no mês. Poucos sabem quanto sobrou. E é aí que mora o susto: a agenda cheia, o caixa girando, e no dia de pagar as contas o dinheiro não fecha.',
      },
      {
        tipo: 'p',
        texto:
          'Faturamento é tudo o que entrou. Lucro é o que fica depois de pagar quem trabalhou, o que foi usado e as contas do mês. Os dois números podem ser muito diferentes.',
      },
      { tipo: 'h2', texto: 'Um mês de barbearia, do faturamento ao lucro' },
      {
        tipo: 'p',
        texto:
          'Pense numa barbearia com quatro barbeiros que fez 600 atendimentos no mês, com ticket médio de R$ 50. O faturamento foi de R$ 30.000. Parece ótimo. Agora vamos tirar o que não é da casa.',
      },
      {
        tipo: 'lista',
        itens: [
          'Comissão dos barbeiros, de 45%: R$ 13.500.',
          'Produto usado nos atendimentos (pomada, lâmina, toalha), R$ 3 por atendimento: R$ 1.800.',
          'Despesas fixas: aluguel R$ 3.500, luz e água R$ 900, internet e sistema R$ 300, contador R$ 600. Total: R$ 5.300.',
          'Despesas variáveis e manutenção no mês: R$ 1.400.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Somando tudo, saíram R$ 22.000. Dos R$ 30.000 faturados, sobraram R$ 8.000. Esse é o lucro da operação: pouco mais de um quarto do que entrou.',
      },
      {
        tipo: 'p',
        texto:
          'E repare: a retirada do dono ainda não saiu daí. Se o dono tira R$ 6.000 por mês, sobram R$ 2.000 para reserva, investimento e imprevisto.',
      },
      { tipo: 'h2', texto: 'Por que o dinheiro some sem ninguém perceber' },
      {
        tipo: 'lista',
        itens: [
          'A comissão é calculada no fim do mês, numa planilha, e ninguém olha quanto ela pesa em cada serviço.',
          'O produto usado não é contado. Parece pouco por corte, mas em 600 atendimentos vira quase dois mil reais.',
          'A retirada do dono se mistura com as despesas da barbearia, e fica impossível saber se a operação dá lucro.',
          'O preço do corte não sobe há anos, enquanto aluguel e produto sobem todo ano.',
        ],
      },
      { tipo: 'chamada' },
      { tipo: 'h2', texto: 'Quanto sobra de cada serviço' },
      {
        tipo: 'p',
        texto:
          'O lucro do mês é a soma do que sobra em cada atendimento. Um corte de R$ 50 com 45% de comissão e R$ 3 de produto deixa R$ 24,50 para a casa. Já uma barba de R$ 30 com a mesma comissão e R$ 4 de produto deixa R$ 12,50. A barba dá trabalho parecido e metade do resultado.',
      },
      {
        tipo: 'p',
        texto:
          'Saber isso muda decisões: qual serviço divulgar, qual combo montar, quando é hora de reajustar o preço.',
      },
      { tipo: 'h2', texto: 'Como começar a medir o lucro, hoje' },
      {
        tipo: 'lista',
        itens: [
          'Separe a retirada do dono das despesas da barbearia. Ela é sua, não é custo da operação.',
          'Anote o produto usado por serviço, nem que seja uma média.',
          'Lance as despesas fixas no começo do mês, para saber quanto precisa faturar só para empatar.',
          'Calcule a sobra de cada serviço, não só o faturamento total.',
          'Olhe o resultado toda semana, não só no fim do mês, quando já não dá para corrigir.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Dá para fazer tudo isso numa planilha, com disciplina. Ou deixar o sistema fazer sozinho: no Pente Fino, cada comanda fechada já calcula a comissão e o produto, e o resultado do mês mostra o faturamento, as despesas e quanto sobrou.',
      },
    ],
    relacionados: [
      { href: '/calculadora/lucro-por-corte', rotulo: 'Calculadora: quanto sobra de cada corte' },
      { href: '/calculadora/preco-do-corte', rotulo: 'Calculadora: quanto cobrar pelo corte' },
      { href: '/controle-financeiro-barbearia', rotulo: 'Controle financeiro para barbearia' },
    ],
  },
  {
    slug: 'como-calcular-comissao-de-barbeiro',
    titulo: 'Como calcular comissão de barbeiro sem planilha',
    descricao: 'Comissão por serviço e por produto, com regra que muda sem bagunçar o passado.',
    publicadoEm: null,
    topicos: [
      'Comissão sobre o preço cheio ou depois do produto',
      'Percentual ou valor fixo',
      'Mudança de regra com data de vigência',
      'Extrato que o barbeiro confere sozinho',
    ],
    blocos: [],
    relacionados: [
      { href: '/calculadora/comissao-de-barbeiro', rotulo: 'Calculadora de comissão' },
    ],
  },
  {
    slug: 'quanto-cobrar-pelo-corte-2027',
    titulo: 'Quanto cobrar pelo corte em 2027: a conta do preço mínimo',
    descricao: 'Custos fixos, comissão, produto e margem: a conta do preço que paga tudo.',
    publicadoEm: null,
    topicos: [
      'Custo fixo por corte',
      'Comissão e produto',
      'Margem desejada',
      'Como reajustar sem perder cliente',
    ],
    blocos: [],
    relacionados: [
      { href: '/calculadora/preco-do-corte', rotulo: 'Calculadora de preço do corte' },
    ],
  },
  {
    slug: 'clube-de-assinatura-na-barbearia',
    titulo: 'Clube de assinatura na barbearia: como montar sem perder dinheiro',
    descricao: 'Preço do plano, limite de uso e comissão do assinante.',
    publicadoEm: null,
    topicos: [
      'Quanto o assinante usa de verdade',
      'Preço do plano a partir do uso',
      'Comissão do barbeiro no clube',
      'Cobrança automática e inadimplência',
    ],
    blocos: [],
    relacionados: [],
  },
  {
    slug: 'comanda-de-papel-ou-digital',
    titulo: 'Comanda de papel x comanda digital',
    descricao: 'O que se perde no papel e o que muda quando a comanda nasce do agendamento.',
    publicadoEm: null,
    topicos: [
      'Erros de soma e comanda perdida',
      'Comanda criada pelo agendamento',
      'Extras lançados por quem atendeu',
      'Fechamento e caixa do dia',
    ],
    blocos: [],
    relacionados: [
      { href: '/comanda-digital-barbearia', rotulo: 'Comanda digital para barbearia' },
    ],
  },
  {
    slug: 'reduzir-faltas-com-lembrete-no-whatsapp',
    titulo: 'Como reduzir faltas com lembrete no WhatsApp',
    descricao: 'Lembrete na hora certa, confirmação e lista de espera para o horário que vaga.',
    publicadoEm: null,
    topicos: [
      'Quanto custa uma falta',
      'Quando mandar o lembrete',
      'Confirmar ou remarcar pelo próprio WhatsApp',
      'Lista de espera para o horário que vaga',
    ],
    blocos: [],
    relacionados: [{ href: '/whatsapp-para-barbearia', rotulo: 'WhatsApp para barbearia' }],
  },
];

export const POSTS_PUBLICADOS = POSTS.filter(
  (p): p is PostBlog & { publicadoEm: string } => p.publicadoEm !== null,
).sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));

export const post = (slug: string) => {
  const p = POSTS_PUBLICADOS.find((x) => x.slug === slug);
  if (!p) throw new Error(`post não publicado: ${slug}`);
  return p;
};

/** Minutos de leitura, a 200 palavras por minuto (pelo menos 1). */
export function minutosDeLeitura(p: PostBlog): number {
  const texto = p.blocos
    .map((b) => (b.tipo === 'lista' ? b.itens.join(' ') : b.tipo === 'chamada' ? '' : b.texto))
    .join(' ');
  return Math.max(1, Math.round(texto.split(/\s+/).filter(Boolean).length / 200));
}

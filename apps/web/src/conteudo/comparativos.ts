// Site N2: páginas de comparação. Regras (docs/historico/melhorias-2026-11-10.md, N2): só fatos conferidos
// na página oficial de cada sistema, com a data e o link; tom justo, dizendo onde o outro é
// melhor (só nos dados: a página não faz propaganda do concorrente, pedido do dono em 15/11); sem logos. Ao mudar um preço aqui, atualizar CONFERIDO_EM e conferir a fonte de novo.

/** Data da última conferência de todas as fontes abaixo (AAAA-MM-DD). */
export const CONFERIDO_EM = '2026-11-12';

/**
 * Resumo para a tabela geral: sim, em parte (ou pago à parte), não, ou null quando o site do
 * sistema não informa. `nota` tem no máximo duas ou três palavras.
 */
export type Sinal = { s: 'sim' | 'parte' | 'nao' | null; nota?: string };
export interface Resumo {
  /** Preço no mensal com 3 barbeiros, curto; null = o site não mostra. */
  preco3: string | null;
  /** Dias de teste, curto; null = o site não informa. */
  teste: string | null;
  whatsapp: Sinal;
  comissao: Sinal;
  lucro: Sinal;
  notaFiscal: Sinal;
  app: Sinal;
}

export interface Concorrente {
  slug: 'appbarber' | 'trinks' | 'booksy' | 'genda' | 'barbeiro-app' | 'bestbarbers';
  nome: string;
  fonte: string;
  /** Data em que esta fonte foi conferida, quando diferente de CONFERIDO_EM. */
  conferidoEm?: string;
  /** Uma frase sobre como cobra, com os números da página. */
  comoCobra: string;
  /** Custo por mês no mensal para 1, 3 e 5 profissionais; null = a página não mostra. */
  custo: { 1: string | null; 3: string | null; 5: string | null };
  teste: string;
  whatsapp: string;
  comissao: string;
  notaFiscal: string;
  lucroPorServico: string;
  appNasLojas: string;
  /** Onde o concorrente é melhor: referência interna, não aparece no site (pedido do dono em 15/11). */
  ondeEleEMelhor: readonly string[];
  /** Onde o Pente Fino é melhor, só com fato que o plano entrega. */
  ondePenteFinoEMelhor: readonly string[];
  /** Os mesmos fatos acima, resumidos para a tabela geral. */
  resumo: Resumo;
}

export const CONCORRENTES: readonly Concorrente[] = [
  {
    slug: 'appbarber',
    nome: 'AppBarber',
    fonte: 'https://appbarber.com.br/',
    comoCobra:
      'Por faixa de profissionais: R$ 79,90 (1), R$ 109,90 (2 a 5), R$ 164,50 (6 a 15) e R$ 219,90 (mais de 15) no mensal, com desconto no semestral e no anual.',
    custo: { 1: 'R$ 79,90', 3: 'R$ 109,90', 5: 'R$ 109,90' },
    teste: '30 dias',
    whatsapp: 'Não citado; lembrete de horário e mensagem de retorno na lista de funções',
    comissao: 'Sim, na lista de funções',
    notaFiscal: 'Módulo fiscal citado, sem preço na página',
    lucroPorServico: 'Não citado',
    appNasLojas: 'Sim, na App Store e na Google Play',
    ondeEleEMelhor: [
      'Teste grátis mais longo: 30 dias, contra 14 do Pente Fino.',
      'App nas lojas para o cliente baixar.',
      'Todas as funções em todos os planos.',
      'Equipe de 4 a 5 barbeiros paga menos no mensal: R$ 109,90, contra R$ 149,90 do Pro.',
    ],
    ondePenteFinoEMelhor: [
      'Até 3 profissionais por R$ 79,90 no Básico; no AppBarber, 2 ou 3 já pagam R$ 109,90.',
      'Lucro e margem de cada serviço e produto (plano Premium), não só o faturamento.',
      'Bot de WhatsApp com a conta da barbearia, sem custo por mensagem (incluso no Pro e no Premium; no Básico, com as Automações).',
      'Caixa do dia com a diferença apontada no fechamento.',
    ],
    resumo: {
      preco3: 'R$ 109,90',
      teste: '30 dias',
      whatsapp: { s: null },
      comissao: { s: 'sim' },
      lucro: { s: null },
      notaFiscal: { s: 'sim', nota: 'módulo fiscal' },
      app: { s: 'sim' },
    },
  },
  {
    slug: 'trinks',
    nome: 'Trinks',
    fonte: 'https://negocios.trinks.com/planos/',
    comoCobra:
      'Por faixa de profissionais (1 a 2, 3 a 4, 5 a 10; de 11 em diante, sob consulta). Vários recursos são itens adicionais, com preço à parte não informado na página.',
    custo: { 1: null, 3: null, 5: null },
    teste: '5 dias',
    whatsapp: 'Item adicional (rotina de mensagens e lembretes automáticos)',
    comissao: 'Pagamento automático de comissões citado no site',
    notaFiscal: 'Sim, como item adicional',
    lucroPorServico: 'Não citado',
    appNasLojas: 'Sim, site e app de agendamento; app exclusivo como item adicional',
    ondeEleEMelhor: [
      'Emite nota fiscal (item adicional). O Pente Fino ainda não emite.',
      'Conta digital integrada e controle de estoque.',
      'Treinamentos ao vivo e migração assistida.',
    ],
    ondePenteFinoEMelhor: [
      'Lembretes e bot de WhatsApp inclusos no Pro, sem item adicional nem custo por mensagem.',
      'Clube de assinatura incluso no Pro; no Trinks é item adicional.',
      'Preço de todos os planos publicado, com o que vem em cada um.',
      'Teste de 14 dias, contra 5.',
    ],
    resumo: {
      preco3: null,
      teste: '5 dias',
      whatsapp: { s: 'parte', nota: 'item adicional' },
      comissao: { s: 'sim' },
      lucro: { s: null },
      notaFiscal: { s: 'parte', nota: 'item adicional' },
      app: { s: 'sim' },
    },
  },
  {
    slug: 'booksy',
    nome: 'Booksy',
    fonte: 'https://biz.booksy.com/pt-br/precos',
    comoCobra:
      'Plano único de R$ 99,99 por mês mais impostos, com R$ 20 por mês (mais impostos) por agenda de profissional a mais.',
    custo: { 1: 'R$ 99,99 + impostos', 3: 'R$ 139,99 + impostos', 5: 'R$ 179,99 + impostos' },
    teste: '7 dias',
    whatsapp: 'Não citado; confirmações e lembretes inclusos',
    comissao: 'Não citado na página de preços',
    notaFiscal: 'Não citado',
    lucroPorServico: 'Não citado',
    appNasLojas: 'Sim, com marketplace onde clientes novos encontram a barbearia',
    ondeEleEMelhor: [
      'Marketplace: clientes novos encontram a barbearia pelo app.',
      'Reserva pelo Google, pagamentos integrados e vale-presente.',
      'Plano único, com todos os recursos.',
    ],
    ondePenteFinoEMelhor: [
      'Não cobra por agenda: 5 barbeiros no Pro pagam R$ 149,90, contra R$ 179,99 mais impostos.',
      'Comissão automática por item, com extrato do barbeiro, em todos os planos.',
      'Bot de WhatsApp com a conta da barbearia (incluso no Pro e no Premium; no Básico, com as Automações).',
      'Lucro e margem de cada serviço e produto (Premium).',
    ],
    resumo: {
      preco3: 'R$ 139,99 + impostos',
      teste: '7 dias',
      whatsapp: { s: null },
      comissao: { s: null },
      lucro: { s: null },
      notaFiscal: { s: null },
      app: { s: 'sim', nota: 'com marketplace' },
    },
  },
  {
    slug: 'genda',
    nome: 'GENDA',
    fonte: 'https://genda.work/#pricing',
    conferidoEm: '2026-11-14',
    comoCobra:
      'Por faixa de profissionais: Grátis (1 profissional, 50 mensagens de WhatsApp por mês), R$ 39,90 (1), R$ 79,90 (até 3) e R$ 129,90 (ilimitados) no mensal, com desconto no trimestral e no semestral.',
    custo: { 1: 'R$ 39,90', 3: 'R$ 79,90', 5: 'R$ 129,90' },
    teste: '5 dias; depois cai no plano grátis',
    whatsapp: 'Lembretes e confirmações em todos os planos, com cota de mensagens por mês',
    comissao: 'Não citado',
    notaFiscal: 'Não citado',
    lucroPorServico: 'Não citado',
    appNasLojas: 'Não citado; funciona no navegador',
    ondeEleEMelhor: [
      'Tem plano grátis para 1 profissional.',
      'Para 1 barbeiro sai mais barato: R$ 39,90, contra R$ 79,90 do Básico.',
      'Lembrete pelo WhatsApp em todos os planos, até no grátis (com cota).',
    ],
    ondePenteFinoEMelhor: [
      'Comissão automática por item, com extrato do barbeiro, em todos os planos.',
      'Caixa do dia com a diferença apontada no fechamento e despesas do mês.',
      'Bot e avisos sem cota de mensagens: o WhatsApp é o da barbearia.',
      'Lucro e margem de cada serviço e produto (Premium).',
    ],
    resumo: {
      preco3: 'R$ 79,90',
      teste: '5 dias',
      whatsapp: { s: 'parte', nota: 'com cota de mensagens' },
      comissao: { s: null },
      lucro: { s: null },
      notaFiscal: { s: null },
      app: { s: null },
    },
  },
  {
    slug: 'barbeiro-app',
    nome: 'Barbeiro.app',
    fonte: 'https://www.barbeiro.app/#planos',
    conferidoEm: '2026-11-14',
    comoCobra:
      'Starter R$ 29,90 (até 3 profissionais, sem WhatsApp), Pro R$ 39,90 e WhatsApp Pro R$ 99,90 (profissionais ilimitados) no mensal, com 20% no anual.',
    custo: { 1: 'R$ 39,90', 3: 'R$ 39,90', 5: 'R$ 39,90' },
    teste: '14 dias, sem cartão',
    whatsapp:
      'Confirmação e lembrete no Pro; as mensagens são cobradas pela Meta (R$ 0,035 a R$ 0,32 cada)',
    comissao: 'Sim, em todos os planos',
    notaFiscal: 'NFS-e no WhatsApp Pro ou por R$ 29,90 por mês à parte',
    lucroPorServico: 'Não citado (cita o lucro do mês e o faturamento por serviço)',
    appNasLojas: 'App para iPhone na App Store; no Android, pelo navegador',
    ondeEleEMelhor: [
      'Bem mais barato: profissionais ilimitados por R$ 39,90 no Pro.',
      'Emite nota fiscal (no WhatsApp Pro ou à parte).',
      'App para iPhone na App Store.',
    ],
    ondePenteFinoEMelhor: [
      'WhatsApp da própria barbearia, sem custo por mensagem; lá cada mensagem é cobrada pela Meta.',
      'Lucro e margem de cada serviço e produto (Premium), não só o lucro do mês.',
      'Caixa do dia com a diferença apontada no fechamento.',
      'Clube de assinatura com cobrança pelo link (Pro e Premium).',
    ],
    resumo: {
      preco3: 'R$ 39,90',
      teste: '14 dias',
      whatsapp: { s: 'parte', nota: 'Meta cobra cada mensagem' },
      comissao: { s: 'sim' },
      lucro: { s: null },
      notaFiscal: { s: 'parte', nota: 'à parte' },
      app: { s: 'parte', nota: 'só iPhone' },
    },
  },
  {
    slug: 'bestbarbers',
    nome: 'BestBarbers',
    fonte: 'https://www.bestbarbers.app/',
    conferidoEm: '2026-11-14',
    comoCobra:
      'A página não mostra os preços: tem o Plano Básico (agenda e financeiro) e o App Próprio, sob consulta com um especialista.',
    custo: { 1: null, 3: null, 5: null },
    teste: 'Não citado',
    whatsapp: 'Não citado; lembretes por notificação no app próprio',
    comissao: 'Sim, gestão de comissões dos barbeiros',
    notaFiscal: 'NFS-e automática depois de cada atendimento',
    lucroPorServico: 'Não citado (cita relatórios e métricas)',
    appNasLojas: 'Sim, app próprio da barbearia na App Store e na Play Store',
    ondeEleEMelhor: [
      'App próprio com a marca da barbearia nas lojas.',
      'Emite a nota fiscal sozinho depois de cada atendimento.',
    ],
    ondePenteFinoEMelhor: [
      'Preço aberto no site, a partir de R$ 79,90 no Básico, sem precisar falar com vendedor.',
      'Avisos e bot no WhatsApp da barbearia, sem custo por mensagem.',
      'Lucro e margem de cada serviço e produto (Premium).',
      'Caixa do dia com a diferença apontada no fechamento.',
    ],
    resumo: {
      preco3: null,
      teste: null,
      whatsapp: { s: null },
      comissao: { s: 'sim' },
      lucro: { s: null },
      notaFiscal: { s: 'sim', nota: 'automática' },
      app: { s: 'sim', nota: 'app próprio' },
    },
  },
];

export const concorrente = (slug: Concorrente['slug']) => {
  const c = CONCORRENTES.find((x) => x.slug === slug);
  if (!c) throw new Error(`comparativo sem dados: ${slug}`);
  return c;
};

/** O Pente Fino nas mesmas linhas (os preços vêm de @pente-fino/shared na página). */
export const PENTE_FINO = {
  whatsapp:
    'Avisos em todos os planos; bot com a conta da barbearia, sem custo por mensagem (incluso no Pro e no Premium; no Básico, com as Automações)',
  comissao: 'Sim, em todos os planos, com extrato do barbeiro',
  notaFiscal: 'Não emite',
  lucroPorServico: 'Sim, margem de cada serviço e produto (Premium)',
  appNasLojas: 'Não: abre no navegador e vira ícone na tela do celular',
} as const;

/** O Pente Fino na tabela geral (preço e teste vêm de @pente-fino/shared na página). */
export const PENTE_FINO_RESUMO: Omit<Resumo, 'preco3' | 'teste'> = {
  whatsapp: { s: 'sim', nota: 'sem custo por mensagem' },
  comissao: { s: 'sim' },
  lucro: { s: 'sim', nota: 'no Premium' },
  notaFiscal: { s: 'nao' },
  app: { s: 'nao', nota: 'navegador' },
};

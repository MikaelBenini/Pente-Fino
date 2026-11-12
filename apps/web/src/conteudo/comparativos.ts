// Site N2: páginas de comparação. Regras (docs/pente-fino-melhorias.md, N2): só fatos conferidos
// na página oficial de cada sistema, com a data e o link; tom justo, dizendo onde o outro é
// melhor; sem logos. Ao mudar um preço aqui, atualizar CONFERIDO_EM e conferir a fonte de novo.

/** Data da última conferência de todas as fontes abaixo (AAAA-MM-DD). */
export const CONFERIDO_EM = '2026-11-12';

export interface Concorrente {
  slug: 'appbarber' | 'trinks' | 'booksy';
  nome: string;
  fonte: string;
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
  /** Onde o concorrente é melhor (dito com todas as letras). */
  ondeEleEMelhor: readonly string[];
  /** Onde o Pente Fino é melhor, só com fato que o plano entrega. */
  ondePenteFinoEMelhor: readonly string[];
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
      'Bot de WhatsApp com a conta da barbearia, sem custo por mensagem (Pro e Premium).',
      'Caixa do dia com a diferença apontada no fechamento.',
    ],
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
      'Bot de WhatsApp com a conta da barbearia (Pro e Premium).',
      'Lucro e margem de cada serviço e produto (Premium).',
    ],
  },
];

export const concorrente = (slug: Concorrente['slug']) => {
  const c = CONCORRENTES.find((x) => x.slug === slug);
  if (!c) throw new Error(`comparativo sem dados: ${slug}`);
  return c;
};

/** O Pente Fino nas mesmas linhas (os preços vêm de @pente-fino/shared na página). */
export const PENTE_FINO = {
  whatsapp: 'Bot com a conta da barbearia, sem custo por mensagem (Pro e Premium)',
  comissao: 'Sim, em todos os planos, com extrato do barbeiro',
  notaFiscal: 'Não emite',
  lucroPorServico: 'Sim, margem de cada serviço e produto (Premium)',
  appNasLojas: 'Não: abre no navegador e vira ícone na tela do celular',
} as const;

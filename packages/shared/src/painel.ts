// Painel do dia do dono (Etapa 23.1): o que precisa de alguém agora, em ordem de urgência, cada
// item com a tela onde se resolve. Regra pura; a tela junta os dados do resumo do dia, do caixa,
// das conversas, do WhatsApp e das avaliações.
import type { ContagemDia } from './resumo-dia.js';

export type TomPendencia = 'perigo' | 'aviso' | 'neutro';

export interface PendenciaDoDia {
  chave: string;
  texto: string;
  tom: TomPendencia;
  rota: `/${string}`;
}

export interface DadosPainelDia {
  totais: Pick<ContagemDia, 'pendentes' | 'aguardandoFechamento' | 'faltas' | 'aAtender'> & {
    primeiraVez: number;
    aniversariantes: number;
  };
  /** Caixa da unidade (só com uma unidade escolhida); null = não se aplica. */
  caixa: { situacao: 'nao_aberto' | 'aberto' | 'fechado'; divergencia: number | null } | null;
  /** O dia já passou do meio-dia (caixa não aberto vira alerta). */
  depoisDoMeioDia: boolean;
  esperandoAtendente: number;
  whatsappCaido: string[];
  notasBaixas: number;
  /** Saúde da conta (seção 7): caixa de outro dia que ficou aberto e comandas paradas. */
  saude?: SaudeDaConta | null;
  /** Unidades com o link de agendamento desligado (o cliente não marca sozinho). */
  linkDesligado?: string[];
}

/** Saúde da conta no Início: o que ficou para trás de dias anteriores. */
export interface SaudeDaConta {
  /** Caixa de um dia anterior que não foi fechado (o mais recente). */
  caixaAnterior: { data: string; unidade: string } | null;
  /** Comandas de dias anteriores que não foram fechadas nem canceladas. */
  comandasParadas: number;
}

const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
const ORDEM: Record<TomPendencia, number> = { perigo: 0, aviso: 1, neutro: 2 };

export function pendenciasDoDia(d: DadosPainelDia): PendenciaDoDia[] {
  const r: PendenciaDoDia[] = [];
  if (d.whatsappCaido.length)
    r.push({
      chave: 'whatsapp',
      tom: 'perigo',
      rota: '/bot',
      texto: `WhatsApp desconectado em ${d.whatsappCaido.join(', ')}: o bot não está respondendo`,
    });
  if (d.esperandoAtendente)
    r.push({
      chave: 'conversas',
      tom: 'perigo',
      rota: '/conversas',
      texto: `${n(d.esperandoAtendente, 'cliente esperando', 'clientes esperando')} atendente no WhatsApp`,
    });
  if (d.caixa?.situacao === 'fechado' && d.caixa.divergencia)
    r.push({
      chave: 'caixa-diferenca',
      tom: 'perigo',
      rota: '/caixa',
      texto: 'O caixa de hoje fechou com diferença',
    });
  if (d.saude?.caixaAnterior) {
    const [, m, dia] = d.saude.caixaAnterior.data.split('-');
    r.push({
      chave: 'caixa-anterior',
      tom: 'perigo',
      rota: '/caixa',
      texto: `O caixa de ${dia}/${m} (${d.saude.caixaAnterior.unidade}) ficou aberto: feche para o dinheiro bater`,
    });
  }
  if (d.saude?.comandasParadas)
    r.push({
      chave: 'comandas-paradas',
      tom: 'aviso',
      rota: '/comandas',
      texto: `${n(d.saude.comandasParadas, 'comanda de dias anteriores', 'comandas de dias anteriores')} sem fechar`,
    });
  if (d.notasBaixas)
    r.push({
      chave: 'notas',
      tom: 'aviso',
      rota: '/resultados?aba=agenda',
      texto: `${n(d.notasBaixas, 'nota baixa', 'notas baixas')} de cliente para resolver`,
    });
  if (d.totais.pendentes)
    r.push({
      chave: 'confirmar',
      tom: 'aviso',
      rota: '/comandas',
      texto: `${n(d.totais.pendentes, 'comanda esperando', 'comandas esperando')} o barbeiro confirmar`,
    });
  const prontas = d.totais.aguardandoFechamento - d.totais.pendentes;
  if (prontas > 0)
    r.push({
      chave: 'fechar',
      tom: 'aviso',
      rota: '/comandas',
      texto: `${n(prontas, 'comanda pronta', 'comandas prontas')} para receber e fechar`,
    });
  if (d.caixa?.situacao === 'nao_aberto' && d.depoisDoMeioDia)
    r.push({
      chave: 'caixa',
      tom: 'aviso',
      rota: '/caixa',
      texto: 'O caixa de hoje ainda não foi aberto',
    });
  if (d.linkDesligado?.length)
    r.push({
      chave: 'link',
      tom: 'neutro',
      rota: '/configuracoes?aba=link',
      texto: `Link de agendamento desligado em ${d.linkDesligado.join(', ')}: o cliente não consegue marcar sozinho`,
    });
  if (d.totais.faltas)
    r.push({
      chave: 'faltas',
      tom: 'neutro',
      rota: '/agenda',
      texto: `${n(d.totais.faltas, 'falta', 'faltas')} hoje: vale oferecer o horário para a lista de espera`,
    });
  if (d.totais.primeiraVez)
    r.push({
      chave: 'novos',
      tom: 'neutro',
      rota: '/agenda',
      texto: `${n(d.totais.primeiraVez, 'cliente vem', 'clientes vêm')} pela primeira vez: capriche na recepção`,
    });
  if (d.totais.aniversariantes)
    r.push({
      chave: 'aniversario',
      tom: 'neutro',
      rota: '/agenda',
      texto: `${n(d.totais.aniversariantes, 'aniversariante', 'aniversariantes')} na agenda de hoje`,
    });
  return r.sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom]);
}

/**
 * Quanto precisa entrar por dia de trabalho que sobra para bater a meta de faturamento do mês
 * (centavos); null quando já bateu ou o mês acabou. `fracaoDoMes` = dias trabalhados ÷ dias de
 * trabalho do mês (o mesmo da projeção).
 */
export function porDiaParaMeta(
  meta: { objetivo: number; atual: number; fracaoDoMes: number },
  diasDeTrabalhoNoMes: number,
): number | null {
  const falta = meta.objetivo - meta.atual;
  const restantes = Math.round(diasDeTrabalhoNoMes * (1 - meta.fracaoDoMes));
  if (falta <= 0 || restantes <= 0) return null;
  return Math.ceil(falta / restantes);
}

// ─── Metas que não são de faturamento (painel M1) ─────────────────────────

export interface MetaParaResumo {
  tipo: 'faturamento' | 'servico';
  servico: string | null;
  objetivo: number;
  atual: number;
  /** Dias trabalhados ÷ dias de trabalho do mês. */
  fracaoDoMes: number;
}

/**
 * Resumo das metas de serviço para o card do Início, quando não há meta de faturamento. Antes, o
 * card dizia "Defina a meta do mês" mesmo com "Corte · 0 de 12" cadastrada. Uma meta: o nome, o
 * andamento e o ritmo; várias: quantas estão no ritmo. null = nenhuma meta de serviço.
 */
export function resumoDasMetas(
  metas: readonly MetaParaResumo[],
): { valor: string; detalhe: string } | null {
  const deServico = metas.filter((m) => m.tipo === 'servico' && m.objetivo > 0);
  if (deServico.length === 0) return null;
  const noRitmo = (m: MetaParaResumo) =>
    m.atual >= m.objetivo || m.atual / m.objetivo >= m.fracaoDoMes;
  if (deServico.length === 1) {
    const m = deServico[0]!;
    const pct = Math.min(100, Math.round((m.atual / m.objetivo) * 100));
    const ritmo = m.atual >= m.objetivo ? 'batida' : noRitmo(m) ? 'no ritmo' : 'abaixo do ritmo';
    return {
      valor: `${pct}%`,
      detalhe: `${m.servico ?? 'Serviço'} · ${m.atual} de ${m.objetivo} · ${ritmo}`,
    };
  }
  const ok = deServico.filter(noRitmo).length;
  return {
    valor: `${ok} de ${deServico.length}`,
    detalhe: `metas de serviço no ritmo${ok < deServico.length ? ` · ${deServico.length - ok} abaixo` : ''}`,
  };
}

// ─── Meses do histórico (painel M2) ───────────────────────────────────────

const mesAntes = (m: string) => {
  const [a, mm] = m.split('-').map(Number) as [number, number];
  return mm === 1 ? `${a - 1}-12` : `${a}-${String(mm - 1).padStart(2, '0')}`;
};

/**
 * Os meses do gráfico e da tabela de 12 meses, do mais antigo ao mês escolhido, sem começar antes
 * de `inicio` (uma conta de novembro não mostra onze meses vazios). Quem chama passa o mês de
 * criação da conta ou o primeiro mês com atendimento, o que vier antes (histórico importado).
 */
export function mesesDoHistorico(mes: string, mesDaCriacao: string | null, quantos = 12): string[] {
  const meses: string[] = [];
  for (let m = mes, i = 0; i < quantos; i++, m = mesAntes(m)) {
    if (mesDaCriacao && m < mesDaCriacao) break;
    meses.unshift(m);
  }
  return meses;
}

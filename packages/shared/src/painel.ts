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
  if (d.notasBaixas)
    r.push({
      chave: 'notas',
      tom: 'aviso',
      rota: '/metricas',
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

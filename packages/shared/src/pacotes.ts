// Pacotes de sessões (Fase 1d, E2; regra aprovada pelo dono em 28/11/2026: igual ao clube).
// O cliente paga antes um número de sessões de um serviço ("10 drenagens por R$ 1.000"), com
// validade. O valor entra no faturamento no dia em que é pago (linha "Pacotes"); cada sessão usada
// sai com valor zero na comanda, conta como cliente e atendimento, paga comissão sobre o preço de
// tabela do serviço (comissaoDoClube) e fica fora do ticket médio. Função "pacotes" (funcoesDaConta).
import { z } from 'zod';
import { FORMAS_PAGAMENTO } from './esquemas-operacao.js';

const centavos = z.number().int().min(100, { error: 'Informe o valor do pacote.' });

/** O pacote que a conta vende (o modelo). */
export const pacoteSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome do pacote.' }).max(80),
  unidadeId: z.uuid({ error: 'Escolha a unidade.' }),
  servicoId: z.uuid({ error: 'Escolha o serviço das sessões.' }),
  sessoes: z
    .number()
    .int()
    .min(2, { error: 'Pelo menos 2 sessões.' })
    .max(100, { error: 'No máximo 100 sessões.' }),
  validadeDias: z
    .number()
    .int()
    .min(7, { error: 'Validade de pelo menos 7 dias.' })
    .max(730, { error: 'Validade de no máximo 2 anos.' }),
  valor: centavos,
  ativo: z.boolean().default(true),
});
export type PacoteEntrada = z.infer<typeof pacoteSchema>;

/** Vender um pacote a um cliente (o pagamento é registrado na hora). */
export const venderPacoteSchema = z.object({
  pacoteId: z.uuid(),
  clienteId: z.uuid(),
  forma: z.enum(FORMAS_PAGAMENTO, { error: 'Escolha a forma de pagamento.' }),
});
export type VenderPacoteEntrada = z.infer<typeof venderPacoteSchema>;

export const cancelarPacoteSchema = z.object({
  motivo: z.string().trim().min(5, { error: 'Conte o motivo (pelo menos 5 letras).' }).max(300),
});

export type SituacaoPacote = 'ativo' | 'esgotado' | 'vencido' | 'cancelado';

export const NOME_SITUACAO_PACOTE: Readonly<Record<SituacaoPacote, string>> = {
  ativo: 'Ativo',
  esgotado: 'Sessões usadas',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

/** Último dia em que as sessões valem (inclusive): o dia da venda + a validade. */
export function validoAteDoPacote(vendidoEm: string, validadeDias: number): string {
  const d = new Date(`${vendidoEm}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + validadeDias);
  return d.toISOString().slice(0, 10);
}

/** Sessões que ainda restam. */
export const saldoDoPacote = (sessoes: number, usadas: number) => Math.max(0, sessoes - usadas);

/** Como está o pacote do cliente hoje (cancelado vence esgotado, que vence vencido). */
export function situacaoDoPacote(
  p: { sessoes: number; usadas: number; validoAte: string; canceladoEm: string | null },
  hoje: string,
): SituacaoPacote {
  if (p.canceladoEm) return 'cancelado';
  if (saldoDoPacote(p.sessoes, p.usadas) === 0) return 'esgotado';
  if (hoje > p.validoAte) return 'vencido';
  return 'ativo';
}

/** O pacote cobre a sessão de hoje? (ativo e do mesmo serviço) */
export const pacoteCobre = (
  p: {
    servicoId: string;
    sessoes: number;
    usadas: number;
    validoAte: string;
    canceladoEm: string | null;
  },
  servicoId: string,
  hoje: string,
) => p.servicoId === servicoId && situacaoDoPacote(p, hoje) === 'ativo';

/** Quanto vale cada sessão (o que o cliente pagou ÷ sessões), para mostrar ao vender. */
export const valorPorSessao = (valor: number, sessoes: number) => Math.round(valor / sessoes);

/** Um pacote do cliente como as telas mostram. */
export interface PacoteDoCliente {
  id: string;
  pacoteId: string;
  nome: string;
  servicoId: string;
  servico: string;
  unidadeId: string;
  sessoes: number;
  usadas: number;
  saldo: number;
  validoAte: string;
  valorPago: number;
  vendidoEm: string;
  situacao: SituacaoPacote;
}

/** O pacote que a conta vende, como a tela lista. */
export interface PacoteDetalhe extends PacoteEntrada {
  id: string;
  servico: string;
  /** Pacotes ativos vendidos dele. */
  ativos: number;
}

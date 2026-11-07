// Administração do sistema (Etapa 15.1): leitura entre contas só pelas funções do banco
// (migração "plataforma"), com o usuário de banco da plataforma. Nunca dado de cliente.
import type { PrismaClient } from './generated/prisma/client.js';

export interface LinhaContaPlataforma {
  id: string;
  nome: string;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criado_em: Date;
  teste_ate: Date | null;
  configurada_em: Date | null;
  cobranca_automatica: boolean;
  cancelada_em: Date | null;
  motivo_cancelamento: string | null;
  unidades: number;
  profissionais: number;
  whatsapp_conectado: boolean;
  fechadas_7_dias: number;
  ultima_fechada_em: Date | null;
  /** Última renovação de sessão de alguém da conta (uso do app). */
  ultimo_acesso_em: Date | null;
}

/** Todas as contas, das mais novas para as mais antigas (plataforma_contas()). */
export function contasDaPlataforma(prisma: PrismaClient): Promise<LinhaContaPlataforma[]> {
  return prisma.$queryRaw<LinhaContaPlataforma[]>`SELECT * FROM plataforma_contas()`;
}

export interface LinhaFaturaPlataforma {
  conta_id: string;
  plano: 'basico' | 'pro' | 'premium';
  ciclo: 'mensal' | 'anual';
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
  origem: 'asaas' | 'manual';
  forma: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia' | null;
  vencimento: Date;
  paga_em: Date | null;
}

/** Faturas das assinaturas de todas as contas (plataforma_faturas()). */
export function faturasDaPlataforma(prisma: PrismaClient): Promise<LinhaFaturaPlataforma[]> {
  return prisma.$queryRaw<LinhaFaturaPlataforma[]>`SELECT * FROM plataforma_faturas()`;
}

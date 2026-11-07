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
  unidades: number;
  profissionais: number;
  whatsapp_conectado: boolean;
  fechadas_7_dias: number;
  ultima_fechada_em: Date | null;
}

/** Todas as contas, das mais novas para as mais antigas (plataforma_contas()). */
export function contasDaPlataforma(prisma: PrismaClient): Promise<LinhaContaPlataforma[]> {
  return prisma.$queryRaw<LinhaContaPlataforma[]>`SELECT * FROM plataforma_contas()`;
}

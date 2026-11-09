// Direitos do titular (LGPD, art. 18), Etapa 21: a barbearia (controladora) exporta tudo o que o
// sistema guarda de um cliente e, a pedido dele, apaga os dados pessoais. Comandas e caixa ficam
// (histórico financeiro da barbearia), mas sem nome, telefone ou e-mail.
import { z } from 'zod';

export const NOME_CLIENTE_REMOVIDO = 'Cliente removido (LGPD)';

export const anonimizarClienteSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, { error: 'Conte o motivo (ex.: pedido do cliente pelo WhatsApp em 10/11).' })
    .max(300),
  /** Confirmação digitada na tela: o nome do cliente como está no cadastro. */
  confirmacao: z.string().trim().min(1, { error: 'Digite o nome do cliente para confirmar.' }),
});
export type AnonimizarClienteEntrada = z.infer<typeof anonimizarClienteSchema>;

/** O que o sistema guarda de um cliente, para entregar a ele (arquivo JSON). */
export interface DadosDoCliente {
  geradoEm: string;
  barbearia: string;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
    aniversario: string | null;
    aceitaMensagens: boolean;
    escolheuEm: string | null;
    cadastradoEm: string;
  };
  anotacoes: { texto: string; criadaEm: string }[];
  horarios: { inicio: string; unidade: string; status: string; observacao: string | null }[];
  atendimentos: {
    data: string;
    unidade: string;
    status: string;
    total: number;
    itens: { descricao: string; quantidade: number; valor: number }[];
  }[];
  clube: { plano: string; status: string; inicio: string; vencimento: string }[];
  avaliacoes: { data: string; nota: number | null; comentario: string | null }[];
  mensagens: { data: string; unidade: string; direcao: string; texto: string }[];
}

export interface ResultadoAnonimizar {
  mensagens: number;
  anotacoes: number;
  sessoesBot: number;
  listaEspera: number;
  avaliacoes: number;
}

// Esquemas das rotas sem login: cadastro de conta e agendamento pelo link público.
import { z } from 'zod';
import { emailSchema, senhaSchema } from './auth.js';
import { CICLOS, PLANOS } from './planos.js';

export const cadastroContaSchema = z.object({
  barbearia: z.string().trim().min(2, { error: 'Informe o nome da barbearia.' }).max(120),
  nome: z.string().trim().min(2, { error: 'Informe seu nome.' }).max(120),
  email: emailSchema,
  senha: senhaSchema,
  plano: z.enum(PLANOS).default('basico'),
  ciclo: z.enum(CICLOS).default('mensal'),
  aceite: z.literal(true, { error: 'É preciso aceitar os termos de uso.' }),
});
export type CadastroContaEntrada = z.infer<typeof cadastroContaSchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: 'Endereço inválido: use letras minúsculas, números e hífen.',
  })
  .min(3)
  .max(60);

export const agendamentoPublicoSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe seu nome.' }).max(120),
  telefone: z
    .string()
    .transform((t) => t.replace(/\D/g, ''))
    .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
    .pipe(z.string().regex(/^\d{12,13}$/, { error: 'Informe o WhatsApp com DDD.' })),
  servicoIds: z.array(z.uuid()).min(1, { error: 'Escolha um serviço.' }).max(5),
  profissionalId: z.uuid(),
  inicio: z.iso.datetime({ offset: true, error: 'Horário inválido.' }),
  /** Marcou a caixa "quero receber lembrete pelo WhatsApp" (aceite ativo, começa desmarcada). */
  lembretes: z.boolean().default(false),
});
export type AgendamentoPublicoEntrada = z.infer<typeof agendamentoPublicoSchema>;

export interface UnidadePublica {
  nome: string;
  barbearia: string;
  endereco: string | null;
  telefone: string | null;
  servicos: {
    id: string;
    nome: string;
    duracaoMin: number;
    preco: number | null;
    ehExtra: boolean;
  }[];
  profissionais: { id: string; nome: string }[];
  /** WhatsApp da unidade conectado e com lembretes configurados: mostra a caixa de aceite. */
  lembretesWhatsapp: boolean;
}

/** Texto pronto do botão "Ativar lembretes": o bot entende e liga os avisos. */
export const TEXTO_ATIVAR_LEMBRETES = 'RECEBER LEMBRETES';

/**
 * Lembretes de quem marcou pelo site: ligados (já conversou com a barbearia), falta ativar
 * (o número precisa escrever primeiro: proteção do WhatsApp) ou não pediu.
 */
export type LembretesDoSite = 'ligados' | 'ativar' | null;

export interface AgendamentoPublicoCriado {
  inicio: string;
  fim: string;
  profissional: string;
  servicos: string[];
  total: number;
  /** Link wa.me para o cliente confirmar com a barbearia (quando a unidade tem telefone). */
  linkWhatsapp: string | null;
  /** Caminho do link para ver, remarcar ou cancelar (/horario?t=token). */
  linkGerenciar: string;
  lembretes: LembretesDoSite;
  /** wa.me do número do bot com "RECEBER LEMBRETES" pronto, quando falta ativar. */
  linkLembretes: string | null;
}

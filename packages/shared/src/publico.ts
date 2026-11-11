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
  /** Cupom de desconto (opcional). */
  cupom: z.string().trim().max(30).optional(),
  /** Campo isca, invisível para pessoas: robô preenche (Etapa 15.4). */
  site: z.string().max(200).optional(),
  /** Quando o formulário abriu (ms): envio rápido demais é robô. */
  abertoEm: z.number().optional(),
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
  /** Token do link mandado pelo bot (nome e telefone já preenchidos). */
  c: z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,20}$/)
    .optional(),
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
  /** "Prefere pelo WhatsApp?": wa.me do bot com "AGENDAR POR AQUI", quando dá para marcar na conversa. */
  linkWhatsappAgendar: string | null;
  /** O plano da barbearia tem lista de espera: mostra "Avise-me se vagar". */
  listaEspera: boolean;
  /**
   * Outras unidades da mesma barbearia com o agendamento online ligado, para o cliente trocar
   * sem sair da página (vazio com uma unidade só). Sem nenhum dado interno.
   */
  outrasUnidades: { slug: string; nome: string; endereco: string | null }[];
}

type ServicoPublico = UnidadePublica['servicos'][number];

export interface TrocaDeUnidade {
  /** Serviços escolhidos que a unidade nova também faz (com preço lá). */
  mantidos: string[];
  /** Nomes dos escolhidos que a unidade nova não faz pelo link. */
  removidos: string[];
  /** Escolhidos que custam diferente na unidade nova. */
  precoMudou: { nome: string; de: number; para: number }[];
}

/**
 * O que acontece com a escolha do cliente ao trocar de unidade no link: os serviços são da
 * barbearia inteira (o mesmo id), mas cada unidade tem o próprio preço e pode não fazer algum.
 * O barbeiro é de cada unidade e não passa de uma para outra.
 */
export function trocarDeUnidade(
  escolhidos: readonly string[],
  antes: readonly ServicoPublico[],
  depois: readonly ServicoPublico[],
): TrocaDeUnidade {
  const r: TrocaDeUnidade = { mantidos: [], removidos: [], precoMudou: [] };
  for (const id of escolhidos) {
    const a = antes.find((s) => s.id === id);
    const d = depois.find((s) => s.id === id);
    if (!d || d.preco === null) {
      if (a) r.removidos.push(a.nome);
      continue;
    }
    r.mantidos.push(id);
    if (a && a.preco !== null && a.preco !== d.preco)
      r.precoMudou.push({ nome: d.nome, de: a.preco, para: d.preco });
  }
  return r;
}

/** Aviso para o cliente depois da troca; null quando nada do que ele escolheu mudou. */
export function avisoDaTroca(
  t: TrocaDeUnidade,
  unidade: string,
  tinhaBarbeiro: boolean,
  formatar: (centavos: number) => string,
): string | null {
  const partes: string[] = [];
  if (t.removidos.length)
    partes.push(
      `${t.removidos.join(', ')} não ${t.removidos.length === 1 ? 'está disponível' : 'estão disponíveis'} nesta unidade pelo link`,
    );
  for (const p of t.precoMudou)
    partes.push(`${p.nome} aqui custa ${formatar(p.para)} (era ${formatar(p.de)})`);
  if (tinhaBarbeiro) partes.push('escolha o barbeiro de novo, a equipe é outra');
  if (!partes.length) return null;
  return `Agora você está agendando na unidade ${unidade}: ${partes.join('; ')}.`;
}

/** Quem chegou pelo link do bot: nome e telefone para preencher o formulário. */
export interface ClienteDoLink {
  nome: string;
  /** Só os dígitos, com 55. */
  telefone: string;
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
  /** Foi empurrado para depois e aceita mensagens: oferece "me avise se vagar antes". */
  podeAntecipar: boolean;
  /** Atraso tolerado (minutos) da unidade, avisado na confirmação. */
  toleranciaMin: number;
}

/** "Avise-me se vagar" no site, quando o dia não tem horário livre. */
export const esperaPublicaSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe seu nome.' }).max(120),
  telefone: z
    .string()
    .transform((t) => t.replace(/\D/g, ''))
    .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
    .pipe(z.string().regex(/^\d{12,13}$/, { error: 'Informe o WhatsApp com DDD.' })),
  servicoIds: z.array(z.uuid()).min(1, { error: 'Escolha um serviço.' }).max(5),
  profissionalId: z.uuid().nullable(),
  dia: z.iso.date(),
  c: z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,20}$/)
    .optional(),
});
export type EsperaPublicaEntrada = z.infer<typeof esperaPublicaSchema>;

export interface EsperaPublicaCriada {
  lembretes: LembretesDoSite;
  linkLembretes: string | null;
}

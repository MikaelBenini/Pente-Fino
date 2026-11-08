// Clube online (Etapa 24): o cliente assina pelo link no WhatsApp, paga por Pix ou cartão no
// Asaas e a mensalidade cai na conta da barbearia (subconta do Asaas com split automático).
// O Pente Fino fica com uma taxa ajustável na administração.
import { z } from 'zod';
import { formatarMoeda } from './formatacao.js';

/** Taxa da plataforma sobre cada mensalidade paga pelo link, em pontos-base (100 = 1%). */
export const TAXA_CLUBE_PADRAO_BP = 100;
export const TAXA_CLUBE_MAXIMA_BP = 2000;

export const configClubeOnlineSchema = z.object({
  taxaBp: z
    .number()
    .int()
    .min(0, { error: 'A taxa não pode ser negativa.' })
    .max(TAXA_CLUBE_MAXIMA_BP, { error: 'A taxa vai até 20%.' }),
});
export type ConfigClubeOnline = z.infer<typeof configClubeOnlineSchema>;

/** Configuração guardada (chave clube_online); sem ela ou inválida, vale a taxa padrão. */
export function lerConfigClubeOnline(json: unknown): ConfigClubeOnline {
  const r = configClubeOnlineSchema.safeParse(json);
  return r.success ? r.data : { taxaBp: TAXA_CLUBE_PADRAO_BP };
}

/**
 * Divisão do que o Asaas repassa (valor líquido, já sem a taxa do Asaas): a barbearia recebe o
 * percentual do split; o resto fica com a plataforma. Centavos inteiros, arredondando a favor da
 * barbearia.
 */
export function dividirRepasse(liquido: number, taxaBp: number) {
  const plataforma = Math.floor((liquido * taxaBp) / 10_000);
  return { barbearia: liquido - plataforma, plataforma };
}

/** Percentual do split para a carteira da barbearia (o Asaas aceita até 4 casas). */
export const percentualDaBarbearia = (taxaBp: number) => Number((100 - taxaBp / 100).toFixed(4));

// ─── Conta para receber (subconta do Asaas) ────────────────────────────────

export const TIPOS_EMPRESA = ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'] as const;
export const NOME_TIPO_EMPRESA: Readonly<Record<(typeof TIPOS_EMPRESA)[number], string>> = {
  MEI: 'MEI',
  LIMITED: 'Limitada (LTDA)',
  INDIVIDUAL: 'Empresário individual',
  ASSOCIATION: 'Associação',
};

const digitos = (t: string) => t.replace(/\D/g, '');

export const dadosRecebimentoSchema = z
  .object({
    tipo: z.enum(['pf', 'pj']),
    nome: z.string().trim().min(3, { error: 'Informe o nome (ou a razão social).' }).max(120),
    documento: z.string().transform(digitos),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'E-mail inválido.' })),
    telefone: z
      .string()
      .transform(digitos)
      .pipe(z.string().regex(/^\d{10,11}$/, { error: 'Telefone com DDD.' })),
    /** Pessoa física: data de nascimento (AAAA-MM-DD). */
    nascimento: z.iso.date().optional(),
    tipoEmpresa: z.enum(TIPOS_EMPRESA).optional(),
    /** Faturamento (PJ) ou renda (PF) por mês, em centavos — o Asaas pede. */
    faturamentoMensal: z.number().int().positive({ error: 'Informe o faturamento por mês.' }),
    cep: z
      .string()
      .transform(digitos)
      .pipe(z.string().regex(/^\d{8}$/, { error: 'CEP com 8 números.' })),
    endereco: z.string().trim().min(3, { error: 'Informe a rua.' }).max(120),
    numero: z.string().trim().min(1, { error: 'Informe o número.' }).max(10),
    complemento: z.string().trim().max(60).optional(),
    bairro: z.string().trim().min(2, { error: 'Informe o bairro.' }).max(60),
  })
  .superRefine((d, ctx) => {
    if (d.tipo === 'pf' && d.documento.length !== 11)
      ctx.addIssue({ code: 'custom', path: ['documento'], message: 'CPF com 11 números.' });
    if (d.tipo === 'pj' && d.documento.length !== 14)
      ctx.addIssue({ code: 'custom', path: ['documento'], message: 'CNPJ com 14 números.' });
    if (d.tipo === 'pf' && !d.nascimento)
      ctx.addIssue({
        code: 'custom',
        path: ['nascimento'],
        message: 'Informe a data de nascimento.',
      });
    if (d.tipo === 'pj' && !d.tipoEmpresa)
      ctx.addIssue({
        code: 'custom',
        path: ['tipoEmpresa'],
        message: 'Escolha o tipo de empresa.',
      });
  });
export type DadosRecebimento = z.infer<typeof dadosRecebimentoSchema>;

/** Situação da conta para receber: documentos enviados e aprovados pelo Asaas. */
export type SituacaoRecebimento = 'documentos' | 'analise' | 'aprovada' | 'recusada';
export const NOME_SITUACAO_RECEBIMENTO: Readonly<Record<SituacaoRecebimento, string>> = {
  documentos: 'Falta enviar os documentos',
  analise: 'Documentos em análise',
  aprovada: 'Pronta para receber',
  recusada: 'Recusada pelo Asaas',
};

export interface RecebimentoNaTela {
  /** null = ainda não criou a conta para receber. */
  situacao: SituacaoRecebimento | null;
  nome: string | null;
  documento: string | null;
  /** Taxa do Pente Fino sobre cada mensalidade online (pontos-base). */
  taxaBp: number;
  /** Saldo na conta do Asaas (centavos); null quando não deu para consultar. */
  saldo: number | null;
}

export interface RecebimentoClube {
  id: string;
  cliente: string;
  plano: string;
  pagoEm: string;
  forma: 'pix' | 'credito' | 'dinheiro' | 'debito' | 'clube';
  valor: number;
  taxaAsaas: number;
  taxaPlataforma: number;
  repasse: number;
  creditoPrevisto: string | null;
}

// ─── Assinatura pelo link ──────────────────────────────────────────────────

export const assinarClubeSchema = z.object({
  itemClubeId: z.uuid(),
  nome: z.string().trim().min(3, { error: 'Informe seu nome completo.' }).max(120),
  telefone: z
    .string()
    .transform(digitos)
    .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
    .pipe(z.string().regex(/^\d{12,13}$/, { error: 'Informe o WhatsApp com DDD.' })),
  cpf: z
    .string()
    .transform(digitos)
    .pipe(z.string().regex(/^\d{11}$/, { error: 'CPF com 11 números (vai na cobrança).' })),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'E-mail inválido.' }))
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type AssinarClubeEntrada = z.infer<typeof assinarClubeSchema>;

export interface PlanoParaAssinar {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  /** "4 cortes por mês", "Barba à vontade"… */
  inclui: string[];
}

export interface ClubeParaAssinar {
  barbearia: string;
  unidade: string;
  planos: PlanoParaAssinar[];
}

/** Caminho do link de assinatura de um plano (ou da lista de planos da unidade). */
export const caminhoAssinarClube = (slug: string, planoId?: string) =>
  `/assinar?u=${encodeURIComponent(slug)}${planoId ? `&p=${encodeURIComponent(planoId)}` : ''}`;

/** Mensagem pronta para mandar pelo WhatsApp com o link do plano. */
export function textoConviteClube(d: {
  cliente?: string | null;
  barbearia: string;
  plano: string;
  valor: number;
  link: string;
}): string {
  const ola = d.cliente ? `Oi, ${d.cliente.trim().split(/\s+/)[0]}!` : 'Oi!';
  return [
    `${ola} Aqui é da ${d.barbearia}. 💈`,
    `Que tal assinar o *${d.plano}* por ${formatarMoeda(d.valor)} por mês? Você garante seus atendimentos e paga uma vez só, no Pix ou no cartão.`,
    `É só assinar por aqui: ${d.link}`,
  ].join('\n\n');
}

/** "4 cortes por mês" / "Barba à vontade" para a lista do que o plano cobre. */
export function textoInclui(servico: string, quantidade: number | null): string {
  if (quantidade === null) return `${servico} à vontade`;
  return `${quantidade}× ${servico} por mês`;
}

/**
 * Planos sugeridos a partir dos serviços com preço na unidade (o "clube já configurado"): o
 * corte mensal, o combo e o à vontade, com desconto sobre o avulso.
 */
export function planosSugeridos(servicos: readonly { id: string; nome: string; preco: number }[]): {
  nome: string;
  descricao: string;
  valor: number;
  servicos: { servicoId: string; quantidade: number | null }[];
}[] {
  const acha = (re: RegExp) =>
    servicos.find((s) => re.test(s.nome.normalize('NFD').replace(/[̀-ͯ]/g, '')));
  const corte = acha(/^corte$/i) ?? acha(/corte/i);
  const barba = acha(/^barba$/i) ?? acha(/barba/i);
  if (!corte) return [];
  const arredondar = (c: number) => Math.max(990, Math.round(c / 1000) * 1000 - 10);
  const r: ReturnType<typeof planosSugeridos> = [
    {
      nome: 'Clube Corte',
      descricao: '4 cortes por mês, com prioridade na agenda.',
      valor: arredondar(corte.preco * 4 * 0.85),
      servicos: [{ servicoId: corte.id, quantidade: 4 }],
    },
  ];
  if (barba)
    r.push({
      nome: 'Clube Corte + Barba',
      descricao: '4 cortes e 4 barbas por mês.',
      valor: arredondar((corte.preco + barba.preco) * 4 * 0.8),
      servicos: [
        { servicoId: corte.id, quantidade: 4 },
        { servicoId: barba.id, quantidade: 4 },
      ],
    });
  r.push({
    nome: 'Clube Corte à vontade',
    descricao: 'Corte sem limite no mês.',
    valor: arredondar(corte.preco * 6 * 0.8),
    servicos: [{ servicoId: corte.id, quantidade: null }],
  });
  return r;
}

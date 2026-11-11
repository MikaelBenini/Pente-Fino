// Nota fiscal de serviço (NFS-e) das mensalidades do Pente Fino (Etapa 23): o Asaas emite a nota
// de cada cobrança da assinatura da barbearia. A administração escolhe o serviço municipal, o
// ISS e quando emitir; os dados fiscais da empresa (inscrição municipal, certificado, regime)
// ficam no painel do Asaas, em Notas fiscais → Configurações.
import { z } from 'zod';

export const QUANDO_EMITIR_NOTA = ['pagamento', 'vencimento'] as const;
export type QuandoEmitirNota = (typeof QUANDO_EMITIR_NOTA)[number];
export const NOME_QUANDO_EMITIR_NOTA: Readonly<Record<QuandoEmitirNota, string>> = {
  pagamento: 'Quando a cobrança for paga',
  vencimento: 'No vencimento da cobrança (mesmo sem pagamento)',
};

/** Valor do Asaas para o campo effectiveDatePeriod. */
export const PERIODO_ASAAS_NOTA: Readonly<Record<QuandoEmitirNota, string>> = {
  pagamento: 'ON_PAYMENT_CONFIRMATION',
  vencimento: 'ON_PAYMENT_DUE_DATE',
};

const aliquota = (nome: string) =>
  z
    .number({ error: `Informe ${nome}.` })
    .min(0, { error: `${nome} não pode ser negativo.` })
    .max(30, { error: `${nome} vai até 30%.` });

export const configNotaFiscalSchema = z
  .object({
    /** Emitir a nota das mensalidades. Desligado, as assinaturas novas saem sem nota. */
    ativa: z.boolean(),
    /** Serviço da lista da prefeitura no Asaas (fiscalInfo/services); null = pelo código. */
    servicoMunicipalId: z.string().trim().max(60).nullable().default(null),
    /** Código do serviço (LC 116), por exemplo "1.05"; usado quando não há serviço da lista. */
    codigoServico: z.string().trim().max(20).default(''),
    nomeServico: z
      .string()
      .trim()
      .min(3, { error: 'Descreva o serviço (aparece na nota).' })
      .max(250),
    /** Alíquota do ISS em %. */
    iss: aliquota('O ISS'),
    /** Retenções federais em % (no Simples Nacional, normalmente zero). */
    pis: aliquota('O PIS').default(0),
    cofins: aliquota('O COFINS').default(0),
    csll: aliquota('O CSLL').default(0),
    inss: aliquota('O INSS').default(0),
    ir: aliquota('O IR').default(0),
    quando: z.enum(QUANDO_EMITIR_NOTA).default('pagamento'),
    observacoes: z.string().trim().max(500).default(''),
  })
  .refine((c) => !c.ativa || c.servicoMunicipalId || c.codigoServico, {
    error: 'Escolha o serviço da prefeitura ou informe o código do serviço.',
    path: ['codigoServico'],
  });
export type ConfigNotaFiscal = z.infer<typeof configNotaFiscalSchema>;
export type ConfigNotaFiscalEntrada = z.input<typeof configNotaFiscalSchema>;

export const NOTA_FISCAL_PADRAO: ConfigNotaFiscal = {
  ativa: false,
  servicoMunicipalId: null,
  codigoServico: '1.05',
  nomeServico: 'Licenciamento de uso de programa de computador (sistema de gestão Pente Fino)',
  iss: 2,
  pis: 0,
  cofins: 0,
  csll: 0,
  inss: 0,
  ir: 0,
  quando: 'pagamento',
  observacoes: '',
};

/** Configuração guardada (chave nota_fiscal); sem ela ou inválida, a nota fica desligada. */
export function lerConfigNotaFiscal(json: unknown): ConfigNotaFiscal {
  const r = configNotaFiscalSchema.safeParse(json);
  return r.success ? r.data : NOTA_FISCAL_PADRAO;
}

/** Corpo do POST /subscriptions/{id}/invoiceSettings do Asaas. */
export function configuracaoNotaAsaas(c: ConfigNotaFiscal) {
  return {
    ...(c.servicoMunicipalId
      ? { municipalServiceId: c.servicoMunicipalId }
      : { municipalServiceCode: c.codigoServico }),
    municipalServiceName: c.nomeServico,
    updatePayment: false,
    deductions: 0,
    effectiveDatePeriod: PERIODO_ASAAS_NOTA[c.quando],
    receivedOnly: c.quando === 'pagamento',
    observations: c.observacoes || undefined,
    taxes: {
      retainIss: false,
      iss: c.iss,
      pis: c.pis,
      cofins: c.cofins,
      csll: c.csll,
      inss: c.inss,
      ir: c.ir,
    },
  };
}

/** Situação dos dados fiscais da conta do Pente Fino no Asaas. */
export interface SituacaoFiscalAsaas {
  /** false = falta configurar em Notas fiscais → Configurações no painel do Asaas. */
  configurada: boolean;
  inscricaoMunicipal: string | null;
  simplesNacional: boolean | null;
  /** Certificado digital ou senha da prefeitura enviados ao Asaas. */
  acessoPrefeitura: boolean;
  /** O que a prefeitura da empresa exige para emitir (opções do município no Asaas). */
  tipoAcesso?: TipoAcessoPrefeitura | null;
}

export type TipoAcessoPrefeitura = 'certificado' | 'token' | 'usuario_senha';

export const NOME_ACESSO_PREFEITURA: Readonly<Record<TipoAcessoPrefeitura, string>> = {
  certificado: 'o certificado digital (e-CNPJ A1) da empresa',
  token: 'o token de acesso da prefeitura',
  usuario_senha: 'o usuário e a senha do portal da prefeitura',
};

/** authenticationType do Asaas (fiscalInfo/municipalOptions). */
export function tipoAcessoDoAsaas(v: string | null | undefined): TipoAcessoPrefeitura | null {
  if (v === 'CERTIFICATE') return 'certificado';
  if (v === 'TOKEN') return 'token';
  if (v === 'USER_AND_PASSWORD') return 'usuario_senha';
  return null;
}

export interface ServicoMunicipal {
  id: string;
  descricao: string;
  iss: number | null;
}

export interface ResultadoAplicarNota {
  aplicadas: number;
  falhas: { conta: string; motivo: string }[];
}

// ─── Pronta para ligar (admin R2) ─────────────────────────────────────────

/**
 * Inscrição municipal que não pode ser de verdade: vazia, curta demais, só um algarismo
 * repetido (000000, 111111) ou uma sequência (123456, 654321). É o que fica quando alguém
 * preenche o Asaas "só para testar".
 */
export function inscricaoDeExemplo(inscricao: string | null | undefined): boolean {
  const d = (inscricao ?? '').replace(/\D/g, '');
  if (d.length < 4) return true;
  if (/^(\d)\1+$/.test(d)) return true;
  const crescente = '01234567890123456789';
  const decrescente = '98765432109876543210';
  return crescente.includes(d) || decrescente.includes(d);
}

export type PendenciaNotaFiscal =
  'sem_dados_fiscais' | 'inscricao_exemplo' | 'sem_acesso_prefeitura' | 'sem_servico';

export interface ItemPendenciaNota {
  codigo: PendenciaNotaFiscal;
  mensagem: string;
}

/**
 * O que impede ligar a emissão. Lista vazia = pronta. Enquanto houver pendência, a nota fica
 * desligada e as mensalidades seguem cobradas como sempre (nada muda para a barbearia).
 */
export function pendenciasNotaFiscal(
  s: SituacaoFiscalAsaas,
  c: Pick<ConfigNotaFiscal, 'servicoMunicipalId' | 'codigoServico'>,
): ItemPendenciaNota[] {
  const p: ItemPendenciaNota[] = [];
  if (!s.configurada)
    p.push({
      codigo: 'sem_dados_fiscais',
      mensagem: `Os dados fiscais da empresa ainda não estão no Asaas (Notas fiscais → Configurações): inscrição municipal, regime${s.tipoAcesso ? ` e ${NOME_ACESSO_PREFEITURA[s.tipoAcesso]}` : ' e o acesso à prefeitura'}.`,
    });
  else {
    if (inscricaoDeExemplo(s.inscricaoMunicipal))
      p.push({
        codigo: 'inscricao_exemplo',
        mensagem: `A inscrição municipal no Asaas (${s.inscricaoMunicipal || 'vazia'}) parece de exemplo. Confira com o contador.`,
      });
    if (!s.acessoPrefeitura)
      p.push({
        codigo: 'sem_acesso_prefeitura',
        mensagem: s.tipoAcesso
          ? `Falta enviar ao Asaas ${NOME_ACESSO_PREFEITURA[s.tipoAcesso]}, que a prefeitura exige para emitir.`
          : 'Falta enviar ao Asaas o acesso à prefeitura (certificado digital, senha ou token).',
      });
  }
  if (!c.servicoMunicipalId && !c.codigoServico.trim())
    p.push({
      codigo: 'sem_servico',
      mensagem: 'Escolha o serviço da prefeitura ou informe o código do serviço.',
    });
  return p;
}

/** Situação no Asaas com o que falta para ligar (GET da tela). */
export interface ProntidaoNotaFiscal extends SituacaoFiscalAsaas {
  pendencias: ItemPendenciaNota[];
}

// ─── Notas emitidas (webhook do Asaas) ────────────────────────────────────

export const STATUS_NOTA_FISCAL = [
  'agendada',
  'enviada',
  'emitida',
  'erro',
  'cancelando',
  'cancelada',
] as const;
export type StatusNotaFiscal = (typeof STATUS_NOTA_FISCAL)[number];

export const NOME_STATUS_NOTA_FISCAL: Readonly<Record<StatusNotaFiscal, string>> = {
  agendada: 'Agendada',
  enviada: 'Enviada à prefeitura',
  emitida: 'Emitida',
  erro: 'Não emitida',
  cancelando: 'Cancelando',
  cancelada: 'Cancelada',
};

/**
 * Situação da nota a partir do evento do webhook (INVOICE_*) e do status que vem nele.
 * null = evento que não diz nada sobre a nota (ignorar).
 */
export function statusDaNotaAsaas(
  evento: string,
  status: string | undefined,
): StatusNotaFiscal | null {
  switch (evento) {
    case 'INVOICE_AUTHORIZED':
      return 'emitida';
    case 'INVOICE_ERROR':
      return 'erro';
    case 'INVOICE_SYNCHRONIZED':
      return 'enviada';
    case 'INVOICE_PROCESSING_CANCELLATION':
      return 'cancelando';
    case 'INVOICE_CANCELED':
      return 'cancelada';
    // A prefeitura não deixou cancelar: a nota continua emitida.
    case 'INVOICE_CANCELLATION_DENIED':
      return 'emitida';
    case 'INVOICE_CREATED':
    case 'INVOICE_UPDATED':
      switch (status) {
        case 'AUTHORIZED':
          return 'emitida';
        case 'ERROR':
          return 'erro';
        case 'PROCESSING_CANCELLATION':
          return 'cancelando';
        case 'CANCELED':
          return 'cancelada';
        case 'CANCELLATION_DENIED':
          return 'emitida';
        case 'SCHEDULED':
          return 'agendada';
        default:
          return null;
      }
    default:
      return null;
  }
}

/**
 * O Asaas avisa "pelo menos uma vez" e pode avisar fora de ordem. Nota emitida só sai de
 * emitida para o cancelamento; cancelada é final. O resto aceita o aviso novo (uma nota com
 * erro pode ser reenviada e ser emitida depois).
 */
export function aceitaStatusNota(atual: StatusNotaFiscal | null, novo: StatusNotaFiscal): boolean {
  if (!atual || atual === novo) return true;
  if (atual === 'cancelada') return false;
  if (atual === 'emitida') return novo === 'cancelando' || novo === 'cancelada';
  if (atual === 'cancelando') return novo === 'cancelada' || novo === 'emitida';
  return true;
}

/** Nota da mensalidade, como a barbearia vê na fatura. */
export interface NotaDaFatura {
  status: StatusNotaFiscal;
  numero: string | null;
  /** PDF da nota (só quando emitida). */
  pdfUrl: string | null;
}

/** Bloco "Nota fiscal" da Saúde do sistema. */
export interface NotasFiscaisNaSaude {
  ativa: boolean;
  /** Última nota emitida (qualquer conta). */
  ultimaEmitida: { conta: string; numero: string | null; quando: string } | null;
  /** Notas que não saíram nos últimos 30 dias, com a mensagem do Asaas ou da prefeitura. */
  erros: { conta: string; mensagem: string; quando: string }[];
  /** Notas a caminho (agendadas ou enviadas à prefeitura). */
  aCaminho: number;
}

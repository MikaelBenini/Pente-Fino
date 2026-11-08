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

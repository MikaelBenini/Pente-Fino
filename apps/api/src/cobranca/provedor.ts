// Cobrança da assinatura do Pente Fino atrás de uma interface: Asaas de verdade (sandbox ou
// produção) ou um provedor falso para os testes automáticos.
import { Logger } from '@nestjs/common';
import type { CobrancaExterna, DataISO } from '@pente-fino/shared';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

export interface ProvedorCobranca {
  readonly nome: 'asaas' | 'falso';
  criarCliente(d: {
    nome: string;
    documento: string;
    email: string;
    telefone: string | null;
    referencia: string;
  }): Promise<{ id: string }>;
  criarAssinatura(d: {
    cliente: string;
    valor: number;
    ciclo: 'mensal' | 'anual';
    vencimento: DataISO;
    descricao: string;
    referencia: string;
  }): Promise<{ id: string }>;
  cobrancasDaAssinatura(assinatura: string): Promise<CobrancaExterna[]>;
}

export class ErroCobranca extends Error {}

const centavos = (reais: number) => Math.round(reais * 100);

interface PagamentoAsaas {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string | null;
  billingType?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
}

/** Converte o pagamento do Asaas (reais, datas AAAA-MM-DD) para o nosso formato. */
export function cobrancaDoAsaas(p: PagamentoAsaas): CobrancaExterna {
  const pago = p.paymentDate ?? p.confirmedDate ?? p.clientPaymentDate ?? null;
  return {
    id: p.id,
    status: p.status,
    valor: centavos(p.value),
    vencimento: p.dueDate,
    link: p.invoiceUrl ?? null,
    forma: p.billingType ?? null,
    pagaEm: pago ? `${pago}T12:00:00-03:00` : null,
  };
}

/** API v3 do Asaas: cabeçalho access_token; valores em reais; erros em { errors: [...] }. */
export class ProvedorAsaas implements ProvedorCobranca {
  readonly nome = 'asaas' as const;
  constructor(private readonly c: { url: string; chave: string }) {}

  private async pedir<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: object): Promise<T> {
    if (!this.c.chave)
      throw new ErroCobranca('A cobrança não está configurada (falta ASAAS_API_KEY no .env).');
    const r = await fetch(`${this.c.url}${caminho}`, {
      method: metodo,
      headers: {
        access_token: this.c.chave,
        'content-type': 'application/json',
        'user-agent': 'pente-fino',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await r.json().catch(() => ({}))) as {
      errors?: { description?: string }[];
    } & T;
    if (!r.ok) {
      const motivo = json.errors?.map((e) => e.description).join(' ') || `HTTP ${r.status}`;
      throw new ErroCobranca(`O Asaas recusou: ${motivo}`);
    }
    return json;
  }

  async criarCliente(d: Parameters<ProvedorCobranca['criarCliente']>[0]) {
    const r = await this.pedir<{ id: string }>('POST', '/customers', {
      name: d.nome,
      cpfCnpj: d.documento,
      email: d.email,
      mobilePhone: d.telefone?.replace(/^55/, '') ?? undefined,
      externalReference: d.referencia,
      notificationDisabled: false,
    });
    return { id: r.id };
  }

  async criarAssinatura(d: Parameters<ProvedorCobranca['criarAssinatura']>[0]) {
    const r = await this.pedir<{ id: string }>('POST', '/subscriptions', {
      customer: d.cliente,
      // O cliente escolhe na página: Pix, boleto ou cartão.
      billingType: 'UNDEFINED',
      value: d.valor / 100,
      nextDueDate: d.vencimento,
      cycle: d.ciclo === 'anual' ? 'YEARLY' : 'MONTHLY',
      description: d.descricao,
      externalReference: d.referencia,
    });
    return { id: r.id };
  }

  async cobrancasDaAssinatura(assinatura: string) {
    const r = await this.pedir<{ data: PagamentoAsaas[] }>(
      'GET',
      `/subscriptions/${encodeURIComponent(assinatura)}/payments?limit=100`,
    );
    return r.data.map(cobrancaDoAsaas);
  }
}

/** Para os testes: guarda tudo na memória; `pagar` simula o pagamento. */
export class ProvedorCobrancaFalso implements ProvedorCobranca {
  readonly nome = 'falso' as const;
  private seq = 0;
  readonly assinaturas = new Map<string, CobrancaExterna[]>();

  async criarCliente() {
    return { id: `cus_falso_${++this.seq}` };
  }

  async criarAssinatura(d: Parameters<ProvedorCobranca['criarAssinatura']>[0]) {
    const id = `sub_falso_${++this.seq}`;
    this.assinaturas.set(id, [
      {
        id: `pay_falso_${++this.seq}`,
        status: 'PENDING',
        valor: d.valor,
        vencimento: d.vencimento,
        link: `https://sandbox.asaas.com/i/${id}`,
        forma: null,
        pagaEm: null,
      },
    ]);
    return { id };
  }

  async cobrancasDaAssinatura(assinatura: string) {
    return this.assinaturas.get(assinatura) ?? [];
  }

  pagar(assinatura: string, forma = 'PIX'): CobrancaExterna {
    const c = this.assinaturas.get(assinatura)![0]!;
    Object.assign(c, { status: 'RECEIVED', forma, pagaEm: new Date().toISOString() });
    return c;
  }
}

export const PROVEDOR_COBRANCA = Symbol('PROVEDOR_COBRANCA');

export const provedorCobranca = {
  provide: PROVEDOR_COBRANCA,
  inject: [CONFIGURACAO],
  useFactory: (c: Configuracao): ProvedorCobranca => {
    if (c.cobranca.provedor === 'falso') {
      if (c.ambiente !== 'test')
        new Logger('Cobrança').warn('COBRANCA_PROVEDOR=falso: nenhuma cobrança é criada.');
      return new ProvedorCobrancaFalso();
    }
    return new ProvedorAsaas({ url: c.cobranca.asaasUrl, chave: c.cobranca.asaasChave });
  },
};

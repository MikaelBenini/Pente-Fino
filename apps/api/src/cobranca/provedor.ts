// Cobrança da assinatura do Pente Fino atrás de uma interface: Asaas de verdade (sandbox ou
// produção) ou um provedor falso para os testes automáticos.
import { Logger } from '@nestjs/common';
import {
  configuracaoNotaAsaas,
  tipoAcessoDoAsaas,
  type CobrancaExterna,
  type ConfigNotaFiscal,
  type DadosRecebimento,
  type DataISO,
  type ServicoMunicipal,
  type SituacaoFiscalAsaas,
  type SituacaoRecebimento,
} from '@pente-fino/shared';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

/** Cobrança como o Asaas devolve (no webhook e em GET /payments/{id}), em reais. */
export interface PagamentoWebhook {
  id: string;
  customer: string;
  subscription?: string | null;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string | null;
  billingType?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  clientPaymentDate?: string | null;
  /** Valor depois da taxa do Asaas (o split usa este). */
  netValue?: number | null;
  /** Quando o Asaas prevê o crédito na conta. */
  estimatedCreditDate?: string | null;
  /** Split da cobrança (clube online): quanto foi para cada carteira, em reais. */
  split?: { walletId?: string; totalValue?: number | null }[] | null;
}

/** Nota fiscal como o Asaas devolve (no webhook e em GET /invoices/{id}). */
export interface NotaWebhook {
  id: string;
  customer?: string | null;
  payment?: string | null;
  status?: string;
  statusDescription?: string | null;
  number?: string | null;
  value?: number | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
}

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
    /** Clube online: parte que vai para a carteira da barbearia (subconta). */
    split?: { walletId: string; percentual: number };
  }): Promise<{ id: string }>;
  cobrancasDaAssinatura(assinatura: string): Promise<CobrancaExterna[]>;
  /**
   * A cobrança como está agora no Asaas; null se não existe. O webhook usa isto em vez do corpo
   * recebido (segurança W1): nem com o token vazado dá para inventar pagamento.
   */
  pagamento(id: string): Promise<PagamentoWebhook | null>;
  /** A nota fiscal como está agora no Asaas; null se não existe. */
  nota(id: string): Promise<NotaWebhook | null>;
  cancelarAssinatura(assinatura: string): Promise<void>;
  // ─── Subconta da barbearia (clube online) ───
  criarSubconta(d: DadosRecebimento): Promise<{ id: string; walletId: string; apiKey: string }>;
  situacaoSubconta(apiKey: string): Promise<SituacaoRecebimento>;
  /** Página do Asaas para a barbearia enviar os documentos; null = nada a enviar. */
  linkDocumentos(apiKey: string): Promise<string | null>;
  /** Saldo da subconta, em centavos. */
  saldoSubconta(apiKey: string): Promise<number>;
  /** Troca de plano: valor e descrição novos, também nas cobranças ainda em aberto. */
  atualizarAssinatura(assinatura: string, d: { valor: number; descricao: string }): Promise<void>;
  // ─── Nota fiscal das mensalidades (conta do Pente Fino) ───
  /** Liga a emissão da NFS-e em todas as cobranças da assinatura. */
  configurarNotaAssinatura(assinatura: string, c: ConfigNotaFiscal): Promise<void>;
  situacaoFiscal(): Promise<SituacaoFiscalAsaas>;
  servicosMunicipais(busca: string): Promise<ServicoMunicipal[]>;
}

export class ErroCobranca extends Error {
  constructor(
    mensagem: string,
    /** Código HTTP da resposta do Asaas, quando houve resposta. */
    readonly status?: number,
  ) {
    super(mensagem);
  }
}

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

  private async pedir<T>(
    metodo: 'GET' | 'POST' | 'DELETE',
    caminho: string,
    corpo?: object,
    chave = this.c.chave,
  ): Promise<T> {
    if (!chave)
      throw new ErroCobranca('A cobrança não está configurada (falta ASAAS_API_KEY no .env).');
    const r = await fetch(`${this.c.url}${caminho}`, {
      method: metodo,
      headers: {
        access_token: chave,
        'content-type': 'application/json',
        'user-agent': 'pente-fino',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await r.json().catch(() => ({}))) as {
      errors?: { description?: string }[];
      message?: string;
    } & T;
    if (!r.ok) {
      // Validação vem em errors[]; recusa de permissão (403) vem em message.
      const motivo =
        json.errors?.map((e) => e.description).join(' ') || json.message || `HTTP ${r.status}`;
      throw new ErroCobranca(`O Asaas recusou: ${motivo}`, r.status);
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
      ...(d.split
        ? { split: [{ walletId: d.split.walletId, percentualValue: d.split.percentual }] }
        : {}),
    });
    return { id: r.id };
  }

  async configurarNotaAssinatura(assinatura: string, c: ConfigNotaFiscal) {
    await this.pedir(
      'POST',
      `/subscriptions/${encodeURIComponent(assinatura)}/invoiceSettings`,
      configuracaoNotaAsaas(c),
    );
  }

  /** O que a prefeitura exige (certificado, token ou senha); sem resposta, não se sabe. */
  private async tipoAcesso() {
    try {
      const o = await this.pedir<{ authenticationType?: string }>(
        'GET',
        '/fiscalInfo/municipalOptions',
      );
      return tipoAcessoDoAsaas(o.authenticationType);
    } catch {
      return null;
    }
  }

  async situacaoFiscal(): Promise<SituacaoFiscalAsaas> {
    const tipoAcesso = await this.tipoAcesso();
    try {
      const f = await this.pedir<{
        municipalInscription?: string | null;
        simplesNacional?: boolean | null;
        passwordSent?: boolean;
        accessTokenSent?: boolean;
        certificateSent?: boolean;
      }>('GET', '/fiscalInfo');
      return {
        configurada: true,
        inscricaoMunicipal: f.municipalInscription || null,
        simplesNacional: f.simplesNacional ?? null,
        acessoPrefeitura: Boolean(f.passwordSent || f.accessTokenSent || f.certificateSent),
        tipoAcesso,
      };
    } catch (e) {
      // Sem dados fiscais o Asaas responde 404 (sem corpo de erro).
      if (e instanceof ErroCobranca && e.status === 404)
        return {
          configurada: false,
          inscricaoMunicipal: null,
          simplesNacional: null,
          acessoPrefeitura: false,
          tipoAcesso,
        };
      throw e;
    }
  }

  async servicosMunicipais(busca: string) {
    const q = new URLSearchParams({ limit: '30', ...(busca ? { description: busca } : {}) });
    const r = await this.pedir<{ data: { id: string; description: string; issTax?: number }[] }>(
      'GET',
      `/fiscalInfo/services?${q}`,
    );
    return r.data.map((s) => ({ id: s.id, descricao: s.description, iss: s.issTax ?? null }));
  }

  async cancelarAssinatura(assinatura: string) {
    await this.pedir('DELETE', `/subscriptions/${encodeURIComponent(assinatura)}`);
  }

  async criarSubconta(d: DadosRecebimento) {
    const r = await this.pedir<{ id: string; walletId: string; apiKey: string }>(
      'POST',
      '/accounts',
      {
        name: d.nome,
        email: d.email,
        cpfCnpj: d.documento,
        ...(d.tipo === 'pf' ? { birthDate: d.nascimento } : { companyType: d.tipoEmpresa }),
        mobilePhone: d.telefone,
        incomeValue: d.faturamentoMensal / 100,
        address: d.endereco,
        addressNumber: d.numero,
        complement: d.complemento,
        province: d.bairro,
        postalCode: d.cep,
      },
    );
    return { id: r.id, walletId: r.walletId, apiKey: r.apiKey };
  }

  async situacaoSubconta(apiKey: string): Promise<SituacaoRecebimento> {
    const r = await this.pedir<{ general?: string; documentation?: string }>(
      'GET',
      '/myAccount/status',
      undefined,
      apiKey,
    );
    if (r.general === 'APPROVED') return 'aprovada';
    if (r.general === 'REJECTED' || r.documentation === 'REJECTED') return 'recusada';
    if (r.documentation === 'PENDING') return 'documentos';
    return 'analise';
  }

  async linkDocumentos(apiKey: string) {
    const r = await this.pedir<{ data?: { onboardingUrl?: string | null }[] }>(
      'GET',
      '/myAccount/documents',
      undefined,
      apiKey,
    );
    return r.data?.find((x) => x.onboardingUrl)?.onboardingUrl ?? null;
  }

  async saldoSubconta(apiKey: string) {
    const r = await this.pedir<{ balance?: number }>('GET', '/finance/balance', undefined, apiKey);
    return centavos(r.balance ?? 0);
  }

  async atualizarAssinatura(assinatura: string, d: { valor: number; descricao: string }) {
    await this.pedir('POST', `/subscriptions/${encodeURIComponent(assinatura)}`, {
      value: d.valor / 100,
      description: d.descricao,
      updatePendingPayments: true,
    });
  }

  async cobrancasDaAssinatura(assinatura: string) {
    const r = await this.pedir<{ data: PagamentoAsaas[] }>(
      'GET',
      `/subscriptions/${encodeURIComponent(assinatura)}/payments?limit=100`,
    );
    return r.data.map(cobrancaDoAsaas);
  }

  /** GET que devolve null quando o Asaas responde 404 (não existe nesta conta). */
  private async buscar<T>(caminho: string): Promise<T | null> {
    try {
      return await this.pedir<T>('GET', caminho);
    } catch (e) {
      if (e instanceof ErroCobranca && e.status === 404) return null;
      throw e;
    }
  }

  async pagamento(id: string) {
    return this.buscar<PagamentoWebhook>(`/payments/${encodeURIComponent(id)}`);
  }

  async nota(id: string) {
    return this.buscar<NotaWebhook>(`/invoices/${encodeURIComponent(id)}`);
  }
}

/** Para os testes: guarda tudo na memória; `pagar` simula o pagamento. */
export class ProvedorCobrancaFalso implements ProvedorCobranca {
  readonly nome = 'falso' as const;
  private seq = 0;
  /** Prefixo por execução: o banco de testes guarda os ids das execuções anteriores. */
  private readonly rodada = Math.random().toString(36).slice(2, 8);
  readonly assinaturas = new Map<string, CobrancaExterna[]>();

  async criarCliente() {
    return { id: `cus_falso_${this.rodada}_${++this.seq}` };
  }

  async criarAssinatura(d: Parameters<ProvedorCobranca['criarAssinatura']>[0]) {
    const id = `sub_falso_${this.rodada}_${++this.seq}`;
    this.splits.set(id, d.split);
    this.assinaturas.set(id, [
      {
        id: `pay_falso_${this.rodada}_${++this.seq}`,
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

  /** Teste: o que o "Asaas" devolve em GET /payments/{id} e GET /invoices/{id}. */
  readonly pagamentosAsaas = new Map<string, PagamentoWebhook>();
  readonly notasAsaas = new Map<string, NotaWebhook>();

  async pagamento(id: string) {
    return this.pagamentosAsaas.get(id) ?? null;
  }

  async nota(id: string) {
    return this.notasAsaas.get(id) ?? null;
  }

  async atualizarAssinatura(assinatura: string, d: { valor: number; descricao: string }) {
    for (const c of this.assinaturas.get(assinatura) ?? [])
      if (c.status === 'PENDING') c.valor = d.valor;
  }

  readonly splits = new Map<string, { walletId: string; percentual: number } | undefined>();
  readonly canceladas = new Set<string>();
  readonly subcontas = new Map<string, SituacaoRecebimento>();

  async cancelarAssinatura(assinatura: string) {
    this.canceladas.add(assinatura);
  }

  async criarSubconta(d: DadosRecebimento) {
    const n = ++this.seq;
    const apiKey = `$aact_falso_${n}_${d.documento}`;
    this.subcontas.set(apiKey, 'documentos');
    return {
      id: `acc_falso_${this.rodada}_${n}`,
      walletId: `wal_falso_${this.rodada}_${n}`,
      apiKey,
    };
  }

  async situacaoSubconta(apiKey: string) {
    return this.subcontas.get(apiKey) ?? 'documentos';
  }

  async linkDocumentos(apiKey: string) {
    return this.subcontas.get(apiKey) === 'documentos'
      ? `https://sandbox.asaas.com/onboarding/${encodeURIComponent(apiKey)}`
      : null;
  }

  async saldoSubconta() {
    return 0;
  }

  readonly notas = new Map<string, ConfigNotaFiscal>();
  /** Teste: assinaturas cuja nota o "Asaas" recusa. */
  readonly notaRecusada = new Set<string>();

  async configurarNotaAssinatura(assinatura: string, c: ConfigNotaFiscal) {
    if (this.notaRecusada.has(assinatura))
      throw new ErroCobranca('O Asaas recusou: Informações fiscais não configuradas.');
    this.notas.set(assinatura, c);
  }

  /** Teste: dados fiscais da conta no "Asaas" (troque para simular o que falta). */
  situacao: SituacaoFiscalAsaas = {
    configurada: true,
    inscricaoMunicipal: '4.821.390-7',
    simplesNacional: true,
    acessoPrefeitura: true,
  };

  async situacaoFiscal(): Promise<SituacaoFiscalAsaas> {
    return { ...this.situacao };
  }

  async servicosMunicipais(busca: string) {
    return [
      { id: 'svc_falso_105', descricao: '1.05 - Licenciamento de programas de computação', iss: 2 },
      { id: 'svc_falso_601', descricao: '6.01 - Barbearia, cabeleireiros', iss: 3 },
    ].filter((s) => !busca || s.descricao.toLowerCase().includes(busca.toLowerCase()));
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

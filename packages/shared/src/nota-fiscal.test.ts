import { describe, expect, it } from 'vitest';
import {
  aceitaStatusNota,
  configNotaFiscalSchema,
  configuracaoNotaAsaas,
  inscricaoDeExemplo,
  lerConfigNotaFiscal,
  NOTA_FISCAL_PADRAO,
  pendenciasNotaFiscal,
  statusDaNotaAsaas,
  tipoAcessoDoAsaas,
} from './nota-fiscal.js';

describe('nota fiscal das mensalidades', () => {
  it('sem configuração ou inválida: desligada', () => {
    expect(lerConfigNotaFiscal(undefined)).toEqual(NOTA_FISCAL_PADRAO);
    expect(lerConfigNotaFiscal({ ativa: true, iss: 'x' }).ativa).toBe(false);
  });

  it('ligada exige serviço da prefeitura ou código', () => {
    const base = { ativa: true, nomeServico: 'Sistema de gestão', iss: 2 };
    expect(configNotaFiscalSchema.safeParse({ ...base, codigoServico: '' }).success).toBe(false);
    expect(configNotaFiscalSchema.safeParse({ ...base, codigoServico: '1.05' }).success).toBe(true);
    expect(configNotaFiscalSchema.safeParse({ ...base, servicoMunicipalId: 'svc_1' }).success).toBe(
      true,
    );
  });

  it('corpo do Asaas: código ou id do serviço, quando emitir e impostos', () => {
    const c = configNotaFiscalSchema.parse({
      ativa: true,
      codigoServico: '1.05',
      nomeServico: 'Sistema de gestão',
      iss: 2,
    });
    expect(configuracaoNotaAsaas(c)).toMatchObject({
      municipalServiceCode: '1.05',
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
      receivedOnly: true,
      taxes: { retainIss: false, iss: 2, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0 },
    });
    const v = configuracaoNotaAsaas({ ...c, servicoMunicipalId: 'svc_1', quando: 'vencimento' });
    expect(v).toMatchObject({
      municipalServiceId: 'svc_1',
      effectiveDatePeriod: 'ON_PAYMENT_DUE_DATE',
      receivedOnly: false,
    });
    expect(v).not.toHaveProperty('municipalServiceCode');
  });
});

describe('pronta para ligar (admin R2)', () => {
  const pronta = {
    configurada: true,
    inscricaoMunicipal: '4.821.390-7',
    simplesNacional: true,
    acessoPrefeitura: true,
  };
  const comCodigo = { servicoMunicipalId: null, codigoServico: '1.05' };

  it.each(['123456', '000000', '111.111', '654321', '0123', '', null, '12'])(
    'inscrição de exemplo: %s',
    (i) => expect(inscricaoDeExemplo(i)).toBe(true),
  );
  it.each(['4.821.390-7', '30219', '9081726354'])('inscrição de verdade: %s', (i) =>
    expect(inscricaoDeExemplo(i)).toBe(false),
  );

  it('pronta: nada pendente', () => {
    expect(pendenciasNotaFiscal(pronta, comCodigo)).toEqual([]);
  });

  it('a auditoria de 10/11: inscrição 123456 não deixa ligar', () => {
    expect(
      pendenciasNotaFiscal({ ...pronta, inscricaoMunicipal: '123456' }, comCodigo).map(
        (p) => p.codigo,
      ),
    ).toEqual(['inscricao_exemplo']);
  });

  it('sem dados fiscais no Asaas: só essa pendência (o resto não dá para saber)', () => {
    const s = {
      configurada: false,
      inscricaoMunicipal: null,
      simplesNacional: null,
      acessoPrefeitura: false,
    };
    expect(pendenciasNotaFiscal(s, comCodigo).map((p) => p.codigo)).toEqual(['sem_dados_fiscais']);
  });

  it('diz exatamente o acesso que a prefeitura exige (opções do município no Asaas)', () => {
    expect(tipoAcessoDoAsaas('CERTIFICATE')).toBe('certificado');
    expect(tipoAcessoDoAsaas('USER_AND_PASSWORD')).toBe('usuario_senha');
    expect(tipoAcessoDoAsaas('OUTRO')).toBeNull();
    const [p] = pendenciasNotaFiscal(
      { ...pronta, acessoPrefeitura: false, tipoAcesso: 'certificado' },
      comCodigo,
    );
    expect(p!.mensagem).toBe(
      'Falta enviar ao Asaas o certificado digital (e-CNPJ A1) da empresa, que a prefeitura exige para emitir.',
    );
  });

  it('sem acesso à prefeitura e sem serviço', () => {
    expect(
      pendenciasNotaFiscal(
        { ...pronta, acessoPrefeitura: false },
        { servicoMunicipalId: null, codigoServico: ' ' },
      ).map((p) => p.codigo),
    ).toEqual(['sem_acesso_prefeitura', 'sem_servico']);
  });
});

describe('situação da nota pelo webhook', () => {
  it.each([
    ['INVOICE_CREATED', 'SCHEDULED', 'agendada'],
    ['INVOICE_SYNCHRONIZED', 'SCHEDULED', 'enviada'],
    ['INVOICE_AUTHORIZED', 'AUTHORIZED', 'emitida'],
    ['INVOICE_ERROR', 'ERROR', 'erro'],
    ['INVOICE_UPDATED', 'ERROR', 'erro'],
    ['INVOICE_UPDATED', 'SYNCHRONIZED', 'enviada'],
    ['INVOICE_PROCESSING_CANCELLATION', 'PROCESSING_CANCELLATION', 'cancelando'],
    ['INVOICE_CANCELED', 'CANCELED', 'cancelada'],
    ['INVOICE_CANCELLATION_DENIED', 'CANCELLATION_DENIED', 'emitida'],
    ['INVOICE_UPDATED', 'ALGO_NOVO', null],
    ['PAYMENT_RECEIVED', undefined, null],
  ] as const)('%s (%s) → %s', (evento, status, esperado) => {
    expect(statusDaNotaAsaas(evento, status)).toBe(esperado);
  });

  it('aviso atrasado não desfaz a nota emitida; cancelada é final', () => {
    expect(aceitaStatusNota(null, 'agendada')).toBe(true);
    expect(aceitaStatusNota('agendada', 'emitida')).toBe(true);
    expect(aceitaStatusNota('erro', 'emitida')).toBe(true);
    expect(aceitaStatusNota('emitida', 'enviada')).toBe(false);
    expect(aceitaStatusNota('emitida', 'erro')).toBe(false);
    expect(aceitaStatusNota('emitida', 'cancelando')).toBe(true);
    expect(aceitaStatusNota('cancelando', 'emitida')).toBe(true);
    expect(aceitaStatusNota('cancelada', 'emitida')).toBe(false);
  });
});

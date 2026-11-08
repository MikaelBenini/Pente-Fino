import { describe, expect, it } from 'vitest';
import {
  configNotaFiscalSchema,
  configuracaoNotaAsaas,
  lerConfigNotaFiscal,
  NOTA_FISCAL_PADRAO,
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

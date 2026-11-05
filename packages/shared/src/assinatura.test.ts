import { describe, expect, it } from 'vitest';
import {
  documentoValido,
  faturaDaCobranca,
  situacaoAssinatura,
  TOLERANCIA_ATRASO_DIAS,
  valorDaCobranca,
} from './assinatura.js';

const agora = new Date('2026-11-05T15:00:00-03:00');
const dia = (n: number) => new Date(agora.getTime() + n * 86_400_000);

describe('situacaoAssinatura', () => {
  it('teste: conta os dias que faltam e não bloqueia', () => {
    expect(situacaoAssinatura({ status: 'teste', testeAte: dia(3) }, [], agora)).toMatchObject({
      situacao: 'teste',
      somenteLeitura: false,
      diasRestantesTeste: 3,
      mensagem: 'Faltam 3 dias de teste grátis.',
    });
  });

  it('teste vencido sem pagamento: só consulta', () => {
    expect(situacaoAssinatura({ status: 'teste', testeAte: dia(-1) }, [], agora)).toMatchObject({
      situacao: 'teste_vencido',
      somenteLeitura: true,
    });
  });

  it('em teste, mas já pagou: vale como ativa', () => {
    const r = situacaoAssinatura(
      { status: 'teste', testeAte: dia(-1) },
      [{ status: 'paga', vencimento: '2026-11-01' }],
      agora,
    );
    expect(r).toMatchObject({ situacao: 'ativa', somenteLeitura: false });
  });

  it('ativa em dia; fatura em aberto que ainda não venceu não pesa', () => {
    expect(
      situacaoAssinatura(
        { status: 'ativa', testeAte: null },
        [
          { status: 'paga', vencimento: '2026-10-05' },
          { status: 'aberta', vencimento: '2026-11-05' },
        ],
        agora,
      ),
    ).toMatchObject({ situacao: 'ativa', somenteLeitura: false });
  });

  it(`recusada e vencida: aviso até ${TOLERANCIA_ATRASO_DIAS} dias, depois só consulta`, () => {
    const conta = { status: 'ativa' as const, testeAte: null };
    expect(
      situacaoAssinatura(conta, [{ status: 'recusada', vencimento: '2026-11-02' }], agora),
    ).toMatchObject({ situacao: 'em_atraso', somenteLeitura: false, diasEmAtraso: 3 });
    expect(
      situacaoAssinatura(conta, [{ status: 'aberta', vencimento: '2026-10-28' }], agora),
    ).toMatchObject({ situacao: 'bloqueada', somenteLeitura: true, diasEmAtraso: 8 });
  });

  it('suspensa e cancelada pela administração: só consulta', () => {
    for (const status of ['suspensa', 'cancelada'] as const)
      expect(situacaoAssinatura({ status, testeAte: null }, [], agora).somenteLeitura).toBe(true);
  });
});

describe('cobrança', () => {
  it.each([
    ['529.982.247-25', true],
    ['52998224725', true],
    ['111.111.111-11', false],
    ['529.982.247-24', false],
    ['11.222.333/0001-81', true],
    ['11.222.333/0001-80', false],
    ['123', false],
  ])('documento %s → %s', (doc, ok) => expect(documentoValido(doc)).toBe(ok));

  it('valor: o mês no mensal, os 12 meses no anual (com o desconto do anual)', () => {
    expect(valorDaCobranca('pro', 'mensal', 1)).toBe(14990);
    expect(valorDaCobranca('pro', 'anual', 1)).toBe(12490 * 12);
    expect(valorDaCobranca('premium', 'mensal', 2)).toBe(24990 + 9990);
  });

  it('status do Asaas → fatura', () => {
    const base = { id: 'pay_1', valor: 14990, vencimento: '2026-11-05', link: null, pagaEm: null };
    expect(faturaDaCobranca({ ...base, status: 'PENDING', forma: null }).status).toBe('aberta');
    expect(faturaDaCobranca({ ...base, status: 'OVERDUE', forma: 'BOLETO' }).status).toBe('aberta');
    expect(
      faturaDaCobranca({
        ...base,
        status: 'RECEIVED',
        forma: 'PIX',
        pagaEm: '2026-11-05T13:00:00Z',
      }),
    ).toEqual({ status: 'paga', forma: 'pix', pagaEm: new Date('2026-11-05T13:00:00Z') });
    expect(faturaDaCobranca({ ...base, status: 'CONFIRMED', forma: 'CREDIT_CARD' }).forma).toBe(
      'cartao',
    );
    expect(faturaDaCobranca({ ...base, status: 'REFUNDED', forma: 'PIX' }).status).toBe(
      'cancelada',
    );
  });
});

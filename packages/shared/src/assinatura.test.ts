import { describe, expect, it } from 'vitest';
import { situacaoAssinatura, TOLERANCIA_ATRASO_DIAS } from './assinatura.js';

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

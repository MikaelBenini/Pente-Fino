import { describe, expect, it } from 'vitest';
import {
  diasRestantesDoTeste,
  proximaCobrancaDaConta,
  SEM_ORIGEM,
  vendasPorOrigem,
  whatsappDoDono,
} from './ficha-admin.js';
import { mascararDocumento, mascararTelefone } from './formatacao.js';
import { venderContaSchema } from './plataforma.js';

const hoje = '2026-11-11';
const base = {
  status: 'ativa' as const,
  testeAte: null,
  cortesiaAte: null,
  cobrarAPartirDe: null,
  cobrancaAutomatica: true,
  interna: false,
  cupom: null,
  descontoBp: 0,
  faturas: [],
};
const fatura = (
  o: Partial<{
    status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
    vencimento: string;
    periodoFim: string;
  }>,
) => ({
  status: 'paga' as 'aberta' | 'paga' | 'recusada' | 'cancelada',
  valor: 9900,
  vencimento: '2026-10-05',
  periodoFim: '2026-11-04',
  ...o,
});

describe('ficha da conta na administração (admin U3)', () => {
  it('dias que faltam do teste', () => {
    expect(diasRestantesDoTeste({ status: 'teste', testeAte: '2026-11-18T23:59:00Z' }, hoje)).toBe(
      7,
    );
    expect(diasRestantesDoTeste({ status: 'teste', testeAte: '2026-11-01' }, hoje)).toBe(0);
    expect(diasRestantesDoTeste({ status: 'ativa', testeAte: '2026-11-18' }, hoje)).toBeNull();
  });

  it('fatura em aberto vem primeiro, vencida ou não, com o cupom', () => {
    const r = proximaCobrancaDaConta(
      {
        ...base,
        cupom: 'LANCAMENTO',
        descontoBp: 3000,
        faturas: [fatura({ status: 'aberta', vencimento: '2026-11-05' })],
      },
      9900,
      hoje,
    );
    expect(r.titulo).toBe('R$ 99,00 venceu em 05/11/2026');
    expect(r.detalhe).toBe('Cupom LANCAMENTO (30% de desconto).');
  });

  it('ativa sem fatura: o dia seguinte ao último período pago', () => {
    const r = proximaCobrancaDaConta({ ...base, faturas: [fatura({})] }, 9900, hoje);
    expect(r.titulo).toBe('R$ 99,00 em 05/11/2026');
    expect(r.detalhe).toBe('Cobrança automática pelo Asaas.');
  });

  it('teste, cortesia, interna e cancelada', () => {
    expect(
      proximaCobrancaDaConta({ ...base, status: 'teste', testeAte: '2026-11-12' }, 9900, hoje)
        .titulo,
    ).toBe('Falta 1 dia de teste');
    expect(proximaCobrancaDaConta({ ...base, cortesiaAte: '2026-12-01' }, 9900, hoje).titulo).toBe(
      'Cortesia até 01/12/2026',
    );
    expect(proximaCobrancaDaConta({ ...base, interna: true }, 9900, hoje).titulo).toBe(
      'Sem cobrança',
    );
    expect(proximaCobrancaDaConta({ ...base, status: 'cancelada' }, 9900, hoje).detalhe).toBe(
      'Conta cancelada.',
    );
    expect(
      proximaCobrancaDaConta(
        { ...base, cobrancaAutomatica: false, cobrarAPartirDe: '2026-11-20' },
        9900,
        hoje,
      ).titulo,
    ).toBe('R$ 99,00 em 20/11/2026');
  });

  it('WhatsApp do dono com saudação; sem número, sem link', () => {
    expect(whatsappDoDono('5511988887777', 'João Silva')).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent('Olá, João! Aqui é da equipe Pente Fino.')}`,
    );
    expect(whatsappDoDono('(11) 98888-7777', 'Ana')).toMatch(/^https:\/\/wa\.me\/5511988887777\?/);
    expect(whatsappDoDono(null, 'Ana')).toBeNull();
    expect(whatsappDoDono('123', 'Ana')).toBeNull();
  });
});

describe('vendas por origem (admin U5)', () => {
  it('cadastros, conversão de quem saiu do teste e receita; internas fora', () => {
    const r = vendasPorOrigem({
      contas: [
        { id: 'a', origem: 'Google Ads · lancamento', status: 'ativa', interna: false },
        { id: 'b', origem: 'Google Ads · lancamento', status: 'cancelada', interna: false },
        { id: 'c', origem: 'Google Ads · lancamento', status: 'teste', interna: false },
        { id: 'd', origem: null, status: 'ativa', interna: false },
        { id: 'e', origem: null, status: 'ativa', interna: true },
      ],
      faturasPagas: [
        { contaId: 'a', valor: 9900 },
        { contaId: 'a', valor: 9900 },
        { contaId: 'd', valor: 4900 },
        { contaId: 'e', valor: 100000 },
      ],
    });
    expect(r).toEqual([
      {
        origem: 'Google Ads · lancamento',
        cadastros: 3,
        emTeste: 1,
        pagantes: 1,
        conversao: 0.5,
        receita: 19800,
      },
      { origem: SEM_ORIGEM, cadastros: 1, emTeste: 0, pagantes: 1, conversao: 1, receita: 4900 },
    ]);
  });

  it('todos ainda no teste: conversão sem número', () => {
    expect(
      vendasPorOrigem({
        contas: [{ id: 'a', origem: 'instagram.com', status: 'teste', interna: false }],
        faturasPagas: [],
      })[0]!.conversao,
    ).toBeNull();
  });
});

describe('máscaras da nova venda (admin U4)', () => {
  it('WhatsApp enquanto digita', () => {
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('1198')).toBe('(11) 98');
    expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(mascararTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(mascararTelefone('5511988887777')).toBe('(11) 98888-7777');
    expect(mascararTelefone('119888877779999')).toBe('(11) 98888-7777');
  });

  it('CPF e CNPJ enquanto digita', () => {
    expect(mascararDocumento('1234')).toBe('123.4');
    expect(mascararDocumento('52998224725')).toBe('529.982.247-25');
    expect(mascararDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('venda: CPF/CNPJ opcional, e conferido quando vem', () => {
    const base = {
      barbearia: 'Navalha',
      dono: { nome: 'João', email: 'j@x.com' },
      plano: 'pro',
      ciclo: 'mensal',
    };
    expect(venderContaSchema.parse({ ...base, documento: '529.982.247-25' }).documento).toBe(
      '52998224725',
    );
    expect(venderContaSchema.parse({ ...base, documento: '' }).documento).toBeNull();
    expect(venderContaSchema.parse(base).documento).toBeUndefined();
    expect(venderContaSchema.safeParse({ ...base, documento: '111.111.111-11' }).success).toBe(
      false,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { calcularIndicadores } from './indicadores.js';
import {
  pacoteCobre,
  saldoDoPacote,
  situacaoDoPacote,
  validoAteDoPacote,
  valorPorSessao,
} from './pacotes.js';

const p = { servicoId: 's1', sessoes: 10, usadas: 3, validoAte: '2026-12-31', canceladoEm: null };

describe('pacotes de sessões (Fase 1d)', () => {
  it('validade, saldo e valor por sessão', () => {
    expect(validoAteDoPacote('2026-11-28', 90)).toBe('2027-02-26');
    expect(saldoDoPacote(10, 3)).toBe(7);
    expect(saldoDoPacote(10, 12)).toBe(0);
    expect(valorPorSessao(100000, 10)).toBe(10000);
  });

  it('situação: cancelado, esgotado, vencido ou ativo', () => {
    expect(situacaoDoPacote(p, '2026-12-01')).toBe('ativo');
    expect(situacaoDoPacote(p, '2027-01-01')).toBe('vencido');
    expect(situacaoDoPacote({ ...p, usadas: 10 }, '2026-12-01')).toBe('esgotado');
    expect(situacaoDoPacote({ ...p, canceladoEm: '2026-12-01' }, '2026-12-01')).toBe('cancelado');
  });

  it('cobre só o serviço do pacote, ativo', () => {
    expect(pacoteCobre(p, 's1', '2026-12-01')).toBe(true);
    expect(pacoteCobre(p, 's2', '2026-12-01')).toBe(false);
    expect(pacoteCobre(p, 's1', '2027-01-01')).toBe(false);
  });

  it('indicadores: pacote pago entra no faturamento; a sessão sai do ticket médio', () => {
    const item = (o: object) => ({
      tipo: 'servico' as const,
      quantidade: 1,
      precoUnitario: 10000,
      desconto: 0,
      ehExtra: false,
      pesoAtendimento: 1,
      custoUnitario: 0,
      comissaoValor: 4000,
      ...o,
    });
    const i = calcularIndicadores(
      [
        { itens: [item({})] },
        // Sessão do pacote: valor zero, comissão sobre o preço de tabela.
        { itens: [item({ precoUnitario: 0, pacoteClienteId: 'p1' })] },
      ],
      [],
      { mensalidades: 0, pacotes: 100000 },
    );
    expect(i.receitaPacotes).toBe(100000);
    expect(i.faturamento).toBe(10000 + 100000);
    expect(i.clientes).toBe(2);
    expect(i.clientesAvulsos).toBe(1);
    expect(i.ticketMedio).toBe(10000);
    expect(i.atendimentosPacote).toBe(1);
    expect(i.atendimentos).toBe(2);
  });
});

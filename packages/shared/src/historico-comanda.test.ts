import { describe, expect, it } from 'vitest';
import { historicoDaComanda } from './historico-comanda.js';

const t = (hhmm: string, s = 0) => `2026-11-14T${hhmm}:${String(s).padStart(2, '0')}.000-03:00`;

describe('histórico da comanda (seção 7)', () => {
  it('linha do tempo em ordem, com abertura agrupada, pagamentos e auditoria', () => {
    const h = historicoDaComanda({
      criadaEm: t('09:00'),
      iniciadaEm: t('09:05'),
      confirmadaEm: t('09:40'),
      confirmadaPor: 'Rafa',
      fechadaEm: t('09:45'),
      fechadaPor: 'Marina',
      itens: [
        { nome: 'Corte', criadoEm: t('09:00', 1) },
        { nome: 'Barba', criadoEm: t('09:00', 2) },
        { nome: 'Pomada', criadoEm: t('09:30') },
      ],
      pagamentos: [
        { forma: 'pix', valor: 9000, criadoEm: t('09:44'), sinal: false, devolvidoEm: null },
      ],
      auditoria: [
        { acao: 'fechar', criadoEm: t('09:45'), quem: 'Marina', motivo: null },
        { acao: 'reabrir', criadoEm: t('10:10'), quem: 'Carlos', motivo: 'Cliente pediu nota' },
        { acao: 'qualquer_outra', criadoEm: t('10:11'), quem: null, motivo: null },
      ],
    });
    expect(h.map((e) => e.texto.replace(/\s/g, ' '))).toEqual([
      'Comanda aberta com corte e barba',
      'Atendimento começou',
      'Lançado: Pomada',
      'Barbeiro confirmou o atendimento',
      'Pagamento de R$ 90,00 no pix',
      'Comanda fechada',
      'Comanda reaberta: Cliente pediu nota',
    ]);
    expect(h.at(-1)).toMatchObject({ quem: 'Carlos', tom: 'aviso' });
  });

  it('comanda antiga sem auditoria do fechamento usa o horário dela; sinal com valor', () => {
    const h = historicoDaComanda({
      criadaEm: t('08:00'),
      iniciadaEm: null,
      confirmadaEm: null,
      confirmadaPor: null,
      fechadaEm: t('08:30'),
      fechadaPor: 'Marina',
      itens: [],
      pagamentos: [
        { forma: 'pix', valor: 2000, criadoEm: t('08:10'), sinal: true, devolvidoEm: null },
      ],
      auditoria: [{ acao: 'receber_sinal', criadoEm: t('08:10', 1), quem: 'Marina', motivo: null }],
    });
    expect(h.map((e) => e.texto.replace(/\s/g, ' '))).toEqual([
      'Comanda aberta',
      'Sinal recebido (R$ 20,00)',
      'Comanda fechada',
    ]);
  });
});

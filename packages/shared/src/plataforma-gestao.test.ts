import { describe, expect, it } from 'vitest';
import type { ContaNaPlataforma } from './plataforma.js';
import {
  diasDeAtraso,
  pendenciasDaPlataforma,
  resumirCobrancas,
  resumoDaMudanca,
} from './plataforma-gestao.js';

const agora = new Date('2026-11-20T15:00:00Z');
const conta = (o: Partial<ContaNaPlataforma>): ContaNaPlataforma => ({
  id: 'c1',
  nome: 'Barbearia A',
  plano: 'pro',
  ciclo: 'mensal',
  status: 'ativa',
  criadaEm: '2026-10-01T12:00:00Z',
  testeAte: null,
  configuradaEm: '2026-10-02T12:00:00Z',
  cobrancaAutomatica: false,
  canceladaEm: null,
  motivoCancelamento: null,
  vendedorId: null,
  donoAtivou: true,
  unidades: 1,
  profissionais: 2,
  whatsappConectado: true,
  fechadas7Dias: 10,
  ultimaFechadaEm: '2026-11-19T12:00:00Z',
  ultimoAcessoEm: '2026-11-19T12:00:00Z',
  interna: false,
  cortesiaAte: null,
  cobrarAPartirDe: null,
  ...o,
});

describe('cobranças', () => {
  it('atraso em dias e totais', () => {
    expect(diasDeAtraso('2026-11-15', '2026-11-20')).toBe(5);
    expect(diasDeAtraso('2026-11-25', '2026-11-20')).toBe(0);
    const base = { conta: 'A', vendedorId: null, origem: 'manual' as const, forma: null };
    const r = resumirCobrancas(
      [
        {
          ...base,
          contaId: 'a',
          valor: 10000,
          status: 'aberta',
          vencimento: '2026-11-10',
          pagaEm: null,
        },
        {
          ...base,
          contaId: 'b',
          valor: 5000,
          status: 'aberta',
          vencimento: '2026-11-25',
          pagaEm: null,
        },
        {
          ...base,
          contaId: 'c',
          valor: 7000,
          status: 'paga',
          vencimento: '2026-11-05',
          pagaEm: '2026-11-06T10:00:00Z',
        },
        {
          ...base,
          contaId: 'd',
          valor: 9000,
          status: 'paga',
          vencimento: '2026-08-05',
          pagaEm: '2026-08-06T10:00:00Z',
        },
      ],
      '2026-11-20',
    );
    expect(r.pendentes.map((c) => c.contaId)).toEqual(['a', 'b']);
    expect(r.pendentes[0]!.diasAtraso).toBe(10);
    expect(r.recebidas.map((c) => c.contaId)).toEqual(['c']);
    expect(r.totais).toEqual({
      vencido: 10000,
      aVencer7Dias: 5000,
      recebidoNoMes: 7000,
      quantidadeVencidas: 1,
    });
  });
});

describe('precisa de atenção', () => {
  it('cobrança vencida há 5+ dias é urgente; a vencer só acompanha', () => {
    const p = pendenciasDaPlataforma(
      [conta({})],
      [
        { contaId: 'c1', valor: 14990, status: 'aberta', vencimento: '2026-11-14' },
        { contaId: 'c1', valor: 14990, status: 'aberta', vencimento: '2026-11-24' },
      ],
      agora,
    );
    expect(p.map((x) => [x.tipo, x.prioridade])).toEqual([
      ['cobranca_vencida', 1],
      ['cobranca_a_vencer', 3],
    ]);
    expect(p[0]!.detalhe).toContain('há 6 dias');
  });

  it('teste acabando, dono que não ativou, sem configurar e sem uso', () => {
    const p = pendenciasDaPlataforma(
      [
        conta({ id: 't', nome: 'Teste', status: 'teste', testeAte: '2026-11-21T12:00:00Z' }),
        conta({
          id: 'v',
          nome: 'Vendida',
          vendedorId: 'x',
          donoAtivou: false,
          criadaEm: '2026-11-15T12:00:00Z',
          configuradaEm: null,
        }),
        conta({ id: 'n', nome: 'Nova', configuradaEm: null, criadaEm: '2026-11-10T12:00:00Z' }),
        conta({
          id: 's',
          nome: 'Sumida',
          ultimoAcessoEm: '2026-11-01T12:00:00Z',
          fechadas7Dias: 0,
        }),
        conta({
          id: 'x',
          nome: 'Cancelada',
          status: 'cancelada',
          fechadas7Dias: 0,
          ultimoAcessoEm: null,
        }),
      ],
      // As ativas já pagaram (senão também seriam "ativa sem cobrança").
      ['v', 'n', 's'].map((contaId) => ({
        contaId,
        valor: 14990,
        status: 'paga' as const,
        vencimento: '2026-11-01',
      })),
      agora,
    );
    expect(p.map((x) => x.tipo).sort()).toEqual(
      ['dono_nao_ativou', 'nao_configurada', 'sem_uso', 'teste_acabando'].sort(),
    );
    expect(p[0]).toMatchObject({ tipo: 'teste_acabando', prioridade: 1 });
  });

  it('teste de quem já pagou não entra', () => {
    const p = pendenciasDaPlataforma(
      [conta({ status: 'teste', testeAte: '2026-11-21T12:00:00Z' })],
      [{ contaId: 'c1', valor: 1, status: 'paga', vencimento: '2026-11-01' }],
      agora,
    );
    expect(p).toEqual([]);
  });
});

describe('auditoria', () => {
  it('resume só o que mudou, sem segredo', () => {
    expect(resumoDaMudanca({ plano: 'basico', senha: 'x' }, { plano: 'pro', senha: 'y' })).toBe(
      'plano: basico → pro',
    );
    expect(resumoDaMudanca(null, { email: 'a@b.c' })).toBe('email: a@b.c');
    expect(resumoDaMudanca({ a: 1 }, { a: 1 })).toBeNull();
  });

  // Admin R5: a auditoria de 10/11 viu uma conta ativa, sem cobrança, e "Tudo em dia por aqui".
  it('ativa sem cobrança pede atenção; cortesia, data para cobrar ou cobrança aberta, não', () => {
    const tipos = (
      o: Partial<ContaNaPlataforma>,
      cobrancas: Parameters<typeof pendenciasDaPlataforma>[1] = [],
    ) => pendenciasDaPlataforma([conta(o)], cobrancas, agora).map((x) => x.tipo);
    expect(tipos({})).toEqual(['ativa_sem_cobranca']);
    expect(pendenciasDaPlataforma([conta({})], [], agora)[0]).toMatchObject({ prioridade: 1 });
    expect(tipos({ cortesiaAte: '2026-12-31' })).toEqual([]);
    expect(tipos({ cortesiaAte: '2026-11-19' })).toEqual(['ativa_sem_cobranca']); // já acabou
    expect(tipos({ cobrarAPartirDe: '2026-11-25' })).toEqual([]);
    expect(
      tipos({}, [{ contaId: 'c1', valor: 14990, status: 'aberta', vencimento: '2026-11-25' }]),
    ).toEqual(['cobranca_a_vencer']);
  });

  it('teste com mais de 60 dias pede atenção (a auditoria viu um até 2028)', () => {
    const p = pendenciasDaPlataforma(
      [conta({ status: 'teste', testeAte: '2028-04-29T23:59:59-03:00' })],
      [],
      agora,
    );
    expect(p).toEqual([
      expect.objectContaining({
        tipo: 'teste_longo',
        detalhe: 'Teste até 29/04/2028 (mais de 60 dias)',
      }),
    ]);
  });

  it('conta interna não aparece em nada', () => {
    expect(
      pendenciasDaPlataforma(
        [
          conta({ interna: true }),
          conta({ interna: true, status: 'teste', testeAte: '2028-04-29T12:00:00Z' }),
        ],
        [],
        agora,
      ),
    ).toEqual([]);
  });

  // Admin R8: a Saúde mostrava "WhatsApp que caiu · desde 09/11 22:18" e o Início, "Tudo em dia".
  it('WhatsApp caído há mais de 2 h é urgente; menos que isso, ainda não', () => {
    const caiu = (horas: number) => ({
      contaId: 'c1',
      unidade: 'Centro',
      caiuEm: new Date(agora.getTime() - horas * 3_600_000).toISOString(),
    });
    const pago = [{ contaId: 'c1', valor: 1, status: 'paga' as const, vencimento: '2026-11-01' }];
    const tipos = (horas: number) =>
      pendenciasDaPlataforma([conta({})], pago, agora, { conexoesCaidas: [caiu(horas)] });
    expect(tipos(1)).toEqual([]);
    expect(tipos(3)).toEqual([
      expect.objectContaining({
        tipo: 'whatsapp_caido',
        prioridade: 1,
        detalhe: 'WhatsApp da unidade Centro caído há 3 horas: o bot e os lembretes estão parados',
      }),
    ]);
    expect(tipos(72)[0]!.detalhe).toContain('caído há 3 dias');
    // De outra conta, ou de conta interna: não entra.
    expect(
      pendenciasDaPlataforma([conta({ interna: true })], pago, agora, {
        conexoesCaidas: [caiu(5)],
      }),
    ).toEqual([]);
  });

  it('e-mail que não saiu: uma pendência do sistema, urgente se for de confirmação', () => {
    const p = pendenciasDaPlataforma([], [], agora, {
      falhasEmail: [{ critico: false }, { critico: true }],
    });
    expect(p).toEqual([
      {
        tipo: 'falha_email',
        contaId: null,
        conta: 'Sistema',
        irPara: 'saude',
        prioridade: 1,
        detalhe:
          '2 e-mails não saíram nas últimas 24 h (um é de boas-vindas ou confirmação de cadastro)',
        acao: 'Ver o motivo na Saúde do sistema e reenviar',
      },
    ]);
    expect(
      pendenciasDaPlataforma([], [], agora, { falhasEmail: [{ critico: false }] })[0],
    ).toMatchObject({ prioridade: 2, detalhe: '1 e-mail não saiu nas últimas 24 h' });
    expect(pendenciasDaPlataforma([], [], agora, { falhasEmail: [] })).toEqual([]);
  });
});

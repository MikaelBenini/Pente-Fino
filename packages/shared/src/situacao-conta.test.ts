import { describe, expect, it } from 'vitest';
import { problemaFimDoTeste, transicaoDaConta, type ContaParaSituacao } from './situacao-conta.js';

const hoje = '2026-11-11';
const conta = (c: Partial<ContaParaSituacao> = {}): ContaParaSituacao => ({
  status: 'ativa',
  statusAnterior: null,
  testeAte: null,
  cobrancaAutomatica: false,
  ...c,
});
const mudanca = (r: ReturnType<typeof transicaoDaConta>) => {
  if (!r.ok) throw new Error(r.motivo);
  return r.mudanca;
};
const motivo = (r: ReturnType<typeof transicaoDaConta>) => (r.ok ? null : r.motivo);

describe('bloquear e desbloquear (suspensão temporária)', () => {
  it('teste bloqueado volta ao teste com a mesma data de fim', () => {
    const t = conta({ status: 'teste', testeAte: '2026-11-22' });
    const b = mudanca(transicaoDaConta(t, { acao: 'bloquear' }, hoje));
    expect(b).toMatchObject({ status: 'suspensa', statusAnterior: 'teste' });
    expect(b.testeAte).toBeUndefined();
    const d = mudanca(
      transicaoDaConta(
        { ...t, status: 'suspensa', statusAnterior: 'teste' },
        { acao: 'desbloquear' },
        hoje,
      ),
    );
    expect(d).toMatchObject({ status: 'teste', statusAnterior: null });
    expect(d.testeAte).toBeUndefined(); // a data de fim fica como estava
  });

  it('ativa bloqueada volta a ativa, com as mesmas cobranças', () => {
    const b = mudanca(transicaoDaConta(conta(), { acao: 'bloquear' }, hoje));
    expect(b.statusAnterior).toBe('ativa');
    expect(b.pararCobrancaAutomatica).toBe(false);
    expect(
      mudanca(
        transicaoDaConta(
          conta({ status: 'suspensa', statusAnterior: 'ativa' }),
          { acao: 'desbloquear' },
          hoje,
        ),
      ).status,
    ).toBe('ativa');
  });

  it('bloqueada antes desta regra: volta ao teste se ainda havia dias, senão ativa', () => {
    const antiga = conta({ status: 'suspensa', statusAnterior: null });
    expect(
      mudanca(
        transicaoDaConta({ ...antiga, testeAte: '2026-11-20' }, { acao: 'desbloquear' }, hoje),
      ).status,
    ).toBe('teste');
    expect(mudanca(transicaoDaConta(antiga, { acao: 'desbloquear' }, hoje)).status).toBe('ativa');
  });

  // A auditoria de 10/11: teste → cancelada → "Desbloqueou" → ativa, sem cobrança nem data.
  it('cancelada não desbloqueia: só reativa, com o próximo passo', () => {
    const c = conta({ status: 'cancelada', testeAte: '2026-11-22' });
    expect(motivo(transicaoDaConta(c, { acao: 'desbloquear' }, hoje))).toMatch(/use Reativar/);
    expect(motivo(transicaoDaConta(c, { acao: 'reativar' }, hoje))).toMatch(/próximo passo/);
    expect(motivo(transicaoDaConta(c, { acao: 'bloquear' }, hoje))).toMatch(/Reativar/);
  });
});

describe('cancelar', () => {
  it('para a cobrança automática do Asaas (senão ela continua cobrando)', () => {
    expect(
      mudanca(transicaoDaConta(conta({ cobrancaAutomatica: true }), { acao: 'cancelar' }, hoje)),
    ).toEqual({
      status: 'cancelada',
      statusAnterior: null,
      cancelamento: 'marcar',
      pararCobrancaAutomatica: true,
    });
    expect(
      mudanca(transicaoDaConta(conta({ status: 'suspensa' }), { acao: 'cancelar' }, hoje)).status,
    ).toBe('cancelada');
    expect(
      motivo(transicaoDaConta(conta({ status: 'cancelada' }), { acao: 'cancelar' }, hoje)),
    ).toMatch(/já está cancelada/);
  });
});

describe('reativar (só cancelada, sempre com o próximo passo)', () => {
  const c = conta({ status: 'cancelada' });

  it('voltar ao teste até a data (no máximo 60 dias)', () => {
    expect(
      mudanca(
        transicaoDaConta(c, { acao: 'reativar', proximo: 'teste', data: '2026-11-25' }, hoje),
      ),
    ).toMatchObject({ status: 'teste', testeAte: '2026-11-25', cancelamento: 'limpar' });
    expect(
      motivo(transicaoDaConta(c, { acao: 'reativar', proximo: 'teste', data: '2028-04-29' }, hoje)),
    ).toMatch(/no máximo até 10\/01\/2027 \(60 dias\).*cortesia/);
  });

  it('ativar com cobrança a partir da data', () => {
    expect(
      mudanca(transicaoDaConta(c, { acao: 'reativar', proximo: 'cobranca', data: hoje }, hoje)),
    ).toMatchObject({ status: 'ativa', cobrarAPartirDe: hoje, cortesiaAte: null });
    expect(
      motivo(
        transicaoDaConta(c, { acao: 'reativar', proximo: 'cobranca', data: '2026-11-10' }, hoje),
      ),
    ).toMatch(/hoje ou depois/);
  });

  it('cortesia até a data: ativa sem cobrança, e a cobrança começa no dia seguinte', () => {
    expect(
      mudanca(
        transicaoDaConta(c, { acao: 'reativar', proximo: 'cortesia', data: '2026-12-31' }, hoje),
      ),
    ).toMatchObject({
      status: 'ativa',
      cortesiaAte: '2026-12-31',
      cobrarAPartirDe: '2027-01-01',
      cancelamento: 'limpar',
    });
  });

  it('bloqueada não reativa: desbloqueia', () => {
    expect(
      motivo(
        transicaoDaConta(
          conta({ status: 'suspensa' }),
          { acao: 'reativar', proximo: 'teste', data: hoje },
          hoje,
        ),
      ),
    ).toMatch(/Desbloquear/);
  });
});

describe('cortesia e início da cobrança', () => {
  it('teste vira cortesia (o fim do teste sai); ativa também', () => {
    expect(
      mudanca(
        transicaoDaConta(
          conta({ status: 'teste', testeAte: '2026-11-20' }),
          { acao: 'cortesia', data: '2027-03-31' },
          hoje,
        ),
      ),
    ).toMatchObject({
      status: 'ativa',
      testeAte: null,
      cortesiaAte: '2027-03-31',
      cobrarAPartirDe: '2027-04-01',
    });
    expect(motivo(transicaoDaConta(conta(), { acao: 'cortesia', data: hoje }, hoje))).toMatch(
      /depois de hoje/,
    );
    expect(
      motivo(transicaoDaConta(conta(), { acao: 'cortesia', data: '2028-01-01' }, hoje)),
    ).toMatch(/um ano/);
  });

  it('com cobrança automática, cortesia e "cobrar" não valem (o Asaas seguiria cobrando)', () => {
    const auto = conta({ cobrancaAutomatica: true });
    expect(motivo(transicaoDaConta(auto, { acao: 'cortesia', data: '2026-12-31' }, hoje))).toMatch(
      /cobrança automática/,
    );
    expect(motivo(transicaoDaConta(auto, { acao: 'cobrar', data: hoje }, hoje))).toMatch(
      /já cobra/,
    );
  });

  it('ativa sem cobrança recebe a data em que a cobrança começa (e a cortesia acaba)', () => {
    expect(
      mudanca(transicaoDaConta(conta(), { acao: 'cobrar', data: '2026-11-15' }, hoje)),
    ).toEqual({
      status: 'ativa',
      statusAnterior: null,
      cortesiaAte: null,
      cobrarAPartirDe: '2026-11-15',
      pararCobrancaAutomatica: false,
    });
    expect(
      motivo(transicaoDaConta(conta({ status: 'teste' }), { acao: 'cobrar', data: hoje }, hoje)),
    ).toMatch(/em teste/);
  });
});

describe('limite do teste (admin R6)', () => {
  it('de hoje até 60 dias; acima, orienta a cortesia', () => {
    expect(problemaFimDoTeste('2026-11-11', hoje)).toBeNull();
    expect(problemaFimDoTeste('2027-01-10', hoje)).toBeNull();
    expect(problemaFimDoTeste('2027-01-11', hoje)).toMatch(/cortesia/);
    expect(problemaFimDoTeste('2026-11-10', hoje)).toMatch(/passado/);
    expect(problemaFimDoTeste(undefined, hoje)).toMatch(/Informe/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  detectarAlertasEquipe,
  emailDeAlertasEquipe,
  type DadosAlertasEquipe,
} from './alertas-equipe.js';

const agora = new Date('2026-11-20T15:00:00Z'); // 20/11, 12h em São Paulo
const h = (horas: number) => new Date(agora.getTime() - horas * 3_600_000).toISOString();
const daqui = (horas: number) => new Date(agora.getTime() + horas * 3_600_000).toISOString();

const vazio: DadosAlertasEquipe = {
  contas: [],
  faturas: [],
  whatsappCaido: [],
  emailsFalhos: [],
  notasComErro: [],
  cupons: [],
};
const conta = (p: Partial<DadosAlertasEquipe['contas'][number]>) => ({
  id: 'c1',
  nome: 'Barbearia Um',
  status: 'ativa' as const,
  criadaEm: h(24 * 60),
  testeAte: null,
  interna: false,
  ultimaFechadaEm: h(5),
  ...p,
});

describe('detectarAlertasEquipe (admin F3)', () => {
  it('cadastro novo dos últimos 2 dias; o antigo e a conta interna não', () => {
    const r = detectarAlertasEquipe(
      {
        ...vazio,
        contas: [
          conta({ id: 'nova', nome: 'Nova', criadaEm: h(3) }),
          conta({ id: 'velha', criadaEm: h(24 * 5) }),
          conta({ id: 'interna', criadaEm: h(1), interna: true }),
        ],
      },
      agora,
    );
    expect(r).toEqual([{ tipo: 'cadastro_novo', chave: 'nova', texto: 'Nova criou a conta.' }]);
  });

  it('teste acabando em até 3 dias sem comanda fechada', () => {
    const r = detectarAlertasEquipe(
      {
        ...vazio,
        contas: [
          conta({ id: 'a', status: 'teste', testeAte: daqui(30), ultimaFechadaEm: null }),
          // Já fechou comanda, ou acaba daqui a 10 dias, ou já acabou: não.
          conta({ id: 'b', status: 'teste', testeAte: daqui(30) }),
          conta({ id: 'c', status: 'teste', testeAte: daqui(240), ultimaFechadaEm: null }),
          conta({ id: 'd', status: 'teste', testeAte: h(2), ultimaFechadaEm: null }),
        ],
      },
      agora,
    );
    expect(r.map((a) => [a.tipo, a.chave])).toEqual([['teste_acabando', 'a']]);
    expect(r[0]!.texto).toContain('acaba em 2 dias');
  });

  it('cobrança vencida (aberta ou recusada) até 30 dias; paga e futura não', () => {
    const r = detectarAlertasEquipe(
      {
        ...vazio,
        contas: [conta({})],
        faturas: [
          { contaId: 'c1', status: 'aberta', vencimento: '2026-11-15', valor: 14990 },
          { contaId: 'c1', status: 'recusada', vencimento: '2026-11-18', valor: 14990 },
          { contaId: 'c1', status: 'paga', vencimento: '2026-11-10', valor: 14990 },
          { contaId: 'c1', status: 'aberta', vencimento: '2026-11-25', valor: 14990 },
          { contaId: 'c1', status: 'aberta', vencimento: '2026-09-01', valor: 14990 },
        ],
      },
      agora,
    );
    expect(r.map((a) => a.chave)).toEqual(['c1:2026-11-15', 'c1:2026-11-18']);
    expect(r[1]!.texto).toBe(
      'Barbearia Um: fatura de R$ 149,90 venceu em 18/11/2026 (cartão recusado).',
    );
  });

  it('WhatsApp caído há mais de 2 horas; a chave muda se cair de novo', () => {
    const r = detectarAlertasEquipe(
      {
        ...vazio,
        contas: [conta({}), conta({ id: 'c2' })],
        whatsappCaido: [
          { contaId: 'c1', conta: 'Barbearia Um', caiuEm: h(3) },
          { contaId: 'c2', conta: 'Barbearia Dois', caiuEm: h(1) },
        ],
      },
      agora,
    );
    expect(r).toEqual([
      {
        tipo: 'whatsapp_caido',
        chave: `c1:${h(3)}`,
        texto: 'Barbearia Um: o WhatsApp caiu há 3 horas e não voltou.',
      },
    ]);
  });

  it('falha de e-mail do último dia, nota recusada da semana e cupom em 80% e esgotado', () => {
    const r = detectarAlertasEquipe(
      {
        ...vazio,
        emailsFalhos: [
          { id: '7', assunto: 'Bem-vindo', quando: h(2) },
          { id: '8', assunto: 'Antigo', quando: h(30) },
        ],
        notasComErro: [{ conta: 'Barbearia Um', numero: null, mensagem: 'CNPJ', quando: h(5) }],
        cupons: [
          { codigo: 'FUNDADOR', vagas: 20, usados: 16 },
          { codigo: 'CHEIO', vagas: 10, usados: 10 },
          { codigo: 'FOLGA', vagas: 20, usados: 3 },
          { codigo: 'LANCAMENTO', vagas: null, usados: 99 },
        ],
      },
      agora,
    );
    expect(r.map((a) => [a.tipo, a.chave])).toEqual([
      ['falha_email', '7'],
      ['falha_nf', `Barbearia Um::${h(5)}`],
      ['cupom_esgotando', 'FUNDADOR:80'],
      ['cupom_esgotando', 'CHEIO:esgotou'],
    ]);
  });
});

describe('emailDeAlertasEquipe', () => {
  const alertas = [
    { tipo: 'cadastro_novo' as const, chave: 'a', texto: 'Nova criou a conta.' },
    { tipo: 'falha_email' as const, chave: '7', texto: 'Não saiu: "Bem-vindo".' },
  ];

  it('só os tipos escolhidos, agrupados, com o link da administração', () => {
    const e = emailDeAlertasEquipe(alertas, ['cadastro_novo'], 'https://x/admin');
    expect(e?.assunto).toBe('Pente Fino: cadastro novo');
    expect(e?.texto).toContain('Cadastro novo:\n- Nova criou a conta.');
    expect(e?.texto).not.toContain('Bem-vindo');
    expect(e?.texto).toContain('https://x/admin');
  });

  it('vários alertas: o assunto diz quantos; nada escolhido: sem e-mail', () => {
    expect(
      emailDeAlertasEquipe(alertas, ['cadastro_novo', 'falha_email'], 'https://x')?.assunto,
    ).toBe('Pente Fino: 2 alertas para a equipe');
    expect(emailDeAlertasEquipe(alertas, [], 'https://x')).toBeNull();
  });
});

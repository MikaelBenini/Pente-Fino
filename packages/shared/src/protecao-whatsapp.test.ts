import { describe, expect, it } from 'vitest';
import {
  ehProativa,
  emailSemanaDoNumero,
  limiteDaMensagem,
  variarAbertura,
  limiteProativasDoDia,
  pausaPorRisco,
  proximaProativa,
  tempoDigitandoMs,
} from './protecao-whatsapp.js';

const agora = new Date('2026-11-27T15:00:00Z');
const diasAtras = (d: number) => new Date(agora.getTime() - d * 86_400_000);

describe('proteção dos números de WhatsApp (27/11/2026)', () => {
  it('proativa é a automática para quem não escreveu nas últimas 24 horas', () => {
    expect(ehProativa(null, agora.getTime())).toBe(true);
    expect(ehProativa(agora.getTime() - 3_600_000, agora.getTime())).toBe(false);
    expect(ehProativa(agora.getTime() - 25 * 3_600_000, agora.getTime())).toBe(true);
  });

  it('aquecimento: número novo manda pouco, e o limite cresce com os dias', () => {
    expect(limiteProativasDoDia(null, agora)).toBe(20);
    expect(limiteProativasDoDia(diasAtras(0), agora)).toBe(20);
    expect(limiteProativasDoDia(diasAtras(4), agora)).toBe(50);
    expect(limiteProativasDoDia(diasAtras(10), agora)).toBe(100);
    expect(limiteProativasDoDia(diasAtras(30), agora)).toBe(200);
  });

  it('ritmo humano: de 25 a 45 segundos entre duas proativas do mesmo número', () => {
    const t = agora.getTime();
    expect(proximaProativa(null, t, 0.5)).toBe(t);
    expect(proximaProativa(t - 60_000, t, 0.5)).toBe(t);
    expect(proximaProativa(t - 5_000, t, 0)).toBe(t + 20_000);
    expect(proximaProativa(t - 5_000, t, 1)).toBe(t + 40_000);
  });

  it('"digitando..." proporcional ao texto, entre 1,2 s e 6 s', () => {
    expect(tempoDigitandoMs('Oi')).toBe(1_200);
    expect(tempoDigitandoMs('x'.repeat(100))).toBe(4_500);
    expect(tempoDigitandoMs('x'.repeat(1_000))).toBe(6_000);
  });

  it('pausa por falhas seguidas (6 h) ou por muita gente pedindo SAIR (24 h)', () => {
    expect(pausaPorRisco({ falhasRecentes: 5, saidas24h: 0, proativas24h: 10 }, agora)).toEqual({
      ate: new Date(agora.getTime() + 6 * 3_600_000),
      motivo: 'falhas',
    });
    expect(pausaPorRisco({ falhasRecentes: 0, saidas24h: 5, proativas24h: 100 }, agora)).toEqual({
      ate: new Date(agora.getTime() + 24 * 3_600_000),
      motivo: 'saidas',
    });
    // 5 SAIR em 200 proativas é 2,5%: abaixo dos 3%, segue.
    expect(pausaPorRisco({ falhasRecentes: 0, saidas24h: 5, proativas24h: 200 }, agora)).toBeNull();
    expect(pausaPorRisco({ falhasRecentes: 4, saidas24h: 4, proativas24h: 10 }, agora)).toBeNull();
  });
});

describe('prioridade no limite do dia', () => {
  it('lembrete usa o limite todo; retorno e aniversário, 70%', () => {
    expect(limiteDaMensagem(20, 'lembrete')).toBe(20);
    expect(limiteDaMensagem(20, null)).toBe(20);
    expect(limiteDaMensagem(20, 'retorno')).toBe(14);
    expect(limiteDaMensagem(200, 'aniversario')).toBe(140);
  });
});

describe('abertura variada e e-mail da semana', () => {
  it('varia só a saudação do começo, sempre igual para a mesma mensagem', () => {
    const t = 'Oi, Ana! Lembrete do seu horário amanhã às 15h.';
    const formas = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => variarAbertura(t, s)));
    expect(formas.size).toBeGreaterThan(1);
    for (const f of formas) expect(f.endsWith('Lembrete do seu horário amanhã às 15h.')).toBe(true);
    expect(variarAbertura(t, 'x')).toBe(variarAbertura(t, 'x'));
    expect(variarAbertura('Seu horário mudou.', 'x')).toBe('Seu horário mudou.');
  });

  it('e-mail da semana com os números e o conselho certo', () => {
    const semana = {
      unidade: 'Centro',
      de: '2026-11-23',
      ate: '2026-11-29',
      proativas: 80,
      saidas: 4,
      pausas: 0,
      limiteHoje: 200,
      aquecendo: false,
    };
    const e = emailSemanaDoNumero({ nome: 'Carlos Lima', semana, link: 'https://x/bot' });
    expect(e.assunto).toBe('WhatsApp da Centro: a semana do número');
    expect(e.texto).toContain('De 23/11 a 29/11');
    expect(e.texto).toContain('Clientes que responderam SAIR: 4');
    expect(e.texto).toContain('Vários clientes pediram para parar');
    expect(
      emailSemanaDoNumero({ nome: 'C', semana: { ...semana, saidas: 0 }, link: '' }).texto,
    ).toContain('o número está saudável');
  });
});

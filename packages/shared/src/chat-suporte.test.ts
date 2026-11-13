import { describe, expect, it } from 'vitest';
import {
  avisoDoChat,
  chatEmHorario,
  iniciarChatSchema,
  respostasProntasDoChat,
  resumirChat,
} from './chat-suporte.js';

// Horários em UTC; São Paulo = UTC−3.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('chatEmHorario (admin F6)', () => {
  it('segunda a sexta das 9h às 18h; sábado das 9h às 13h; domingo fechado', () => {
    expect(chatEmHorario(sp('2026-11-16T09:00:00'))).toBe(true); // segunda
    expect(chatEmHorario(sp('2026-11-16T17:59:00'))).toBe(true);
    expect(chatEmHorario(sp('2026-11-16T18:00:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-16T08:59:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-21T12:30:00'))).toBe(true); // sábado
    expect(chatEmHorario(sp('2026-11-21T13:00:00'))).toBe(false);
    expect(chatEmHorario(sp('2026-11-22T10:00:00'))).toBe(false); // domingo
  });
});

describe('iniciarChatSchema', () => {
  const base = { nome: 'Carlos', texto: 'Quanto custa para 3 barbeiros?' };
  it('aceita WhatsApp com DDD ou e-mail', () => {
    expect(iniciarChatSchema.safeParse({ ...base, contato: '(11) 98888-7777' }).success).toBe(true);
    expect(iniciarChatSchema.safeParse({ ...base, contato: 'carlos@barbearia.com' }).success).toBe(
      true,
    );
  });
  it('recusa contato que não dá para responder', () => {
    const r = iniciarChatSchema.safeParse({ ...base, contato: '98888' });
    expect(r.success).toBe(false);
  });
});

describe('avisoDoChat', () => {
  const base = { status: 'fila' as const, posicao: 1, atendente: null, emHorario: true };
  it('fila, atendimento, fora do horário e encerrada', () => {
    expect(avisoDoChat(base)).toBe('Você é o próximo da fila. Já já alguém responde.');
    expect(avisoDoChat({ ...base, posicao: 3 })).toContain('2 pessoas na sua frente');
    expect(avisoDoChat({ ...base, status: 'atendendo', atendente: 'Ana' })).toBe(
      'Ana está te atendendo.',
    );
    expect(avisoDoChat({ ...base, emHorario: false })).toContain('fora do horário');
    expect(avisoDoChat({ ...base, status: 'encerrada' })).toContain('encerrada');
  });
});

describe('respostasProntasDoChat e resumirChat (sugestões do chat)', () => {
  it('as respostas prontas usam os preços e os dias de teste que recebem', () => {
    const r = respostasProntasDoChat({
      diasTeste: 14,
      basico: 'R$ 79,90',
      pro: 'R$ 149,90',
      premium: 'R$ 249,90',
    });
    expect(r.find((x) => x.titulo === 'Preço dos planos')?.texto).toContain('Básico R$ 79,90/mês');
    expect(r.find((x) => x.titulo === 'Como funciona o teste')?.texto).toContain('14 dias grátis');
  });

  it('respostas personalizadas trocam os marcadores pelos valores atuais', () => {
    const r = respostasProntasDoChat(
      { diasTeste: 14, basico: 'R$ 79,90', pro: 'R$ 149,90', premium: 'R$ 249,90' },
      [{ titulo: 'Oferta', texto: 'Básico por {basico} e {dias} dias de teste. {outro} fica.' }],
    );
    expect(r).toEqual([
      { titulo: 'Oferta', texto: 'Básico por R$ 79,90 e 14 dias de teste. {outro} fica.' },
    ]);
  });

  it('conversão em cadastro e primeira resposta só das começadas em horário', () => {
    const r = resumirChat([
      // Segunda 10h, respondida em 6 min, virou cadastro.
      {
        criadoEm: sp('2026-11-16T10:00:00').toISOString(),
        primeiraRespostaEm: sp('2026-11-16T10:06:00').toISOString(),
        virouConta: true,
      },
      // Segunda 11h, respondida em 2 min.
      {
        criadoEm: sp('2026-11-16T11:00:00').toISOString(),
        primeiraRespostaEm: sp('2026-11-16T11:02:00').toISOString(),
        virouConta: false,
      },
      // Segunda 15h, sem resposta ainda.
      {
        criadoEm: sp('2026-11-16T15:00:00').toISOString(),
        primeiraRespostaEm: null,
        virouConta: false,
      },
      // Domingo (fora do horário), respondida na segunda: não entra na média.
      {
        criadoEm: sp('2026-11-15T20:00:00').toISOString(),
        primeiraRespostaEm: sp('2026-11-16T09:30:00').toISOString(),
        virouConta: true,
      },
    ]);
    expect(r).toEqual({
      conversas: 4,
      viraramCadastro: 2,
      taxaCadastro: 0.5,
      primeiraRespostaMin: 4,
      semResposta: 1,
      avaliadas: 0,
      uteis: 0,
    });
  });

  it('sem conversas: zeros e sem média', () => {
    expect(resumirChat([])).toEqual({
      conversas: 0,
      viraramCadastro: 0,
      taxaCadastro: 0,
      primeiraRespostaMin: null,
      semResposta: 0,
      avaliadas: 0,
      uteis: 0,
    });
  });

  it('avaliações: conta as avaliadas e as úteis', () => {
    const base = {
      criadoEm: sp('2026-11-16T10:00:00').toISOString(),
      primeiraRespostaEm: null,
      virouConta: false,
    };
    const r = resumirChat([
      { ...base, avaliacao: true },
      { ...base, avaliacao: true },
      { ...base, avaliacao: false },
      { ...base, avaliacao: null },
    ]);
    expect(r).toMatchObject({ avaliadas: 3, uteis: 2 });
  });
});

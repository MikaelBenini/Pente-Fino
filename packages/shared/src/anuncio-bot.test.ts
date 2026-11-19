import { describe, expect, it } from 'vitest';
import {
  ehFraseDeAnuncio,
  FLUXO_ANUNCIO_PADRAO,
  fluxoAnuncioSchema,
  lerFluxoAnuncio,
  resumoDoAnuncio,
  responderAnuncio,
  type FluxoAnuncio,
} from './anuncio-bot.js';

const fluxo: FluxoAnuncio = {
  ativo: true,
  frases: ['Olá! Quero saber mais.'],
  etapas: ['Oi, {cliente}! Qual serviço te interessou?', 'Qual dia fica melhor?'],
  final: 'Anotado! Já passei para a equipe.',
};
const agora = new Date('2026-11-16T15:00:00Z');
const depois = (min: number) => new Date(agora.getTime() + min * 60_000);

describe('mensagens automáticas de anúncio (pedido do dono em 16/11/2026)', () => {
  it('desligado ou mensagem comum: segue o bot normal', () => {
    expect(responderAnuncio({ ...fluxo, ativo: false }, null, 'oi', agora, true, null)).toBeNull();
    expect(responderAnuncio(fluxo, null, 'quero marcar', agora, false, null)).toBeNull();
  });

  it('começa pelo anúncio (ou pela frase pronta), pergunta em sequência e passa para a equipe', () => {
    const r1 = responderAnuncio(fluxo, null, 'ola, quero saber mais', agora, false, 'João Silva')!;
    expect(r1).toMatchObject({ comecou: true, paraEquipe: false });
    expect(r1.respostas).toEqual(['Oi, João! Qual serviço te interessou?']);
    const r2 = responderAnuncio(fluxo, r1.sessao, 'Corte e barba', depois(1), false, 'João')!;
    expect(r2.respostas).toEqual(['Qual dia fica melhor?']);
    const r3 = responderAnuncio(fluxo, r2.sessao, 'Sábado de manhã', depois(2), false, 'João')!;
    expect(r3).toMatchObject({
      paraEquipe: true,
      respostas: ['Anotado! Já passei para a equipe.'],
    });
    expect(r3.sessao.comAtendente).toBe(true);
    expect(r3.sessao.anuncio).toBeUndefined();
    expect(resumoDoAnuncio(r3.sessao.respostasAnuncio!)).toBe(
      'Do anúncio: Corte e barba · Sábado de manhã',
    );
    // Com a equipe, o fluxo não volta nem com a frase do anúncio.
    expect(
      responderAnuncio(fluxo, r3.sessao, 'Olá! Quero saber mais.', depois(3), true, null),
    ).toBeNull();
  });

  it('sem nome, o {cliente} some sem deixar vírgula sobrando', () => {
    expect(responderAnuncio(fluxo, null, 'x', agora, true, null)!.respostas[0]).toBe(
      'Oi! Qual serviço te interessou?',
    );
  });

  it('frase do anúncio sem diferença de acento e pontuação; o padrão vem desligado', () => {
    expect(ehFraseDeAnuncio(fluxo, 'OLA quero saber mais!!')).toBe(true);
    expect(ehFraseDeAnuncio(fluxo, 'quero saber o preço')).toBe(false);
    expect(lerFluxoAnuncio(null)).toEqual(FLUXO_ANUNCIO_PADRAO);
    expect(FLUXO_ANUNCIO_PADRAO.ativo).toBe(false);
  });
});

describe('relatório de clientes de anúncio', () => {
  it('soma o que os clientes de anúncio gastaram e conta as conversas por anúncio', async () => {
    const { resumirAnuncios } = await import('./anuncio-bot.js');
    expect(
      resumirAnuncios({
        conversas: [{ titulo: 'Corte R$ 50' }, { titulo: 'Corte R$ 50' }, { titulo: null }],
        novosClientes: 2,
        comandas: [
          { clienteId: 'a', total: 5000 },
          { clienteId: 'a', total: 3500 },
          { clienteId: 'b', total: 4500 },
        ],
      }),
    ).toEqual({
      conversas: 3,
      novosClientes: 2,
      clientesQueCompraram: 2,
      faturamento: 13_000,
      ticket: 6500,
      porAnuncio: [
        { titulo: 'Corte R$ 50', conversas: 2 },
        { titulo: 'Sem título', conversas: 1 },
      ],
    });
    expect(resumirAnuncios({ conversas: [], novosClientes: 0, comandas: [] }).ticket).toBe(0);
  });
});

describe('cliente comum não cai no anúncio (16/11/2026)', () => {
  it('a frase só vale no começo da mensagem e numa conversa nova; a marca do WhatsApp vale sempre', () => {
    // No meio do texto: não é anúncio.
    expect(ehFraseDeAnuncio(fluxo, 'oi, queria saber mais sobre o corte')).toBe(false);
    // No meio de uma conversa (sessão de 5 min atrás): a frase não começa o fluxo.
    const emConversa = { caminho: [], comAtendente: false, ultimaEm: depois(-5).toISOString() };
    expect(
      responderAnuncio(fluxo, emConversa, 'Olá! Quero saber mais.', agora, false, null),
    ).toBeNull();
    // Conversa nova (última mensagem há 2 h): a frase começa o fluxo.
    const antiga = { caminho: [], comAtendente: false, ultimaEm: depois(-120).toISOString() };
    expect(
      responderAnuncio(fluxo, antiga, 'Olá! Quero saber mais.', agora, false, null)?.comecou,
    ).toBe(true);
    // Com a marca do WhatsApp, vale mesmo no meio de uma conversa.
    expect(responderAnuncio(fluxo, emConversa, 'oi', agora, true, null)?.comecou).toBe(true);
  });
});

// 18/11/2026: "está indo sozinha a mensagem de anúncio para os clientes".
describe('o fluxo do anúncio só vai para quem veio de anúncio', () => {
  const nova = { doAnuncio: false, primeiroContato: true, anuncioRecente: false };
  it('cliente da casa (já escreveu antes) não entra pela frase; com a marca do WhatsApp, entra', () => {
    const daCasa = { ...nova, primeiroContato: false };
    expect(responderAnuncio(fluxo, null, 'Olá! Quero saber mais.', agora, daCasa, null)).toBeNull();
    expect(
      responderAnuncio(fluxo, null, 'oi', agora, { ...daCasa, doAnuncio: true }, null)?.comecou,
    ).toBe(true);
  });

  it('quem já passou pelo fluxo há pouco não recebe de novo, nem com a marca', () => {
    const recente = { doAnuncio: true, primeiroContato: false, anuncioRecente: true };
    expect(responderAnuncio(fluxo, null, 'oi', agora, recente, null)).toBeNull();
  });

  it('frase curta não é aceita; a antiga salva sai, e o resto do fluxo continua', () => {
    expect(fluxoAnuncioSchema.safeParse({ ...fluxo, frases: ['Olá'] }).success).toBe(false);
    expect(fluxoAnuncioSchema.safeParse({ ...fluxo, frases: ['Oi tudo'] }).success).toBe(false);
    const lido = lerFluxoAnuncio({ ...fluxo, frases: ['Olá', 'Vi o anúncio de vocês'] });
    expect(lido).toMatchObject({ ativo: true, frases: ['Vi o anúncio de vocês'] });
  });

  it('o padrão vem sem frase nenhuma (a do Instagram pegava cliente comum)', () => {
    expect(FLUXO_ANUNCIO_PADRAO.frases).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  dentroDoHorario,
  descreverHorario,
  ehSaudacao,
  MENSAGENS_BOT_PADRAO,
  MENU_BOT_PADRAO,
  NOTA_NAO_ENTENDIDA,
  normalizar,
  preencher,
  responder,
  textoDoMenu,
  validarMenu,
  type ContextoConversa,
  type MenuBot,
  type SessaoBot,
} from './bot.js';

const agora = new Date('2026-11-04T14:00:00-03:00'); // quarta, 14h
const ctx = (p: Partial<ContextoConversa> = {}): ContextoConversa => ({
  agora,
  cliente: 'João Pedro',
  barbearia: 'Barbearia Navalha',
  unidade: 'Centro',
  endereco: 'Rua A, 10',
  horario: 'de segunda a sábado, das 9h às 19h',
  dentroDoHorario: true,
  link: 'https://app/agendar?u=centro',
  precos: [
    { nome: 'Corte', valor: 4500 },
    { nome: 'Barba', valor: 3500 },
  ],
  ...p,
});
const fala = (sessao: SessaoBot | null, entrada: string, c = ctx(), m: MenuBot = MENU_BOT_PADRAO) =>
  responder(m, MENSAGENS_BOT_PADRAO, sessao, entrada, c);

describe('texto', () => {
  it('normaliza acento, caixa e pontuação', () => {
    expect(normalizar('  Preço!!  da BARBA? ')).toBe('preco da barba');
  });

  it('preenche variáveis e arruma a pontuação quando falta valor', () => {
    expect(
      preencher('Olá, {cliente}! Aqui é a {unidade}.', { cliente: 'Ana', unidade: 'Centro' }),
    ).toBe('Olá, Ana! Aqui é a Centro.');
    expect(preencher('Olá, {cliente}! Aqui é a {unidade}.', { unidade: 'Centro' })).toBe(
      'Olá! Aqui é a Centro.',
    );
    expect(preencher('{desconhecida}', {})).toBe('{desconhecida}');
    expect(preencher('Estamos aqui.\n{mapa}\nAté já.', {})).toBe('Estamos aqui.\nAté já.');
  });

  it('monta o menu numerado, com 0 só nos submenus', () => {
    expect(textoDoMenu(MENU_BOT_PADRAO.menu, {}, false)).toBe(
      'Como posso ajudar?\n\n1. Agendar horário\n2. Ver preços\n3. Endereço e horário\n4. Falar com um atendente',
    );
    expect(
      textoDoMenu({ texto: 'Qual?', opcoes: MENU_BOT_PADRAO.menu.opcoes.slice(0, 1) }, {}, true),
    ).toMatch(/1\. Agendar horário\n0\. Voltar$/);
  });
});

describe('conversa', () => {
  it('primeira mensagem: boas-vindas com o nome e o menu', () => {
    const r = fala(null, 'oi');
    expect(r.respostas).toEqual([
      'Olá, João! Aqui é a Barbearia Navalha.',
      textoDoMenu(MENU_BOT_PADRAO.menu, {}, false),
    ]);
    expect(r.sessao).toMatchObject({ caminho: [], comAtendente: false });
  });

  it('fora do horário avisa antes e o menu continua funcionando', () => {
    const r = fala(null, 'boa noite', ctx({ dentroDoHorario: false }));
    expect(r.respostas[0]).toBe(
      'Agora estamos fechados. Funcionamos de segunda a sábado, das 9h às 19h. Você pode agendar pelo menu a qualquer hora.',
    );
    expect(r.respostas).toHaveLength(3);
  });

  it('número do menu: preços com a tabela da unidade', () => {
    const s = fala(null, 'oi').sessao;
    const r = fala(s, '2');
    expect(r.acao).toBe('ver_precos');
    expect(r.respostas[0]).toBe('Nossos preços:\n• Corte: R$ 45,00\n• Barba: R$ 35,00');
  });

  it('agendar manda o link; sem link, passa para o atendente', () => {
    const s = fala(null, 'oi').sessao;
    expect(fala(s, '1').respostas[0]).toMatch(/por aqui:\nhttps:\/\/app\/agendar\?u=centro$/);
    const semLink = fala(s, '1', ctx({ link: null }));
    expect(semLink.acao).toBe('falar_com_atendente');
  });

  it('palavra-chave vale em qualquer ponto, sem acento e no meio da frase', () => {
    const s = fala(null, 'oi').sessao;
    expect(fala(s, 'Quanto custa a BARBA?').acao).toBe('ver_precos');
    expect(fala(s, 'onde fica?').respostas[0]).toBe(
      'Estamos em Rua A, 10.\nhttps://www.google.com/maps/search/?api=1&query=Rua%20A%2C%2010\nFuncionamos de segunda a sábado, das 9h às 19h.',
    );
    // Na primeira mensagem, cumprimenta e já responde.
    const primeira = fala(null, 'qual o preço do corte?');
    expect(primeira.respostas[0]).toBe('Olá, João! Aqui é a Barbearia Navalha.');
    expect(primeira.acao).toBe('ver_precos');
  });

  it('não entendeu: uma mensagem só, com as opções uma por linha (legível no celular)', () => {
    const s = fala(null, 'oi').sessao;
    const r = fala(s, '7');
    expect(r.respostas).toEqual([
      'Não entendi. Responda com o número de uma das opções:\n\n' +
        '1. Agendar horário\n2. Ver preços\n3. Endereço e horário\n4. Falar com um atendente',
    ]);
    expect(r.sessao.erros).toBe(1);
  });

  it('erros seguidos: o 2º oferece o menu e o atendente, do 3º em diante o bot fica quieto', () => {
    let s = fala(null, 'oi').sessao;
    s = fala(s, 'kkkk').sessao;
    const segundo = fala(s, 'blz');
    expect(segundo.respostas).toEqual([MENSAGENS_BOT_PADRAO.nao_entendi_de_novo]);
    const terceiro = fala(segundo.sessao, 'hein');
    expect(terceiro.respostas).toEqual([]);
    expect(fala(terceiro.sessao, '???').respostas).toEqual([]);
    // Acertou: volta a responder e a conta zera.
    const acertou = fala(terceiro.sessao, '3');
    expect(acertou.respostas.join('\n')).toContain('Rua A, 10');
    expect(acertou.sessao.erros).toBe(0);
    expect(fala(acertou.sessao, 'xyz').respostas).toHaveLength(1);
  });

  it('0 e palavra-chave tiram do silêncio', () => {
    let s = fala(null, 'oi').sessao;
    for (const t of ['a', 'b', 'c']) s = fala(s, t).sessao;
    expect(fala(s, '0').respostas[0]).toMatch(/^Como posso ajudar\?/);
    expect(fala(s, 'menu').respostas.join('\n')).toMatch(/Como posso ajudar\?/);
  });

  it('entende o número escrito de outros jeitos e o nome da opção', () => {
    const s = fala(null, 'oi').sessao;
    for (const t of ['2', '2.', 'opção 2', 'Opcao 2', 'a dois', 'dois', '2 por favor']) {
      expect(fala(s, t).acao, t).toBe('ver_precos');
    }
    const m: MenuBot = { ...MENU_BOT_PADRAO, palavrasChave: [] };
    expect(fala(s, 'ver precos', ctx(), m).acao).toBe('ver_precos');
    expect(fala(s, 'quero o endereco e horario', ctx(), m).acao).toBe('endereco');
    // "horario" está em "Agendar horário" e em "Endereço e horário": não escolhe no chute.
    expect(fala(s, 'horario', ctx(), m).acao).toBeNull();
    expect(fala(s, 'endereco', ctx(), m).acao).toBe('endereco');
    // Curto demais para escolher pelo nome.
    expect(fala(s, 'a', ctx(), m).acao).toBeNull();
  });

  it('nome que combina com mais de uma opção não escolhe no chute', () => {
    const m: MenuBot = {
      palavrasChave: [],
      menu: {
        texto: 'Escolha',
        opcoes: [
          { id: 'a', rotulo: 'Corte social', resposta: 'A', acao: null, submenu: null },
          { id: 'b', rotulo: 'Corte degradê', resposta: 'B', acao: null, submenu: null },
        ],
      },
    };
    const s = fala(null, 'oi', ctx(), m).sessao;
    expect(fala(s, 'corte', ctx(), m).respostas[0]).toMatch(/^Não entendi/);
    expect(fala(s, 'corte degrade', ctx(), m).respostas[0]).toBe('B');
  });

  it('{barbearia} é o nome da conta e {unidade} o da unidade', () => {
    expect(fala(null, 'oi').respostas[0]).toBe('Olá, João! Aqui é a Barbearia Navalha.');
    expect(preencher('{barbearia} · {unidade}', { barbearia: 'Navalha', unidade: 'Centro' })).toBe(
      'Navalha · Centro',
    );
  });

  it('atendente: o bot fica quieto até a recepção devolver', () => {
    const s = fala(null, 'oi').sessao;
    const r = fala(s, '4');
    expect(r.sessao.comAtendente).toBe(true);
    expect(fala(r.sessao, 'alô?').respostas).toEqual([]);
  });

  it('SAIR e RECEBER mudam o consentimento, mesmo com atendente', () => {
    const comAtendente: SessaoBot = {
      caminho: [],
      ultimaEm: agora.toISOString(),
      comAtendente: true,
    };
    expect(fala(comAtendente, 'SAIR')).toMatchObject({ consentimento: false });
    expect(fala(null, 'Receber').respostas[0]).toBe(
      'Combinado! Você volta a receber os lembretes da Barbearia Navalha.',
    );
  });

  it('com atendente, o bot espera 2 horas antes de voltar sozinho', () => {
    const ha = (min: number): SessaoBot => ({
      caminho: [],
      ultimaEm: new Date(agora.getTime() - min * 60_000).toISOString(),
      comAtendente: true,
    });
    expect(fala(ha(90), 'oi').respostas).toEqual([]);
    const voltou = fala(ha(121), 'oi');
    expect(voltou.respostas[0]).toBe('Olá, João! Aqui é a Barbearia Navalha.');
    expect(voltou.sessao.comAtendente).toBe(false);
  });

  it('depois de 30 minutos parado, a conversa recomeça', () => {
    const antiga: SessaoBot = {
      caminho: ['x'],
      ultimaEm: new Date(agora.getTime() - 31 * 60_000).toISOString(),
      comAtendente: false,
    };
    const r = fala(antiga, '2');
    expect(r.respostas[0]).toBe('Olá, João! Aqui é a Barbearia Navalha.');
    expect(r.sessao).toMatchObject({ caminho: [], comAtendente: false });
  });

  it('submenu: entra, responde e volta com 0', () => {
    const m: MenuBot = {
      palavrasChave: [],
      menu: {
        texto: 'Escolha:',
        opcoes: [
          {
            id: 'servicos',
            rotulo: 'Serviços',
            resposta: '',
            acao: null,
            submenu: {
              texto: 'Qual serviço?',
              opcoes: [
                {
                  id: 'pig',
                  rotulo: 'Pigmentação',
                  resposta: 'Leva 1 hora.',
                  acao: null,
                  submenu: null,
                },
              ],
            },
          },
        ],
      },
    };
    const s0 = fala(null, 'oi', ctx(), m).sessao;
    const s1 = fala(s0, '1', ctx(), m);
    expect(s1.respostas).toEqual(['Qual serviço?\n\n1. Pigmentação\n0. Voltar']);
    expect(fala(s1.sessao, '1', ctx(), m).respostas[0]).toBe('Leva 1 hora.');
    const volta = fala(s1.sessao, '0', ctx(), m);
    expect(volta.sessao.caminho).toEqual([]);
    expect(volta.respostas[0]).toBe('Escolha:\n\n1. Serviços');
  });
  describe('convite para receber avisos', () => {
    const convite = MENSAGENS_BOT_PADRAO.convite_avisos;

    it('número que ainda não escolheu recebe o convite no fim da primeira resposta', () => {
      const r = fala(null, 'oi', ctx({ pedirConsentimento: true }));
      expect(r.respostas.at(-1)).toBe(convite);
      expect(r.respostas.length).toBeGreaterThan(1);
    });

    it('também quando a conversa começa por palavra-chave', () => {
      const r = fala(null, 'qual o preço?', ctx({ pedirConsentimento: true }));
      expect(r.respostas.at(-1)).toBe(convite);
    });

    it('só na abertura: no meio da conversa não repete', () => {
      const r0 = fala(null, 'oi', ctx({ pedirConsentimento: true }));
      const r1 = fala(r0.sessao, '2', ctx({ pedirConsentimento: true }));
      expect(r1.respostas).not.toContain(convite);
    });

    it('quem já escolheu não recebe', () => {
      expect(fala(null, 'oi').respostas).not.toContain(convite);
    });

    it('SAIR e RECEBER respondem só a confirmação', () => {
      const sair = fala(null, 'SAIR', ctx({ pedirConsentimento: true }));
      expect(sair.respostas).toEqual([MENSAGENS_BOT_PADRAO.saida_avisos]);
      expect(sair.consentimento).toBe(false);
    });

    it('pedido de atendente na abertura não leva convite', () => {
      const r = fala(null, 'atendente', ctx({ pedirConsentimento: true }));
      expect(r.sessao.comAtendente).toBe(true);
      expect(r.respostas).not.toContain(convite);
    });
  });
});

describe('validarMenu', () => {
  it('o menu padrão pode ser publicado', () => {
    expect(validarMenu(MENU_BOT_PADRAO)).toEqual([]);
  });

  it('aponta cada problema com o lugar exato', () => {
    const r = validarMenu({
      menu: {
        texto: 'Oi {apelido}',
        opcoes: [
          { id: 'a', rotulo: '', resposta: '', acao: null, submenu: null },
          {
            id: 'b',
            rotulo: 'Sub',
            resposta: '',
            acao: null,
            submenu: { texto: 'Vazio', opcoes: [] },
          },
        ],
      },
      palavrasChave: [
        { id: 'k1', palavras: ['preço'], resposta: 'x', acao: null },
        { id: 'k2', palavras: ['PRECO', 'sair'], resposta: '', acao: null },
      ],
    });
    expect(r).toEqual(
      expect.arrayContaining([
        { onde: 'Menu principal', mensagem: 'A variável {apelido} não existe.' },
        { onde: 'Opção 1 do menu principal', mensagem: 'Dê um nome para a opção.' },
        {
          onde: 'Opção 1 do menu principal',
          mensagem: 'Escreva a resposta ou escolha o que a opção faz.',
        },
        { onde: '"Sub"', mensagem: 'O menu precisa de pelo menos uma opção.' },
        { onde: 'Palavras-chave, grupo 2', mensagem: '"preco" já está no grupo 1.' },
        {
          onde: 'Palavras-chave, grupo 2',
          mensagem: '"sair" é uma palavra do sistema e não pode ser usada.',
        },
        {
          onde: 'Palavras-chave, grupo 2',
          mensagem: 'Escreva a resposta ou escolha o que o grupo faz.',
        },
      ]),
    );
  });

  it('limite de opções por menu', () => {
    const opcoes = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      rotulo: `O${i}`,
      resposta: 'x',
      acao: null,
      submenu: null,
    }));
    expect(validarMenu({ menu: { texto: 'x', opcoes }, palavrasChave: [] })).toEqual([
      { onde: 'Menu principal', mensagem: 'No máximo 9 opções por menu.' },
    ]);
  });
});

describe('horário', () => {
  const semana = [1, 2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, inicioMin: 540, fimMin: 1140 }));

  it('descreve juntando os dias seguidos', () => {
    expect(descreverHorario(semana)).toBe('de segunda a sábado, das 9h às 19h');
    expect(
      descreverHorario([
        ...semana.slice(0, 5),
        { diaSemana: 6, inicioMin: 480, fimMin: 780 },
        { diaSemana: 0, inicioMin: 540, fimMin: 720 },
      ]),
    ).toBe(
      'de segunda a sexta, das 9h às 19h; aos sábados, das 8h às 13h; aos domingos, das 9h às 12h',
    );
    expect(descreverHorario([{ diaSemana: 3, inicioMin: 570, fimMin: 1110 }])).toBe(
      'às quartas, das 9h30 às 18h30',
    );
    expect(descreverHorario([])).toBe('com horário a combinar');
  });

  it('dentro do horário pela hora de São Paulo', () => {
    expect(dentroDoHorario(semana, agora)).toBe(true);
    expect(dentroDoHorario(semana, new Date('2026-11-04T19:00:00-03:00'))).toBe(false);
    expect(dentroDoHorario(semana, new Date('2026-11-08T10:00:00-03:00'))).toBe(false); // domingo
  });
});

describe('pesquisa depois do atendimento', () => {
  const comPesquisa = (min = 5): SessaoBot => ({
    caminho: [],
    // Horas depois da última conversa: a pesquisa vale mesmo com a sessão vencida.
    ultimaEm: new Date(agora.getTime() - min * 60_000).toISOString(),
    comAtendente: false,
    pesquisa: { avaliacaoId: 'av1', passo: 'atendimento' },
  });

  it('nota do atendimento → da barbearia → comentário → obrigado', () => {
    const r1 = fala(comPesquisa(180), '5');
    expect(r1.respostas).toEqual([MENSAGENS_BOT_PADRAO.pesquisa_barbearia]);
    expect(r1.avaliacao).toEqual({ avaliacaoId: 'av1', notaAtendimento: 5, concluida: false });
    const r2 = fala(r1.sessao, 'nota 4');
    expect(r2.avaliacao).toMatchObject({ notaBarbearia: 4 });
    expect(r2.respostas).toEqual([MENSAGENS_BOT_PADRAO.pesquisa_comentario]);
    const r3 = fala(r2.sessao, 'Corte top, só demorou um pouco.');
    expect(r3.avaliacao).toEqual({
      avaliacaoId: 'av1',
      comentario: 'Corte top, só demorou um pouco.',
      concluida: true,
    });
    expect(r3.respostas).toEqual([MENSAGENS_BOT_PADRAO.pesquisa_obrigado]);
    expect(r3.sessao.pesquisa).toBeUndefined();
  });

  it('0 pula o comentário', () => {
    const s: SessaoBot = {
      ...comPesquisa(),
      pesquisa: { avaliacaoId: 'av1', passo: 'comentario' },
    };
    expect(fala(s, '0').avaliacao).toMatchObject({ comentario: null, concluida: true });
  });

  it('resposta que não é nota: pede uma vez; na segunda, larga a pesquisa e segue o menu', () => {
    const r1 = fala(comPesquisa(), 'ótimo');
    expect(r1.respostas).toEqual([NOTA_NAO_ENTENDIDA]);
    expect(r1.avaliacao).toBeNull();
    const r2 = fala(r1.sessao, 'preço');
    expect(r2.sessao.pesquisa).toBeUndefined();
    expect(r2.acao).toBe('ver_precos');
  });

  it('SAIR no meio encerra a pesquisa e desliga os avisos', () => {
    const r = fala(comPesquisa(), 'sair');
    expect(r).toMatchObject({ consentimento: false, avaliacao: null });
    expect(r.sessao.pesquisa).toBeUndefined();
  });
});

describe('saudação no meio da conversa', () => {
  it.each(['Oii', 'oiiiii', 'olá', 'Bom dia!', 'boa tarde, tudo bem?', 'e aí', 'opa', 'oie'])(
    '"%s" recomeça com boas-vindas e o menu, sem "não entendi"',
    (entrada) => {
      const s = fala(fala(null, 'oi').sessao, '7').sessao; // já errou uma vez
      const r = fala(s, entrada);
      expect(r.respostas[0]).toBe('Olá, João! Aqui é a Barbearia Navalha.');
      expect(r.respostas[1]).toMatch(/^Como posso ajudar\?/);
      expect(r.sessao.erros).toBe(0);
    },
  );

  it('não confunde com outra coisa', () => {
    for (const t of ['oi quero agendar amanha cedo', 'boa sorte', 'oito']) {
      expect(ehSaudacao(normalizar(t))).toBe(false);
    }
  });
});

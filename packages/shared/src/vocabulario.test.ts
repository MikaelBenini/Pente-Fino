import { describe, expect, it } from 'vitest';
import { MENU_BOT_PADRAO, mensagensBotPadrao, menuBotPadrao, sobreMensagemBot } from './bot.js';
import {
  comArtigo,
  comVocabulario,
  comVocabularioEmTudo,
  FUNCOES_DO_SEGMENTO,
  funcoesDaConta,
  maiuscula,
  SEGMENTOS,
  vocabulario,
} from './vocabulario.js';

describe('vocabulário por segmento (Fase 1a, 27/11/2026)', () => {
  it('barbearia continua dizendo barbeiro e barbearia (nada muda para quem já usa)', () => {
    const v = vocabulario('barbearia');
    expect(v.profissional.um).toBe('barbeiro');
    expect(v.estabelecimento.um).toBe('barbearia');
    expect(comArtigo(v.estabelecimento)).toBe('a barbearia');
    expect(maiuscula(v.profissional.muitos)).toBe('Barbeiros');
  });

  it('cada segmento tem os quatro termos, com singular e plural', () => {
    for (const s of SEGMENTOS) {
      const v = vocabulario(s);
      for (const termo of [v.estabelecimento, v.profissional, v.cliente, v.atendimento]) {
        expect(termo.um, s).not.toBe('');
        expect(termo.muitos, s).not.toBe('');
      }
      expect(v.nomeSegmento, s).not.toBe('');
    }
  });

  it('estética, academia e personal falam a língua do negócio', () => {
    expect(comArtigo(vocabulario('estetica').profissional)).toBe('a esteticista');
    expect(vocabulario('estetica').atendimento.um).toBe('sessão');
    expect(vocabulario('academia').cliente.muitos).toBe('alunos');
    expect(comArtigo(vocabulario('tatuagem').profissional, true)).toBe('os tatuadores');
  });

  it('segmento desconhecido ou ausente cai em barbearia', () => {
    expect(vocabulario(null).segmento).toBe('barbearia');
    expect(vocabulario('padaria').segmento).toBe('barbearia');
  });

  it('funções: o padrão do segmento ou a escolha do dono', () => {
    expect(funcoesDaConta('estetica', null)).toEqual([...FUNCOES_DO_SEGMENTO.estetica]);
    expect(funcoesDaConta('barbearia', null)).toEqual([]);
    // Barbearia que vende pacotes liga a função sem trocar de segmento (ADR 0014).
    expect(funcoesDaConta('barbearia', ['pacotes', 'inexistente'])).toEqual(['pacotes']);
    expect(funcoesDaConta('academia', [])).toEqual([]);
  });
});

describe('texto com o vocabulário (marcadores [[...]])', () => {
  const b = vocabulario('barbearia');
  const e = vocabulario('estetica');
  it('barbearia: o texto de sempre', () => {
    expect(comVocabulario('Escolha o serviço, [[o profissional]] e o horário.', b)).toBe(
      'Escolha o serviço, o barbeiro e o horário.',
    );
    expect(comVocabulario('Fale com [[a estabelecimento]] pelo WhatsApp.', b)).toBe(
      'Fale com a barbearia pelo WhatsApp.',
    );
    expect(comVocabulario('[[Profissionais]] · [[profissionais]] · [[Profissional]]', b)).toBe(
      'Barbeiros · barbeiros · Barbeiro',
    );
  });
  it('estética e salão: artigo e gênero certos', () => {
    expect(comVocabulario('Comissão [[do profissional]] [[na estabelecimento]]', e)).toBe(
      'Comissão da esteticista na clínica',
    );
    expect(
      comVocabulario('[[O estabelecimento]] não usa lista de espera.', vocabulario('salao')),
    ).toBe('O salão não usa lista de espera.');
    expect(comVocabulario('[[os clientes]] e [[as atendimentos]]', vocabulario('academia'))).toBe(
      'os alunos e as aulas',
    );
  });
  it('marcador desconhecido fica como está; o {barbearia} do bot não é marcador', () => {
    expect(comVocabulario('[[xyz]] e {barbearia}', e)).toBe('[[xyz]] e {barbearia}');
  });
});

describe('marcadores em objetos (menu e mensagens do bot)', () => {
  it('resolve todos os textos e mantém o resto', () => {
    const menu = {
      titulo: 'Fale com [[o profissional]]',
      itens: [{ n: 1, r: '[[Estabelecimento]]' }],
    };
    expect(comVocabularioEmTudo(menu, vocabulario('estetica'))).toEqual({
      titulo: 'Fale com a esteticista',
      itens: [{ n: 1, r: 'Clínica' }],
    });
  });
});

describe('bot pronto no vocabulário do segmento', () => {
  it('barbearia continua com o texto de sempre; estética fala de esteticista e clínica', () => {
    expect(MENU_BOT_PADRAO.menu.opcoes[0]!.resposta).toBe(
      'Para agendar, escolha o serviço, o barbeiro e o horário por aqui:',
    );
    const e = vocabulario('estetica');
    expect(menuBotPadrao(e).menu.opcoes[0]!.resposta).toBe(
      'Para agendar, escolha o serviço, a esteticista e o horário por aqui:',
    );
    expect(mensagensBotPadrao(e).pesquisa_barbearia).toContain('para a clínica (ambiente');
    expect(sobreMensagemBot(e).pesquisa_barbearia.nome).toBe('Pesquisa: nota da clínica');
  });
});

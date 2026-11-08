import { describe, expect, it } from 'vitest';
import {
  CHAVES_MODELO_EMAIL,
  EXEMPLO_VARIAVEIS,
  emailDoModelo,
  emailPronto,
  lerModelosEmail,
  MODELOS_EMAIL,
  modeloPersonalizadoSchema,
  variaveisDesconhecidas,
} from './modelos-email.js';

describe('modelos de e-mail', () => {
  it('todo modelo padrão usa só as próprias variáveis e preenche tudo no exemplo', () => {
    for (const chave of CHAVES_MODELO_EMAIL) {
      expect(variaveisDesconhecidas(chave, MODELOS_EMAIL[chave].padrao)).toEqual([]);
      const e = emailDoModelo(chave, undefined, EXEMPLO_VARIAVEIS);
      expect(`${e.assunto} ${e.paragrafos.join(' ')}`).not.toMatch(/\{\{/);
    }
  });

  it('personalizado substitui o padrão; parágrafos pela linha em branco', () => {
    const e = emailDoModelo(
      'pagamento_recebido',
      { assunto: 'Valeu, {{nome}}!', corpo: 'Pagou {{valor}}.\n\nAté mais.', botao: null },
      EXEMPLO_VARIAVEIS,
    );
    expect(e).toEqual({
      assunto: 'Valeu, Carlos!',
      paragrafos: ['Pagou R$ 149,90.', 'Até mais.'],
      botao: null,
    });
  });

  it('recusa variável que o e-mail não tem; guardado inválido vira padrão', () => {
    const r = modeloPersonalizadoSchema('redefinir_senha').safeParse({
      assunto: 'Senha de {{nome}}',
      corpo: 'Olá {{nome}}, seu plano {{plano}} venceu.',
      botao: 'Trocar',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Variável que este e-mail não tem: {{plano}}.');
    expect(lerModelosEmail({ redefinir_senha: { assunto: 'x' }, outro: 1 })).toEqual({});
  });

  it('e-mail pronto: botão só com link; HTML escapa o texto', () => {
    const e = emailPronto(
      'carlos@x.dev',
      'fim_teste',
      { fim_teste: { assunto: 'Teste <3', corpo: 'Oi {{nome}} <b>', botao: 'Ver planos' } },
      EXEMPLO_VARIAVEIS,
      'https://app/configuracoes?aba=assinatura',
    );
    expect(e.assunto).toBe('Teste <3');
    expect(e.texto).toContain('Ver planos: https://app/configuracoes?aba=assinatura');
    expect(e.html).toContain('Oi Carlos &#60;b&#62;');
    expect(emailPronto('c@x.dev', 'fim_teste', {}, EXEMPLO_VARIAVEIS).texto).not.toContain(
      'Escolher um plano:',
    );
  });
});

describe('visual do e-mail', () => {
  it('lista com "- ", logo e rodapé com o site, prévia escondida', () => {
    const e = emailPronto(
      'carlos@x.dev',
      'boas_vindas',
      {},
      EXEMPLO_VARIAVEIS,
      'https://seupentefino.com.br/app',
      { site: 'https://seupentefino.com.br/' },
    );
    expect(e.html).toContain(
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">',
    );
    expect(e.html).not.toContain('- Cadastre');
    expect(e.html).toContain('https://seupentefino.com.br/icones/icone-192.png');
    expect(e.html).toContain('>seupentefino.com.br</a>');
    expect(e.html).toContain('display:none');
    expect(e.texto).toContain('- Cadastre seus serviços');
    expect(e.texto).toMatch(/Equipe Pente Fino\nhttps:\/\/seupentefino.com.br$/);
  });

  it('sem site, sai sem imagem', () => {
    expect(emailPronto('c@x.dev', 'pagamento_recebido', {}, EXEMPLO_VARIAVEIS).html).not.toContain(
      '<img',
    );
  });
});

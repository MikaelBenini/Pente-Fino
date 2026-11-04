import { describe, expect, it } from 'vitest';
import { caminhoValido, destinoSeguro, origemPermitida } from './seguranca';

describe('destinoSeguro', () => {
  it('aceita rota interna com consulta', () => {
    expect(destinoSeguro('/comandas?data=2026-11-03')).toBe('/comandas?data=2026-11-03');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '/\tevil', '', null])(
    'recusa %s',
    (v) => {
      expect(destinoSeguro(v)).toBe('/');
    },
  );
});

describe('caminhoValido', () => {
  it('aceita caminhos comuns da API', () => {
    expect(caminhoValido(['usuarios', 'convites'])).toBe(true);
  });

  it.each([[['..', 'admin']], [['auth', '.']], [['a', '']], [['a\\b']], [['a?b=1']], [[]]])(
    'recusa %j',
    (s) => {
      expect(caminhoValido(s)).toBe(false);
    },
  );
});

describe('origemPermitida', () => {
  it('leitura sempre passa', () => {
    expect(origemPermitida('GET', 'app.pentefino.com.br', 'https://evil.com', null)).toBe(true);
  });

  it('alteração só do próprio site', () => {
    expect(
      origemPermitida('POST', 'app.pentefino.com.br', 'https://app.pentefino.com.br', null),
    ).toBe(true);
    expect(origemPermitida('POST', 'app.pentefino.com.br', 'https://evil.com', null)).toBe(false);
    expect(
      origemPermitida(
        'DELETE',
        'app.pentefino.com.br',
        null,
        'https://app.pentefino.com.br/comandas',
      ),
    ).toBe(true);
    expect(origemPermitida('POST', 'app.pentefino.com.br', null, null)).toBe(false);
  });
});

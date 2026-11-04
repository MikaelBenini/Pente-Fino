import { describe, expect, it } from 'vitest';
import { caminhoValido, destinoSeguro, hostsDeDesenvolvimento, origemPermitida } from './seguranca';

describe('destinoSeguro', () => {
  it('aceita rota interna com consulta', () => {
    expect(destinoSeguro('/comandas?data=2026-11-03')).toBe('/comandas?data=2026-11-03');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '/\tevil', '', null])(
    'recusa %s',
    (v) => {
      expect(destinoSeguro(v)).toBe('/app');
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

describe('hostsDeDesenvolvimento (Codespaces)', () => {
  const codespace = {
    CODESPACE_NAME: 'fluffy-space-123',
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
  };

  it('aceita o endereço encaminhado do Codespace só fora de produção', () => {
    const extras = hostsDeDesenvolvimento({ ...codespace, NODE_ENV: 'development' });
    expect(extras).toEqual(['fluffy-space-123-3000.app.github.dev']);
    expect(
      origemPermitida(
        'POST',
        'localhost:3000',
        'https://fluffy-space-123-3000.app.github.dev',
        null,
        extras,
      ),
    ).toBe(true);
    expect(
      origemPermitida('POST', 'localhost:3000', 'https://evil.app.github.dev', null, extras),
    ).toBe(false);
    expect(hostsDeDesenvolvimento({ ...codespace, NODE_ENV: 'production' })).toEqual([]);
  });

  it('fora do Codespace, ou com valores estranhos, não libera nada', () => {
    expect(hostsDeDesenvolvimento({ NODE_ENV: 'development' })).toEqual([]);
    expect(
      hostsDeDesenvolvimento({
        ...codespace,
        CODESPACE_NAME: 'x/../evil.com#',
        NODE_ENV: 'development',
      }),
    ).toEqual([]);
  });
});

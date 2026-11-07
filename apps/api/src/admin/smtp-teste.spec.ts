import { explicarErroSmtp, respostaDoErro, testarConexaoSmtp } from './smtp-teste.js';

const d = { host: 'smtp-relay.brevo.com', porta: 587, seguro: false };

describe('explicarErroSmtp', () => {
  it('usuário ou senha recusados', () => {
    expect(explicarErroSmtp({ code: 'EAUTH', responseCode: 535 }, d)).toMatch(/recusou o login/);
  });
  it('servidor inexistente', () => {
    expect(explicarErroSmtp({ code: 'EDNS', message: 'getaddrinfo ENOTFOUND x' }, d)).toMatch(
      /não encontrado/,
    );
  });
  it('TLS trocado', () => {
    expect(
      explicarErroSmtp(
        { code: 'ESOCKET', message: 'ssl3_get_record:wrong version number' },
        {
          ...d,
          seguro: true,
        },
      ),
    ).toMatch(/não usa TLS desde o início/);
  });
  it('sem resposta sugere a 465', () => {
    expect(explicarErroSmtp({ code: 'ETIMEDOUT', message: 'Greeting never received' }, d)).toMatch(
      /465/,
    );
  });
});

describe('respostaDoErro', () => {
  it('devolve a linha do servidor, ou nada', () => {
    expect(respostaDoErro({ response: '535 5.7.8 Authentication failed' })).toBe(
      '535 5.7.8 Authentication failed',
    );
    expect(respostaDoErro(new Error('x'))).toBeUndefined();
  });
});

describe('testarConexaoSmtp', () => {
  it('porta fechada responde rápido e com o motivo', async () => {
    const r = await testarConexaoSmtp({
      host: '127.0.0.1',
      porta: 1,
      seguro: false,
      usuario: '',
      senha: '',
    });
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/porta 1/);
  });
});

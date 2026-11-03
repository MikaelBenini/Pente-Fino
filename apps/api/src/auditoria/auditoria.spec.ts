import { limparSensiveis } from './auditoria.js';

describe('limparSensiveis', () => {
  it('omite senha, token e hash em qualquer nível', () => {
    expect(
      limparSensiveis({
        nome: 'Ana',
        senhaHash: 'x',
        perfil: { refreshToken: 'y', email: 'a@b.c' },
        lista: [{ token: 'z' }],
      }),
    ).toEqual({
      nome: 'Ana',
      senhaHash: '[omitido]',
      perfil: { refreshToken: '[omitido]', email: 'a@b.c' },
      lista: [{ token: '[omitido]' }],
    });
  });

  it('datas viram texto ISO', () => {
    expect(limparSensiveis({ em: new Date('2026-11-03T12:00:00Z') })).toEqual({
      em: '2026-11-03T12:00:00.000Z',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { barbeirosSemCadastro } from './equipe.js';
import type { UsuarioEquipe } from './esquemas.js';

const usuario = (id: string, papeis: UsuarioEquipe['papeis'], extra = {}): UsuarioEquipe => ({
  id,
  nome: `Pessoa ${id}`,
  email: `${id}@x.dev`,
  telefone: null,
  ativo: true,
  pendente: true,
  papeis,
  ...extra,
});

describe('barbeirosSemCadastro', () => {
  it('lista quem foi convidado como barbeiro e ainda não tem ficha naquela unidade', () => {
    const r = barbeirosSemCadastro(
      [
        usuario('a', [{ papel: 'barbeiro', unidadeId: 'u1' }]),
        usuario('b', [
          { papel: 'barbeiro', unidadeId: 'u1' },
          { papel: 'barbeiro', unidadeId: 'u2' },
        ]),
        usuario('c', [{ papel: 'recepcao', unidadeId: 'u1' }]),
        usuario('d', [{ papel: 'barbeiro', unidadeId: 'u1' }], { ativo: false }),
      ],
      [{ usuarioId: 'b', unidadeId: 'u1' }],
    );
    expect(r.map((x) => `${x.usuarioId}:${x.unidadeId}`)).toEqual(['a:u1', 'b:u2']);
    expect(r[0]).toMatchObject({ nome: 'Pessoa a', email: 'a@x.dev', pendente: true });
  });

  it('todo barbeiro com ficha: lista vazia', () => {
    expect(
      barbeirosSemCadastro(
        [usuario('a', [{ papel: 'barbeiro', unidadeId: 'u1' }])],
        [{ usuarioId: 'a', unidadeId: 'u1' }],
      ),
    ).toEqual([]);
  });
});

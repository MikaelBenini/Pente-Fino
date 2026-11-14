import { describe, expect, it } from 'vitest';
import { buscaDeClienteValida, buscarTelas } from './busca-global.js';
import { menuPara } from './menu.js';

const dono = menuPara(['dono']);
const barbeiro = menuPara(['barbeiro']);
const ids = (termo: string, menu = dono) => buscarTelas(menu, termo).map((i) => i.id);

describe('buscarTelas', () => {
  it('termo vazio devolve o menu inteiro', () => {
    expect(ids('  ')).toEqual(dono.map((i) => i.id));
  });

  it('acha pelo nome, sem acento e sem diferença de maiúscula', () => {
    expect(ids('SERVI')[0]).toBe('servicos');
    expect(ids('inicio')[0]).toBe('inicio');
    expect(ids('pagina')[0]).toBe('pagina');
  });

  it('acha por palavra do nome e por palavra que o dono usaria', () => {
    expect(ids('dia')).toContain('caixa');
    expect(ids('despesa')).toEqual(['financeiro']);
    expect(ids('site')).toEqual(['pagina']);
  });

  it('o nome vem antes das outras palavras', () => {
    // "Clientes" começa com "cli"; nenhuma outra tela tem "cli" no nome.
    expect(ids('cli')[0]).toBe('clientes');
  });

  it('só mostra telas do menu do papel', () => {
    expect(ids('despesa', barbeiro)).toEqual([]);
    expect(ids('preco', barbeiro)).toEqual(['perfil']);
  });

  it('termo que não combina com nada não devolve nada', () => {
    expect(ids('xyzw')).toEqual([]);
  });
});

describe('buscaDeClienteValida', () => {
  it('pede 2 letras ou 4 dígitos', () => {
    expect(buscaDeClienteValida('a')).toBe(false);
    expect(buscaDeClienteValida('jo')).toBe(true);
    expect(buscaDeClienteValida('119')).toBe(false);
    expect(buscaDeClienteValida('(11) 9')).toBe(false);
    expect(buscaDeClienteValida('9876')).toBe(true);
  });
});

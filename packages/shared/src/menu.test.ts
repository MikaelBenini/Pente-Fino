import { describe, expect, it } from 'vitest';
import { itemDaRota, menuEmGrupos, menuPara } from './menu.js';

const rotulos = (papeis: Parameters<typeof menuPara>[0]) => menuPara(papeis).map((i) => i.rotulo);

describe('menu por papel', () => {
  it('dono', () => {
    expect(rotulos(['dono'])).toEqual([
      'Início',
      'Resumo do dia',
      'Agenda',
      'Comandas',
      'Caixa do dia',
      'Clientes',
      'Resultados do mês',
      'Financeiro',
      'Equipe',
      'Serviços',
      'Produtos',
      'Clube',
      'Bot',
      'Conversas do bot',
      'Configurações',
      'Ajuda',
    ]);
  });

  it('gestor vê o mesmo menu do dono (os dados é que ficam na unidade dele)', () => {
    expect(rotulos(['gestor'])).toEqual(rotulos(['dono']));
  });

  it('o que a recepção vê, dono e gestor também veem', () => {
    for (const papel of ['dono', 'gestor'] as const)
      for (const item of rotulos(['recepcao'])) expect(rotulos([papel])).toContain(item);
  });

  it('menu longo vem em seções; o curto fica numa lista só', () => {
    expect(menuEmGrupos(menuPara(['dono'])).map((g) => g.grupo)).toEqual([
      'Dia a dia',
      'Gestão',
      'Cadastros',
      'WhatsApp',
      'Conta',
    ]);
    expect(menuEmGrupos(menuPara(['recepcao']))).toEqual([
      { grupo: null, itens: menuPara(['recepcao']) },
    ]);
  });

  it('recepção', () => {
    expect(rotulos(['recepcao'])).toEqual([
      'Agenda',
      'Comandas',
      'Caixa do dia',
      'Clientes',
      'Conversas do bot',
      'Ajuda',
    ]);
  });

  it('barbeiro', () => {
    expect(rotulos(['barbeiro'])).toEqual([
      'Hoje',
      'Comandas',
      'Clientes',
      'Desempenho',
      'Comissões',
      'Perfil',
      'Ajuda',
    ]);
  });

  it('dois papéis na mesma unidade somam os menus sem repetir', () => {
    const menu = rotulos(['recepcao', 'barbeiro']);
    expect(menu.filter((r) => r === 'Comandas')).toHaveLength(1);
    expect(menu).toContain('Caixa do dia');
    expect(menu).toContain('Hoje');
  });

  it('cada número do mês num lugar só: sem as páginas que repetiam os resultados', () => {
    const rotas = menuPara(['dono', 'barbeiro']).map((i) => i.rota);
    for (const antiga of ['/metricas', '/relatorio', '/rede', '/metas'])
      expect(rotas).not.toContain(antiga);
    expect(rotas.filter((r) => r === '/resultados')).toHaveLength(1);
  });

  it('acha o item pela rota, inclusive subrotas', () => {
    expect(itemDaRota('/comandas/019a')?.id).toBe('comandas');
    expect(itemDaRota('/comandasx')).toBeUndefined();
  });
});

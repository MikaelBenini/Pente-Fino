import { describe, expect, it } from 'vitest';
import { itemDaRota, menuPara } from './menu.js';

const rotulos = (papeis: Parameters<typeof menuPara>[0]) => menuPara(papeis).map((i) => i.rotulo);

describe('menu por papel', () => {
  it('dono', () => {
    expect(rotulos(['dono'])).toEqual([
      'Início',
      'Resumo do dia',
      'Agenda',
      'Comandas',
      'Financeiro',
      'Métricas e metas',
      'Equipe',
      'Clube',
      'Serviços',
      'Produtos',
      'Clientes',
      'Bot',
      'Configurações',
    ]);
  });

  it('gestor vê o mesmo menu do dono (os dados é que ficam na unidade dele)', () => {
    expect(rotulos(['gestor'])).toEqual(rotulos(['dono']));
  });

  it('recepção', () => {
    expect(rotulos(['recepcao'])).toEqual([
      'Agenda',
      'Comandas',
      'Caixa do dia',
      'Clientes',
      'Conversas do bot',
    ]);
  });

  it('barbeiro', () => {
    expect(rotulos(['barbeiro'])).toEqual([
      'Hoje',
      'Comandas',
      'Clientes',
      'Desempenho',
      'Comissões',
      'Metas',
      'Perfil',
    ]);
  });

  it('dois papéis na mesma unidade somam os menus sem repetir', () => {
    const menu = rotulos(['recepcao', 'barbeiro']);
    expect(menu.filter((r) => r === 'Comandas')).toHaveLength(1);
    expect(menu).toContain('Caixa do dia');
    expect(menu).toContain('Hoje');
  });

  it('acha o item pela rota, inclusive subrotas', () => {
    expect(itemDaRota('/comandas/019a')?.id).toBe('comandas');
    expect(itemDaRota('/comandasx')).toBeUndefined();
  });
});

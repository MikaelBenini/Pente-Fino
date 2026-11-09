// Menu montado pelo papel (docs/documentacao-do-produto.md, "Navegação por papel").
// Nada aparece bloqueado: o que o papel não usa simplesmente não está no menu.
import type { Papel } from './papeis.js';

export type IdMenu =
  | 'inicio'
  | 'dia'
  | 'hoje'
  | 'agenda'
  | 'comandas'
  | 'caixa'
  | 'financeiro'
  | 'metricas'
  | 'rede'
  | 'equipe'
  | 'clube'
  | 'servicos'
  | 'produtos'
  | 'clientes'
  | 'desempenho'
  | 'comissoes'
  | 'metas'
  | 'bot'
  | 'conversas'
  | 'configuracoes'
  | 'perfil'
  | 'ajuda';

/** Seções do menu lateral, na ordem em que aparecem. */
export const GRUPOS_MENU = ['Dia a dia', 'Gestão', 'Cadastros', 'WhatsApp', 'Conta'] as const;
export type GrupoMenu = (typeof GRUPOS_MENU)[number];

export interface ItemMenu {
  id: IdMenu;
  rotulo: string;
  rota: `/${string}`;
  papeis: readonly Papel[];
  grupo: GrupoMenu;
}

const GESTAO: readonly Papel[] = ['dono', 'gestor'];
/** A recepção atende o balcão; dono e gestor também podem, então veem o mesmo que ela. */
const BALCAO: readonly Papel[] = ['dono', 'gestor', 'recepcao'];
const TODOS: readonly Papel[] = ['dono', 'gestor', 'recepcao', 'barbeiro'];

/**
 * Ordem única, agrupada por função. Regra: o que a recepção vê, dono e gestor também veem
 * (testado em menu.test.ts); o barbeiro tem as telas dele.
 */
export const ITENS_MENU: readonly ItemMenu[] = [
  { id: 'inicio', rotulo: 'Início', rota: '/inicio', papeis: GESTAO, grupo: 'Dia a dia' },
  { id: 'dia', rotulo: 'Resumo do dia', rota: '/dia', papeis: GESTAO, grupo: 'Dia a dia' },
  { id: 'hoje', rotulo: 'Hoje', rota: '/hoje', papeis: ['barbeiro'], grupo: 'Dia a dia' },
  { id: 'agenda', rotulo: 'Agenda', rota: '/agenda', papeis: BALCAO, grupo: 'Dia a dia' },
  { id: 'comandas', rotulo: 'Comandas', rota: '/comandas', papeis: TODOS, grupo: 'Dia a dia' },
  { id: 'caixa', rotulo: 'Caixa do dia', rota: '/caixa', papeis: BALCAO, grupo: 'Dia a dia' },
  { id: 'clientes', rotulo: 'Clientes', rota: '/clientes', papeis: TODOS, grupo: 'Dia a dia' },
  { id: 'financeiro', rotulo: 'Financeiro', rota: '/financeiro', papeis: GESTAO, grupo: 'Gestão' },
  {
    id: 'metricas',
    rotulo: 'Métricas e metas',
    rota: '/metricas',
    papeis: GESTAO,
    grupo: 'Gestão',
  },
  { id: 'rede', rotulo: 'Painel da rede', rota: '/rede', papeis: GESTAO, grupo: 'Gestão' },
  { id: 'equipe', rotulo: 'Equipe', rota: '/equipe', papeis: GESTAO, grupo: 'Gestão' },
  {
    id: 'desempenho',
    rotulo: 'Desempenho',
    rota: '/desempenho',
    papeis: ['barbeiro'],
    grupo: 'Gestão',
  },
  {
    id: 'comissoes',
    rotulo: 'Comissões',
    rota: '/comissoes',
    papeis: ['barbeiro'],
    grupo: 'Gestão',
  },
  { id: 'metas', rotulo: 'Metas', rota: '/metas', papeis: ['barbeiro'], grupo: 'Gestão' },
  { id: 'servicos', rotulo: 'Serviços', rota: '/servicos', papeis: GESTAO, grupo: 'Cadastros' },
  { id: 'produtos', rotulo: 'Produtos', rota: '/produtos', papeis: GESTAO, grupo: 'Cadastros' },
  { id: 'clube', rotulo: 'Clube', rota: '/clube', papeis: GESTAO, grupo: 'Cadastros' },
  { id: 'bot', rotulo: 'Bot', rota: '/bot', papeis: GESTAO, grupo: 'WhatsApp' },
  {
    id: 'conversas',
    rotulo: 'Conversas do bot',
    rota: '/conversas',
    papeis: BALCAO,
    grupo: 'WhatsApp',
  },
  {
    id: 'configuracoes',
    rotulo: 'Configurações',
    rota: '/configuracoes',
    papeis: GESTAO,
    grupo: 'Conta',
  },
  { id: 'perfil', rotulo: 'Perfil', rota: '/perfil', papeis: ['barbeiro'], grupo: 'Conta' },
  { id: 'ajuda', rotulo: 'Ajuda', rota: '/ajuda', papeis: TODOS, grupo: 'Conta' },
];

/** O menu em seções, só as que têm item; o menu curto (até 7 itens) fica numa lista só. */
export function menuEmGrupos(
  menu: readonly ItemMenu[],
): { grupo: GrupoMenu | null; itens: ItemMenu[] }[] {
  if (menu.length <= 7) return [{ grupo: null, itens: [...menu] }];
  return GRUPOS_MENU.map((grupo) => ({
    grupo,
    itens: menu.filter((i) => i.grupo === grupo),
  })).filter((g) => g.itens.length > 0);
}

/** Itens do menu para os papéis que valem na unidade ativa (união, na ordem canônica). */
export function menuPara(papeis: readonly Papel[]): ItemMenu[] {
  return ITENS_MENU.filter((item) => item.papeis.some((p) => papeis.includes(p)));
}

/** Item do menu dono de uma rota (inclusive subrotas: /comandas/123 → comandas). */
export function itemDaRota(rota: string): ItemMenu | undefined {
  return ITENS_MENU.find((item) => rota === item.rota || rota.startsWith(`${item.rota}/`));
}

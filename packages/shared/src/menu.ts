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
  | 'perfil';

export interface ItemMenu {
  id: IdMenu;
  rotulo: string;
  rota: `/${string}`;
  papeis: readonly Papel[];
}

const GESTAO: readonly Papel[] = ['dono', 'gestor'];

/** Ordem única que respeita a ordem de cada papel na documentação. */
export const ITENS_MENU: readonly ItemMenu[] = [
  { id: 'inicio', rotulo: 'Início', rota: '/inicio', papeis: GESTAO },
  { id: 'dia', rotulo: 'Resumo do dia', rota: '/dia', papeis: GESTAO },
  { id: 'hoje', rotulo: 'Hoje', rota: '/hoje', papeis: ['barbeiro'] },
  { id: 'agenda', rotulo: 'Agenda', rota: '/agenda', papeis: ['dono', 'gestor', 'recepcao'] },
  {
    id: 'comandas',
    rotulo: 'Comandas',
    rota: '/comandas',
    papeis: ['dono', 'gestor', 'recepcao', 'barbeiro'],
  },
  { id: 'caixa', rotulo: 'Caixa do dia', rota: '/caixa', papeis: ['recepcao'] },
  { id: 'financeiro', rotulo: 'Financeiro', rota: '/financeiro', papeis: GESTAO },
  { id: 'metricas', rotulo: 'Métricas e metas', rota: '/metricas', papeis: GESTAO },
  { id: 'equipe', rotulo: 'Equipe', rota: '/equipe', papeis: GESTAO },
  { id: 'clube', rotulo: 'Clube', rota: '/clube', papeis: GESTAO },
  { id: 'servicos', rotulo: 'Serviços', rota: '/servicos', papeis: GESTAO },
  { id: 'produtos', rotulo: 'Produtos', rota: '/produtos', papeis: GESTAO },
  {
    id: 'clientes',
    rotulo: 'Clientes',
    rota: '/clientes',
    papeis: ['dono', 'gestor', 'recepcao', 'barbeiro'],
  },
  { id: 'desempenho', rotulo: 'Desempenho', rota: '/desempenho', papeis: ['barbeiro'] },
  { id: 'comissoes', rotulo: 'Comissões', rota: '/comissoes', papeis: ['barbeiro'] },
  { id: 'metas', rotulo: 'Metas', rota: '/metas', papeis: ['barbeiro'] },
  { id: 'bot', rotulo: 'Bot', rota: '/bot', papeis: GESTAO },
  { id: 'conversas', rotulo: 'Conversas do bot', rota: '/conversas', papeis: ['recepcao'] },
  { id: 'configuracoes', rotulo: 'Configurações', rota: '/configuracoes', papeis: GESTAO },
  { id: 'perfil', rotulo: 'Perfil', rota: '/perfil', papeis: ['barbeiro'] },
];

/** Itens do menu para os papéis que valem na unidade ativa (união, na ordem canônica). */
export function menuPara(papeis: readonly Papel[]): ItemMenu[] {
  return ITENS_MENU.filter((item) => item.papeis.some((p) => papeis.includes(p)));
}

/** Item do menu dono de uma rota (inclusive subrotas: /comandas/123 → comandas). */
export function itemDaRota(rota: string): ItemMenu | undefined {
  return ITENS_MENU.find((item) => rota === item.rota || rota.startsWith(`${item.rota}/`));
}

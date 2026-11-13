// Telas do sistema (pastas de app/(app)): sem sessão, vão para o login. O resto do site segue o
// roteamento normal, e endereço que não existe responde 404 de verdade (briefing do site, B1).
// rotas.test.ts confere esta lista contra as pastas: tela nova esquecida aqui quebra o teste.
export const ROTAS_DO_APP = [
  'agenda',
  'ajuda',
  'app',
  'avisos',
  'bot',
  'caixa',
  'clientes',
  'clube',
  'comandas',
  'comissoes',
  'configuracao-inicial',
  'configuracoes',
  'conversas',
  'desempenho',
  'dia',
  'equipe',
  'financeiro',
  'hoje',
  'inicio',
  'metas',
  'metricas',
  'pagina',
  'perfil',
  'produtos',
  'rede',
  'relatorio',
  'resultados',
  'servicos',
  'unidade',
] as const;

/** O endereço é de uma tela do sistema (ela mesma ou uma subtela)? */
export const ehRotaDoApp = (pathname: string) =>
  ROTAS_DO_APP.some((r) => pathname === `/${r}` || pathname.startsWith(`/${r}/`));

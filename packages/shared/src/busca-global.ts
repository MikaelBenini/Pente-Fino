// Busca global (seção 7, Ctrl+K): acha uma tela pelo nome ou por uma palavra que o dono usaria
// ("despesa" leva ao Financeiro, "site" à Minha página). Só entra o que está no menu do papel,
// então a busca nunca mostra uma tela que a pessoa não abre.
import { normalizar } from './bot.js';
import type { IdMenu, ItemMenu } from './menu.js';

/** Outras palavras para cada tela, como o balcão e o dono falam. */
export const PALAVRAS_DA_TELA: Partial<Record<IdMenu, readonly string[]>> = {
  inicio: ['painel', 'resumo do mes', 'pendencias'],
  dia: ['hoje', 'movimento'],
  hoje: ['meus horarios', 'minha agenda'],
  agenda: ['horario', 'agendamento', 'marcar', 'encaixe'],
  comandas: ['atendimento', 'conta do cliente', 'receber'],
  caixa: ['abrir caixa', 'fechar caixa', 'sangria', 'dinheiro', 'troco'],
  clientes: ['cliente', 'aniversario', 'telefone', 'contato'],
  resultados: ['faturamento', 'lucro', 'ticket medio', 'mes'],
  financeiro: ['despesa', 'conta a pagar', 'retirada', 'cartao'],
  equipe: ['barbeiro', 'profissional', 'funcionario', 'convite', 'expediente'],
  desempenho: ['ranking', 'meta'],
  comissoes: ['comissao', 'pagar barbeiro', 'vale'],
  servicos: ['corte', 'barba', 'preco', 'combo'],
  produtos: ['estoque', 'pomada', 'venda'],
  clube: ['assinatura', 'plano', 'mensalidade', 'assinante'],
  pagina: ['site', 'link de agendamento', 'dominio', 'fotos', 'tema'],
  bot: ['whatsapp', 'mensagem automatica', 'menu do bot', 'qr code'],
  conversas: ['whatsapp', 'atendente', 'chat'],
  configuracoes: [
    'unidade',
    'horario de funcionamento',
    'assinatura do sistema',
    'plano',
    'usuarios',
  ],
  perfil: ['meus precos', 'senha', 'foto'],
  ajuda: ['suporte', 'duvida', 'tutorial'],
};

/**
 * As telas que combinam com o termo, da melhor para a pior: nome que começa com o termo, depois
 * palavra do nome, depois as outras palavras. Termo vazio devolve o menu como está.
 */
export function buscarTelas(menu: readonly ItemMenu[], termo: string): ItemMenu[] {
  const t = normalizar(termo);
  if (!t) return [...menu];
  const nota = (item: ItemMenu): number => {
    const nome = normalizar(item.rotulo);
    if (nome.startsWith(t)) return 3;
    if (nome.split(' ').some((p) => p.startsWith(t))) return 2;
    const outras = PALAVRAS_DA_TELA[item.id] ?? [];
    if (outras.some((p) => p.startsWith(t) || p.split(' ').some((w) => w.startsWith(t)))) return 1;
    return 0;
  };
  return menu
    .map((item, i) => ({ item, i, n: nota(item) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.item);
}

/** Busca de cliente só vale a partir de 2 letras ou 4 dígitos (evita listar a base inteira). */
export function buscaDeClienteValida(termo: string): boolean {
  const t = termo.trim();
  const digitos = t.replace(/\D/g, '');
  if (digitos.length > 0 && digitos.length === t.replace(/[\s()+-]/g, '').length)
    return digitos.length >= 4;
  return normalizar(t).length >= 2;
}

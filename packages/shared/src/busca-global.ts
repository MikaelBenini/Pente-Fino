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
  equipe: ['profissional', 'profissional', 'funcionario', 'convite', 'expediente'],
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

// ─── Opções e configurações (pedido do dono em 20/11/2026) ──────────────────

/**
 * "Procurar" achava só telas, clientes e comandas. Agora acha também as opções que ficam dentro
 * das telas (o Instagram, a cidade da unidade, os lembretes...), com o link direto para a aba.
 * Só aparece a opção cuja tela está no menu do papel.
 */
export interface OpcaoDeBusca {
  id: string;
  titulo: string;
  /** Onde fica, como a pessoa vê: "Configurações › Unidades". */
  onde: string;
  rota: `/${string}`;
  tela: IdMenu;
  palavras: readonly string[];
}

export const OPCOES_DE_BUSCA: readonly OpcaoDeBusca[] = [
  {
    id: 'unidade-endereco',
    titulo: 'Endereço, cidade e telefone da unidade',
    onde: 'Configurações › Unidades',
    rota: '/configuracoes?aba=unidades',
    tela: 'configuracoes',
    palavras: [
      'endereco',
      'cidade',
      'uf',
      'estado',
      'telefone',
      'mapa',
      'google maps',
      'localizacao',
    ],
  },
  {
    id: 'unidade-horario',
    titulo: 'Horário de funcionamento e cadeiras',
    onde: 'Configurações › Unidades',
    rota: '/configuracoes?aba=unidades',
    tela: 'configuracoes',
    palavras: [
      'abre',
      'fecha',
      'horario de funcionamento',
      'dias de trabalho',
      'cadeiras',
      'almoco',
    ],
  },
  {
    id: 'folgas',
    titulo: 'Folgas e feriados',
    onde: 'Configurações › Folgas e feriados',
    rota: '/configuracoes?aba=calendario',
    tela: 'configuracoes',
    palavras: ['feriado', 'folga', 'fechado', 'recesso', 'ferias'],
  },
  {
    id: 'link-agendamento',
    titulo: 'Link de agendamento',
    onde: 'Configurações › Link e agendamento',
    rota: '/configuracoes?aba=link',
    tela: 'configuracoes',
    palavras: ['link', 'agendar online', 'aparecer no google', 'endereco do link', 'agendamento'],
  },
  {
    id: 'regras-agendamento',
    titulo: 'Regras: antecedência, prazo para cancelar e lembretes',
    onde: 'Configurações › Link e agendamento',
    rota: '/configuracoes?aba=link',
    tela: 'configuracoes',
    palavras: [
      'antecedencia',
      'janela',
      'cancelar',
      'remarcar',
      'prazo',
      'lembrete',
      'tolerancia',
      'atraso',
      'intervalo',
      'marcar pelo whatsapp',
    ],
  },
  {
    id: 'importar',
    titulo: 'Importar planilha de clientes, serviços ou equipe',
    onde: 'Configurações › Importar planilha',
    rota: '/configuracoes?aba=importar',
    tela: 'configuracoes',
    palavras: ['importar', 'planilha', 'excel', 'csv', 'migrar'],
  },
  {
    id: 'assinatura',
    titulo: 'Assinatura do sistema e forma de pagamento',
    onde: 'Configurações › Assinatura',
    rota: '/configuracoes?aba=assinatura',
    tela: 'configuracoes',
    palavras: ['plano', 'pagar', 'fatura', 'boleto', 'cartao', 'mensalidade do sistema'],
  },
  {
    id: 'suporte',
    titulo: 'Acesso do suporte',
    onde: 'Configurações › Acesso do suporte',
    rota: '/configuracoes?aba=suporte',
    tela: 'configuracoes',
    palavras: ['suporte', 'liberar acesso', 'ajuda tecnica'],
  },
  {
    id: 'instagram',
    titulo: 'Instagram e redes sociais do site',
    onde: 'Minha página › Cabeçalho e rodapé',
    rota: '/pagina',
    tela: 'pagina',
    palavras: ['instagram', 'facebook', 'tiktok', 'youtube', 'redes sociais', 'rodape'],
  },
  {
    id: 'tema-site',
    titulo: 'Cores, fonte, paleta e logotipo do site',
    onde: 'Minha página › Tema',
    rota: '/pagina',
    tela: 'pagina',
    palavras: [
      'cor',
      'cores',
      'fonte',
      'tema',
      'paleta',
      'logo',
      'logotipo',
      'css',
      'banner',
      'galeria',
    ],
  },
  {
    id: 'visual-agendamento',
    titulo: 'Aparência da página de agendamento e prévia do link',
    onde: 'Minha página › Página de agendamento',
    rota: '/pagina?secao=agendamento',
    tela: 'pagina',
    palavras: ['previa', 'compartilhar', 'capa', 'boas vindas', 'logo no link', 'whatsapp do link'],
  },
  {
    id: 'dominio',
    titulo: 'Endereço do site e domínio próprio',
    onde: 'Minha página › Endereço e domínio',
    rota: '/pagina?secao=enderecos',
    tela: 'pagina',
    palavras: ['dominio', 'endereco do site', 'www', 'dns'],
  },
  {
    id: 'whatsapp-conectar',
    titulo: 'Conectar o WhatsApp (QR Code)',
    onde: 'Bot › Conexão',
    rota: '/bot?aba=conexao',
    tela: 'bot',
    palavras: ['qr code', 'conectar', 'desconectado', 'numero do whatsapp', 'trocar numero'],
  },
  {
    id: 'mensagens-bot',
    titulo: 'Mensagens automáticas e menu do bot',
    onde: 'Bot › Respostas',
    rota: '/bot',
    tela: 'bot',
    palavras: ['boas vindas', 'encerramento', 'mensagem', 'menu do bot', 'anuncio', 'retorno'],
  },
  {
    id: 'precos',
    titulo: 'Tabela de preços por unidade',
    onde: 'Serviços › Tabela de preços',
    rota: '/servicos?aba=precos',
    tela: 'servicos',
    palavras: ['preco', 'precos', 'valor', 'tabela'],
  },
  {
    id: 'comissao',
    titulo: 'Comissão, salário e expediente do barbeiro',
    onde: 'Equipe',
    rota: '/equipe',
    tela: 'equipe',
    palavras: ['comissao', 'percentual', 'salario', 'expediente', 'horario do barbeiro'],
  },
  {
    id: 'senha',
    titulo: 'Trocar senha, foto e avisos no celular',
    onde: 'Perfil',
    rota: '/perfil',
    tela: 'perfil',
    palavras: ['senha', 'trocar senha', 'foto', 'notificacao', 'avisos no celular', 'meus precos'],
  },
];

/** As opções que combinam com o termo (todas as palavras do termo aparecem). */
export function buscarOpcoes(menu: readonly ItemMenu[], termo: string): OpcaoDeBusca[] {
  const palavras = normalizar(termo)
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  if (!palavras.length) return [];
  const telas = new Set(menu.map((i) => i.id));
  return OPCOES_DE_BUSCA.map((o) => {
    const titulo = normalizar(o.titulo);
    const resto = o.palavras.map(normalizar).join(' ');
    let pontos = 0;
    for (const p of palavras) {
      if (titulo.split(' ').some((w) => w.startsWith(p))) pontos += 2;
      else if (resto.split(' ').some((w) => w.startsWith(p)) || titulo.includes(p)) pontos += 1;
      else return { o, pontos: 0 };
    }
    return { o, pontos };
  })
    .filter((x) => x.pontos > 0 && telas.has(x.o.tela))
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.o);
}

// Central de ajuda e tutorial de primeiros passos (Etapa 23). O conteúdo fica aqui, em texto,
// para a tela de ajuda, o cartão de primeiros passos do Início e os testes usarem a mesma fonte.
// Cada artigo diz em que tela fazer, passo a passo, com os nomes que aparecem no sistema.
import type { Papel } from './papeis.js';

export const CATEGORIAS_AJUDA = [
  'Começar',
  'Agenda e atendimento',
  'Dinheiro',
  'WhatsApp',
  'Equipe',
  'Clube',
  'Conta e dados',
] as const;
export type CategoriaAjuda = (typeof CATEGORIAS_AJUDA)[number];

export interface ArtigoAjuda {
  id: string;
  titulo: string;
  resumo: string;
  categoria: CategoriaAjuda;
  /** Quem enxerga o artigo (o barbeiro não vê como montar o bot, por exemplo). */
  papeis: readonly Papel[];
  /** Tela onde se faz, para o botão "Ir para a tela". */
  rota: `/${string}` | null;
  passos: readonly string[];
  dica?: string;
}

const GESTAO: readonly Papel[] = ['dono', 'gestor'];
const BALCAO: readonly Papel[] = ['dono', 'gestor', 'recepcao'];
const TODOS: readonly Papel[] = ['dono', 'gestor', 'recepcao', 'barbeiro'];

export const ARTIGOS_AJUDA: readonly ArtigoAjuda[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos: do cadastro ao primeiro atendimento',
    resumo: 'A ordem que deixa a barbearia pronta para atender em poucos minutos.',
    categoria: 'Começar',
    papeis: GESTAO,
    rota: '/inicio',
    passos: [
      'Termine a Configuração guiada: dados da barbearia, horário de funcionamento, serviços com preço e barbeiros.',
      'Em Equipe, convide quem vai usar o sistema (recepção e barbeiros): cada um recebe um link por e-mail para criar a senha.',
      'Em Bot, conecte o WhatsApp da barbearia lendo o QR Code com o celular da unidade.',
      'Na Agenda, marque o primeiro horário. A comanda nasce sozinha com o serviço e o preço.',
      'No fim do atendimento, o barbeiro confirma a comanda e a recepção toca em "Receber e fechar".',
      'Em Métricas e metas, defina a meta do mês: o Início passa a mostrar quanto falta.',
    ],
    dica: 'O cartão "Primeiros passos" no Início marca cada etapa sozinho, conforme você usa o sistema.',
  },
  {
    id: 'servicos-e-precos',
    titulo: 'Cadastrar serviços, preços e custo de produto',
    resumo: 'Preço por unidade, custo do produto usado e o que conta como atendimento.',
    categoria: 'Começar',
    papeis: GESTAO,
    rota: '/servicos',
    passos: [
      'Abra Serviços e toque em adicionar.',
      'Informe nome, duração e o custo de produto (pomada, lâmina, toalha): é ele que separa faturamento de lucro.',
      'Marque se é extra (sobrancelha, hidratação) ou principal. O peso em atendimentos diz quanto o serviço conta nos indicadores.',
      'Defina o preço em cada unidade e a data a partir de quando vale. Mudar o preço depois nunca altera atendimentos antigos.',
    ],
    dica: 'Só aparecem no link de agendamento os serviços com preço na unidade.',
  },
  {
    id: 'equipe-e-acessos',
    titulo: 'Cadastrar barbeiros, comissão e dar acesso à equipe',
    resumo: 'Comissão por serviço e produto, papéis e o convite por e-mail.',
    categoria: 'Equipe',
    papeis: GESTAO,
    rota: '/equipe',
    passos: [
      'Em Equipe, adicione o profissional com a data de entrada e a comissão em serviços e em produtos.',
      'Para ele usar o sistema, informe o e-mail: o convite chega com o link para criar a senha.',
      'Escolha o papel: Barbeiro vê só a agenda, as comandas e os números dele; Recepção cuida da agenda e do caixa; Gestor vê tudo da unidade.',
      'A comissão pode mudar com data de início: o que já foi fechado continua com a regra antiga.',
    ],
  },
  {
    id: 'conectar-whatsapp',
    titulo: 'Conectar o WhatsApp da barbearia',
    resumo: 'Ler o QR Code e o que fazer se o WhatsApp desconectar.',
    categoria: 'WhatsApp',
    papeis: GESTAO,
    rota: '/bot',
    passos: [
      'Abra Bot e escolha a unidade.',
      'Toque para conectar: aparece um QR Code.',
      'No celular da barbearia, abra o WhatsApp → Aparelhos conectados → Conectar um aparelho e leia o código.',
      'Pronto: o status fica "Conectado" e o bot começa a responder quem escrever.',
    ],
    dica: 'Se o WhatsApp cair (celular sem internet por muito tempo, aparelho desconectado), você recebe um aviso no sistema e por e-mail. É só ler o QR Code de novo.',
  },
  {
    id: 'menu-do-bot',
    titulo: 'Montar o menu do bot, testar e publicar',
    resumo: 'O bot não usa inteligência artificial: responde exatamente o que você escrever.',
    categoria: 'WhatsApp',
    papeis: GESTAO,
    rota: '/bot',
    passos: [
      'Em Bot, edite as opções do menu (Agendar, Preços, Endereço e horário, Clube, Falar com atendente) e as respostas.',
      'Use o simulador ao lado para conversar como se fosse o cliente.',
      'Quando estiver certo, publique. Dá para voltar à versão anterior se precisar.',
      'Quem escrever ATENDENTE vai para Conversas do bot, onde a recepção responde pelo painel.',
    ],
    dica: 'O cliente escolhe se quer receber lembretes (RECEBER) e pode parar a qualquer momento (SAIR). O sistema respeita.',
  },
  {
    id: 'link-de-agendamento',
    titulo: 'Link de agendamento para o cliente marcar sozinho',
    resumo: 'Divulgue no Instagram, no WhatsApp e no Google.',
    categoria: 'Agenda e atendimento',
    papeis: GESTAO,
    rota: '/configuracoes?aba=link',
    passos: [
      'Em Configurações → Link de agendamento, ligue o link da unidade e copie.',
      'Cole na bio do Instagram, no status do WhatsApp e no perfil do Google.',
      'O cliente escolhe serviço, barbeiro e horário. O horário entra na agenda com a comanda pronta.',
      'Em Configurações → Agendamento, ajuste antecedência mínima, até quantos dias à frente e os intervalos.',
    ],
  },
  {
    id: 'agenda',
    titulo: 'Agenda: marcar, mover, encaixe e falta',
    resumo: 'O dia de cada barbeiro, com aviso automático ao cliente.',
    categoria: 'Agenda e atendimento',
    papeis: BALCAO,
    rota: '/agenda',
    passos: [
      'Toque num horário livre para um novo agendamento: cliente, serviços (pode escolher mais de um) e barbeiro.',
      'Arraste ou edite para mover. Marque "Avisar o cliente" e ele recebe o novo horário pelo WhatsApp.',
      'Para encaixe, informe o horário do encaixe mesmo com a agenda cheia.',
      'Cliente não veio? Marque "O cliente não veio": conta como falta no histórico dele.',
      'Bloqueie folgas e pausas do barbeiro para ninguém marcar nesse horário.',
    ],
  },
  {
    id: 'comanda',
    titulo: 'Comanda: do agendamento ao fechamento',
    resumo: 'Lançamento único: o barbeiro confirma, a recepção fecha.',
    categoria: 'Agenda e atendimento',
    papeis: TODOS,
    rota: '/comandas',
    passos: [
      'O agendamento já cria a comanda prevista com serviço e preço.',
      'No atendimento, o barbeiro inicia, lança os extras e produtos vendidos e confirma pelo celular.',
      'A recepção toca em "Receber e fechar", escolhe a forma de pagamento (pode dividir) e dá desconto se precisar.',
      'Só comanda fechada entra no faturamento, nas comissões e nos indicadores.',
      'Errou? Dono ou gestor reabre a comanda com o motivo (fica na auditoria).',
    ],
  },
  {
    id: 'caixa-do-dia',
    titulo: 'Caixa do dia: conferir e fechar',
    resumo: 'Dinheiro na gaveta, Pix e cartão batendo com o que foi lançado.',
    categoria: 'Dinheiro',
    papeis: BALCAO,
    rota: '/caixa',
    passos: [
      'Abra Caixa do dia: aparecem as entradas por forma de pagamento.',
      'Informe o troco que ficou na gaveta e o dinheiro contado.',
      'Feche o caixa. Diferença entre o contado e o lançado gera aviso para o dono e o gestor.',
    ],
  },
  {
    id: 'lucro-e-indicadores',
    titulo: 'Lucro real, metas e indicadores',
    resumo: 'Quanto sobra de cada serviço, barbeiro e unidade.',
    categoria: 'Dinheiro',
    papeis: GESTAO,
    rota: '/metricas',
    passos: [
      'No Início, veja faturamento, atendimentos, ticket médio e a projeção do mês.',
      'Em Métricas e metas, "Lucro por serviço" mostra receita menos custo de produto e comissão.',
      'Em Financeiro, lance as despesas (fixas, variáveis, retirada do dono) para chegar ao lucro do mês.',
      'Defina a meta do mês de faturamento ou de um serviço: a barra mostra se o ritmo vai bater.',
    ],
    dica: 'A projeção usa os dias de trabalho do calendário da unidade, não os dias corridos.',
  },
  {
    id: 'ficha-do-profissional',
    titulo: 'Ler a ficha do profissional',
    resumo: 'Atendimentos, extras, nota dos clientes e comissão de cada barbeiro.',
    categoria: 'Equipe',
    papeis: ['dono', 'gestor', 'barbeiro'],
    rota: null,
    passos: [
      'Dono e gestor: em Equipe, abra o profissional; o barbeiro vê a própria ficha em Desempenho.',
      'Atendimentos e faturamento do período, com a comparação com o período anterior.',
      '% de extras: quanto dos atendimentos teve sobrancelha, hidratação ou produto.',
      'Nota média dos clientes na pesquisa pós-atendimento e os comentários.',
      'A comissão do período, item por item, em Comissões.',
    ],
  },
  {
    id: 'comissoes',
    titulo: 'Comissões: conferir e pagar',
    resumo: 'Calculadas sozinhas a cada comanda fechada.',
    categoria: 'Dinheiro',
    papeis: TODOS,
    rota: null,
    passos: [
      'Cada item fechado grava a comissão da regra que valia no dia.',
      'O barbeiro vê o extrato em Comissões, item por item.',
      'Dono e gestor registram o pagamento no Financeiro: o sistema mostra quanto falta pagar no período.',
    ],
  },
  {
    id: 'clube',
    titulo: 'Clube de assinatura: planos, adesões e cobrança pelo link',
    resumo: 'Receita todo mês, com a mensalidade caindo direto na conta da barbearia.',
    categoria: 'Clube',
    papeis: GESTAO,
    rota: '/clube',
    passos: [
      'Em Clube, crie os planos (ou toque em "Criar planos sugeridos" para montar a partir dos preços).',
      'Para receber online, abra "Receber online" e ative a conta no Asaas (CPF ou CNPJ e documentos).',
      'Em cada plano, use "Mandar pelo WhatsApp": o cliente assina pelo link, no Pix ou no cartão.',
      'A adesão nasce e renova sozinha a cada pagamento; o uso dos serviços aparece na comanda.',
    ],
    dica: 'A comissão do serviço do clube é calculada sobre o preço de tabela da unidade (dá para trocar por valor fixo).',
  },
  {
    id: 'notificacoes',
    titulo: 'Instalar no celular e ligar as notificações',
    resumo: 'Avisos na tela do celular, como um aplicativo.',
    categoria: 'Começar',
    papeis: TODOS,
    rota: '/avisos',
    passos: [
      'No celular, abra o Pente Fino no navegador.',
      'Android (Chrome): menu ⋮ → Instalar aplicativo. iPhone (Safari): Compartilhar → Adicionar à Tela de Início.',
      'Abra pelo ícone novo e toque no sino: permita as notificações.',
      'No Perfil, escolha quais avisos chegam no celular.',
    ],
  },
  {
    id: 'assinatura-e-fundador',
    titulo: 'Assinar o plano, cupom e oferta de lançamento',
    resumo: 'Pix, boleto ou cartão; o teste continua valendo até o fim.',
    categoria: 'Conta e dados',
    papeis: ['dono'],
    rota: '/configuracoes?aba=assinatura',
    passos: [
      'Em Configurações → Assinatura, escolha o plano e o ciclo (anual sai mais barato).',
      'Tem cupom? Digite e toque em Aplicar. Na oferta de lançamento, o cupom LANCAMENTO dá 30% em toda mensalidade enquanto a assinatura estiver ativa.',
      'Informe o CPF ou CNPJ e pague na página que abre. Depois toque em "Já paguei, conferir".',
      'Atrasou? O sistema fica só para consulta até o pagamento; nada é apagado.',
    ],
  },
  {
    id: 'dados-do-cliente',
    titulo: 'Cliente pediu os dados ou para apagar (LGPD)',
    resumo: 'Entregar o arquivo ou apagar os dados pessoais pela ficha do cliente.',
    categoria: 'Conta e dados',
    papeis: ['dono'],
    rota: '/clientes',
    passos: [
      'Abra o cliente em Clientes e vá até "Dados do cliente (LGPD)".',
      '"Baixar os dados" gera o arquivo com tudo o que o sistema guarda dele, para você enviar.',
      '"Apagar os dados pessoais" pede o motivo e o nome para confirmar. Antes, cancele horários futuros e o clube, se houver.',
      'Os atendimentos e o caixa continuam, sem o nome (são histórico financeiro da barbearia).',
    ],
  },
];

export interface PerguntaAjuda {
  pergunta: string;
  resposta: string;
  /** Artigo com o passo a passo, quando houver. */
  artigo?: string;
}

export const PERGUNTAS_AJUDA: readonly PerguntaAjuda[] = [
  {
    pergunta: 'O bot do WhatsApp usa inteligência artificial?',
    resposta:
      'Não. Ele responde exatamente o que você configurou no menu, por número ou palavra-chave. Nada é inventado para o seu cliente.',
    artigo: 'menu-do-bot',
  },
  {
    pergunta: 'Preciso de um número de WhatsApp novo?',
    resposta:
      'Não. Use o WhatsApp da barbearia, conectado pelo QR Code como no WhatsApp Web. Recomendamos um chip só da barbearia, no celular que fica na unidade.',
    artigo: 'conectar-whatsapp',
  },
  {
    pergunta: 'Qual a diferença entre faturamento e lucro no sistema?',
    resposta:
      'Faturamento é o que entrou. Lucro do serviço é o que sobra depois do custo de produto e da comissão; o lucro do mês desconta também as despesas lançadas no Financeiro.',
    artigo: 'lucro-e-indicadores',
  },
  {
    pergunta: 'O barbeiro vê o faturamento da barbearia?',
    resposta:
      'Não. O barbeiro vê só a agenda, as comandas, a comissão e o desempenho dele. O telefone do cliente pode ficar oculto para ele.',
    artigo: 'equipe-e-acessos',
  },
  {
    pergunta: 'Mudei o preço de um serviço. Os atendimentos antigos mudam?',
    resposta:
      'Não. Cada comanda guarda o preço e a comissão do dia em que foi lançada. O preço novo vale a partir da data que você escolher.',
    artigo: 'servicos-e-precos',
  },
  {
    pergunta: 'Posso usar em mais de uma unidade?',
    resposta:
      'Sim, no plano Premium: cada unidade tem a agenda, a equipe, o caixa e o WhatsApp dela, e o Painel da rede mostra tudo junto.',
  },
  {
    pergunta: 'O que acontece se eu não pagar a mensalidade?',
    resposta:
      'Depois de alguns dias de atraso o sistema fica só para consulta até o pagamento. Nenhum dado é apagado por atraso.',
    artigo: 'assinatura-e-fundador',
  },
  {
    pergunta: 'Como o cliente assina o clube?',
    resposta:
      'Você manda o link do plano pelo WhatsApp; ele assina no Pix ou no cartão e a mensalidade cai direto na conta da barbearia, todo mês.',
    artigo: 'clube',
  },
  {
    pergunta: 'Meus dados estão seguros?',
    resposta:
      'Cada barbearia só enxerga os próprios dados, o acesso é por papel e unidade, e há cópia de segurança diária criptografada fora do servidor.',
  },
  {
    pergunta: 'Posso levar meus dados se cancelar?',
    resposta:
      'Sim. Os dados ficam disponíveis para exportação por 90 dias depois do cancelamento; depois disso são apagados, como diz a política de privacidade.',
  },
  {
    pergunta: 'O WhatsApp desconectou. E agora?',
    resposta:
      'Você recebe um aviso no sistema e por e-mail. Abra Bot e leia o QR Code de novo com o celular da barbearia.',
    artigo: 'conectar-whatsapp',
  },
];

/** Artigos que o papel enxerga, na ordem da lista. */
export const artigosPara = (papeis: readonly Papel[]) =>
  ARTIGOS_AJUDA.filter((a) => a.papeis.some((p) => papeis.includes(p)));

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Busca simples por palavras (sem acento, sem diferença de maiúscula): título vale mais que
 * resumo e passos. Todas as palavras precisam aparecer em algum lugar do artigo.
 */
export function buscarAjuda(texto: string, papeis: readonly Papel[]): ArtigoAjuda[] {
  const palavras = normalizar(texto)
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  const lista = artigosPara(papeis);
  if (palavras.length === 0) return lista;
  return lista
    .map((a) => {
      const titulo = normalizar(a.titulo);
      const corpo = normalizar([a.resumo, ...a.passos, a.dica ?? ''].join(' '));
      let pontos = 0;
      for (const p of palavras) {
        if (titulo.includes(p)) pontos += 3;
        else if (corpo.includes(p)) pontos += 1;
        else return { a, pontos: 0 };
      }
      return { a, pontos };
    })
    .filter((r) => r.pontos > 0)
    .sort((x, y) => y.pontos - x.pontos)
    .map((r) => r.a);
}

// ─── Tutorial: primeiros passos (cartão no Início) ─────────────────────────

export const PASSOS_INICIAIS = [
  'servicos',
  'equipe',
  'convite',
  'whatsapp',
  'agendamento',
  'comanda',
  'meta',
  'notificacoes',
] as const;
export type PassoInicial = (typeof PASSOS_INICIAIS)[number];

export interface DefinicaoPasso {
  titulo: string;
  porque: string;
  rota: `/${string}`;
  artigo: string;
}

export const DEFINICAO_PASSOS: Readonly<Record<PassoInicial, DefinicaoPasso>> = {
  servicos: {
    titulo: 'Cadastrar os serviços com preço',
    porque: 'Sem preço não tem agenda nem lucro.',
    rota: '/servicos',
    artigo: 'servicos-e-precos',
  },
  equipe: {
    titulo: 'Cadastrar os barbeiros',
    porque: 'Cada um com a agenda e a comissão dele.',
    rota: '/equipe',
    artigo: 'equipe-e-acessos',
  },
  convite: {
    titulo: 'Convidar a equipe para usar o sistema',
    porque: 'O barbeiro confirma a comanda pelo celular.',
    rota: '/equipe',
    artigo: 'equipe-e-acessos',
  },
  whatsapp: {
    titulo: 'Conectar o WhatsApp da barbearia',
    porque: 'O bot agenda, lembra o horário e reduz as faltas.',
    rota: '/bot',
    artigo: 'conectar-whatsapp',
  },
  agendamento: {
    titulo: 'Marcar o primeiro horário',
    porque: 'A comanda nasce pronta com serviço e preço.',
    rota: '/agenda',
    artigo: 'agenda',
  },
  comanda: {
    titulo: 'Fechar a primeira comanda',
    porque: 'É aqui que entram faturamento, comissão e lucro.',
    rota: '/comandas',
    artigo: 'comanda',
  },
  meta: {
    titulo: 'Definir a meta do mês',
    porque: 'O Início mostra se o ritmo vai bater.',
    rota: '/metricas',
    artigo: 'lucro-e-indicadores',
  },
  notificacoes: {
    titulo: 'Instalar no celular e ligar os avisos',
    porque: 'Caixa com diferença ou WhatsApp caído chegam na hora.',
    rota: '/avisos',
    artigo: 'notificacoes',
  },
};

export type EstadoPrimeirosPassos = Record<PassoInicial, boolean>;

/** Quantos passos feitos e o próximo a fazer (null = tudo pronto). */
export function progressoPrimeirosPassos(e: EstadoPrimeirosPassos): {
  feitos: number;
  total: number;
  proximo: PassoInicial | null;
} {
  const feitos = PASSOS_INICIAIS.filter((p) => e[p]).length;
  return {
    feitos,
    total: PASSOS_INICIAIS.length,
    proximo: PASSOS_INICIAIS.find((p) => !e[p]) ?? null,
  };
}

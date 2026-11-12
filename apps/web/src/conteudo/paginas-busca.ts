// Site N1: uma página por termo dos anúncios e da busca do Google. O texto fica aqui, a página
// é desenhada por componentes/site/pagina-busca.tsx. Regras: frases curtas, números de barbearia,
// nada que o plano não entregue (o selo sai de RECURSOS, a mesma regra da API).
import type { Recurso } from '@pente-fino/shared';
import type { TELAS } from '@/componentes/site/vitrine';
import type { Pergunta } from '@/componentes/site/perguntas';

export interface SecaoBusca {
  titulo: string;
  texto: string;
  /** Recurso que não vem em todos os planos: mostra o selo do plano. */
  recurso?: Recurso;
  tela?: keyof typeof TELAS;
  alt?: string;
}

export interface PaginaBusca {
  caminho: `/${string}`;
  /** Nome curto (trilha do Google e links "Veja também"). */
  nome: string;
  /** <title> da página. */
  titulo: string;
  descricao: string;
  /** H1: o termo de busca, com as palavras de quem procura. */
  h1: string;
  /** Resposta direta logo abaixo do H1. */
  resposta: string;
  secoes: readonly SecaoBusca[];
  perguntas: readonly Pergunta[];
}

export const PAGINAS_BUSCA: readonly PaginaBusca[] = [
  {
    caminho: '/sistema-para-barbearia',
    nome: 'Sistema para barbearia',
    titulo: 'Sistema para barbearia: agenda, comanda, caixa e lucro',
    descricao:
      'Sistema para barbearia que vai do agendamento ao lucro do mês: agenda por barbeiro, comanda que nasce do horário, caixa, comissão e quanto sobrou.',
    h1: 'Sistema para barbearia que mostra quanto sobra',
    resposta:
      'O Pente Fino junta agenda, comanda, caixa, comissão e despesas num lugar só. O cliente marca, a comanda já existe, o barbeiro completa no celular e a recepção fecha. No fim do mês você vê o faturamento e também o lucro.',
    secoes: [
      {
        titulo: 'Lança uma vez, o resto se calcula',
        texto:
          'Agendou, a comanda está criada. O barbeiro lança o extra no celular, a recepção recebe e fecha. Caixa, comissão e indicadores atualizam sozinhos, sem planilha e sem digitar duas vezes.',
        tela: 'agenda',
        alt: 'Agenda do dia com os horários de cada barbeiro',
      },
      {
        titulo: 'Faturamento não é lucro',
        texto:
          'Uma barbearia que fatura R$ 30.000 e gasta R$ 24.000 sobra R$ 6.000. O Pente Fino tira das vendas a comissão, o produto usado e as despesas do mês e mostra o que ficou.',
        tela: 'financeiro',
        alt: 'Tela financeira com faturamento, despesas e lucro do mês',
      },
      {
        titulo: 'Cada um vê o que precisa',
        texto:
          'O dono vê o mês inteiro. A recepção vê a agenda e o caixa. O barbeiro vê só a própria agenda e a própria comissão, no celular.',
        tela: 'celularComanda',
        alt: 'Comanda aberta no celular do barbeiro',
      },
    ],
    perguntas: [
      {
        pergunta: 'Serve para barbearia pequena?',
        resposta:
          'Serve. O plano Básico atende até 3 profissionais e já vem com agenda online, comanda, caixa, comissão automática e o app do barbeiro.',
      },
      {
        pergunta: 'Preciso instalar alguma coisa?',
        resposta:
          'Não. Funciona no navegador do computador e do celular. No celular dá para pôr o ícone na tela inicial, como um aplicativo.',
      },
      {
        pergunta: 'Consigo trazer o que já tenho na planilha?',
        resposta:
          'Sim. A configuração guiada importa clientes, serviços e preços da sua planilha antes do primeiro atendimento.',
      },
    ],
  },
  {
    caminho: '/agenda-online-para-barbearia',
    nome: 'Agenda online para barbearia',
    titulo: 'Agenda online para barbearia com link de agendamento',
    descricao:
      'Agenda online para barbearia com uma agenda por barbeiro e link para o cliente marcar sozinho. O horário marcado já vira comanda.',
    h1: 'Agenda online para barbearia, com link para o cliente marcar',
    resposta:
      'Cada barbeiro tem a própria agenda e a barbearia ganha um link de agendamento para pôr no Instagram e no WhatsApp. O cliente escolhe o serviço, o barbeiro e o horário, sem baixar nada. O horário marcado já vira a comanda do atendimento.',
    secoes: [
      {
        titulo: 'Uma agenda por barbeiro',
        texto:
          'Horários de trabalho, folgas e almoço de cada um. A recepção vê todos lado a lado e encaixa quem chega sem horário.',
        tela: 'agenda',
        alt: 'Agenda com uma coluna por barbeiro',
      },
      {
        titulo: 'Link de agendamento para o cliente',
        texto:
          'O cliente marca sozinho, a qualquer hora, só nos horários livres e só com os serviços da unidade. Você não precisa responder mensagem para marcar.',
      },
      {
        titulo: 'A comanda nasce do horário',
        texto:
          'Marcou um corte de R$ 50 às 15h? A comanda de R$ 50 já existe. O barbeiro acrescenta a barba ou o produto e a recepção só recebe.',
        tela: 'celularComanda',
        alt: 'Comanda criada a partir do horário marcado',
      },
      {
        titulo: 'Lista de espera',
        texto:
          'Quando um horário vaga, ele vai para quem pediu aquele dia. Menos cadeira vazia sem você correr atrás.',
        recurso: 'listaEspera',
      },
    ],
    perguntas: [
      {
        pergunta: 'O cliente precisa baixar aplicativo para marcar?',
        resposta:
          'Não. O link abre no navegador do celular. Ele informa nome e telefone e escolhe o horário.',
      },
      {
        pergunta: 'Tem lembrete do horário?',
        resposta:
          'Nos planos Pro e Premium, o bot do WhatsApp da própria barbearia manda o lembrete, sem custo por mensagem.',
      },
      {
        pergunta: 'Posso bloquear o almoço de toda semana?',
        resposta: 'Pode. O bloqueio pode ser de um dia só ou repetir toda semana, por barbeiro.',
      },
    ],
  },
  {
    caminho: '/controle-financeiro-barbearia',
    nome: 'Controle financeiro para barbearia',
    titulo: 'Controle financeiro para barbearia: caixa, despesas e lucro',
    descricao:
      'Controle financeiro para barbearia: caixa do dia que bate, despesas por grupo, lucro do mês e arquivo pronto para o contador.',
    h1: 'Controle financeiro para barbearia, do caixa do dia ao lucro do mês',
    resposta:
      'O caixa do dia mostra quanto entrou em dinheiro, Pix e cartão, e aponta a diferença na hora de fechar. As despesas ficam por grupo, com o percentual sobre o faturamento. No fim do mês você vê o lucro e manda o arquivo para o contador.',
    secoes: [
      {
        titulo: 'Caixa do dia que bate',
        texto:
          'Abre com o troco, recebe as comandas e fecha contando a gaveta. Se faltar ou sobrar, o sistema mostra quanto e avisa o dono.',
      },
      {
        titulo: 'Despesas por grupo',
        texto:
          'Fixas, variáveis, manutenção, investimento e retirada do dono, cada uma no seu lugar. As fixas se repetem todo mês com um clique.',
        tela: 'financeiro',
        alt: 'Financeiro com despesas por grupo e percentual sobre o faturamento',
      },
      {
        titulo: 'Lucro e projeção do mês',
        texto:
          'Faturou R$ 18.000 até o dia 15 em 12 dias trabalhados, com 24 dias de trabalho no mês? A projeção é R$ 36.000. Você sabe cedo se o mês vai fechar no azul.',
      },
      {
        titulo: 'Margem de cada serviço e produto',
        texto:
          'Corte de R$ 50 com 45% de comissão e R$ 3,50 de produto deixa R$ 24 para a casa. Veja qual serviço dá lucro e qual só dá trabalho.',
        recurso: 'lucroReal',
        tela: 'lucroProdutos',
        alt: 'Lucro e margem de cada serviço e produto',
      },
    ],
    perguntas: [
      {
        pergunta: 'Retirada do dono entra como despesa?',
        resposta:
          'Ela fica registrada, mas fora do percentual de despesas operacionais, junto com investimento e cartão. Assim o lucro da operação não fica distorcido.',
      },
      {
        pergunta: 'O contador consegue usar?',
        resposta:
          'Sim. O dono exporta o mês em planilha com receitas e despesas, pronta para mandar ao contador.',
      },
      {
        pergunta: 'Funciona com várias formas de pagamento na mesma comanda?',
        resposta:
          'Funciona. Uma comanda pode ser paga parte em dinheiro e parte no Pix ou no cartão, e cada parte entra no caixa certo.',
      },
    ],
  },
  {
    caminho: '/comissao-de-barbeiro',
    nome: 'Comissão de barbeiro',
    titulo: 'Comissão de barbeiro automática, item a item',
    descricao:
      'Comissão de barbeiro calculada sozinha em cada serviço e produto, com vigência e extrato no celular do barbeiro. Inclusa em todos os planos.',
    h1: 'Comissão de barbeiro calculada sozinha, sem planilha',
    resposta:
      'Cada serviço e produto da comanda já sai com a comissão do barbeiro, pelo percentual ou valor fixo que você definiu. Mudou a regra? Vale dali para frente, sem mexer no que já foi pago. O barbeiro acompanha o próprio extrato no celular.',
    secoes: [
      {
        titulo: 'Item a item, com vigência',
        texto:
          'Comissão de 45% no serviço e 10% no produto, por exemplo. Corte de R$ 50 rende R$ 22,50 ao barbeiro; pomada de R$ 40, R$ 4. Se a regra mudar no dia 10, só o que vier depois usa a nova.',
        recurso: 'comissoes',
      },
      {
        titulo: 'Extrato do barbeiro no celular',
        texto:
          'Ele vê o que atendeu, quanto ganhou e o que já recebeu. Sem discussão no fim do mês e sem acesso aos números da casa.',
        tela: 'celularDesempenho',
        alt: 'Extrato de comissão do barbeiro no celular',
      },
      {
        titulo: 'Pagamento registrado',
        texto:
          'Pagou um adiantamento ou o mês fechado? Fica registrado, e o saldo a receber se atualiza.',
      },
    ],
    perguntas: [
      {
        pergunta: 'A comissão vem em qual plano?',
        resposta: 'Em todos, inclusive no Básico, sem custo extra.',
      },
      {
        pergunta: 'E a comissão do assinante do clube?',
        resposta:
          'O barbeiro recebe por atendimento, sobre o preço de tabela do serviço na data. O dono pode trocar por um valor fixo.',
      },
      {
        pergunta: 'O barbeiro pode ter preço próprio?',
        resposta:
          'Pode. Ele muda o próprio preço no perfil e a comissão sai desse valor. Sem preço próprio, vale o da unidade.',
      },
    ],
  },
  {
    caminho: '/comanda-digital-barbearia',
    nome: 'Comanda digital para barbearia',
    titulo: 'Comanda digital para barbearia, sem papel',
    descricao:
      'Comanda digital para barbearia: criada pelo agendamento, completada pelo barbeiro no celular e fechada pela recepção. Impressão em PDF com QR code.',
    h1: 'Comanda digital para barbearia: fim da comanda de papel',
    resposta:
      'A comanda é criada quando o cliente marca. O barbeiro acrescenta o que fez no celular, a recepção recebe e fecha. Se precisar de papel, a comanda sai em PDF com QR code.',
    secoes: [
      {
        titulo: 'Criada pelo agendamento',
        texto:
          'Ninguém digita a comanda. O horário marcado já traz o cliente, o barbeiro e o serviço com o preço do dia.',
        tela: 'celularComanda',
        alt: 'Comanda digital aberta no celular',
      },
      {
        titulo: 'Extras lançados por quem atendeu',
        texto:
          'Barba, sobrancelha, pomada: o barbeiro lança na hora e confirma. A recepção só confere e recebe.',
      },
      {
        titulo: 'Fechada uma vez, contada em tudo',
        texto:
          'Só a comanda fechada entra no faturamento, na comissão e nos indicadores. Reabrir pede permissão, motivo e fica registrado.',
      },
    ],
    perguntas: [
      {
        pergunta: 'Dá para imprimir?',
        resposta:
          'Dá. A comanda sai em PDF, com QR code, para quem ainda gosta do papel no balcão.',
      },
      {
        pergunta: 'Funciona sem internet?',
        resposta: 'O app do barbeiro guarda o que foi lançado e envia quando a internet volta.',
      },
      {
        pergunta: 'Posso dar desconto na comanda?',
        resposta: 'Pode. O desconto fica registrado no item, e a comissão sai do valor cobrado.',
      },
    ],
  },
  {
    caminho: '/whatsapp-para-barbearia',
    nome: 'WhatsApp para barbearia',
    titulo: 'Bot de WhatsApp para barbearia, sem custo por mensagem',
    descricao:
      'Bot de WhatsApp para barbearia que agenda 24 horas com menus que você programa. Sem inteligência artificial e sem custo por mensagem. Planos Pro e Premium.',
    h1: 'Bot de WhatsApp para barbearia que agenda sozinho',
    resposta:
      'O bot usa o WhatsApp da própria barbearia, conectado por QR Code. Ele responde com menus que você programa: agendar, remarcar, ver preços e endereço. Não usa inteligência artificial e não cobra por mensagem.',
    secoes: [
      {
        titulo: 'Agenda 24 horas',
        texto:
          'O cliente manda "oi" às 23h e sai com o horário marcado, nos horários livres do barbeiro que escolheu.',
        recurso: 'bot',
      },
      {
        titulo: 'Menus que você controla',
        texto:
          'Você escreve as respostas e monta o menu. Sem resposta inventada: o bot só diz o que você programou.',
        recurso: 'bot',
      },
      {
        titulo: 'Lembrete e retorno',
        texto:
          'Lembrete antes do horário para reduzir faltas. No Premium, também o convite de retorno e a mensagem de aniversário.',
        recurso: 'automacoes',
      },
    ],
    perguntas: [
      {
        pergunta: 'Preciso de WhatsApp Business oficial?',
        resposta:
          'Não. Você conecta o WhatsApp da barbearia lendo um QR Code, como no WhatsApp Web.',
      },
      {
        pergunta: 'Tem custo por mensagem?',
        resposta: 'Não. O bot está incluso nos planos Pro e Premium.',
      },
      {
        pergunta: 'E se o cliente quiser falar com uma pessoa?',
        resposta:
          'O menu tem a opção de falar com a recepção, e a conversa continua no mesmo WhatsApp.',
      },
    ],
  },
  {
    caminho: '/aplicativo-para-barbearia',
    nome: 'Aplicativo para barbearia',
    titulo: 'Aplicativo para barbearia e app do barbeiro no celular',
    descricao:
      'Aplicativo para barbearia que abre no celular sem loja: agenda, comandas, comissão e desempenho do barbeiro. Funciona mesmo com a internet fraca.',
    h1: 'Aplicativo para barbearia, direto no celular',
    resposta:
      'O Pente Fino abre no navegador e vira um ícone na tela inicial do celular, sem passar pela loja de aplicativos. O barbeiro vê a agenda, lança extras na comanda e acompanha a própria comissão. Se a internet cair, ele continua lançando.',
    secoes: [
      {
        titulo: 'App do barbeiro',
        texto:
          'Agenda do dia, comandas para completar e o quanto já ganhou no mês. Ele vê só os próprios dados.',
        tela: 'celularDesempenho',
        alt: 'App do barbeiro com o desempenho do mês',
      },
      {
        titulo: 'Sem loja, sem atualização',
        texto:
          'Abre pelo link e fica na tela inicial. Toda melhoria chega sozinha, sem baixar versão nova.',
      },
      {
        titulo: 'Funciona com a internet fraca',
        texto: 'O que o barbeiro lança fica guardado no aparelho e sobe quando a conexão volta.',
        tela: 'celularComanda',
        alt: 'Comanda lançada no celular do barbeiro',
      },
    ],
    perguntas: [
      {
        pergunta: 'Funciona em iPhone e Android?',
        resposta: 'Funciona nos dois, pelo navegador. Dá para pôr o ícone na tela inicial.',
      },
      {
        pergunta: 'O barbeiro paga para usar?',
        resposta: 'Não. O plano é da barbearia, e cada barbeiro ativo entra no limite do plano.',
      },
      {
        pergunta: 'O dono também usa pelo celular?',
        resposta:
          'Usa. O painel inteiro se ajusta ao celular: agenda, caixa, resultados e financeiro.',
      },
    ],
  },
];

export const paginaBusca = (caminho: string) => {
  const p = PAGINAS_BUSCA.find((x) => x.caminho === caminho);
  if (!p) throw new Error(`página de busca sem conteúdo: ${caminho}`);
  return p;
};

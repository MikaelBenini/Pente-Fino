'use client';

import { ITENS_MENU, type IdMenu } from '@pente-fino/shared';
import { EstadoVazio } from '@pente-fino/ui';
import { ICONES_MENU } from './icones-menu';
import { nomeDaUnidade, useApp } from './contexto-app';

type IdSecao = Exclude<IdMenu, 'perfil'>;

/** O que cada tela vai mostrar e como começa a ter dados. */
const TEXTOS: Record<IdSecao, { pergunta: string; vazio: string; texto: string }> = {
  inicio: {
    pergunta: 'Como está o mês?',
    vazio: 'Os números do mês aparecem aqui',
    texto:
      'Faturamento contra a meta, ritmo, projeção, lucro, ticket médio, ocupação e extras, calculados das comandas fechadas. Aparecem assim que a primeira comanda for fechada.',
  },
  dia: {
    pergunta: 'O que tem para hoje e o que já foi feito?',
    vazio: 'A agenda e o movimento do dia aparecem aqui',
    texto:
      'Quem atende quem e quando, o que já foi fechado, o que ainda vai entrar, faltas, clientes novos e aniversariantes, por barbeiro.',
  },
  hoje: {
    pergunta: 'Quem é o próximo?',
    vazio: 'Seus clientes de hoje aparecem aqui',
    texto:
      'Próximos horários, a meta do mês com a barra de ritmo e a comissão do dia. Quando a recepção marcar um horário com você, ele aparece nesta tela.',
  },
  agenda: {
    pergunta: 'Quem atende quem e quando?',
    vazio: 'A agenda do dia aparece aqui',
    texto:
      'Uma coluna por profissional, com cada horário e o estado da comanda. Para marcar o primeiro horário, a unidade precisa ter equipe e serviços cadastrados.',
  },
  comandas: {
    pergunta: 'O que falta receber?',
    vazio: 'Nenhuma comanda aberta',
    texto:
      'Todo agendamento vira uma comanda prevista. O barbeiro lança os extras e confirma; a recepção recebe e fecha. Só comanda fechada entra no faturamento.',
  },
  caixa: {
    pergunta: 'O caixa bate?',
    vazio: 'O caixa do dia aparece aqui',
    texto:
      'Entradas por forma de pagamento, comandas pendentes e a diferença entre o sistema e a gaveta. No fim do dia, você confere e fecha.',
  },
  financeiro: {
    pergunta: 'Quanto sobrou?',
    vazio: 'Receitas e despesas aparecem aqui',
    texto:
      'Despesas por categoria (fixas, variáveis, manutenção), o percentual sobre o faturamento e o lucro do mês. Investimento, retirada do dono e cartão aparecem à parte.',
  },
  metricas: {
    pergunta: 'Bati a meta?',
    vazio: 'Metas e indicadores aparecem aqui',
    texto:
      'Meta de faturamento e de serviços por unidade e mês, com o atual calculado sozinho, ritmo e projeção pelo calendário da unidade.',
  },
  equipe: {
    pergunta: 'Quem trabalha aqui?',
    vazio: 'Cadastre sua equipe',
    texto:
      'Profissionais com data de entrada, horários e regra de comissão com vigência. Convide recepção e barbeiros por e-mail ou WhatsApp.',
  },
  clube: {
    pergunta: 'Quem é assinante?',
    vazio: 'O clube da barbearia aparece aqui',
    texto:
      'Planos de assinatura, combos e convênios com valor por unidade. A comanda reconhece o assinante e não cobra o que o plano cobre.',
  },
  servicos: {
    pergunta: 'Quanto custa cada serviço?',
    vazio: 'Cadastre seu primeiro serviço',
    texto:
      'Duração, custo de produto, se é extra e quanto pesa em atendimentos. A tabela de preços tem uma coluna por unidade e data de início; mudar o preço nunca altera o passado.',
  },
  produtos: {
    pergunta: 'O que está à venda?',
    vazio: 'Cadastre seus produtos',
    texto:
      'Pomadas, óleos e o que mais a barbearia vende, com preço de venda e custo. A venda entra na comanda como receita de produto.',
  },
  clientes: {
    pergunta: 'Quem volta e quem sumiu?',
    vazio: 'Seus clientes aparecem aqui',
    texto:
      'Cada cliente atendido entra com telefone, histórico de comandas e anotações. Também dá para cadastrar na hora, no balcão.',
  },
  desempenho: {
    pergunta: 'Como foi o meu mês?',
    vazio: 'Seu desempenho aparece aqui',
    texto:
      'Clientes atendidos, ticket médio e extras do mês, comparados com o mês anterior. Conta a partir das comandas fechadas com você.',
  },
  comissoes: {
    pergunta: 'Quanto tenho a receber?',
    vazio: 'Suas comissões aparecem aqui',
    texto:
      'Extrato item por item, separado em previsto, a receber e pago. A comissão entra quando a recepção fecha a comanda.',
  },
  metas: {
    pergunta: 'Falta quanto para a meta?',
    vazio: 'Suas metas aparecem aqui',
    texto: 'A meta do mês com a barra de ritmo: onde você está e onde deveria estar hoje.',
  },
  bot: {
    pergunta: 'O que o bot responde?',
    vazio: 'Monte o menu do WhatsApp',
    texto:
      'Menu numerado, respostas prontas e palavras-chave, sem inteligência artificial: o bot responde só o que você escrever. Começa por um modelo pronto.',
  },
  conversas: {
    pergunta: 'Quem está esperando resposta?',
    vazio: 'Nenhuma conversa esperando',
    texto:
      'Mensagens do WhatsApp da unidade. Quando um cliente pede atendente, a conversa aparece aqui para você assumir ou devolver ao bot.',
  },
  configuracoes: {
    pergunta: 'Como a barbearia funciona?',
    vazio: 'Configurações da conta',
    texto:
      'Unidades, dias de trabalho e capacidade, calendário de feriados, conexão do WhatsApp e modelos de mensagem.',
  },
};

export function Secao({ id }: { id: IdSecao }) {
  const contexto = useApp();
  const item = ITENS_MENU.find((i) => i.id === id)!;
  const t = TEXTOS[id];
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
          {nomeDaUnidade(contexto)}
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{item.rotulo}</h1>
        <p className="text-lg text-tinta-suave">{t.pergunta}</p>
      </header>
      <EstadoVazio icone={ICONES_MENU[id]} titulo={t.vazio} texto={<p>{t.texto}</p>} />
    </div>
  );
}

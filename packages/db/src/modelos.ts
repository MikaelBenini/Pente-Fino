// Modelos prontos para uma conta nova: o dono começa com o básico cadastrado e
// ajusta depois. Usado pelo seed e, na Etapa 4, pelo cadastro de conta.
import {
  dataParaBanco,
  MENSAGENS_BOT_PADRAO,
  MENU_BOT_PADRAO,
  TIPOS_MENSAGEM_BOT,
  type DataISO,
} from '@pente-fino/shared';
import type { GrupoDespesa, Prisma, TipoModeloMensagem } from './generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export interface ModeloServico {
  nome: string;
  categoria: string;
  duracaoMin: number;
  /** Centavos. */
  custoProduto: number;
  ehExtra: boolean;
  pesoAtendimento: number;
  /** Preço sugerido em centavos; o dono troca na tabela de preços. */
  precoSugerido: number;
}

/** Peso: principal 1, extra 0, combo = soma dos inclusos. */
export const MODELO_SERVICOS: readonly ModeloServico[] = [
  {
    nome: 'Corte',
    categoria: 'Cabelo',
    duracaoMin: 30,
    custoProduto: 150,
    ehExtra: false,
    pesoAtendimento: 1,
    precoSugerido: 4500,
  },
  {
    nome: 'Barba',
    categoria: 'Barba',
    duracaoMin: 30,
    custoProduto: 200,
    ehExtra: false,
    pesoAtendimento: 1,
    precoSugerido: 3500,
  },
  {
    nome: 'Corte + Barba',
    categoria: 'Combo',
    duracaoMin: 60,
    custoProduto: 350,
    ehExtra: false,
    pesoAtendimento: 2,
    precoSugerido: 7000,
  },
  {
    nome: 'Corte infantil',
    categoria: 'Cabelo',
    duracaoMin: 30,
    custoProduto: 150,
    ehExtra: false,
    pesoAtendimento: 1,
    precoSugerido: 4000,
  },
  {
    nome: 'Platinado',
    categoria: 'Química',
    duracaoMin: 120,
    custoProduto: 3500,
    ehExtra: false,
    pesoAtendimento: 1,
    precoSugerido: 18000,
  },
  {
    nome: 'Selagem',
    categoria: 'Química',
    duracaoMin: 60,
    custoProduto: 2500,
    ehExtra: false,
    pesoAtendimento: 1,
    precoSugerido: 12000,
  },
  {
    nome: 'Sobrancelha',
    categoria: 'Extras',
    duracaoMin: 10,
    custoProduto: 0,
    ehExtra: true,
    pesoAtendimento: 0,
    precoSugerido: 1500,
  },
  {
    nome: 'Pezinho',
    categoria: 'Extras',
    duracaoMin: 10,
    custoProduto: 0,
    ehExtra: true,
    pesoAtendimento: 0,
    precoSugerido: 1000,
  },
  {
    nome: 'Hidratação',
    categoria: 'Extras',
    duracaoMin: 15,
    custoProduto: 400,
    ehExtra: true,
    pesoAtendimento: 0,
    precoSugerido: 2500,
  },
  {
    nome: 'Pigmentação de barba',
    categoria: 'Extras',
    duracaoMin: 20,
    custoProduto: 500,
    ehExtra: true,
    pesoAtendimento: 0,
    precoSugerido: 3000,
  },
];

/** Investimento, retirada do dono e cartão/resgates ficam fora do % de despesas operacionais. */
export const MODELO_CATEGORIAS_DESPESA: readonly { nome: string; grupo: GrupoDespesa }[] = [
  { nome: 'Aluguel', grupo: 'fixa' },
  { nome: 'Condomínio e IPTU', grupo: 'fixa' },
  { nome: 'Internet e telefone', grupo: 'fixa' },
  { nome: 'Sistemas e assinaturas', grupo: 'fixa' },
  { nome: 'Contador', grupo: 'fixa' },
  { nome: 'Salários e encargos', grupo: 'fixa' },
  { nome: 'Energia elétrica', grupo: 'variavel' },
  { nome: 'Água', grupo: 'variavel' },
  { nome: 'Produtos de uso', grupo: 'variavel' },
  { nome: 'Limpeza e descartáveis', grupo: 'variavel' },
  { nome: 'Taxas da maquininha', grupo: 'variavel' },
  { nome: 'Marketing', grupo: 'variavel' },
  { nome: 'Manutenção de equipamentos', grupo: 'manutencao' },
  { nome: 'Reparos no espaço', grupo: 'manutencao' },
  { nome: 'Equipamentos novos', grupo: 'investimento' },
  { nome: 'Reforma e ampliação', grupo: 'investimento' },
  { nome: 'Retirada do dono', grupo: 'retirada_dono' },
  { nome: 'Fatura do cartão', grupo: 'cartao_resgate' },
  { nome: 'Resgates', grupo: 'cartao_resgate' },
];

/** Variáveis: {cliente}, {data}, {hora}, {profissional}, {unidade}, {link}. */
export const MODELO_MENSAGENS: readonly { tipo: TipoModeloMensagem; texto: string }[] = [
  {
    tipo: 'confirmacao',
    texto:
      'Olá, {cliente}! Seu horário na {unidade} está marcado para {data} às {hora} com {profissional}. ' +
      'Responda 1 para confirmar ou 2 para remarcar.',
  },
  {
    tipo: 'lembrete',
    texto:
      'Oi, {cliente}! Lembrete: hoje às {hora} você tem horário com {profissional} na {unidade}. Até já!',
  },
  {
    tipo: 'retorno',
    texto:
      'Oi, {cliente}! Já faz um tempinho desde o seu último corte na {unidade}. ' +
      'Quer agendar? É só responder com 1 ou acessar {link}.',
  },
  {
    tipo: 'aniversario',
    texto:
      'Parabéns, {cliente}! A equipe da {unidade} deseja um ótimo aniversário. Passa aqui para ficar no grau!',
  },
];

export interface OpcoesModelos {
  /** Unidades que recebem a tabela de preços sugerida. */
  unidadeIds: readonly string[];
  /** Início da vigência dos preços sugeridos. */
  vigenciaInicio: DataISO;
  /** false: cria só categorias, mensagens e menu do bot (os serviços vêm da configuração guiada). */
  incluirServicos?: boolean;
}

/**
 * Cadastra os modelos prontos na conta da transação (naConta).
 * Devolve os serviços criados, pelo nome, para quem precisar dos ids.
 */
export async function aplicarModelosIniciais(
  tx: Tx,
  { unidadeIds, vigenciaInicio, incluirServicos = true }: OpcoesModelos,
): Promise<Map<string, string>> {
  const servicos = new Map<string, string>();
  for (const { precoSugerido, ...dados } of incluirServicos ? MODELO_SERVICOS : []) {
    const servico = await tx.servico.create({ data: { ...dados, unidadeIds: [...unidadeIds] } });
    servicos.set(servico.nome, servico.id);
    await tx.precoServico.createMany({
      data: unidadeIds.map((unidadeId) => ({
        servicoId: servico.id,
        unidadeId,
        valor: precoSugerido,
        vigenciaInicio: dataParaBanco(vigenciaInicio),
      })),
    });
  }
  await tx.categoriaDespesa.createMany({ data: [...MODELO_CATEGORIAS_DESPESA] });
  await tx.modeloMensagem.createMany({
    data: [
      ...MODELO_MENSAGENS,
      ...TIPOS_MENSAGEM_BOT.map((tipo) => ({ tipo, texto: MENSAGENS_BOT_PADRAO[tipo] })),
    ],
  });
  // Menu do bot pronto e publicado: a barbearia já tem um bot que funciona e só edita.
  await tx.botMenu.create({
    data: {
      status: 'publicado',
      menu: structuredClone(MENU_BOT_PADRAO) as unknown as Prisma.InputJsonValue,
      publicadoEm: new Date(),
    },
  });
  return servicos;
}

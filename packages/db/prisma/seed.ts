// Seed de demonstração: conta "Barbearia Pente Fino (demonstração)" com 2 unidades,
// 5 barbeiros e os últimos 30 dias de comandas, com a agenda de hoje em andamento.
//
// Roda como o usuário da aplicação (DATABASE_URL), sujeito ao RLS, exatamente como a API.
// É determinístico (sorteio com semente fixa) a partir da data de hoje.
// Rodar de novo apaga a conta de demonstração e recria do zero; outras contas não são tocadas.
//
// Uso: pnpm db:seed
import {
  comissaoItem,
  dataLocal,
  dataParaBanco,
  selecionarVigente,
  valorItem,
  type DataISO,
} from '@pente-fino/shared';
import { hash } from '@node-rs/argon2';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  aplicarModelosIniciais,
  criarPrisma,
  naConta,
  type FormaPagamento,
  type OrigemAgendamento,
  type Prisma,
  type StatusComanda,
  type TipoItemComanda,
} from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

export const CONTA_DEMO_ID = '019a4b2c-0000-7000-8000-00000000d3e0';
/** Senha de todos os usuários da demonstração. Só existe em desenvolvimento. */
export const SENHA_DEMO = 'pentefino123';
const DIAS_DE_HISTORICO = 30;
const FUSO = 'America/Sao_Paulo';

// ─── Sorteio determinístico ───────────────────────────────────────────────

function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const aleatorio = mulberry32(20261103);
const chance = (p: number) => aleatorio() < p;
const inteiro = (min: number, max: number) => min + Math.floor(aleatorio() * (max - min + 1));
function sortear<T>(itens: readonly T[]): T {
  return itens[Math.floor(aleatorio() * itens.length)]!;
}
function sortearPeso<T>(opcoes: readonly (readonly [T, number])[]): T {
  const total = opcoes.reduce((s, [, p]) => s + p, 0);
  let r = aleatorio() * total;
  for (const [valor, peso] of opcoes) {
    r -= peso;
    if (r < 0) return valor;
  }
  return opcoes[opcoes.length - 1]![0];
}

// ─── Datas (São Paulo é UTC−3 o ano todo desde 2019) ──────────────────────

function somarDias(data: DataISO, dias: number): DataISO {
  const d = dataParaBanco(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diaDaSemana(data: DataISO): number {
  return dataParaBanco(data).getUTCDay();
}
/** Instante de um horário local (minutos desde a meia-noite) num dia de São Paulo. */
function instante(data: DataISO, minutos: number): Date {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return new Date(`${data}T${hh}:${mm}:00-03:00`);
}
function primeiroDoMes(data: DataISO): DataISO {
  return `${data.slice(0, 7)}-01`;
}
function adicionarMinutos(d: Date, minutos: number): Date {
  return new Date(d.getTime() + minutos * 60_000);
}

// ─── Dados fictícios ──────────────────────────────────────────────────────

const NOMES = [
  'Gabriel',
  'Lucas',
  'Matheus',
  'Pedro',
  'Guilherme',
  'Rafael',
  'Felipe',
  'Bruno',
  'João',
  'Gustavo',
  'Vinícius',
  'Leonardo',
  'Eduardo',
  'Rodrigo',
  'Henrique',
  'André',
  'Caio',
  'Daniel',
  'Marcelo',
  'Thiago',
  'Igor',
  'Otávio',
  'Renan',
  'Samuel',
  'Vitor',
  'Arthur',
  'Enzo',
  'Davi',
  'Murilo',
  'Heitor',
];
const SOBRENOMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Rodrigues',
  'Ferreira',
  'Alves',
  'Pereira',
  'Lima',
  'Gomes',
  'Costa',
  'Ribeiro',
  'Martins',
  'Carvalho',
  'Almeida',
  'Lopes',
  'Barbosa',
  'Rocha',
  'Dias',
  'Moreira',
];

const EQUIPE = [
  { nome: 'Rafael Moura', unidade: 'Centro', percentual: 5000, entradaHaDias: 900 },
  {
    nome: 'Diego Prado',
    unidade: 'Centro',
    percentual: 4000,
    entradaHaDias: 420,
    novoPercentual: 4500,
  },
  { nome: 'Thiago Nunes', unidade: 'Centro', percentual: 4000, entradaHaDias: 200 },
  { nome: 'Lucas Teixeira', unidade: 'Jardins', percentual: 4500, entradaHaDias: 600 },
  { nome: 'Bruno Farias', unidade: 'Jardins', percentual: 4000, entradaHaDias: 75 },
] as const;

const PRODUTOS = [
  { nome: 'Pomada modeladora', categoria: 'Cabelo', precoVenda: 4500, custo: 1800 },
  { nome: 'Óleo para barba', categoria: 'Barba', precoVenda: 3900, custo: 1400 },
  { nome: 'Shampoo anticaspa', categoria: 'Cabelo', precoVenda: 3500, custo: 1500 },
] as const;

// ─── Seed ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = criarPrisma();
  const hoje = dataLocal(new Date(), FUSO);
  const inicioHistorico = somarDias(hoje, -DIAS_DE_HISTORICO);
  const agora = new Date();

  try {
    // Apaga a demonstração anterior (a cascata leva tudo da conta, inclusive auditoria).
    const removida = await naConta(prisma, CONTA_DEMO_ID, (tx) =>
      tx.conta.deleteMany({ where: { id: CONTA_DEMO_ID } }),
    );
    if (removida.count > 0) console.log('Conta de demonstração anterior removida.');

    const resumo = await naConta(
      prisma,
      CONTA_DEMO_ID,
      (tx) => popular(tx, { hoje, inicioHistorico, agora }),
      { timeout: 120_000, maxWait: 10_000 },
    );

    console.log(`Conta de demonstração criada (${CONTA_DEMO_ID}).`);
    console.log(
      `Login: dono@demo.pentefino.dev (e os demais @demo.pentefino.dev) · senha: ${SENHA_DEMO}`,
    );
    console.table(resumo);
  } finally {
    await prisma.$disconnect();
  }
}

interface Contexto {
  hoje: DataISO;
  inicioHistorico: DataISO;
  agora: Date;
}

async function popular(tx: Prisma.TransactionClient, { hoje, inicioHistorico, agora }: Contexto) {
  await tx.conta.create({
    data: {
      id: CONTA_DEMO_ID,
      nome: 'Barbearia Pente Fino (demonstração)',
      plano: 'premium',
      status: 'ativa',
      configuradaEm: new Date(),
    },
  });

  // Unidades: Centro abre de segunda a sábado; Jardins, de terça a sábado.
  const centro = await tx.unidade.create({
    data: {
      nome: 'Centro',
      slug: 'demo-centro',
      agendamentoPublico: true,
      endereco: 'Rua Augusta, 1200 - São Paulo/SP',
      telefone: '551130000001',
      diasTrabalho: [1, 2, 3, 4, 5, 6],
      capacidade: 3,
    },
  });
  const jardins = await tx.unidade.create({
    data: {
      nome: 'Jardins',
      slug: 'demo-jardins',
      agendamentoPublico: true,
      endereco: 'Alameda Lorena, 450 - São Paulo/SP',
      telefone: '551130000002',
      diasTrabalho: [2, 3, 4, 5, 6],
      capacidade: 2,
    },
  });
  const unidades = { Centro: centro, Jardins: jardins };

  // Feriado de Finados (02/11) e Proclamação da República (15/11): ninguém trabalha.
  const ano = hoje.slice(0, 4);
  for (const [data, motivo] of [
    [`${ano}-11-02`, 'Finados'],
    [`${ano}-11-15`, 'Proclamação da República'],
  ] as const) {
    await tx.calendarioUnidade.createMany({
      data: [centro.id, jardins.id].map((unidadeId) => ({
        unidadeId,
        data: dataParaBanco(data),
        trabalha: false,
        motivo,
      })),
    });
  }
  const feriados = new Set([`${ano}-11-02`, `${ano}-11-15`]);

  // Modelos prontos (serviços, categorias, bot, mensagens) com preços desde 60 dias atrás.
  const vigenciaBase = somarDias(hoje, -60);
  const servicoIds = await aplicarModelosIniciais(tx, {
    unidadeIds: [centro.id, jardins.id],
    vigenciaInicio: vigenciaBase,
  });
  const servicos = await tx.servico.findMany();
  const servicoPorNome = new Map(servicos.map((s) => [s.nome, s]));

  // Reajuste no meio do período: Corte passa de R$ 45 para R$ 50 no Centro há 10 dias.
  const dataReajuste = somarDias(hoje, -10);
  await tx.precoServico.create({
    data: {
      servicoId: servicoIds.get('Corte')!,
      unidadeId: centro.id,
      valor: 5000,
      vigenciaInicio: dataParaBanco(dataReajuste),
    },
  });
  const tabelaPrecos = await tx.precoServico.findMany();
  function preco(servicoId: string, unidadeId: string, data: DataISO): number {
    const vigente = selecionarVigente(
      tabelaPrecos
        .filter((p) => p.servicoId === servicoId && p.unidadeId === unidadeId)
        .map((p) => ({
          vigenciaInicio: p.vigenciaInicio.toISOString().slice(0, 10),
          valor: p.valor,
        })),
      data,
    );
    if (!vigente) throw new Error(`sem preço vigente para ${servicoId} em ${data}`);
    return vigente.valor;
  }

  const produtos = await Promise.all(PRODUTOS.map((p) => tx.produto.create({ data: p })));

  // Pessoas: dono, gestor, recepção (uma por unidade) e barbeiros.
  const dono = await tx.usuario.create({
    data: { nome: 'Carlos Mendes', email: 'dono@demo.pentefino.dev', telefone: '5511990000001' },
  });
  const gestor = await tx.usuario.create({
    data: { nome: 'Fernanda Ramos', email: 'gestor@demo.pentefino.dev', telefone: '5511990000002' },
  });
  const recepCentro = await tx.usuario.create({
    data: { nome: 'Juliana Castro', email: 'recepcao.centro@demo.pentefino.dev' },
  });
  const recepJardins = await tx.usuario.create({
    data: { nome: 'Patrícia Lemos', email: 'recepcao.jardins@demo.pentefino.dev' },
  });
  await tx.papelUsuario.createMany({
    data: [
      { usuarioId: dono.id, papel: 'dono', unidadeId: null },
      { usuarioId: gestor.id, papel: 'gestor', unidadeId: centro.id },
      { usuarioId: recepCentro.id, papel: 'recepcao', unidadeId: centro.id },
      { usuarioId: recepJardins.id, papel: 'recepcao', unidadeId: jardins.id },
    ],
  });
  const recepcaoDa = { [centro.id]: recepCentro.id, [jardins.id]: recepJardins.id };

  const dataNovaRegra = somarDias(hoje, -15);
  const barbeiros: {
    id: string;
    unidadeId: string;
    regras: { vigenciaInicio: DataISO; percentualBp: number }[];
    regraProduto: number;
    usuarioId: string;
  }[] = [];
  for (const membro of EQUIPE) {
    const email = `${membro.nome.split(' ')[0]!.toLowerCase()}@demo.pentefino.dev`;
    const usuario = await tx.usuario.create({ data: { nome: membro.nome, email } });
    const unidade = unidades[membro.unidade];
    await tx.papelUsuario.create({
      data: { usuarioId: usuario.id, papel: 'barbeiro', unidadeId: unidade.id },
    });
    const entrada = somarDias(hoje, -membro.entradaHaDias);
    const profissional = await tx.profissional.create({
      data: { usuarioId: usuario.id, unidadeId: unidade.id, dataEntrada: dataParaBanco(entrada) },
    });
    await tx.horarioProfissional.createMany({
      data: unidade.diasTrabalho.map((diaSemana) => ({
        profissionalId: profissional.id,
        diaSemana,
        inicioMin: 9 * 60,
        fimMin: 19 * 60,
      })),
    });
    const regras = [{ vigenciaInicio: entrada, percentualBp: membro.percentual }];
    if ('novoPercentual' in membro)
      regras.push({ vigenciaInicio: dataNovaRegra, percentualBp: membro.novoPercentual });
    await tx.regraComissao.createMany({
      data: [
        ...regras.map((r) => ({
          profissionalId: profissional.id,
          tipoItem: 'servico' as const,
          percentualBp: r.percentualBp,
          vigenciaInicio: dataParaBanco(r.vigenciaInicio),
        })),
        {
          profissionalId: profissional.id,
          tipoItem: 'produto' as const,
          percentualBp: 1000,
          vigenciaInicio: dataParaBanco(entrada),
        },
      ],
    });
    barbeiros.push({
      id: profissional.id,
      unidadeId: unidade.id,
      regras,
      regraProduto: 1000,
      usuarioId: usuario.id,
    });
  }

  // Clientes com telefone único.
  const clientes = Array.from({ length: 140 }, (_, i) => ({
    id: randomUUID(),
    nome: `${sortear(NOMES)} ${sortear(SOBRENOMES)}`,
    telefone: `55119${String(70000000 + i * 7919).padStart(8, '0')}`,
    unidadeOrigemId: i % 3 === 0 ? jardins.id : centro.id,
    consentimentoMsg: chance(0.8),
    origemLead: sortearPeso([
      ['indicação', 4],
      ['instagram', 3],
      ['passou na frente', 2],
      ['google', 1],
    ] as const),
    aniversario: chance(0.6)
      ? dataParaBanco(
          `${inteiro(1970, 2008)}-${String(inteiro(1, 12)).padStart(2, '0')}-${String(inteiro(1, 28)).padStart(2, '0')}`,
        )
      : null,
  }));
  await tx.cliente.createMany({ data: clientes });

  // ─── Agenda e comandas ──────────────────────────────────────────────────

  const agendamentos: Prisma.AgendamentoCreateManyInput[] = [];
  const comandas: Prisma.ComandaCreateManyInput[] = [];
  const itens: Prisma.ItemComandaCreateManyInput[] = [];
  const pagamentos: Prisma.PagamentoCreateManyInput[] = [];
  const caixaPorDia = new Map<string, { unidadeId: string; data: DataISO; total: number }>();

  const principais = [
    ['Corte', 50],
    ['Corte + Barba', 30],
    ['Barba', 14],
    ['Corte infantil', 5],
    ['Selagem', 1],
  ] as const;
  const extras = ['Sobrancelha', 'Pezinho', 'Hidratação', 'Pigmentação de barba'] as const;
  const DURACAO_SLOT = 45;

  for (let data = inicioHistorico; data <= hoje; data = somarDias(data, 1)) {
    if (feriados.has(data)) continue;
    for (const barbeiro of barbeiros) {
      const unidade = barbeiro.unidadeId === centro.id ? centro : jardins;
      if (!unidade.diasTrabalho.includes(diaDaSemana(data))) continue;
      const regraServico = selecionarVigente(barbeiro.regras, data)!;

      for (let minuto = 9 * 60; minuto + DURACAO_SLOT <= 19 * 60; minuto += DURACAO_SLOT) {
        if (minuto === 12 * 60 + 45) continue; // almoço
        if (!chance(0.62)) continue;

        const inicio = instante(data, minuto);
        const fim = adicionarMinutos(inicio, DURACAO_SLOT);
        const passado = fim <= agora;
        const emAndamento = inicio <= agora && agora < fim;
        const cliente = sortear(clientes);
        const veioPelaAgenda = chance(0.72);
        const falta = passado && veioPelaAgenda && chance(0.05);

        let status: StatusComanda = 'prevista';
        if (falta) status = 'cancelada';
        else if (passado) status = 'fechada';
        else if (emAndamento) status = 'em_atendimento';
        // Sem agendamento, a comanda só existe quando o cliente chega.
        if (!veioPelaAgenda && !passado && !emAndamento) continue;

        const comandaId = randomUUID();
        let agendamentoId: string | null = null;
        if (veioPelaAgenda) {
          agendamentoId = randomUUID();
          agendamentos.push({
            id: agendamentoId,
            unidadeId: unidade.id,
            profissionalId: barbeiro.id,
            clienteId: cliente.id,
            inicio,
            fim,
            status: falta ? 'falta' : passado ? 'atendido' : 'agendado',
            origem: sortearPeso<OrigemAgendamento>([
              ['balcao', 4],
              ['bot', 3],
              ['app', 2],
              ['link', 1],
            ]),
            criadoEm: adicionarMinutos(inicio, -inteiro(60, 60 * 24 * 5)),
          });
        }

        // Itens: um serviço principal, às vezes extras e produto.
        const linhas: {
          tipo: TipoItemComanda;
          servicoId?: string;
          produtoId?: string;
          preco: number;
          custo: number;
          extra: boolean;
          peso: number;
          desconto: number;
          percentual: number;
        }[] = [];
        const principal = servicoPorNome.get(sortearPeso(principais))!;
        linhas.push({
          tipo: 'servico',
          servicoId: principal.id,
          preco: preco(principal.id, unidade.id, data),
          custo: principal.custoProduto,
          extra: false,
          peso: principal.pesoAtendimento,
          desconto: chance(0.04) ? 500 : 0,
          percentual: regraServico.percentualBp,
        });
        let duracaoPrevista = principal.duracaoMin;
        if (status !== 'prevista' && chance(0.28)) {
          const extra = servicoPorNome.get(sortear(extras))!;
          duracaoPrevista += extra.duracaoMin;
          linhas.push({
            tipo: 'servico',
            servicoId: extra.id,
            preco: preco(extra.id, unidade.id, data),
            custo: extra.custoProduto,
            extra: true,
            peso: extra.pesoAtendimento,
            desconto: 0,
            percentual: regraServico.percentualBp,
          });
        }
        if (status === 'fechada' && chance(0.1)) {
          const produto = sortear(produtos);
          linhas.push({
            tipo: 'produto',
            produtoId: produto.id,
            preco: produto.precoVenda,
            custo: produto.custo,
            extra: false,
            peso: 0,
            desconto: 0,
            percentual: barbeiro.regraProduto,
          });
        }

        let totalBruto = 0;
        let desconto = 0;
        for (const linha of linhas) {
          const valor = valorItem({
            quantidade: 1,
            precoUnitario: linha.preco,
            desconto: linha.desconto,
          });
          totalBruto += linha.preco;
          desconto += linha.desconto;
          itens.push({
            comandaId,
            tipo: linha.tipo,
            servicoId: linha.servicoId ?? null,
            produtoId: linha.produtoId ?? null,
            profissionalId: barbeiro.id,
            quantidade: 1,
            precoUnitario: linha.preco,
            desconto: linha.desconto,
            custoUnitario: linha.custo,
            ehExtra: linha.extra,
            pesoAtendimento: linha.peso,
            comissaoPercentualBp: linha.percentual,
            comissaoValor: comissaoItem(valor, 1, { percentualBp: linha.percentual }),
            criadoEm: inicio,
          });
        }
        const totalLiquido = totalBruto - desconto;
        let fechadaEm = adicionarMinutos(fim, inteiro(1, 10));
        // Rotina realista para a ficha do profissional: às vezes começa atrasado, o tempo
        // real varia e 1 em 10 a recepção fecha sem o barbeiro confirmar.
        const atendeu = status !== 'prevista' && status !== 'cancelada';
        const iniciadaEm = atendeu
          ? adicionarMinutos(inicio, chance(0.15) ? inteiro(11, 25) : inteiro(0, 6))
          : null;
        const confirmou = status === 'fechada' && chance(0.9);
        const confirmadaEm =
          status === 'fechada'
            ? confirmou
              ? adicionarMinutos(iniciadaEm!, duracaoPrevista + inteiro(-6, 8))
              : fechadaEm
            : null;
        if (confirmadaEm && confirmadaEm > fechadaEm)
          fechadaEm = adicionarMinutos(confirmadaEm, inteiro(1, 5));

        comandas.push({
          id: comandaId,
          unidadeId: unidade.id,
          clienteId: cliente.id,
          profissionalId: barbeiro.id,
          agendamentoId,
          status,
          totalBruto,
          desconto,
          totalLiquido,
          iniciadaEm,
          confirmadaEm,
          confirmadaPorId: confirmou ? barbeiro.usuarioId : null,
          fechadaEm: status === 'fechada' ? fechadaEm : null,
          fechadaPorId: status === 'fechada' ? recepcaoDa[unidade.id]! : null,
          canceladaEm: status === 'cancelada' ? fim : null,
          motivoCancelamento: status === 'cancelada' ? 'Cliente não compareceu' : null,
          criadoEm: inicio,
        });

        if (status === 'fechada') {
          const forma = sortearPeso<FormaPagamento>([
            ['pix', 45],
            ['credito', 25],
            ['debito', 20],
            ['dinheiro', 10],
          ]);
          if (totalLiquido > 6000 && chance(0.1)) {
            const parte = Math.round(totalLiquido / 2);
            pagamentos.push({
              comandaId,
              forma: 'dinheiro',
              valor: parte,
              recebidoPorId: recepcaoDa[unidade.id]!,
              criadoEm: fechadaEm,
            });
            pagamentos.push({
              comandaId,
              forma,
              valor: totalLiquido - parte,
              recebidoPorId: recepcaoDa[unidade.id]!,
              criadoEm: fechadaEm,
            });
          } else {
            pagamentos.push({
              comandaId,
              forma,
              valor: totalLiquido,
              recebidoPorId: recepcaoDa[unidade.id]!,
              criadoEm: fechadaEm,
            });
          }
          const chave = `${unidade.id}|${data}`;
          const caixa = caixaPorDia.get(chave) ?? { unidadeId: unidade.id, data, total: 0 };
          caixa.total += totalLiquido;
          caixaPorDia.set(chave, caixa);
        }
      }
    }
  }

  await tx.agendamento.createMany({ data: agendamentos });
  await tx.comanda.createMany({ data: comandas });
  await tx.itemComanda.createMany({ data: itens });
  await tx.pagamento.createMany({ data: pagamentos });

  // Caixa: dias anteriores fechados; um dia com R$ 5,00 a menos na gaveta.
  const caixas = [...caixaPorDia.values()].filter((c) => c.data < hoje);
  const diaComDivergencia = caixas[Math.floor(caixas.length / 2)];
  await tx.caixaDia.createMany({
    data: [...caixaPorDia.values()].map((c) => {
      const aberto = c.data === hoje;
      const informado = c === diaComDivergencia ? c.total - 500 : c.total;
      return {
        unidadeId: c.unidadeId,
        data: dataParaBanco(c.data),
        valorAbertura: 20000,
        abertoPorId: recepcaoDa[c.unidadeId]!,
        abertoEm: instante(c.data, 8 * 60 + 45),
        fechadoPorId: aberto ? null : recepcaoDa[c.unidadeId]!,
        fechadoEm: aberto ? null : instante(c.data, 19 * 60 + 20),
        totalSistema: aberto ? null : c.total,
        totalInformado: aberto ? null : informado,
        divergencia: aberto ? null : informado - c.total,
      };
    }),
  });

  // Uma comanda fechada foi reaberta para corrigir a forma de pagamento (com auditoria).
  const corrigida = comandas.find(
    (c) => c.status === 'fechada' && c.fechadaEm! < instante(somarDias(hoje, -3), 0),
  );
  if (corrigida) {
    await tx.auditoria.createMany({
      data: [
        {
          usuarioId: gestor.id,
          entidade: 'comanda',
          entidadeId: corrigida.id!,
          acao: 'reabrir',
          antes: { status: 'fechada' },
          depois: { status: 'reaberta' },
          motivo: 'Pagamento lançado como débito, era crédito',
          criadoEm: adicionarMinutos(corrigida.fechadaEm as Date, 30),
        },
        {
          usuarioId: recepcaoDa[corrigida.unidadeId]!,
          entidade: 'comanda',
          entidadeId: corrigida.id!,
          acao: 'fechar',
          antes: { status: 'reaberta' },
          depois: { status: 'fechada' },
          criadoEm: adicionarMinutos(corrigida.fechadaEm as Date, 35),
        },
      ],
    });
  }

  // Despesas do mês atual e do anterior.
  const categorias = new Map((await tx.categoriaDespesa.findMany()).map((c) => [c.nome, c.id]));
  const meses = [primeiroDoMes(somarDias(primeiroDoMes(hoje), -1)), primeiroDoMes(hoje)];
  const despesas: Prisma.DespesaCreateManyInput[] = [];
  for (const competencia of meses) {
    const pago = competencia < primeiroDoMes(hoje);
    const lancar = (
      categoria: string,
      descricao: string,
      valor: number,
      unidadeId: string | null,
    ) =>
      despesas.push({
        categoriaId: categorias.get(categoria)!,
        unidadeId,
        descricao,
        valor,
        competencia: dataParaBanco(competencia),
        vencimento: dataParaBanco(somarDias(competencia, 9)),
        pago,
        pagoEm: pago ? instante(somarDias(competencia, 8), 10 * 60) : null,
      });
    lancar('Aluguel', 'Aluguel Centro', 650000, centro.id);
    lancar('Aluguel', 'Aluguel Jardins', 820000, jardins.id);
    lancar('Energia elétrica', 'Conta de luz', inteiro(68000, 82000), centro.id);
    lancar('Energia elétrica', 'Conta de luz', inteiro(52000, 61000), jardins.id);
    lancar('Água', 'Conta de água', inteiro(12000, 16000), centro.id);
    lancar('Internet e telefone', 'Internet fibra', 14990, centro.id);
    lancar('Internet e telefone', 'Internet fibra', 14990, jardins.id);
    lancar('Sistemas e assinaturas', 'Pente Fino Premium', 34980, null);
    lancar('Contador', 'Honorários contábeis', 90000, null);
    lancar('Produtos de uso', 'Lâminas, toalhas, pomadas de uso', inteiro(110000, 140000), null);
    lancar('Taxas da maquininha', 'Taxas de cartão', inteiro(85000, 105000), null);
    lancar('Marketing', 'Anúncios no Instagram', 40000, null);
    lancar('Retirada do dono', 'Pró-labore do dono', 800000, null);
    if (competencia === meses[0]) {
      lancar('Manutenção de equipamentos', 'Conserto de cadeira hidráulica', 45000, jardins.id);
      lancar('Equipamentos novos', 'Máquina de corte profissional', 129000, centro.id);
    }
  }
  await tx.despesa.createMany({ data: despesas });

  // Metas do mês: faturamento por unidade e quantidade de "Corte + Barba".
  await tx.meta.createMany({
    data: [
      {
        unidadeId: centro.id,
        mes: dataParaBanco(primeiroDoMes(hoje)),
        tipo: 'faturamento',
        objetivo: 3_500_000,
      },
      {
        unidadeId: jardins.id,
        mes: dataParaBanco(primeiroDoMes(hoje)),
        tipo: 'faturamento',
        objetivo: 2_300_000,
      },
      {
        unidadeId: centro.id,
        mes: dataParaBanco(primeiroDoMes(hoje)),
        tipo: 'servico',
        servicoId: servicoIds.get('Corte + Barba')!,
        objetivo: 170,
      },
    ],
  });

  // Comissões pagas: tudo que foi fechado antes do início do mês atual.
  const inicioDoMes = instante(primeiroDoMes(hoje), 0);
  const fechadasAntes = new Set(
    comandas
      .filter((c) => c.status === 'fechada' && (c.fechadaEm as Date) < inicioDoMes)
      .map((c) => c.id),
  );
  const comissaoPorBarbeiro = new Map<string, number>();
  for (const item of itens) {
    if (!fechadasAntes.has(item.comandaId)) continue;
    comissaoPorBarbeiro.set(
      item.profissionalId!,
      (comissaoPorBarbeiro.get(item.profissionalId!) ?? 0) + (item.comissaoValor ?? 0),
    );
  }
  await tx.pagamentoComissao.createMany({
    data: [...comissaoPorBarbeiro]
      .filter(([, valor]) => valor > 0)
      .map(([profissionalId, valor]) => ({
        profissionalId,
        periodoInicio: dataParaBanco(inicioHistorico),
        periodoFim: dataParaBanco(somarDias(primeiroDoMes(hoje), -1)),
        valor,
        pagoEm: instante(primeiroDoMes(hoje), 18 * 60),
        pagoPorId: dono.id,
      })),
  });

  // WhatsApp do Centro: a instância "teste" da Evolution API local.
  await tx.botConexao.create({
    data: { unidadeId: centro.id, instancia: 'teste', status: 'desconectado' },
  });

  // Conversas do bot no Centro: uma esperando atendente (tela Conversas) e uma com o bot.
  const conversas = [
    {
      cliente: clientes[1]!,
      atendente: true,
      falas: [
        ['entrada', 'oi'],
        ['saida', 'Olá! Aqui é a Barbearia Pente Fino (demonstração).'],
        ['entrada', 'quero falar com alguém sobre o pacote de noivo'],
        ['saida', 'Certo! Um atendente vai responder por aqui assim que possível.'],
      ],
    },
    {
      cliente: clientes[2]!,
      atendente: false,
      falas: [
        ['entrada', 'preço'],
        ['saida', 'Nossos preços:\n• Corte: R$ 45,00'],
      ],
    },
  ] as const;
  for (const [n, c] of conversas.entries()) {
    const fim = agora.getTime() - (n * 40 + 8) * 60_000;
    await tx.mensagem.createMany({
      data: c.falas.map(([direcao, texto], i) => ({
        unidadeId: centro.id,
        clienteId: c.cliente.id,
        telefone: c.cliente.telefone,
        direcao,
        texto,
        status: direcao === 'entrada' ? ('recebida' as const) : ('enviada' as const),
        criadoEm: new Date(fim - (c.falas.length - 1 - i) * 30_000),
      })),
    });
    await tx.botSessao.create({
      data: {
        unidadeId: centro.id,
        telefone: c.cliente.telefone,
        clienteId: c.cliente.id,
        sessao: {
          caminho: [],
          ultimaEm: new Date(fim).toISOString(),
          comAtendente: c.atendente,
          erros: 0,
        },
        atendenteDesde: c.atendente ? new Date(fim) : null,
      },
    });
  }

  // Avaliações depois do atendimento: as comandas fechadas mais recentes, quase todas boas,
  // algumas com comentário e duas notas baixas para a tela "para resolver".
  const COMENTARIOS = [
    'Corte ficou perfeito, como sempre.',
    'Atendimento top, ambiente muito bom.',
    'Gostei, mas atrasou uns 15 minutos.',
    'Barba impecável!',
    null,
    null,
    null,
  ];
  const avaliadas = await tx.comanda.findMany({
    where: { status: 'fechada', clienteId: { not: null } },
    orderBy: { fechadaEm: 'desc' },
    take: 60,
    include: { cliente: true },
  });
  const jaAvaliado = new Set<string>();
  let baixas = 0;
  for (const c of avaliadas) {
    if (!c.cliente?.telefone || jaAvaliado.has(c.cliente.id) || !c.fechadaEm) continue;
    jaAvaliado.add(c.cliente.id);
    const enviadaEm = new Date(c.fechadaEm.getTime() + 60 * 60_000);
    const respondeu = chance(0.7);
    const baixa = respondeu && baixas < 2 && chance(0.1);
    if (baixa) baixas += 1;
    const notaAtendimento = baixa
      ? 2
      : sortearPeso([
          [5, 6],
          [4, 3],
          [3, 1],
        ] as const);
    await tx.avaliacao.create({
      data: {
        unidadeId: c.unidadeId,
        comandaId: c.id,
        profissionalId: c.profissionalId,
        clienteId: c.cliente.id,
        telefone: c.cliente.telefone,
        status: respondeu ? 'respondida' : 'enviada',
        enviarEm: enviadaEm,
        enviadaEm,
        expiraEm: new Date(enviadaEm.getTime() + 48 * 3_600_000),
        ...(respondeu
          ? {
              notaAtendimento,
              notaBarbearia: baixa ? 3 : Math.max(3, notaAtendimento - (chance(0.3) ? 1 : 0)),
              comentario: baixa
                ? 'Esperei muito e o corte não ficou como pedi.'
                : sortear(COMENTARIOS),
              respondidaEm: new Date(enviadaEm.getTime() + 20 * 60_000),
            }
          : {}),
      },
    });
  }

  // Todos os usuários da demonstração entram com a mesma senha (argon2id).
  await tx.usuario.updateMany({ data: { senhaHash: await hash(SENHA_DEMO) } });

  await tx.notaCliente.createMany({
    data: [
      {
        clienteId: clientes[0]!.id,
        profissionalId: barbeiros[0]!.id,
        texto: 'Prefere degradê baixo, máquina 1 nas laterais.',
      },
      {
        clienteId: clientes[1]!.id,
        profissionalId: barbeiros[3]!.id,
        texto: 'Pele sensível: usar navalha só no acabamento.',
      },
    ],
  });

  const fechadas = comandas.filter((c) => c.status === 'fechada');
  return {
    unidades: 2,
    barbeiros: barbeiros.length,
    clientes: clientes.length,
    agendamentos: agendamentos.length,
    comandas: comandas.length,
    'comandas fechadas': fechadas.length,
    'faltas (canceladas)': comandas.filter((c) => c.status === 'cancelada').length,
    'em aberto hoje': comandas.filter(
      (c) => c.status === 'prevista' || c.status === 'em_atendimento',
    ).length,
    'itens de comanda': itens.length,
    'faturamento (R$)': (
      fechadas.reduce((s, c) => s + (c.totalLiquido ?? 0), 0) / 100
    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    despesas: despesas.length,
  };
}

await main();

import { describe, expect, it } from 'vitest';
import {
  analisarClientes,
  analisarRotina,
  calcularOcupacao,
  desempenhoPorServico,
  diasEntreDatas,
  duracaoReal,
  linkWhatsapp,
  mensagemRetorno,
  mesesAte,
  produtosVendidos,
  type ItemDesempenho,
} from './desempenho.js';

const hora = (h: string) => new Date(`2026-11-03T${h}:00-03:00`);

describe('analisarClientes', () => {
  const periodo = { de: '2026-11-01', ate: '2026-11-30', hoje: '2026-11-20' };

  it('separa novo, voltou no prazo e voltou depois da janela de 45 dias', () => {
    const r = analisarClientes(
      [
        { clienteId: 'novo', data: '2026-11-05' },
        { clienteId: 'fiel', data: '2026-10-10' },
        { clienteId: 'fiel', data: '2026-11-08' },
        { clienteId: 'fiel', data: '2026-11-08' }, // duas comandas no dia = uma visita
        { clienteId: 'tardio', data: '2026-08-01' },
        { clienteId: 'tardio', data: '2026-11-10' },
        { clienteId: 'fora', data: '2026-10-25' },
      ],
      periodo,
    );
    expect(r.resumo).toEqual({
      atendidos: 3,
      novos: 1,
      voltaramNoPrazo: 1,
      voltaramDepois: 1,
      taxaRetorno: 1 / 3,
      intervaloMedioDias: Math.round((29 + 101) / 2),
    });
    const fiel = r.clientes.find((c) => c.clienteId === 'fiel')!;
    expect(fiel).toMatchObject({ visitas: 2, visitasNoPeriodo: 1, situacao: 'voltou_no_prazo' });
    expect(r.clientes.map((c) => c.clienteId)).not.toContain('fora');
  });

  it('a janela de retorno é configurável', () => {
    const visitas = [
      { clienteId: 'a', data: '2026-10-01' },
      { clienteId: 'a', data: '2026-11-15' },
    ];
    expect(analisarClientes(visitas, periodo, 30).resumo.voltaramDepois).toBe(1);
    expect(analisarClientes(visitas, periodo, 45).resumo.voltaramNoPrazo).toBe(1);
  });

  it('sumido: passou de 1,5× o intervalo habitual, ou da janela com uma visita só', () => {
    const r = analisarClientes(
      [
        // vem a cada 20 dias; última há 31 → passou de 30
        { clienteId: 'quinzenal', data: '2026-09-10' },
        { clienteId: 'quinzenal', data: '2026-09-30' },
        { clienteId: 'quinzenal', data: '2026-10-20' },
        // uma visita há 40 dias: ainda dentro dos 45
        { clienteId: 'uma', data: '2026-10-11' },
        // uma visita há 50 dias
        { clienteId: 'antiga', data: '2026-10-01' },
        // há mais de um ano: perdido, fora da lista
        { clienteId: 'perdido', data: '2025-10-01' },
      ],
      periodo,
    );
    expect(r.sumidos.map((s) => s.clienteId)).toEqual(['quinzenal', 'antiga']);
    expect(r.sumidos[0]).toMatchObject({ diasSemVir: 31, limiteDias: 30, visitas: 3 });
  });

  it('visita futura (período passado) não conta para o período nem para quem sumiu', () => {
    const r = analisarClientes(
      [
        { clienteId: 'a', data: '2026-09-05' },
        { clienteId: 'a', data: '2026-11-18' },
      ],
      { de: '2026-09-01', ate: '2026-09-30', hoje: '2026-11-20' },
    );
    expect(r.clientes[0]).toMatchObject({ visitas: 1, situacao: 'novo' });
    expect(r.sumidos).toEqual([]);
  });

  it('sem visitas, tudo zerado', () => {
    expect(analisarClientes([], periodo).resumo).toMatchObject({
      atendidos: 0,
      taxaRetorno: 0,
      intervaloMedioDias: null,
    });
  });
});

describe('analisarRotina', () => {
  it('confirmação no prazo (fim + 15 min), atrasos acima de 10 min', () => {
    const r = analisarRotina([
      // começou na hora, confirmou 5 min depois do fim
      {
        inicioAgendado: hora('09:00'),
        fimAgendado: hora('09:30'),
        iniciadaEm: hora('09:02'),
        confirmadaEm: hora('09:35'),
        confirmadaPeloProfissional: true,
      },
      // atrasou 20 min, confirmou 40 min depois do fim
      {
        inicioAgendado: hora('10:00'),
        fimAgendado: hora('10:30'),
        iniciadaEm: hora('10:20'),
        confirmadaEm: hora('11:10'),
        confirmadaPeloProfissional: true,
      },
      // recepção fechou sem confirmação
      {
        inicioAgendado: hora('11:00'),
        fimAgendado: hora('11:30'),
        iniciadaEm: null,
        confirmadaEm: null,
        confirmadaPeloProfissional: false,
      },
      // chegou sem agendamento e foi confirmada
      {
        inicioAgendado: null,
        fimAgendado: null,
        iniciadaEm: hora('14:00'),
        confirmadaEm: hora('14:30'),
        confirmadaPeloProfissional: true,
      },
    ]);
    expect(r).toEqual({
      comandas: 4,
      confirmadasPeloBarbeiro: 3,
      percentualConfirmadas: 0.75,
      confirmadasNoPrazo: 2,
      percentualNoPrazo: 0.5,
      minutosAteConfirmar: Math.round((5 + 40) / 2),
      atrasos: 1,
      atrasoMedioMin: 20,
    });
  });

  it('confirmação feita por outra pessoa não conta para o barbeiro', () => {
    const r = analisarRotina([
      {
        inicioAgendado: hora('09:00'),
        fimAgendado: hora('09:30'),
        iniciadaEm: hora('09:00'),
        confirmadaEm: hora('09:40'),
        confirmadaPeloProfissional: false,
      },
    ]);
    expect(r).toMatchObject({
      confirmadasPeloBarbeiro: 0,
      confirmadasNoPrazo: 0,
      minutosAteConfirmar: null,
    });
  });

  it('confirmar antes do fim conta como 0 minuto', () => {
    const r = analisarRotina([
      {
        inicioAgendado: hora('09:00'),
        fimAgendado: hora('09:30'),
        iniciadaEm: hora('09:00'),
        confirmadaEm: hora('09:20'),
        confirmadaPeloProfissional: true,
      },
    ]);
    expect(r.minutosAteConfirmar).toBe(0);
    expect(r.atrasoMedioMin).toBeNull();
  });

  it('sem comandas não divide por zero', () => {
    expect(analisarRotina([])).toMatchObject({ percentualConfirmadas: 0, percentualNoPrazo: 0 });
  });
});

describe('duracaoReal', () => {
  it('mede de começar a confirmar e descarta o que é esquecimento', () => {
    expect(duracaoReal({ iniciadaEm: hora('09:00'), confirmadaEm: hora('09:38') })).toBe(38);
    expect(duracaoReal({ iniciadaEm: hora('09:00'), confirmadaEm: hora('09:01') })).toBeNull();
    expect(duracaoReal({ iniciadaEm: hora('09:00'), confirmadaEm: hora('18:00') })).toBeNull();
    expect(duracaoReal({ iniciadaEm: null, confirmadaEm: hora('09:30') })).toBeNull();
  });
});

const item = (p: Partial<ItemDesempenho>): ItemDesempenho => ({
  tipo: 'servico',
  servicoId: 'corte',
  quantidade: 1,
  precoUnitario: 4500,
  desconto: 0,
  ehExtra: false,
  pesoAtendimento: 1,
  custoUnitario: 200,
  comissaoValor: 2025,
  ...p,
});

describe('desempenhoPorServico', () => {
  it('soma por serviço, lucro e tempo real só de comanda com um serviço', () => {
    const r = desempenhoPorServico([
      { itens: [item({})], duracaoRealMin: 30 },
      { itens: [item({ desconto: 500 })], duracaoRealMin: 40 },
      {
        itens: [
          item({}),
          item({
            servicoId: 'barba',
            precoUnitario: 3000,
            ehExtra: true,
            custoUnitario: 0,
            comissaoValor: 1350,
          }),
        ],
        duracaoRealMin: 70,
      },
      {
        itens: [item({ tipo: 'produto', servicoId: null, produtoId: 'pomada' })],
        duracaoRealMin: null,
      },
    ]);
    expect(r).toEqual([
      {
        servicoId: 'corte',
        quantidade: 3,
        comoExtra: 0,
        receita: 13000,
        comissao: 6075,
        custo: 600,
        lucro: 13000 - 600 - 6075,
        tempoRealMedioMin: 35,
        medicoes: 2,
      },
      {
        servicoId: 'barba',
        quantidade: 1,
        comoExtra: 1,
        receita: 3000,
        comissao: 1350,
        custo: 0,
        lucro: 1650,
        tempoRealMedioMin: null,
        medicoes: 0,
      },
    ]);
  });

  it('produtos vendidos por quantidade', () => {
    const p = (id: string, q: number) =>
      item({ tipo: 'produto', servicoId: null, produtoId: id, quantidade: q, precoUnitario: 3500 });
    expect(
      produtosVendidos([
        { itens: [p('pomada', 1), p('shampoo', 2)], duracaoRealMin: null },
        { itens: [p('pomada', 2), item({})], duracaoRealMin: null },
      ]),
    ).toEqual([
      { produtoId: 'pomada', quantidade: 3, receita: 10500 },
      { produtoId: 'shampoo', quantidade: 2, receita: 7000 },
    ]);
  });
});

describe('calcularOcupacao', () => {
  // 2026-11-03 é terça (2). Expediente 09:00–12:00 e 13:00–19:00 = 540 min.
  const turnos = [
    { diaSemana: 2, inicioMin: 540, fimMin: 720 },
    { diaSemana: 2, inicioMin: 780, fimMin: 1140 },
  ];
  it('agendado ÷ expediente menos bloqueios', () => {
    const r = calcularOcupacao({
      dias: ['2026-11-03', '2026-11-04'], // quarta sem turno
      turnos,
      bloqueios: [{ inicio: hora('17:00'), fim: hora('19:00') }],
      agendados: [
        { inicio: hora('09:00'), fim: hora('10:00') },
        { inicio: hora('09:30'), fim: hora('10:30') }, // cruza: conta uma vez
        { inicio: hora('11:30'), fim: hora('13:30') }, // metade cai no almoço
      ],
    });
    expect(r).toEqual({ disponivelMin: 420, agendadoMin: 90 + 30 + 30, fracao: 150 / 420 });
  });

  it('sem expediente, ocupação zero', () => {
    expect(calcularOcupacao({ dias: [], turnos, bloqueios: [], agendados: [] }).fracao).toBe(0);
  });
});

describe('datas', () => {
  it('diasEntreDatas e mesesAte', () => {
    expect(diasEntreDatas('2026-10-31', '2026-11-30')).toBe(30);
    expect(mesesAte('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('chamar o cliente de volta', () => {
  it('linkWhatsapp aceita telefone com ou sem 55 e recusa inválido', () => {
    expect(linkWhatsapp('11988887777', 'Oi')).toBe('https://wa.me/5511988887777?text=Oi');
    expect(linkWhatsapp('5511988887777', 'a b')).toBe('https://wa.me/5511988887777?text=a%20b');
    expect(linkWhatsapp('123', 'Oi')).toBeNull();
    expect(linkWhatsapp(null, 'Oi')).toBeNull();
  });

  it('mensagemRetorno usa o primeiro nome e o link quando existe', () => {
    expect(
      mensagemRetorno({
        cliente: 'João Pedro Silva',
        barbeiro: 'Rafael Moura',
        unidade: 'Barbearia Centro',
        linkAgendamento: 'https://app/agendar?u=centro',
      }),
    ).toBe(
      'Oi, João! Tudo bem? Aqui é da Barbearia Centro. Faz um tempinho que você não aparece e o Rafael lembrou de você. Se quiser, é só escolher o horário por aqui: https://app/agendar?u=centro',
    );
    expect(
      mensagemRetorno({
        cliente: 'Ana',
        barbeiro: 'Rafael',
        unidade: 'Centro',
        linkAgendamento: null,
      }),
    ).toMatch(/Quer que eu veja um horário para você\?$/);
  });
});

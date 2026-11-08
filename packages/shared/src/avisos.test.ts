import { describe, expect, it } from 'vitest';
import {
  avisoCaixaDivergente,
  avisoCaixaSemFechar,
  avisoComandasPendentes,
  avisoResumoDoDia,
  destinatariosDoAviso,
  emailResumoDoDia,
  fimDoDiaDaUnidade,
  lerPreferenciasAvisos,
  linhasDoResumo,
  tiposDoPapel,
  vaiParaOCelular,
} from './avisos.js';

describe('central de avisos', () => {
  it('pendentes vão para a recepção; sem recepção, gestor; sem gestor, dono', () => {
    const dono = { usuarioId: 'd', papeis: ['dono'] as const };
    const gestor = { usuarioId: 'g', papeis: ['gestor'] as const };
    const recepcao = { usuarioId: 'r', papeis: ['recepcao'] as const };
    const barbeiro = { usuarioId: 'b', papeis: ['barbeiro'] as const };
    expect(destinatariosDoAviso('comandas_pendentes', [dono, gestor, recepcao, barbeiro])).toEqual([
      'r',
    ]);
    expect(destinatariosDoAviso('comandas_pendentes', [dono, gestor, barbeiro])).toEqual(['g']);
    expect(destinatariosDoAviso('comandas_pendentes', [dono, barbeiro])).toEqual(['d']);
    expect(destinatariosDoAviso('comandas_pendentes', [barbeiro])).toEqual([]);
    expect(destinatariosDoAviso('caixa_divergente', [dono, gestor, recepcao])).toEqual(['d', 'g']);
  });

  it('texto das comandas pendentes, só com as novas', () => {
    expect(avisoComandasPendentes({ unidadeId: 'u', novas: [], total: 3 })).toBeNull();
    const a = avisoComandasPendentes({
      unidadeId: 'u',
      novas: [
        {
          comandaId: 'c2',
          cliente: 'João Silva',
          profissional: 'Rafael Moura',
          fim: '2026-12-01T17:30:00.000Z',
        },
        { comandaId: 'c1', cliente: null, profissional: 'Thiago', fim: '2026-12-01T17:00:00.000Z' },
      ],
      total: 3,
    })!;
    expect(a).toEqual({
      tipo: 'comandas_pendentes',
      titulo: '2 comandas esperando confirmação',
      texto:
        'João (Rafael, até 14:30) e mais 1. 3 comandas pendentes para resolver com o barbeiro.',
      link: '/comandas',
      chave: 'pendentes:u:c1,c2',
    });
  });

  it('caixa com diferença', () => {
    const base = {
      caixaId: 'x',
      unidade: 'Centro',
      dia: '2026-12-01',
      totalSistema: 120000,
      fechadoPor: 'Juliana Castro',
    };
    expect(avisoCaixaDivergente({ ...base, totalInformado: 120000 })).toBeNull();
    const a = avisoCaixaDivergente({ ...base, totalInformado: 115000 })!;
    expect(a.titulo).toBe('Caixa de 01/12 fechado com diferença');
    expect(a.texto).toMatch(
      /^Centro: sistema R\$\s1\.200,00, contado R\$\s1\.150,00 \(faltam R\$\s50,00\)\. Fechado por Juliana\.$/,
    );
    expect(a.link).toBe('/caixa?dia=2026-12-01');
  });
});

describe('fim do dia', () => {
  const resumo = {
    unidade: 'Centro',
    faturamento: 120000,
    clientes: 25,
    faltas: 2,
    notasBaixas: 0,
    abertas: 1,
    mes: { faturamento: 3000000, projecao: 5200000 },
  };

  it('o dia acaba meia hora depois do último turno', () => {
    expect(fimDoDiaDaUnidade([])).toBeNull();
    expect(fimDoDiaDaUnidade([{ fimMin: 12 * 60 }, { fimMin: 19 * 60 }])).toBe(19 * 60 + 30);
    expect(fimDoDiaDaUnidade([{ fimMin: 23 * 60 + 50 }])).toBe(24 * 60 - 1);
  });

  it('resumo com o ritmo do mês, uma vez por unidade e dia', () => {
    const a = avisoResumoDoDia({ unidadeId: 'u', dia: '2026-12-01', resumo });
    expect(a.titulo).toBe('Resumo de 01/12 · Centro');
    expect(a.chave).toBe('resumo:u:2026-12-01');
    expect(linhasDoResumo(resumo).map((l) => l.replace(/\s/g, ' '))).toEqual([
      'Hoje: R$ 1.200,00 em 25 clientes · ticket R$ 48,00.',
      'Mês: R$ 30.000,00 até hoje, projeção de R$ 52.000,00.',
      '2 faltas.',
      '1 comanda esperando fechamento.',
    ]);
    const e = emailResumoDoDia({
      nome: 'Carlos Mendes',
      dia: '2026-12-01',
      resumo,
      link: 'https://app/inicio',
    });
    expect(e.assunto).toBe('Resumo de 01/12 · Centro');
    expect(e.texto).toMatch(/^Oi, Carlos\.\n\nHoje:/);
    expect(e.texto).toContain('Perfil → Avisos');
  });

  it('caixa aberto no fim do dia só se recebeu algo', () => {
    expect(
      avisoCaixaSemFechar({ unidadeId: 'u', unidade: 'Centro', dia: '2026-12-01', recebido: 0 }),
    ).toBeNull();
    expect(
      avisoCaixaSemFechar({ unidadeId: 'u', unidade: 'Centro', dia: '2026-12-01', recebido: 5000 })
        ?.link,
    ).toBe('/caixa?dia=2026-12-01');
  });
});

describe('preferências de avisos', () => {
  it('padrão: tudo no celular, resumo sem e-mail; lixo vira padrão', () => {
    const p = lerPreferenciasAvisos({});
    expect(p).toEqual({ celular: {}, resumoPorEmail: false, agendaNoCelular: true });
    expect(vaiParaOCelular(p, 'comandas_pendentes')).toBe(true);
    expect(lerPreferenciasAvisos({ celular: 'x' })).toEqual({
      celular: {},
      resumoPorEmail: false,
      agendaNoCelular: true,
    });
    const desligado = lerPreferenciasAvisos({
      celular: { resumo_dia: false },
      resumoPorEmail: true,
    });
    expect(vaiParaOCelular(desligado, 'resumo_dia')).toBe(false);
    expect(desligado.resumoPorEmail).toBe(true);
  });

  it('cada papel vê só os seus tipos', () => {
    expect(tiposDoPapel(['recepcao'])).toEqual(['comandas_pendentes']);
    expect(tiposDoPapel(['barbeiro'])).toEqual([]);
    expect(tiposDoPapel(['gestor'])).toEqual([
      'comandas_pendentes',
      'caixa_divergente',
      'caixa_sem_fechar',
      'resumo_dia',
      'clube_online',
      'whatsapp_caiu',
    ]);
  });
});

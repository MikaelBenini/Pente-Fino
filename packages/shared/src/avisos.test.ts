import { describe, expect, it } from 'vitest';
import { avisoCaixaDivergente, avisoComandasPendentes, destinatariosDoAviso } from './avisos.js';

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

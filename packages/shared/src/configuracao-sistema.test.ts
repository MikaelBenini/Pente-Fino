import { describe, expect, it } from 'vitest';
import { avisoGeralSchema, avisoVigente, lerConfiguracaoPublica } from './configuracao-sistema.js';
import { DIAS_TESTE, VERSAO_TERMOS } from './planos.js';

describe('configurações do sistema', () => {
  const aviso = {
    texto: 'Manutenção programada no domingo às 23 h.',
    tom: 'manutencao' as const,
    inicio: '2026-11-10T00:00:00-03:00',
    fim: '2026-11-17T00:00:00-03:00',
  };

  it('sem nada configurado: padrões do sistema', () => {
    expect(lerConfiguracaoPublica(null)).toEqual({
      avisoGeral: null,
      teste: { dias: DIAS_TESTE, versaoTermos: VERSAO_TERMOS },
    });
    expect(lerConfiguracaoPublica({ teste: { dias: 999 } }).teste.dias).toBe(DIAS_TESTE);
  });

  it('aviso geral: só entre o início e o fim; fim antes do início é recusado', () => {
    const c = lerConfiguracaoPublica({ aviso_geral: aviso, teste: { dias: 7 } });
    expect(c.teste).toEqual({ dias: 7, versaoTermos: VERSAO_TERMOS });
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-09T12:00:00Z'))).toBeNull();
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-12T12:00:00Z'))?.tom).toBe('manutencao');
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-17T03:00:00Z'))).toBeNull();
    expect(avisoGeralSchema.safeParse({ ...aviso, fim: aviso.inicio }).success).toBe(false);
  });
});

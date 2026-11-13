import { describe, expect, it } from 'vitest';
import { faixaDaSaude, saudeDaConta, type DadosSaudeConta } from './saude-conta.js';

const agora = new Date('2026-11-20T15:00:00Z');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
const saudavel: DadosSaudeConta = {
  status: 'ativa',
  ultimoAcessoEm: diasAtras(1),
  fechadas7Dias: 25,
  whatsappConectado: true,
  ativacao: 8,
  totalPassos: 8,
  cobrancaVencida: false,
};

describe('saudeDaConta (admin F4)', () => {
  it('conta que usa tudo e paga em dia: 100, sem motivos', () => {
    expect(saudeDaConta(saudavel, agora)).toEqual({ nota: 100, motivos: [] });
  });

  it('cada parte tira o seu peso, e os motivos vêm do que mais tirou', () => {
    const r = saudeDaConta(
      {
        ...saudavel,
        ultimoAcessoEm: diasAtras(5), // metade de 30: -15
        fechadas7Dias: 3, // um terço de 30: -20
        ativacao: 4, // metade de 15: -7,5
        whatsappConectado: false, // -10
      },
      agora,
    );
    expect(r?.nota).toBe(48); // 100 - 52,5, arredondado
    expect(r?.motivos).toEqual([
      'Só 3 comandas fechadas na semana',
      'Sem acesso há 5 dias',
      'WhatsApp desconectado',
      'Configurou 4 de 8 primeiros passos',
    ]);
  });

  it('nunca entrou, nada fechado e cobrança vencida: nota baixa', () => {
    const r = saudeDaConta(
      {
        ...saudavel,
        ultimoAcessoEm: null,
        fechadas7Dias: 0,
        ativacao: 0,
        cobrancaVencida: true,
        whatsappConectado: false,
      },
      agora,
    );
    expect(r?.nota).toBe(0);
    expect(r?.motivos[0]).toBe('Ninguém entrou ainda');
  });

  it('cancelada não tem nota', () => {
    expect(saudeDaConta({ ...saudavel, status: 'cancelada' }, agora)).toBeNull();
  });

  it('faixas: boa, atenção e risco', () => {
    expect([faixaDaSaude(70), faixaDaSaude(69), faixaDaSaude(40), faixaDaSaude(39)]).toEqual([
      'boa',
      'atencao',
      'atencao',
      'risco',
    ]);
  });
});

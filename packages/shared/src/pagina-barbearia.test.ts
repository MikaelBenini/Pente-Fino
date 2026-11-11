import { describe, expect, it } from 'vitest';
import { formatarMoeda } from './formatacao.js';
import {
  arquivoCalendario,
  jsonLdDaBarbearia,
  metadadosDaPagina,
  precoInicial,
} from './pagina-barbearia.js';

const servico = (nome: string, preco: number | null, ehExtra = false) => ({
  id: nome,
  nome,
  duracaoMin: 30,
  ehExtra,
  preco,
});
const unidade = {
  nome: 'Centro',
  barbearia: 'Barbearia Navalha',
  endereco: 'Rua A, 10 - Centro, Campinas/SP',
  telefone: '5519999998888',
  servicos: [servico('Corte', 4500), servico('Barba', 3500), servico('Sobrancelha', 1500, true)],
};

describe('página da barbearia (painel P1, P4 e P6)', () => {
  it('prévia: "Agende na {Barbearia} · {Unidade}", os serviços e o preço inicial', () => {
    expect(metadadosDaPagina(unidade)).toEqual({
      titulo: 'Agende na Barbearia Navalha · Centro',
      descricao: `Corte, Barba · a partir de ${formatarMoeda(3500)}. Escolha o serviço, o barbeiro e o horário online.`,
    });
    // Unidade com o mesmo nome da barbearia: sem repetir.
    expect(metadadosDaPagina({ ...unidade, nome: 'barbearia navalha' }).titulo).toBe(
      'Agende na Barbearia Navalha',
    );
    expect(metadadosDaPagina({ ...unidade, servicos: [] }).descricao).toBe(
      'Escolha o serviço, o barbeiro e o horário online.',
    );
  });

  it('preço inicial: o menor dos principais (extra mais barato não conta)', () => {
    expect(precoInicial(unidade)).toBe(3500);
    expect(precoInicial({ servicos: [servico('Sobrancelha', 1500, true)] })).toBe(1500);
    expect(precoInicial({ servicos: [servico('Corte', null)] })).toBeNull();
  });

  it('Google: HairSalon com endereço, telefone, preço e a ação de agendar', () => {
    expect(jsonLdDaBarbearia(unidade, 'https://x/b/navalha-centro')).toMatchObject({
      '@type': 'HairSalon',
      name: 'Barbearia Navalha · Centro',
      url: 'https://x/b/navalha-centro',
      address: 'Rua A, 10 - Centro, Campinas/SP',
      telephone: '+5519999998888',
      potentialAction: { '@type': 'ReserveAction', target: 'https://x/b/navalha-centro' },
    });
    expect(
      jsonLdDaBarbearia({ ...unidade, endereco: null, telefone: null }, 'u'),
    ).not.toHaveProperty('address');
  });

  it('calendário: horário em UTC, fim pela duração, lembrete 1 h antes e texto escapado', () => {
    const t = arquivoCalendario({
      id: 'ag-1',
      inicio: '2026-11-12T10:00:00-03:00',
      duracaoMin: 60,
      titulo: 'Corte, Barba; Navalha',
      local: 'Rua A, 10',
      descricao: 'Com Rafael\nVer ou remarcar: https://x/horario?t=abc',
      agora: new Date('2026-11-11T12:00:00Z'),
    });
    expect(t).toContain('DTSTART:20261112T130000Z');
    expect(t).toContain('DTEND:20261112T140000Z');
    expect(t).toContain('SUMMARY:Corte\\, Barba\\; Navalha');
    expect(t).toContain('LOCATION:Rua A\\, 10');
    expect(t).toContain('DESCRIPTION:Com Rafael\\nVer ou remarcar: https://x/horario?t=abc');
    expect(t).toContain('TRIGGER:-PT1H');
    expect(t.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});

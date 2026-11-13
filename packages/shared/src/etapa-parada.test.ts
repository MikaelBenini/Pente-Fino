import { describe, expect, it } from 'vitest';
import { decidirEtapaParada, emailDoPasso } from './etapa-parada.js';

const agora = new Date('2026-11-20T15:00:00Z');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
const base = {
  etapa: 'servicos' as const,
  guardada: { etapa: 'servicos', desde: diasAtras(4), avisadoEm: null },
  status: 'teste' as const,
  interna: false,
  plano: 'basico' as const,
  agora,
};

describe('decidirEtapaParada (admin F1d)', () => {
  it('parada há 3 dias ou mais, sem aviso: avisa com o passo do tutorial', () => {
    expect(decidirEtapaParada(base)).toEqual({ acao: 'avisar', passo: 'servicos' });
    expect(
      decidirEtapaParada({
        ...base,
        etapa: 'barbeiros',
        guardada: { ...base.guardada, etapa: 'barbeiros' },
      }),
    ).toEqual({ acao: 'avisar', passo: 'equipe' });
  });

  it('primeira vez ou etapa nova: só guarda (o relógio dos 3 dias começa agora)', () => {
    expect(decidirEtapaParada({ ...base, guardada: null })).toEqual({
      acao: 'guardar',
      etapa: 'servicos',
    });
    expect(decidirEtapaParada({ ...base, etapa: 'agendamento' })).toEqual({
      acao: 'guardar',
      etapa: 'agendamento',
    });
  });

  it('menos de 3 dias, já avisada, ou concluída: nada', () => {
    expect(
      decidirEtapaParada({ ...base, guardada: { ...base.guardada, desde: diasAtras(2) } }),
    ).toEqual({ acao: 'nada' });
    expect(
      decidirEtapaParada({ ...base, guardada: { ...base.guardada, avisadoEm: diasAtras(1) } }),
    ).toEqual({ acao: 'nada' });
    expect(decidirEtapaParada({ ...base, etapa: null })).toEqual({ acao: 'nada' });
  });

  it('conta interna, suspensa ou cancelada: nada', () => {
    expect(decidirEtapaParada({ ...base, interna: true })).toEqual({ acao: 'nada' });
    expect(decidirEtapaParada({ ...base, status: 'suspensa' })).toEqual({ acao: 'nada' });
    expect(decidirEtapaParada({ ...base, status: 'cancelada' })).toEqual({ acao: 'nada' });
  });

  it('pagamento não gera este e-mail; WhatsApp só em plano com o bot', () => {
    const em = (etapa: 'pagamento' | 'whatsapp', plano: 'basico' | 'pro') =>
      decidirEtapaParada({ ...base, etapa, plano, guardada: { ...base.guardada, etapa } });
    expect(em('pagamento', 'pro')).toEqual({ acao: 'nada' });
    expect(em('whatsapp', 'basico')).toEqual({ acao: 'nada' });
    expect(em('whatsapp', 'pro')).toEqual({ acao: 'avisar', passo: 'whatsapp' });
  });
});

describe('emailDoPasso', () => {
  it('título, porquê e link da tela do passo', () => {
    expect(emailDoPasso('servicos', 'https://app.x')).toEqual({
      passo: 'Cadastrar os serviços com preço',
      porque: 'Sem preço não tem agenda nem lucro.',
      link: 'https://app.x/servicos',
    });
  });
});

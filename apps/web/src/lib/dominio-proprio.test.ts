import { describe, expect, it } from 'vitest';
import { ehHostDoPenteFino, rotaNoDominio } from './dominio-proprio';

const mapa = { siteSlug: 'navalha', slugAgendamento: 'navalha-agenda' };

describe('domínio próprio (lote 7e)', () => {
  it('reconhece o endereço do Pente Fino e o desenvolvimento', () => {
    const app = 'https://seupentefino.com.br';
    expect(ehHostDoPenteFino('seupentefino.com.br', app)).toBe(true);
    expect(ehHostDoPenteFino('api.seupentefino.com.br', app)).toBe(true);
    expect(ehHostDoPenteFino('localhost:3100', app)).toBe(true);
    expect(ehHostDoPenteFino('x-3000.app.github.dev', app)).toBe(true);
    expect(ehHostDoPenteFino('barbeariadocarlos.com.br', app)).toBe(false);
    expect(ehHostDoPenteFino('seupentefino.com.br.golpe.com', app)).toBe(false);
  });

  it('a raiz e as páginas viram o site; /agendar, o agendamento', () => {
    expect(rotaNoDominio('/', mapa)).toEqual({ tipo: 'reescrever', caminho: '/s/navalha' });
    expect(rotaNoDominio('/servicos/', mapa)).toEqual({
      tipo: 'reescrever',
      caminho: '/s/navalha/servicos',
    });
    expect(rotaNoDominio('/agendar', mapa)).toEqual({
      tipo: 'reescrever',
      caminho: '/b/navalha-agenda',
    });
  });

  it('arquivos, fotos, ponte da API e horário passam; o resto vai ao Pente Fino', () => {
    for (const p of ['/_next/static/x.js', '/f/a-640.webp', '/api/publico/x', '/horario', '/b/x'])
      expect(rotaNoDominio(p, mapa)).toEqual({ tipo: 'passar' });
    expect(rotaNoDominio('/entrar', mapa)).toEqual({ tipo: 'levar', caminho: '/entrar' });
    expect(rotaNoDominio('/inicio', mapa)).toEqual({ tipo: 'levar', caminho: '/inicio' });
  });
});

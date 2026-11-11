import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ehRotaDoApp, ROTAS_DO_APP } from './rotas';

describe('telas do sistema protegidas pelo login', () => {
  it('a lista bate com as pastas de app/(app)', () => {
    const pasta = fileURLToPath(new URL('../app/(app)', import.meta.url));
    const telas = readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect([...ROTAS_DO_APP].sort()).toEqual(telas);
  });

  it('subtelas contam; endereço parecido ou do site, não', () => {
    expect(ehRotaDoApp('/equipe/ficha')).toBe(true);
    expect(ehRotaDoApp('/app')).toBe(true);
    expect(ehRotaDoApp('/agendar')).toBe(false);
    expect(ehRotaDoApp('/blog')).toBe(false);
    expect(ehRotaDoApp('/pagina-que-nao-existe')).toBe(false);
  });
});

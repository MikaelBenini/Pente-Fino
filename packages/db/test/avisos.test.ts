import { describe, expect, it, vi } from 'vitest';
import { silenciarAvisoDoPgNoPrisma } from '../src/avisos.js';

describe('silenciarAvisoDoPgNoPrisma', () => {
  it('cala só o aviso do pg sobre consultas simultâneas', () => {
    const avisos: string[] = [];
    const ouvir = (w: Error) => avisos.push(w.message);
    process.on('warning', ouvir);
    silenciarAvisoDoPgNoPrisma();
    process.emitWarning(
      'Calling client.query() when the client is already executing a query is deprecated',
      'DeprecationWarning',
    );
    process.emitWarning('Outro aviso qualquer', 'Warning');
    return vi.waitFor(() => {
      expect(avisos).toEqual(['Outro aviso qualquer']);
      process.off('warning', ouvir);
    });
  });
});

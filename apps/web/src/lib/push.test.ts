import { describe, expect, it } from 'vitest';
import { chaveDoServidor, ErroPush, motivoDoErroPush } from './push';

// Pedido do dono em 20/11/2026: "ativar notificação não faz nada". Cada erro do navegador vira um
// passo claro, em vez de "Não foi possível ligar".
describe('motivo do erro ao ligar as notificações', () => {
  it('serviço de push indisponível (Brave, aba anônima) explica o que ligar', () => {
    const e = new DOMException('Registration failed - push service not available', 'AbortError');
    expect(motivoDoErroPush(e)).toMatch(/Brave/);
  });
  it('permissão negada manda liberar no cadeado', () => {
    expect(motivoDoErroPush(new DOMException('x', 'NotAllowedError'))).toMatch(/cadeado/);
  });
  it('erro conhecido passa como está; desconhecido mostra o detalhe', () => {
    expect(motivoDoErroPush(new ErroPush('Recarregue a página.'))).toBe('Recarregue a página.');
    expect(motivoDoErroPush(new TypeError('falhou'))).toMatch(/TypeError: falhou/);
  });
  it('a chave do servidor vira os bytes que o navegador pede', () => {
    expect([...chaveDoServidor('AQID')]).toEqual([1, 2, 3]);
  });
});

// Quem tem papel de barbeiro mas ainda não tem a ficha de profissional (comissão, horários).
import type { ProfissionalDetalhe, UsuarioEquipe } from './esquemas.js';

export interface BarbeiroSemCadastro {
  usuarioId: string;
  nome: string;
  email: string;
  telefone: string | null;
  pendente: boolean;
  unidadeId: string;
}

/**
 * Convidar alguém como barbeiro em "Acessos" dá o papel, mas sem comissão nem horários ele
 * não aparece na agenda nem nos indicadores. Esta lista mostra quem falta completar, por
 * unidade. Desativados ficam de fora; um profissional que saiu continua contando como
 * cadastrado (o histórico é dele).
 */
export function barbeirosSemCadastro(
  usuarios: readonly UsuarioEquipe[],
  profissionais: readonly Pick<ProfissionalDetalhe, 'usuarioId' | 'unidadeId'>[],
): BarbeiroSemCadastro[] {
  const cadastrados = new Set(profissionais.map((p) => `${p.usuarioId}:${p.unidadeId}`));
  return usuarios.flatMap((u) =>
    u.ativo
      ? u.papeis
          .filter(
            (p): p is { papel: 'barbeiro'; unidadeId: string } =>
              p.papel === 'barbeiro' &&
              p.unidadeId !== null &&
              !cadastrados.has(`${u.id}:${p.unidadeId}`),
          )
          .map((p) => ({
            usuarioId: u.id,
            nome: u.nome,
            email: u.email,
            telefone: u.telefone,
            pendente: u.pendente,
            unidadeId: p.unidadeId,
          }))
      : [],
  );
}

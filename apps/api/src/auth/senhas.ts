import { hash, verify } from '@node-rs/argon2';

// argon2id com os parâmetros padrão da biblioteca (memória 19 MiB, 2 iterações),
// a recomendação mínima da OWASP. Os parâmetros ficam gravados no próprio hash.
export function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha);
}

// Hash de uma senha qualquer: usado quando o e-mail não existe, para o login levar o
// mesmo tempo com ou sem usuário (não revela quais e-mails estão cadastrados).
const hashFicticio = hash('senha-que-ninguem-usa-so-para-medir-tempo');

export async function conferirSenha(
  senhaHash: string | null | undefined,
  senha: string,
): Promise<boolean> {
  if (!senhaHash) {
    await verify(await hashFicticio, senha).catch(() => false);
    return false;
  }
  return verify(senhaHash, senha).catch(() => false);
}

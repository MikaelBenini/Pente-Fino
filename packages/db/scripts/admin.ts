// Cria quem administra o Pente Fino (ou redefine quem perdeu o celular), pela linha de comando
// do servidor: o primeiro admin não tem como nascer pela tela. A senha sai uma vez só, aqui.
//
//   pnpm admin:criar --email ana@pentefino.dev --nome "Ana Lima" [--papel vendedor]
//   pnpm admin:criar --email ana@pentefino.dev --redefinir   (senha nova e autenticador do zero)
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hash } from '@node-rs/argon2';
import { criarPrisma } from '../src/index.js';

const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    nome: { type: 'string' },
    papel: { type: 'string', default: 'admin' },
    redefinir: { type: 'boolean', default: false },
  },
});
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Informe --email válido.');
  process.exit(1);
}
if (values.papel !== 'admin' && values.papel !== 'vendedor') {
  console.error('--papel é admin ou vendedor.');
  process.exit(1);
}

const prisma = criarPrisma(process.env.DATABASE_PLATAFORMA_URL);
const senha = randomBytes(12).toString('base64url');
try {
  const existe = await prisma.usuarioPlataforma.findUnique({ where: { email } });
  if (existe && !values.redefinir) {
    console.error(`${email} já existe. Para senha nova e autenticador do zero, use --redefinir.`);
    process.exit(1);
  }
  if (!existe && values.redefinir) {
    console.error(`${email} não existe.`);
    process.exit(1);
  }
  if (existe) {
    await prisma.$transaction([
      prisma.usuarioPlataforma.update({
        where: { id: existe.id },
        data: {
          senhaHash: await hash(senha),
          totpSegredo: null,
          totpConfirmadoEm: null,
          totpUltimoPasso: null,
          ativo: true,
        },
      }),
      prisma.sessaoPlataforma.updateMany({
        where: { usuarioId: existe.id, encerradaEm: null },
        data: { encerradaEm: new Date() },
      }),
      prisma.auditoriaPlataforma.create({
        data: { usuarioId: null, acao: 'redefinir_acesso_pelo_servidor', depois: { email } },
      }),
    ]);
  } else {
    if (!values.nome?.trim()) {
      console.error('Informe --nome.');
      process.exit(1);
    }
    const u = await prisma.usuarioPlataforma.create({
      data: { email, nome: values.nome.trim(), papel: values.papel, senhaHash: await hash(senha) },
    });
    await prisma.auditoriaPlataforma.create({
      data: {
        usuarioId: null,
        acao: 'criar_usuario_pelo_servidor',
        depois: { email, papel: u.papel },
      },
    });
  }
  console.log(`\n${existe ? 'Acesso redefinido' : 'Criado'}: ${email}`);
  console.log(`Senha (anote agora, não aparece de novo): ${senha}`);
  console.log('No primeiro acesso a /admin, configure o aplicativo autenticador pelo QR code.\n');
} finally {
  await prisma.$disconnect();
}

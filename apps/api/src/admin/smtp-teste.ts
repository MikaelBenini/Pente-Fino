// Teste do SMTP pela administração: conecta e autentica na hora (sem fila), para quem configura
// saber logo se servidor, porta, TLS e senha estão certos, em vez de esperar um e-mail.
import type { ResultadoTesteSmtp } from '@pente-fino/shared';
import { createTransport } from 'nodemailer';

export interface DadosSmtp {
  host: string;
  porta: number;
  seguro: boolean;
  usuario: string;
  senha: string;
}

/** Tempo máximo de cada etapa (conectar, saudação, resposta). */
const LIMITE_MS = 10_000;

export function transporteSmtp(d: DadosSmtp) {
  return createTransport({
    host: d.host,
    port: d.porta,
    secure: d.seguro,
    auth: d.usuario ? { user: d.usuario, pass: d.senha } : undefined,
    connectionTimeout: LIMITE_MS,
    greetingTimeout: LIMITE_MS,
    socketTimeout: LIMITE_MS,
  });
}

/** Traduz o erro do nodemailer para o que a pessoa precisa conferir. */
export function explicarErroSmtp(e: unknown, d: Pick<DadosSmtp, 'host' | 'porta' | 'seguro'>) {
  const erro = (e ?? {}) as { code?: string; responseCode?: number; message?: string };
  const codigo = erro.code ?? '';
  const texto = (erro.message ?? String(e)).slice(0, 300);
  if (codigo === 'EAUTH' || erro.responseCode === 535)
    return 'O servidor recusou o usuário ou a senha. No Brevo, use o login SMTP e a chave SMTP (xsmtpsib-), não a chave de API.';
  if (codigo === 'EDNS' || /ENOTFOUND|EAI_AGAIN/.test(texto))
    return `Servidor "${d.host}" não encontrado. Confira o endereço.`;
  if (/ECONNREFUSED/.test(texto) || codigo === 'ECONNREFUSED')
    return `O servidor recusou a conexão na porta ${d.porta}. Confira a porta.`;
  if (/wrong version number|ssl3_get_record|tls/i.test(texto))
    return d.seguro
      ? `A porta ${d.porta} não usa TLS desde o início. Desmarque a opção (porta 587) ou use a 465.`
      : `A porta ${d.porta} espera TLS desde o início. Marque a opção (porta 465) ou use a 587.`;
  if (
    codigo === 'ETIMEDOUT' ||
    codigo === 'ESOCKET' ||
    codigo === 'ECONNECTION' ||
    /timeout/i.test(texto)
  )
    return d.seguro
      ? `Sem resposta de ${d.host}:${d.porta}. Confira servidor e porta.`
      : `Sem resposta de ${d.host}:${d.porta}. Confira servidor e porta; se for a 465, marque "TLS desde o início".`;
  return `Falhou: ${texto}`;
}

/** Conecta, faz o TLS e autentica. Não manda e-mail. */
export async function testarConexaoSmtp(d: DadosSmtp): Promise<ResultadoTesteSmtp> {
  const inicio = Date.now();
  const t = transporteSmtp(d);
  try {
    await t.verify();
    return {
      ok: true,
      mensagem: `Conexão com ${d.host}:${d.porta} ok${d.usuario ? ', usuário e senha aceitos' : ''}.`,
      ms: Date.now() - inicio,
    };
  } catch (e) {
    return { ok: false, mensagem: explicarErroSmtp(e, d), ms: Date.now() - inicio };
  } finally {
    t.close();
  }
}

/** Manda um e-mail e devolve o que o servidor respondeu (ex.: "250 Message queued"). */
export async function enviarTesteSmtp(
  d: DadosSmtp,
  m: { de: string; para: string; assunto: string; texto: string },
): Promise<ResultadoTesteSmtp> {
  const inicio = Date.now();
  const t = transporteSmtp(d);
  try {
    const r = (await t.sendMail({ from: m.de, to: m.para, subject: m.assunto, text: m.texto })) as {
      response?: string;
    };
    return {
      ok: true,
      mensagem: `O servidor aceitou o e-mail para ${m.para}. Se não chegar em alguns minutos, olhe o spam e a verificação do domínio do remetente.`,
      resposta: r.response?.slice(0, 200),
      ms: Date.now() - inicio,
    };
  } catch (e) {
    return { ok: false, mensagem: explicarErroSmtp(e, d), ms: Date.now() - inicio };
  } finally {
    t.close();
  }
}

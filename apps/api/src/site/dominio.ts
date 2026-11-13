// Domínio próprio do site da barbearia (seção 7, lote 7e). O domínio está pronto quando o DNS
// dele aponta para o mesmo servidor do Pente Fino: os IPs do domínio (ou do www) batem com os do
// endereço principal, ou o www é um CNAME para ele.
import type { Transacao } from '@pente-fino/db';
import { resolve4, resolveCname } from 'node:dns/promises';
import type { Configuracao } from '../config/configuracao.js';

const semErro = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

/** IPs do servidor (para onde o registro A do domínio deve apontar). */
export async function ipsDoServidor(config: Configuracao): Promise<string[]> {
  if (config.dominio.verificacao === 'falso') return ['203.0.113.10'];
  return semErro(resolve4(config.dominio.alvo));
}

/** O DNS do domínio já leva ao Pente Fino? */
export async function dominioApontado(config: Configuracao, dominio: string): Promise<boolean> {
  if (config.dominio.verificacao === 'falso') return dominio.endsWith('.teste');
  const alvo = config.dominio.alvo;
  const ips = new Set(await ipsDoServidor(config));
  if (!ips.size) return false;
  const doDominio = await semErro(resolve4(dominio));
  if (doDominio.length && doDominio.every((ip) => ips.has(ip))) return true;
  const cnames = await semErro(resolveCname(`www.${dominio}`));
  if (cnames.some((c) => c.replace(/\.$/, '') === alvo)) return true;
  const doWww = await semErro(resolve4(`www.${dominio}`));
  return doWww.length > 0 && doWww.every((ip) => ips.has(ip));
}

/** O domínio já é de outra unidade (de qualquer barbearia)? */
export async function dominioEmUso(
  tx: Transacao,
  dominio: string,
  unidadeId: string,
): Promise<boolean> {
  const [r] = await tx.$queryRaw<{ em_uso: boolean }[]>`
    SELECT dominio_em_uso(${dominio}, ${unidadeId}::uuid) AS em_uso`;
  return !!r?.em_uso;
}

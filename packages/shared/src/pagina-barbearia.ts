// Página pública da unidade (/b/<slug>): o que aparece na prévia do WhatsApp e do Instagram
// (painel P1), o que o Google lê quando o dono liga "Aparecer no Google" (P4) e o arquivo de
// calendário da confirmação (P6). Regras puras, sem nada da tela.
import { formatarMoeda } from './formatacao.js';
import type { UnidadePublica } from './publico.js';

type ParaPagina = Pick<UnidadePublica, 'nome' | 'barbearia' | 'endereco' | 'telefone' | 'servicos'>;

/** Preço inicial: o menor preço entre os serviços principais (extras não contam). */
export function precoInicial(u: Pick<UnidadePublica, 'servicos'>): number | null {
  const principais = u.servicos.filter((s) => !s.ehExtra && s.preco !== null);
  const lista = principais.length ? principais : u.servicos.filter((s) => s.preco !== null);
  return lista.length ? Math.min(...lista.map((s) => s.preco!)) : null;
}

/** Título e descrição da prévia: "Agende na Barbearia Navalha · Centro". */
export function metadadosDaPagina(u: ParaPagina): { titulo: string; descricao: string } {
  const titulo =
    u.nome && u.nome.toLowerCase() !== u.barbearia.toLowerCase()
      ? `Agende na ${u.barbearia} · ${u.nome}`
      : `Agende na ${u.barbearia}`;
  const nomes = u.servicos
    .filter((s) => !s.ehExtra)
    .slice(0, 4)
    .map((s) => s.nome);
  const preco = precoInicial(u);
  const partes = [
    nomes.length ? nomes.join(', ') : null,
    preco !== null ? `a partir de ${formatarMoeda(preco)}` : null,
  ].filter(Boolean);
  const descricao = partes.length
    ? `${partes.join(' · ')}. Escolha o serviço, o barbeiro e o horário online.`
    : 'Escolha o serviço, o barbeiro e o horário online.';
  return { titulo, descricao: descricao.slice(0, 155) };
}

/** JSON-LD HairSalon (schema.org) para o Google, só quando o dono liga "Aparecer no Google". */
export function jsonLdDaBarbearia(u: ParaPagina, url: string): Record<string, unknown> {
  const preco = precoInicial(u);
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: u.nome && u.nome !== u.barbearia ? `${u.barbearia} · ${u.nome}` : u.barbearia,
    url,
    ...(u.endereco ? { address: u.endereco } : {}),
    ...(u.telefone ? { telephone: `+${u.telefone.replace(/\D/g, '')}` } : {}),
    ...(preco !== null
      ? { priceRange: `a partir de ${formatarMoeda(preco)}`, currenciesAccepted: 'BRL' }
      : {}),
    potentialAction: {
      '@type': 'ReserveAction',
      target: url,
      name: 'Agendar horário',
    },
  };
}

const ics = (t: string) =>
  t
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, '\\n');
const quandoIcs = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * Arquivo .ics do horário marcado ("Adicionar ao calendário"), que o celular abre direto na
 * agenda. Horário em UTC, então vale em qualquer fuso; com um lembrete 1 h antes.
 */
export function arquivoCalendario(d: {
  id: string;
  inicio: string;
  duracaoMin: number;
  titulo: string;
  local: string | null;
  descricao: string;
  agora?: Date;
}): string {
  const inicio = new Date(d.inicio);
  const fim = new Date(inicio.getTime() + Math.max(15, d.duracaoMin) * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pente Fino//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${d.id}@pentefino`,
    `DTSTAMP:${quandoIcs(d.agora ?? new Date())}`,
    `DTSTART:${quandoIcs(inicio)}`,
    `DTEND:${quandoIcs(fim)}`,
    `SUMMARY:${ics(d.titulo)}`,
    ...(d.local ? [`LOCATION:${ics(d.local)}`] : []),
    `DESCRIPTION:${ics(d.descricao)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${ics(d.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

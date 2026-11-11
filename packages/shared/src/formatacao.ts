// Formatação para a tela, em pt-BR. Dinheiro chega em centavos; datas, em UTC.
import { FUSO_EXIBICAO } from './datas.js';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR');

/** 123456 → "R$ 1.234,56" (com espaço comum, não o inseparável do Intl). */
export function formatarMoeda(centavos: number): string {
  return moeda.format(centavos / 100).replace(/[\u00a0\u202f]/g, ' ');
}

/** 123456 → "1.234,56", para colunas onde o "R$" já está no cabeçalho. */
export function formatarValor(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarNumero(n: number): string {
  return numero.format(n);
}

/** Pontos-base → "40%" ou "42,5%". */
export function formatarPercentualBp(bp: number): string {
  return `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Fração (0,425) → "42,5%". */
export function formatarFracao(fracao: number, casas = 1): string {
  return `${(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;
}

function comoData(valor: Date | string): Date {
  return typeof valor === 'string' ? new Date(valor) : valor;
}

/** "03/11/2026" no fuso da unidade. */
export function formatarData(valor: Date | string, fuso: string = FUSO_EXIBICAO): string {
  return comoData(valor).toLocaleDateString('pt-BR', { timeZone: fuso });
}

/** "14:30" no fuso da unidade. */
export function formatarHora(valor: Date | string, fuso: string = FUSO_EXIBICAO): string {
  return comoData(valor).toLocaleTimeString('pt-BR', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "03/11/2026 14:30". */
export function formatarDataHora(valor: Date | string, fuso: string = FUSO_EXIBICAO): string {
  return `${formatarData(valor, fuso)} ${formatarHora(valor, fuso)}`;
}

/** "terça, 3 de novembro". */
export function formatarDiaPorExtenso(valor: Date | string, fuso: string = FUSO_EXIBICAO): string {
  return comoData(valor)
    .toLocaleDateString('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long' })
    .replace('-feira', '');
}

/** "5511988887777" → "(11) 98888-7777"; fixo: "(11) 3333-4444". Outro formato volta como veio. */
export function formatarTelefone(telefone: string): string {
  const d = telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telefone;
}
/** Máscara enquanto digita o WhatsApp: "11988887777" → "(11) 98888-7777" (no máximo 11 dígitos). */
export function mascararTelefone(texto: string): string {
  const d = texto
    .replace(/\D/g, '')
    .replace(/^55(?=\d{11})/, '')
    .slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const fim = d.length === 11 ? 7 : 6;
  if (d.length <= fim) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, fim)}-${d.slice(fim)}`;
}

/** Máscara de CPF (até 11 dígitos) ou CNPJ (12 a 14) enquanto digita. */
export function mascararDocumento(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Lê um valor digitado em reais e devolve centavos: "45", "45,5", "45,50", "1.234,56",
 * "R$ 70,00", "45.50" (ponto como decimal quando só há 1 ou 2 casas). Inválido → null.
 */
export function lerMoeda(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '');
  if (t === '' || /[^\d.,-]/.test(t)) return null;
  const negativo = t.startsWith('-');
  t = t.replace(/^-/, '');
  if (t.includes(',')) {
    const [inteiro = ''] = t.split(',');
    // Milhar com ponto só de três em três: "1.234,56" sim, "1.2.3,4" não.
    if (inteiro.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(inteiro)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}(\.|$)/.test(t)) {
    t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, decimal = ''] = t.split('.');
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? (negativo ? -centavos : centavos) : null;
}

/** Centavos → "45,00" para preencher um campo de valor. */
export function valorParaCampo(centavos: number): string {
  return formatarValor(centavos);
}

/**
 * "Vitor Martins" → "Vitor M.", "Ana" → "Ana": para caber num bloco curto da agenda (painel M9).
 * O nome inteiro continua no rótulo de acessibilidade e na dica.
 */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes[0]} ${partes[1]!.charAt(0).toUpperCase()}.`;
}

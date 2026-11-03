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

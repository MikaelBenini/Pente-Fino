// Ficha da conta e vendas na administração (admin U3 e U5): o que vem a seguir na cobrança, quanto
// falta do teste, o atalho para o WhatsApp do dono e de onde vêm as barbearias que pagam.
// Regras puras, usadas pela tela e pela API e testadas aqui.
import { formatarData, formatarMoeda } from './formatacao.js';
import type { FaturaNaPlataforma } from './plataforma.js';

const DIA_MS = 86_400_000;

/** Dias até o fim do teste (0 = termina hoje); null quando a conta não está em teste. */
export function diasRestantesDoTeste(
  f: { status: string; testeAte: string | null },
  hoje: string,
): number | null {
  if (f.status !== 'teste' || !f.testeAte) return null;
  const fim = f.testeAte.slice(0, 10);
  return Math.max(0, Math.round((Date.parse(fim) - Date.parse(hoje)) / DIA_MS));
}

const dia = (iso: string) => formatarData(`${iso.slice(0, 10)}T12:00:00Z`);

/**
 * "Próxima cobrança" da ficha: a fatura em aberto (a mais antiga), ou o que vem quando não há
 * nenhuma. Ativa sem fatura: o dia seguinte ao fim do último período pago, no valor do plano.
 */
export function proximaCobrancaDaConta(
  f: {
    status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
    testeAte: string | null;
    cortesiaAte: string | null;
    cobrarAPartirDe: string | null;
    cobrancaAutomatica: boolean;
    interna: boolean;
    cupom: string | null;
    descontoBp: number;
    faturas: readonly Pick<FaturaNaPlataforma, 'status' | 'valor' | 'vencimento' | 'periodoFim'>[];
  },
  /** Valor de cada cobrança (mês no mensal, ano no anual), já com o desconto do cupom. */
  valor: number,
  hoje: string,
): { titulo: string; detalhe: string | null } {
  const cupom = f.cupom ? `Cupom ${f.cupom} (${f.descontoBp / 100}% de desconto).` : null;
  const juntar = (...p: (string | null)[]) => p.filter(Boolean).join(' ') || null;
  if (f.interna) return { titulo: 'Sem cobrança', detalhe: 'Conta interna da equipe.' };
  if (f.status === 'cancelada') return { titulo: 'Sem cobrança', detalhe: 'Conta cancelada.' };
  const aberta = f.faturas
    .filter((x) => x.status === 'aberta' || x.status === 'recusada')
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  if (aberta) {
    const vencida = aberta.vencimento.slice(0, 10) < hoje;
    return {
      titulo: `${formatarMoeda(aberta.valor)} ${vencida ? 'venceu' : 'vence'} em ${dia(aberta.vencimento)}`,
      detalhe: juntar(aberta.status === 'recusada' ? 'O cartão recusou.' : null, cupom),
    };
  }
  if (f.status === 'teste') {
    const n = diasRestantesDoTeste(f, hoje) ?? 0;
    return {
      titulo:
        n === 0
          ? 'O teste termina hoje'
          : n === 1
            ? 'Falta 1 dia de teste'
            : `Faltam ${n} dias de teste`,
      detalhe: juntar(`Depois, ${formatarMoeda(valor)} quando assinar.`, cupom),
    };
  }
  if (f.cortesiaAte && f.cortesiaAte >= hoje)
    return {
      titulo: `Cortesia até ${dia(f.cortesiaAte)}`,
      detalhe: juntar(`Depois, ${formatarMoeda(valor)}.`, cupom),
    };
  const ultima = f.faturas
    .filter((x) => x.status === 'paga')
    .sort((a, b) => b.periodoFim.localeCompare(a.periodoFim))[0];
  let vence: string | null = null;
  if (ultima) {
    const d = new Date(`${ultima.periodoFim.slice(0, 10)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    vence = d.toISOString().slice(0, 10);
  } else if (f.cobrarAPartirDe) vence = f.cobrarAPartirDe;
  if (!vence) return { titulo: formatarMoeda(valor), detalhe: juntar('Sem data ainda.', cupom) };
  return {
    titulo: `${formatarMoeda(valor)} em ${dia(vence)}`,
    detalhe: juntar(
      f.cobrancaAutomatica ? 'Cobrança automática pelo Asaas.' : 'Cobrança manual.',
      cupom,
    ),
  };
}

/** Link do WhatsApp do dono, com uma saudação pronta; null sem número válido. */
export function whatsappDoDono(telefone: string | null, nome: string): string | null {
  const n = (telefone ?? '').replace(/\D/g, '');
  if (n.length < 10) return null;
  const numero = n.length <= 11 ? `55${n}` : n;
  const primeiro = nome.trim().split(/\s+/)[0] ?? '';
  const texto = `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da equipe Pente Fino.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// ─── Vendas por origem (U5) ────────────────────────────────────────────────

export const SEM_ORIGEM = 'Direto ou sem dado';

export interface VendasPorOrigem {
  origem: string;
  cadastros: number;
  /** Ainda no teste (a conversão só conta quem já passou dele). */
  emTeste: number;
  /** Com ao menos uma fatura paga. */
  pagantes: number;
  /** pagantes ÷ (cadastros − emTeste); null quando ninguém saiu do teste ainda. */
  conversao: number | null;
  /** Soma das faturas pagas, em centavos. */
  receita: number;
}

/** Cadastros, conversão do teste em pagante e receita por origem (contas internas não entram). */
export function vendasPorOrigem(d: {
  contas: readonly { id: string; origem: string | null; status: string; interna: boolean }[];
  faturasPagas: readonly { contaId: string; valor: number }[];
}): VendasPorOrigem[] {
  const receitaDa = new Map<string, number>();
  for (const f of d.faturasPagas)
    receitaDa.set(f.contaId, (receitaDa.get(f.contaId) ?? 0) + f.valor);
  const grupos = new Map<string, VendasPorOrigem>();
  for (const c of d.contas) {
    if (c.interna) continue;
    const origem = c.origem ?? SEM_ORIGEM;
    const g = grupos.get(origem) ?? {
      origem,
      cadastros: 0,
      emTeste: 0,
      pagantes: 0,
      conversao: null,
      receita: 0,
    };
    g.cadastros += 1;
    if (c.status === 'teste') g.emTeste += 1;
    const receita = receitaDa.get(c.id) ?? 0;
    if (receita > 0) {
      g.pagantes += 1;
      g.receita += receita;
    }
    grupos.set(origem, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const sairam = g.cadastros - g.emTeste;
      return { ...g, conversao: sairam > 0 ? Math.min(1, g.pagantes / sairam) : null };
    })
    .sort((a, b) => b.receita - a.receita || b.cadastros - a.cadastros);
}

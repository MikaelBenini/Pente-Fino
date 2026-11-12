// Admin F1: funil de ativação. Do cadastro ao pagamento, quantas contas já fizeram cada etapa e
// em qual etapa cada conta está. As contas internas (da equipe) ficam de fora.

export type EtapaFunil =
  'cadastro' | 'servicos' | 'barbeiros' | 'agendamento' | 'comanda' | 'whatsapp' | 'pagamento';

export const ETAPAS_FUNIL: readonly { etapa: EtapaFunil; nome: string }[] = [
  { etapa: 'cadastro', nome: 'Cadastro' },
  { etapa: 'servicos', nome: 'Serviços com preço' },
  { etapa: 'barbeiros', nome: 'Barbeiros cadastrados' },
  { etapa: 'agendamento', nome: '1º agendamento' },
  { etapa: 'comanda', nome: '1ª comanda fechada' },
  { etapa: 'whatsapp', nome: 'WhatsApp conectado' },
  { etapa: 'pagamento', nome: '1º pagamento' },
];

export const NOME_ETAPA_FUNIL = Object.fromEntries(
  ETAPAS_FUNIL.map((e) => [e.etapa, e.nome]),
) as Record<EtapaFunil, string>;

/** O que o banco diz de cada conta (plataforma_funil()). */
export interface ContaNoFunil {
  id: string;
  criadoEm: string;
  interna: boolean;
  servicos: boolean;
  barbeiros: boolean;
  agendamento: boolean;
  comanda: boolean;
  whatsapp: boolean;
  pagamento: boolean;
}

const feita = (c: ContaNoFunil, e: EtapaFunil) => e === 'cadastro' || c[e];

/** A primeira etapa que falta, na ordem do funil; null = todas feitas. */
export function etapaAtualDoFunil(c: ContaNoFunil): EtapaFunil | null {
  return ETAPAS_FUNIL.find((e) => !feita(c, e.etapa))?.etapa ?? null;
}

export interface ResumoFunil {
  /** Contas no funil (cadastros no período, sem as internas). */
  total: number;
  etapas: { etapa: EtapaFunil; nome: string; contas: number; pct: number }[];
}

/** Quantas contas fizeram cada etapa; `desde` (ISO) limita aos cadastros a partir da data. */
export function resumirFunil(contas: readonly ContaNoFunil[], desde?: string): ResumoFunil {
  const noFunil = contas.filter((c) => !c.interna && (!desde || c.criadoEm >= desde));
  const total = noFunil.length;
  return {
    total,
    etapas: ETAPAS_FUNIL.map(({ etapa, nome }) => {
      const n = noFunil.filter((c) => feita(c, etapa)).length;
      return { etapa, nome, contas: n, pct: total ? Math.round((n / total) * 100) : 0 };
    }),
  };
}

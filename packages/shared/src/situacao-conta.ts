// Situação da conta na administração (admin R3 e R6): uma máquina de estados explícita.
// Bloquear é suspensão temporária e desbloquear volta exatamente ao que era. Cancelar tem o par
// reativar, que sempre diz o próximo passo: nunca "ativa" sem teste, cobrança ou cortesia.
// O teste tem limite; acima dele, só cortesia (com motivo e data de fim).
import { z } from 'zod';

export type StatusConta = 'teste' | 'ativa' | 'suspensa' | 'cancelada';

/** Máximo de dias de teste a partir de hoje (venda, estender ou reativar). */
export const LIMITE_TESTE_DIAS = 60;
/** Cortesia longa demais vira esquecimento: no máximo um ano por vez. */
export const LIMITE_CORTESIA_DIAS = 366;

export const ACOES_CONTA = [
  'bloquear',
  'desbloquear',
  'cancelar',
  'reativar',
  'cortesia',
  'cobrar',
] as const;
export type AcaoConta = (typeof ACOES_CONTA)[number];

/** O próximo passo de uma conta cancelada que volta. */
export const PROXIMOS_PASSOS = ['teste', 'cobranca', 'cortesia'] as const;
export type ProximoPasso = (typeof PROXIMOS_PASSOS)[number];

export const NOME_PROXIMO_PASSO: Readonly<Record<ProximoPasso, string>> = {
  teste: 'Voltar ao teste até a data',
  cobranca: 'Ativar com cobrança a partir da data',
  cortesia: 'Cortesia até a data (sem cobrança)',
};

const diaISO = z.iso.date({ error: 'Data inválida.' });

export const acaoContaSchema = z.object({
  acao: z.enum(ACOES_CONTA),
  motivo: z.string().trim().min(5, { error: 'Explique o motivo (pelo menos 5 letras).' }).max(300),
  /** Só no reativar. */
  proximo: z.enum(PROXIMOS_PASSOS).optional(),
  /** Fim do teste ou da cortesia, ou o início da cobrança. */
  data: diaISO.optional(),
});
export type AcaoContaEntrada = z.infer<typeof acaoContaSchema>;

export interface ContaParaSituacao {
  status: StatusConta;
  /** O que a conta era antes de ser bloqueada. */
  statusAnterior: StatusConta | null;
  /** Último dia do teste (AAAA-MM-DD, em São Paulo). */
  testeAte: string | null;
  /** Cobrança automática no Asaas ligada. */
  cobrancaAutomatica: boolean;
}

/** O que gravar (undefined = deixar como está). */
export interface MudancaDeSituacao {
  status: StatusConta;
  statusAnterior: StatusConta | null;
  testeAte?: string | null;
  cortesiaAte?: string | null;
  cobrarAPartirDe?: string | null;
  /** Cancelar marca a data e o motivo; reativar limpa. */
  cancelamento?: 'marcar' | 'limpar';
  /** Cancelar também para a cobrança automática no Asaas (senão ela continua cobrando). */
  pararCobrancaAutomatica: boolean;
}

export type ResultadoSituacao =
  { ok: true; mudanca: MudancaDeSituacao } | { ok: false; motivo: string };

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
const erro = (motivo: string): ResultadoSituacao => ({ ok: false, motivo });

/** Fim de teste válido: de hoje até LIMITE_TESTE_DIAS dias. null = pode. */
export function problemaFimDoTeste(ate: string | undefined, hoje: string): string | null {
  if (!ate) return 'Informe até quando vai o teste.';
  if (ate < hoje) return 'O teste não pode terminar no passado.';
  const limite = somarDias(hoje, LIMITE_TESTE_DIAS);
  if (ate > limite)
    return `O teste vai no máximo até ${ddmm(limite)} (${LIMITE_TESTE_DIAS} dias). Para mais tempo, dê uma cortesia com o motivo.`;
  return null;
}

function problemaCortesia(ate: string | undefined, hoje: string): string | null {
  if (!ate) return 'Informe até quando vai a cortesia.';
  if (ate <= hoje) return 'A cortesia termina depois de hoje.';
  if (ate > somarDias(hoje, LIMITE_CORTESIA_DIAS))
    return 'A cortesia vai no máximo um ano por vez; depois, renove com outro motivo.';
  return null;
}

function problemaInicioCobranca(aPartirDe: string | undefined, hoje: string): string | null {
  if (!aPartirDe) return 'Informe a partir de quando a conta é cobrada.';
  if (aPartirDe < hoje) return 'A cobrança começa hoje ou depois.';
  if (aPartirDe > somarDias(hoje, LIMITE_TESTE_DIAS))
    return `A cobrança começa em até ${LIMITE_TESTE_DIAS} dias; para mais tempo sem cobrar, use cortesia.`;
  return null;
}

const SEM_COBRANCA_AUTOMATICA =
  'Esta conta paga pela cobrança automática do Asaas, que continuaria cobrando. Cancele a conta (isso para a cobrança) e reative com o próximo passo.';

/** Cortesia: ativa sem cobrança até a data; a cobrança manual começa no dia seguinte. */
const cortesia = (status: StatusConta, ate: string): MudancaDeSituacao => ({
  status: 'ativa',
  statusAnterior: null,
  cortesiaAte: ate,
  cobrarAPartirDe: somarDias(ate, 1),
  pararCobrancaAutomatica: false,
  ...(status === 'teste' ? { testeAte: null } : {}),
});

/**
 * A próxima situação da conta, ou o motivo de não poder. Regras:
 * - bloquear: teste ou ativa → suspensa, guardando o que era;
 * - desbloquear: suspensa → exatamente o que era (o teste mantém a data de fim);
 * - cancelar: teste, ativa ou suspensa → cancelada, e para a cobrança automática;
 * - reativar: cancelada → teste até a data, ativa com cobrança a partir da data ou cortesia;
 * - cortesia: teste ou ativa (sem cobrança automática) → ativa sem cobrança até a data;
 * - cobrar: ativa sem cobrança automática → a cobrança manual começa na data.
 */
export function transicaoDaConta(
  conta: ContaParaSituacao,
  e: Pick<AcaoContaEntrada, 'acao' | 'proximo' | 'data'>,
  hoje: string,
): ResultadoSituacao {
  const { status } = conta;
  switch (e.acao) {
    case 'bloquear':
      if (status === 'suspensa') return erro('A conta já está bloqueada.');
      if (status === 'cancelada') return erro('A conta está cancelada; para voltar, use Reativar.');
      return {
        ok: true,
        mudanca: { status: 'suspensa', statusAnterior: status, pararCobrancaAutomatica: false },
      };

    case 'desbloquear': {
      if (status !== 'suspensa')
        return erro(
          status === 'cancelada'
            ? 'A conta está cancelada, não bloqueada; use Reativar e escolha o próximo passo.'
            : 'A conta não está bloqueada.',
        );
      // Bloqueada antes desta regra (sem o "antes" guardado): teste se ainda havia dias.
      const volta =
        conta.statusAnterior ?? (conta.testeAte && conta.testeAte >= hoje ? 'teste' : 'ativa');
      return {
        ok: true,
        mudanca: { status: volta, statusAnterior: null, pararCobrancaAutomatica: false },
      };
    }

    case 'cancelar':
      if (status === 'cancelada') return erro('A conta já está cancelada.');
      return {
        ok: true,
        mudanca: {
          status: 'cancelada',
          statusAnterior: null,
          cancelamento: 'marcar',
          pararCobrancaAutomatica: conta.cobrancaAutomatica,
        },
      };

    case 'reativar': {
      if (status !== 'cancelada')
        return erro('Só conta cancelada é reativada; bloqueada volta com Desbloquear.');
      if (!e.proximo) return erro('Escolha o próximo passo: teste, cobrança ou cortesia.');
      const base = {
        statusAnterior: null,
        cancelamento: 'limpar' as const,
        pararCobrancaAutomatica: false,
      };
      if (e.proximo === 'teste') {
        const p = problemaFimDoTeste(e.data, hoje);
        if (p) return erro(p);
        return {
          ok: true,
          mudanca: {
            ...base,
            status: 'teste',
            testeAte: e.data!,
            cortesiaAte: null,
            cobrarAPartirDe: null,
          },
        };
      }
      if (e.proximo === 'cobranca') {
        const p = problemaInicioCobranca(e.data, hoje);
        if (p) return erro(p);
        return {
          ok: true,
          mudanca: { ...base, status: 'ativa', cortesiaAte: null, cobrarAPartirDe: e.data! },
        };
      }
      const p = problemaCortesia(e.data, hoje);
      if (p) return erro(p);
      return { ok: true, mudanca: { ...cortesia(status, e.data!), ...base } };
    }

    case 'cortesia': {
      if (status !== 'teste' && status !== 'ativa')
        return erro(
          status === 'cancelada'
            ? 'A conta está cancelada; use Reativar → Cortesia.'
            : 'Desbloqueie a conta antes de dar cortesia.',
        );
      if (conta.cobrancaAutomatica) return erro(SEM_COBRANCA_AUTOMATICA);
      const p = problemaCortesia(e.data, hoje);
      if (p) return erro(p);
      return { ok: true, mudanca: cortesia(status, e.data!) };
    }

    case 'cobrar': {
      if (status !== 'ativa')
        return erro(
          status === 'teste'
            ? 'A conta está em teste: a cobrança começa quando ela assinar.'
            : 'Só conta ativa recebe a data da cobrança.',
        );
      if (conta.cobrancaAutomatica)
        return erro('A cobrança automática do Asaas já cobra esta conta.');
      const p = problemaInicioCobranca(e.data, hoje);
      if (p) return erro(p);
      return {
        ok: true,
        mudanca: {
          status: 'ativa',
          statusAnterior: null,
          cortesiaAte: null,
          cobrarAPartirDe: e.data!,
          pararCobrancaAutomatica: false,
        },
      };
    }
  }
}

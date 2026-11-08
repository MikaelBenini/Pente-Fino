// Exclusão automática de dados (Etapa 15.4): o banco não cresce sem limite. Rotina diária no
// worker, em lotes pequenos. O que sai e quando está escrito na política de privacidade.
import { dataLocal } from './datas.js';

/** Dias que guardamos conversas do bot, sessões e tokens vencidos, avisos lidos e filas. */
export const DIAS_GUARDA = 90;
/** Conta cancelada ou com o teste vencido sem pagamento: apagada depois destes dias. */
export const DIAS_CONTA_PARADA = 90;
/** Avisos por e-mail antes de apagar a conta parada. */
export const AVISOS_CONTA_PARADA = [15, 3] as const;
/** Conta criada pelo site sem confirmar o e-mail: apagada depois destes dias. */
export const DIAS_SEM_CONFIRMAR = 7;
/** Aviso por e-mail antes de apagar a conta sem confirmação. */
export const AVISO_SEM_CONFIRMAR = 2;
/** Linhas por lote: cada DELETE é curto e não trava a tabela. */
export const LOTE_LIMPEZA = 500;

/** Tipos do que a rotina apaga (a Saúde do sistema mostra o total de cada um). */
export const TIPOS_LIMPEZA = [
  'mensagens',
  'sessoesBot',
  'tokens',
  'linksHorario',
  'tokensAgendamento',
  'avisosLidos',
  'comentarios',
  'sessoesAdmin',
  'filas',
  'contasSemConfirmar',
  'contasParadas',
] as const;
export type TipoLimpeza = (typeof TIPOS_LIMPEZA)[number];
export const NOME_TIPO_LIMPEZA: Readonly<Record<TipoLimpeza, string>> = {
  mensagens: 'Conversas do bot',
  sessoesBot: 'Sessões do bot paradas',
  tokens: 'Logins e links vencidos',
  linksHorario: 'Links de horário antigos',
  tokensAgendamento: 'Links de agendamento vencidos',
  avisosLidos: 'Avisos lidos',
  comentarios: 'Comentários de avaliação (a nota fica)',
  sessoesAdmin: 'Sessões da administração',
  filas: 'Trabalhos antigos das filas',
  contasSemConfirmar: 'Contas sem confirmar o e-mail',
  contasParadas: 'Contas canceladas ou com teste vencido',
};

export type MotivoApagarConta = 'sem_confirmar' | 'parada';

export interface ContaParaLimpeza {
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criadoEm: Date;
  testeAte: Date | null;
  canceladaEm: Date | null;
  /** Alguma mensalidade paga (Asaas ou manual). */
  temPagamento: boolean;
  /** Algum dono ainda sem confirmar o e-mail (cadastro pelo site). */
  donoSemConfirmar: boolean;
}

export type DecisaoLimpeza =
  | { tipo: 'manter' }
  | { tipo: 'avisar'; motivo: MotivoApagarConta; dias: number; apagaEm: string }
  | { tipo: 'apagar'; motivo: MotivoApagarConta };

const DIA_MS = 86_400_000;
/** Diferença em dias de calendário (São Paulo) entre duas datas AAAA-MM-DD. */
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA_MS);
const somarDias = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/**
 * O que fazer com a conta hoje. Os avisos caem num dia só (sem repetir); se a rotina não rodar
 * no dia do aviso, a conta ainda sai no prazo. Conta paga nunca sai por aqui.
 */
export function decidirLimpezaDaConta(c: ContaParaLimpeza, agora: Date): DecisaoLimpeza {
  if (c.temPagamento && c.status !== 'cancelada') return { tipo: 'manter' };
  const hoje = dataLocal(agora);
  const prazo = (
    inicio: Date,
    dias: number,
    avisos: readonly number[],
    motivo: MotivoApagarConta,
  ) => {
    const apagaEm = somarDias(dataLocal(inicio), dias);
    const faltam = diasEntre(hoje, apagaEm);
    if (faltam <= 0) return { tipo: 'apagar', motivo } as const;
    if (avisos.includes(faltam)) return { tipo: 'avisar', motivo, dias: faltam, apagaEm } as const;
    return null;
  };

  // Cadastro pelo site sem confirmar o e-mail (e sem pagamento): 7 dias.
  if (c.donoSemConfirmar && !c.temPagamento && c.status === 'teste') {
    return (
      prazo(c.criadoEm, DIAS_SEM_CONFIRMAR, [AVISO_SEM_CONFIRMAR], 'sem_confirmar') ?? {
        tipo: 'manter',
      }
    );
  }
  // Cancelada: 90 dias depois do cancelamento.
  if (c.status === 'cancelada' && c.canceladaEm)
    return (
      prazo(c.canceladaEm, DIAS_CONTA_PARADA, AVISOS_CONTA_PARADA, 'parada') ?? {
        tipo: 'manter',
      }
    );
  // Teste vencido sem nenhum pagamento: 90 dias depois do fim do teste.
  if (c.status === 'teste' && c.testeAte && c.testeAte.getTime() < agora.getTime())
    return (
      prazo(c.testeAte, DIAS_CONTA_PARADA, AVISOS_CONTA_PARADA, 'parada') ?? {
        tipo: 'manter',
      }
    );
  return { tipo: 'manter' };
}

/** Resultado de uma execução da rotina (Saúde do sistema). */
export interface ExecucaoLimpezaNaTela {
  iniciadaEm: string;
  terminadaEm: string | null;
  apagados: Partial<Record<TipoLimpeza, number>>;
  /** Contas que já deviam sair mas têm cobrança ativa no Asaas (cancele lá primeiro). */
  retidas: { contaId: string; conta: string; motivo: string }[];
  erro: string | null;
}

// Admin F3: alertas para a equipe da plataforma, por e-mail. A rotina do worker (de hora em hora)
// junta os dados, esta regra decide o que é alerta, e cada alerta sai uma vez só (tipo + chave
// gravados em alerta_equipe_enviado). Cada pessoa da equipe escolhe quais tipos recebe.
import { z } from 'zod';
import { dataLocal } from './datas.js';
import { formatarMoeda } from './formatacao.js';

export const TIPOS_ALERTA_EQUIPE = [
  'cadastro_novo',
  'teste_acabando',
  'cobranca_vencida',
  'whatsapp_caido',
  'falha_email',
  'falha_nf',
  'cupom_esgotando',
] as const;
export type TipoAlertaEquipe = (typeof TIPOS_ALERTA_EQUIPE)[number];

export const ALERTAS_EQUIPE: Readonly<Record<TipoAlertaEquipe, { nome: string; quando: string }>> =
  {
    cadastro_novo: { nome: 'Cadastro novo', quando: 'Uma barbearia criou a conta.' },
    teste_acabando: {
      nome: 'Teste acabando sem uso',
      quando: 'O teste acaba em até 3 dias e a conta ainda não fechou nenhuma comanda.',
    },
    cobranca_vencida: {
      nome: 'Cobrança vencida',
      quando: 'Uma fatura da assinatura passou do vencimento sem pagamento.',
    },
    whatsapp_caido: {
      nome: 'WhatsApp caído',
      quando: 'O WhatsApp de uma barbearia caiu há mais de 2 horas e não voltou.',
    },
    falha_email: { nome: 'Falha de e-mail', quando: 'Um e-mail não saiu depois das tentativas.' },
    falha_nf: { nome: 'Falha de nota fiscal', quando: 'A prefeitura ou o Asaas recusou uma nota.' },
    cupom_esgotando: {
      nome: 'Cupom perto de esgotar',
      quando: 'Um cupom com vagas já usou 80% delas.',
    },
  };

/** O que cada pessoa da equipe escolhe receber. */
export const alertasDaEquipeSchema = z.object({
  alertas: z.array(z.enum(TIPOS_ALERTA_EQUIPE)).max(TIPOS_ALERTA_EQUIPE.length),
});
export type AlertasDaEquipeEntrada = z.infer<typeof alertasDaEquipeSchema>;

/** Dados que a rotina junta para decidir os alertas. Datas em ISO. */
export interface DadosAlertasEquipe {
  contas: {
    id: string;
    nome: string;
    status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
    criadaEm: string;
    testeAte: string | null;
    interna: boolean;
    /** Última comanda fechada; null = nunca fechou. */
    ultimaFechadaEm: string | null;
  }[];
  faturas: {
    contaId: string;
    status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
    /** AAAA-MM-DD. */
    vencimento: string;
    valor: number;
  }[];
  whatsappCaido: { contaId: string; conta: string; caiuEm: string }[];
  emailsFalhos: { id: string; assunto: string; quando: string }[];
  notasComErro: { conta: string; numero: string | null; mensagem: string | null; quando: string }[];
  cupons: { codigo: string; vagas: number | null; usados: number }[];
}

export interface AlertaEquipe {
  tipo: TipoAlertaEquipe;
  /** Identifica o alerta: o mesmo tipo + chave nunca sai duas vezes. */
  chave: string;
  /** Uma linha para o e-mail. */
  texto: string;
}

const HORA = 3_600_000;
const DIA = 24 * HORA;

/**
 * Os alertas de agora. Olha só para trás o suficiente para a primeira execução não mandar o
 * histórico inteiro: cadastros de 2 dias, faturas vencidas há até 30 dias, falhas de 1 dia (e-mail)
 * e de 7 dias (nota). Conta interna nunca gera alerta.
 */
export function detectarAlertasEquipe(d: DadosAlertasEquipe, agora: Date): AlertaEquipe[] {
  const t = agora.getTime();
  const hoje = dataLocal(agora);
  const contas = new Map(d.contas.map((c) => [c.id, c]));
  const externa = (id: string) => {
    const c = contas.get(id);
    return c && !c.interna ? c : null;
  };
  const alertas: AlertaEquipe[] = [];

  for (const c of d.contas) {
    if (c.interna) continue;
    if (t - Date.parse(c.criadaEm) <= 2 * DIA)
      alertas.push({ tipo: 'cadastro_novo', chave: c.id, texto: `${c.nome} criou a conta.` });
    if (c.status === 'teste' && c.testeAte && !c.ultimaFechadaEm) {
      const falta = Date.parse(c.testeAte) - t;
      if (falta > 0 && falta <= 3 * DIA) {
        const dias = Math.ceil(falta / DIA);
        alertas.push({
          tipo: 'teste_acabando',
          chave: c.id,
          texto: `${c.nome}: o teste acaba em ${dias} ${dias === 1 ? 'dia' : 'dias'} e nenhuma comanda foi fechada.`,
        });
      }
    }
  }

  const limiteVencida = dataLocal(new Date(t - 30 * DIA));
  for (const f of d.faturas) {
    const c = externa(f.contaId);
    if (!c || (f.status !== 'aberta' && f.status !== 'recusada')) continue;
    if (f.vencimento >= hoje || f.vencimento < limiteVencida) continue;
    const [a, m, dd] = f.vencimento.split('-');
    alertas.push({
      tipo: 'cobranca_vencida',
      chave: `${f.contaId}:${f.vencimento}`,
      texto: `${c.nome}: fatura de ${formatarMoeda(f.valor)} venceu em ${dd}/${m}/${a}${f.status === 'recusada' ? ' (cartão recusado)' : ''}.`,
    });
  }

  for (const w of d.whatsappCaido) {
    if (!externa(w.contaId) || t - Date.parse(w.caiuEm) < 2 * HORA) continue;
    const horas = Math.floor((t - Date.parse(w.caiuEm)) / HORA);
    alertas.push({
      tipo: 'whatsapp_caido',
      chave: `${w.contaId}:${w.caiuEm}`,
      texto: `${w.conta}: o WhatsApp caiu há ${horas} horas e não voltou.`,
    });
  }

  for (const e of d.emailsFalhos) {
    if (t - Date.parse(e.quando) > DIA) continue;
    alertas.push({ tipo: 'falha_email', chave: e.id, texto: `Não saiu: "${e.assunto}".` });
  }

  for (const n of d.notasComErro) {
    if (t - Date.parse(n.quando) > 7 * DIA) continue;
    alertas.push({
      tipo: 'falha_nf',
      chave: `${n.conta}:${n.numero ?? ''}:${n.quando}`,
      texto: `${n.conta}: nota recusada${n.mensagem ? ` (${n.mensagem})` : ''}.`,
    });
  }

  for (const c of d.cupons) {
    if (!c.vagas || c.usados < Math.ceil(c.vagas * 0.8)) continue;
    const esgotou = c.usados >= c.vagas;
    alertas.push({
      tipo: 'cupom_esgotando',
      // Uma vez ao chegar em 80% e outra quando esgota.
      chave: `${c.codigo}:${esgotou ? 'esgotou' : '80'}`,
      texto: esgotou
        ? `Cupom ${c.codigo} esgotou: ${c.usados} de ${c.vagas} vagas.`
        : `Cupom ${c.codigo} perto de esgotar: ${c.usados} de ${c.vagas} vagas.`,
    });
  }
  return alertas;
}

/** O e-mail de uma pessoa da equipe com os alertas que ela escolheu; null = nada para ela. */
export function emailDeAlertasEquipe(
  alertas: readonly AlertaEquipe[],
  escolhidos: readonly TipoAlertaEquipe[],
  linkAdmin: string,
): { assunto: string; texto: string } | null {
  const dela = alertas.filter((a) => escolhidos.includes(a.tipo));
  if (dela.length === 0) return null;
  const grupos = TIPOS_ALERTA_EQUIPE.map((tipo) => ({
    tipo,
    itens: dela.filter((a) => a.tipo === tipo),
  })).filter((g) => g.itens.length > 0);
  const assunto =
    dela.length === 1
      ? `Pente Fino: ${ALERTAS_EQUIPE[dela[0]!.tipo].nome.toLowerCase()}`
      : `Pente Fino: ${dela.length} alertas para a equipe`;
  const texto = [
    ...grupos.flatMap((g) => [
      `${ALERTAS_EQUIPE[g.tipo].nome}:`,
      ...g.itens.map((a) => `- ${a.texto}`),
      '',
    ]),
    `Abrir a administração: ${linkAdmin}`,
    'Para mudar os alertas que você recebe: Administração → Equipe → Meus alertas.',
  ].join('\n');
  return { assunto, texto };
}

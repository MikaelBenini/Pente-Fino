// Histórico da comanda (seção 7): a linha do tempo do que aconteceu com ela, para o balcão e o
// dono entenderem uma comanda sem perguntar a ninguém. Junta os horários da própria comanda, os
// itens, os pagamentos e a auditoria (fechar, reabrir com motivo, cancelar, falta...).
import { formatarMoeda } from './formatacao.js';
import { NOME_FORMA, type FormaPagamento } from './esquemas-operacao.js';

export interface EventoComanda {
  quando: string;
  texto: string;
  quem: string | null;
  tom: 'neutro' | 'aviso' | 'perigo';
}

export interface DadosHistoricoComanda {
  criadaEm: string;
  iniciadaEm: string | null;
  confirmadaEm: string | null;
  confirmadaPor: string | null;
  fechadaEm: string | null;
  fechadaPor: string | null;
  itens: { nome: string; criadoEm: string }[];
  pagamentos: {
    forma: FormaPagamento;
    valor: number;
    criadoEm: string;
    sinal: boolean;
    devolvidoEm: string | null;
  }[];
  auditoria: { acao: string; criadoEm: string; quem: string | null; motivo: string | null }[];
}

/** O que cada ação da auditoria quer dizer para quem lê. */
const ACOES: Record<string, { texto: string; tom: EventoComanda['tom'] }> = {
  fechar: { texto: 'Comanda fechada', tom: 'neutro' },
  reabrir: { texto: 'Comanda reaberta', tom: 'aviso' },
  cancelar: { texto: 'Comanda cancelada', tom: 'perigo' },
  falta: { texto: 'Marcada como falta', tom: 'perigo' },
  nao_veio: { texto: 'Cliente não veio', tom: 'perigo' },
  desfazer_nao_veio: { texto: 'Desfeito o "não veio"', tom: 'aviso' },
  preco_livre: { texto: 'Preço de item digitado fora da tabela', tom: 'aviso' },
  receber_sinal: { texto: 'Sinal recebido', tom: 'neutro' },
  devolver_sinal: { texto: 'Sinal devolvido', tom: 'aviso' },
};

/** Itens lançados até 10 s depois de abrir contam como a abertura. */
const JANELA_ABERTURA_MS = 10_000;

const juntar = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

export function historicoDaComanda(d: DadosHistoricoComanda): EventoComanda[] {
  const r: EventoComanda[] = [];
  const t0 = Date.parse(d.criadaEm);
  const naAbertura = d.itens.filter((i) => Date.parse(i.criadoEm) - t0 <= JANELA_ABERTURA_MS);
  r.push({
    quando: d.criadaEm,
    texto: naAbertura.length
      ? `Comanda aberta com ${juntar(naAbertura.map((i) => i.nome.toLowerCase()))}`
      : 'Comanda aberta',
    quem: null,
    tom: 'neutro',
  });
  for (const i of d.itens.filter((x) => !naAbertura.includes(x)))
    r.push({ quando: i.criadoEm, texto: `Lançado: ${i.nome}`, quem: null, tom: 'neutro' });
  if (d.iniciadaEm)
    r.push({ quando: d.iniciadaEm, texto: 'Atendimento começou', quem: null, tom: 'neutro' });
  if (d.confirmadaEm)
    r.push({
      quando: d.confirmadaEm,
      texto: 'Barbeiro confirmou o atendimento',
      quem: d.confirmadaPor,
      tom: 'neutro',
    });
  // Sinal recebido e devolvido já entram pela auditoria; aqui, os demais pagamentos.
  for (const p of d.pagamentos.filter((x) => !x.sinal))
    r.push({
      quando: p.criadoEm,
      texto: `Pagamento de ${formatarMoeda(p.valor)} no ${NOME_FORMA[p.forma].toLowerCase()}`,
      quem: null,
      tom: 'neutro',
    });
  for (const a of d.auditoria) {
    const acao = ACOES[a.acao];
    if (!acao) continue;
    const sinal = a.acao === 'receber_sinal' || a.acao === 'devolver_sinal';
    const valorSinal = sinal
      ? d.pagamentos.find(
          (p) => p.sinal && Math.abs(Date.parse(p.criadoEm) - Date.parse(a.criadoEm)) < 5_000,
        )
      : undefined;
    r.push({
      quando: a.criadoEm,
      texto: `${acao.texto}${valorSinal ? ` (${formatarMoeda(valorSinal.valor)})` : ''}${a.motivo ? `: ${a.motivo}` : ''}`,
      quem: a.quem,
      tom: acao.tom,
    });
  }
  // Sem a auditoria do fechamento (comanda antiga), o horário da própria comanda conta.
  if (d.fechadaEm && !d.auditoria.some((a) => a.acao === 'fechar'))
    r.push({ quando: d.fechadaEm, texto: 'Comanda fechada', quem: d.fechadaPor, tom: 'neutro' });
  return r.sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
}

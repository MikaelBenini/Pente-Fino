import type { LinhaContaPlataforma } from '@pente-fino/db';
import {
  origemCadastroSchema,
  resumoDaOrigem,
  type ContaNaPlataforma,
  type EtapaFunil,
  type SaudeConta,
} from '@pente-fino/shared';

const iso = (d: Date | null) => d?.toISOString() ?? null;
const dia = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** Linha de plataforma_contas() como a administração mostra (sem dado de cliente). */
/** `etapaFunil` vem do funil (admin F1c) e `saude` da nota (admin F4); sem eles, null. */
export function contaParaTela(
  c: LinhaContaPlataforma,
  extra: { etapaFunil?: EtapaFunil | null; saude?: SaudeConta | null } = {},
): ContaNaPlataforma {
  return {
    etapaFunil: extra.etapaFunil ?? null,
    saude: extra.saude ?? null,
    id: c.id,
    nome: c.nome,
    plano: c.plano,
    ciclo: c.ciclo,
    status: c.status,
    criadaEm: c.criado_em.toISOString(),
    testeAte: iso(c.teste_ate),
    configuradaEm: iso(c.configurada_em),
    cobrancaAutomatica: c.cobranca_automatica,
    canceladaEm: iso(c.cancelada_em),
    motivoCancelamento: c.motivo_cancelamento,
    vendedorId: c.vendedor_id,
    donoAtivou: c.dono_ativou,
    unidades: c.unidades,
    profissionais: c.profissionais,
    whatsappConectado: c.whatsapp_conectado,
    fechadas7Dias: c.fechadas_7_dias,
    ultimaFechadaEm: iso(c.ultima_fechada_em),
    ultimoAcessoEm: iso(c.ultimo_acesso_em),
    interna: c.interna,
    cortesiaAte: dia(c.cortesia_ate),
    cobrarAPartirDe: dia(c.cobrar_a_partir_de),
    origem: resumoDaOrigem(origemCadastroSchema.safeParse(c.origem).data),
    ativacao: Number(c.ativacao) || 0,
  };
}

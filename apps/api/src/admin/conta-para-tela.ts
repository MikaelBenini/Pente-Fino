import type { LinhaContaPlataforma } from '@pente-fino/db';
import type { ContaNaPlataforma } from '@pente-fino/shared';

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Linha de plataforma_contas() como a administração mostra (sem dado de cliente). */
export function contaParaTela(c: LinhaContaPlataforma): ContaNaPlataforma {
  return {
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
  };
}

import { precoServicoVigente, type Prisma, type Transacao } from '@pente-fino/db';
import {
  dataLocal,
  fotosDoSite,
  horarioDaUnidade,
  linkWhatsappDaUnidade,
  notaDoSite,
  type SiteBarbearia,
  type SitePublico,
} from '@pente-fino/shared';
import { umPorVez } from '../comum/sequencia.js';

type UnidadeDoSite = Prisma.UnidadeGetPayload<object>;

/**
 * Junta o conteúdo do dono (rascunho ou publicado) com os dados vivos da unidade: serviços com
 * preço, equipe ativa, horário pelo expediente e a nota dos últimos 12 meses. Roda dentro da
 * conta (naConta), igual à página de agendamento.
 */
export async function montarSitePublico(
  tx: Transacao,
  u: UnidadeDoSite,
  site: SiteBarbearia,
): Promise<SitePublico> {
  const hoje = dataLocal(new Date());
  const conta = await tx.conta.findUniqueOrThrow({ where: { id: u.contaId } });
  const servicos = await tx.servico.findMany({
    where: { ativo: true, unidadeIds: { has: u.id } },
    orderBy: [{ ehExtra: 'asc' }, { categoria: 'asc' }, { nome: 'asc' }],
  });
  const comPreco = await umPorVez(servicos, async (s) => ({
    id: s.id,
    nome: s.nome,
    categoria: s.categoria,
    duracaoMin: s.duracaoMin,
    ehExtra: s.ehExtra,
    preco: (await precoServicoVigente(tx, s.id, u.id, hoje)) ?? null,
  }));
  const profissionais = await tx.profissional.findMany({
    where: { unidadeId: u.id, ativo: true },
    include: { usuario: { select: { nome: true } }, horarios: true },
    orderBy: { usuario: { nome: 'asc' } },
  });
  const umAnoAtras = new Date(Date.now() - 365 * 86_400_000);
  const notas = await tx.avaliacao.findMany({
    where: {
      unidadeId: u.id,
      status: 'respondida',
      notaBarbearia: { not: null },
      respondidaEm: { gte: umAnoAtras },
    },
    select: { notaBarbearia: true },
  });
  const ids = fotosDoSite(site);
  const fotos = ids.length
    ? await tx.fotoSite.findMany({
        where: { id: { in: ids } },
        select: { id: true, largura: true, altura: true },
      })
    : [];
  return {
    slug: u.siteSlug ?? '',
    // Vazio = link de agendamento desligado: o site mostra o WhatsApp no lugar de "Agendar".
    slugAgendamento: u.agendamentoPublico && u.slug ? u.slug : '',
    barbearia: conta.nome,
    unidade: u.nome,
    site,
    endereco: u.endereco,
    telefone: u.telefone,
    whatsapp: linkWhatsappDaUnidade(u.telefone),
    aparecerNoGoogle: u.aparecerNoGoogle,
    // Só o que tem preço na unidade pode ser agendado: o resto não aparece no site.
    servicos: comPreco.flatMap((s) => (s.preco === null ? [] : [{ ...s, preco: s.preco }])),
    equipe: profissionais.map((p) => ({
      id: p.id,
      nome: p.usuario.nome.split(' ')[0]!,
      foco: site.equipe[p.id]?.foco ?? '',
      sobre: site.equipe[p.id]?.sobre ?? '',
      servicoIds: p.servicoIds,
    })),
    horario: horarioDaUnidade(
      profissionais.flatMap((p) => p.horarios),
      u.diasTrabalho,
    ),
    nota: notaDoSite(notas.map((n) => n.notaBarbearia!)),
    fotos: Object.fromEntries(fotos.map((f) => [f.id, { largura: f.largura, altura: f.altura }])),
  };
}

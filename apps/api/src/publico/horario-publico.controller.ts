import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cancelarPeloCliente,
  estadoAssinatura,
  hashTokenHorario,
  remarcarPeloCliente,
  type Transacao,
} from '@pente-fino/db';
import {
  consultaHorariosDoLink,
  dataLocal,
  decidirLink,
  lerRegrasAgendamento,
  remarcarPeloLinkSchema,
  type EsperaPublicaCriada,
  type HorarioDoLink,
  type HorarioLivre,
  type RemarcarPeloLinkEntrada,
  temRecurso,
} from '@pente-fino/shared';
import { z } from 'zod';
import { AgendaService, traduzir } from '../agenda/agenda.service.js';
import { avisarEquipe, liberarVaga } from '../agenda/aviso-equipe.js';
import { LimiteAutenticacao, Publico } from '../auth/decoradores.js';
import { ativacaoDosAvisos } from './publico.controller.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { Filas } from '../filas/filas.module.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';

const tokenParam = new PipeZod(z.string().regex(/^[A-Za-z0-9_-]{20,40}$/, 'Link inválido.'));
const NAO_ACHOU = 'Este link não abre mais. Fale com a barbearia ou marque de novo.';

/**
 * Link do cliente para o próprio horário (/horario?t=token), sem login: ver, remarcar com o
 * mesmo serviço e profissional, ou cancelar, dentro do prazo da unidade. O token só dá acesso
 * àquele horário (RLS por hash do token para achar a conta, depois tudo dentro da conta).
 */
@ApiTags('Público (sem login)')
@Controller('publico/horario')
export class HorarioPublicoController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(AgendaService) private readonly agenda: AgendaService,
    @Inject(Filas) private readonly filas: Filas,
  ) {}

  /** Conta e agendamento do token (404 se não existe ou foi trocado por um link novo). */
  private async link(token: string) {
    const l = await this.banco.semConta({ tokenHorario: hashTokenHorario(token) }, (tx) =>
      tx.linkHorario.findUnique({ where: { tokenHash: hashTokenHorario(token) } }),
    );
    if (!l) throw Erros.naoEncontrado(NAO_ACHOU);
    return l;
  }

  private async carregar(tx: Transacao, agendamentoId: string, agora = new Date()) {
    const ag = await tx.agendamento.findUnique({
      where: { id: agendamentoId },
      include: {
        unidade: true,
        profissional: { include: { usuario: true } },
        comanda: { include: { itens: { include: { servico: true } } } },
      },
    });
    if (!ag) throw Erros.naoEncontrado(NAO_ACHOU);
    const regras = lerRegrasAgendamento(ag.unidade.regrasAgendamento);
    const decisao = decidirLink({
      status: ag.status,
      comandaPrevista: ag.comanda?.status === 'prevista',
      inicio: ag.inicio,
      agora,
      prazoMudarMin: regras.prazoMudarMin,
    });
    return { ag, regras, decisao };
  }

  private exigirQuePode(decisao: { podeMudar: boolean; motivo: string | null }) {
    if (!decisao.podeMudar) throw Erros.conflito(decisao.motivo ?? 'Não dá para mudar por aqui.');
  }

  @Get(':token')
  @Publico()
  @ApiOperation({ summary: 'O horário do link: quando, com quem, e se ainda dá para mudar' })
  async ver(@Param('token', tokenParam) token: string): Promise<HorarioDoLink> {
    const l = await this.link(token);
    return this.banco.naConta(l.contaId, async (tx) => {
      const { ag, regras, decisao } = await this.carregar(tx, l.agendamentoId);
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: l.contaId } });
      return {
        barbearia: conta.nome,
        unidade: ag.unidade.nome,
        endereco: ag.unidade.endereco,
        linkWhatsapp: ag.unidade.telefone ? `https://wa.me/${ag.unidade.telefone}` : null,
        inicio: ag.inicio.toISOString(),
        fim: ag.fim.toISOString(),
        servicos: (ag.comanda?.itens ?? []).map((i) => i.servico?.nome ?? 'Serviço'),
        total: ag.comanda?.totalLiquido ?? 0,
        profissional: ag.profissional.usuario.nome.split(' ')[0]!,
        ...decisao,
        janelaDias: regras.janelaDias,
      };
    });
  }

  @Get(':token/horarios')
  @Publico()
  @ApiOperation({ summary: 'Horários livres para remarcar (mesmo serviço e profissional)' })
  async horarios(
    @Param('token', tokenParam) token: string,
    @Consulta(consultaHorariosDoLink) c: z.infer<typeof consultaHorariosDoLink>,
  ): Promise<HorarioLivre[]> {
    const l = await this.link(token);
    return this.banco.naConta(l.contaId, async (tx) => {
      const { ag, regras, decisao } = await this.carregar(tx, l.agendamentoId);
      this.exigirQuePode(decisao);
      this.exigirJanela(c.data, regras.janelaDias);
      const duracao = Math.round((ag.fim.getTime() - ag.inicio.getTime()) / 60_000);
      return this.agenda.calcularLivres(tx, ag.unidadeId, c.data, duracao, ag.profissionalId, {
        antecedenciaMin: regras.antecedenciaMin,
        ignorar: ag.id,
      });
    });
  }

  @Post(':token/remarcar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remarcar pelo link (mesmo serviço e profissional)' })
  async remarcar(
    @Param('token', tokenParam) token: string,
    @Corpo(remarcarPeloLinkSchema) d: RemarcarPeloLinkEntrada,
  ): Promise<HorarioDoLink> {
    const l = await this.link(token);
    const inicio = new Date(d.inicio);
    let liberado: { unidadeId: string; profissionalId: string; inicio: Date; fim: Date } | null =
      null;
    const comandaId = await this.banco.naConta(l.contaId, async (tx) => {
      if ((await estadoAssinatura(tx)).somenteLeitura)
        throw Erros.conflito('Por aqui não dá para mudar agora. Fale com a barbearia.');
      const { regras, decisao } = await this.carregar(tx, l.agendamentoId);
      this.exigirQuePode(decisao);
      this.exigirJanela(dataLocal(inicio), regras.janelaDias);
      if (inicio.getTime() < Date.now() + regras.antecedenciaMin * 60_000)
        throw Erros.requisicaoInvalida('horario_passado', 'Este horário não está mais livre.');
      const r = await traduzir(() => remarcarPeloCliente(tx, l.agendamentoId, inicio, 'link'));
      liberado = { unidadeId: r.unidadeId, ...r.antes };
      return r.comandaId;
    });
    if (liberado) await liberarVaga(this.filas, l.contaId, liberado);
    await this.agenda.agendarLembretes(l.contaId, comandaId);
    await avisarEquipe(this.banco, this.filas, l.contaId, l.agendamentoId, 'remarcado');
    return this.ver(token);
  }

  @Post(':token/antecipar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '"Me avise se vagar antes": entra na lista para antecipar este horário',
  })
  async antecipar(@Param('token', tokenParam) token: string): Promise<EsperaPublicaCriada> {
    const l = await this.link(token);
    return this.banco.naConta(l.contaId, async (tx) => {
      const { ag, decisao } = await this.carregar(tx, l.agendamentoId);
      this.exigirQuePode(decisao);
      if (!temRecurso((await estadoAssinatura(tx)).plano, 'listaEspera'))
        throw Erros.conflito('Esta barbearia não usa lista de espera.');
      const cliente = ag.clienteId
        ? await tx.cliente.findUnique({ where: { id: ag.clienteId } })
        : null;
      if (!cliente?.consentimentoMsg || !cliente.telefone)
        throw Erros.conflito('O aviso vai pelo WhatsApp: aceite receber mensagens ao marcar.');
      const dia = new Date(`${dataLocal(ag.inicio)}T00:00:00.000Z`);
      const ja = await tx.listaEspera.findFirst({
        where: { agendamentoId: ag.id, status: { in: ['aguardando', 'oferecido'] } },
      });
      if (!ja) {
        const local = new Date(ag.inicio.getTime() - 3 * 3_600_000);
        const minuto = local.getUTCHours() * 60 + local.getUTCMinutes();
        await tx.listaEspera.create({
          data: {
            unidadeId: ag.unidadeId,
            clienteId: cliente.id,
            profissionalId: ag.profissionalId,
            servicoIds: (ag.comanda?.itens ?? []).flatMap((i) =>
              i.servicoId ? [i.servicoId] : [],
            ),
            dia,
            deMin: 0,
            ateMin: Math.max(0, minuto - 15),
            origem: 'antecipar',
            agendamentoId: ag.id,
          },
        });
      }
      return ativacaoDosAvisos(tx, ag.unidadeId, cliente.telefone);
    });
  }

  @Post(':token/cancelar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar pelo link (libera o horário, não conta como falta)' })
  async cancelar(@Param('token', tokenParam) token: string): Promise<HorarioDoLink> {
    const l = await this.link(token);
    const liberado = await this.banco.naConta(l.contaId, async (tx) => {
      const { decisao } = await this.carregar(tx, l.agendamentoId);
      this.exigirQuePode(decisao);
      return traduzir(() => cancelarPeloCliente(tx, l.agendamentoId, 'link'));
    });
    await liberarVaga(this.filas, l.contaId, liberado);
    await avisarEquipe(this.banco, this.filas, l.contaId, l.agendamentoId, 'cancelado');
    return this.ver(token);
  }

  private exigirJanela(dia: string, janelaDias: number) {
    const hoje = dataLocal(new Date());
    const limite = new Date(`${hoje}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + janelaDias);
    if (dia < hoje || dia > limite.toISOString().slice(0, 10))
      throw Erros.validacao([
        { campo: 'data', mensagem: `Escolha um dia entre hoje e os próximos ${janelaDias} dias.` },
      ]);
  }
}

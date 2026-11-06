import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Transacao } from '@pente-fino/db';
import {
  esperaSchema,
  type EsperaDetalhe,
  type EsperaEntrada,
  type OrigemEspera,
  type StatusEspera,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';

const BALCAO = ['dono', 'gestor', 'recepcao'] as const;
const consultaEspera = z.object({ unidadeId: z.uuid(), dia: z.iso.date() });

/**
 * Lista de espera no balcão: quem quer um horário no dia, numa faixa, com um profissional (ou
 * qualquer um). Quando vaga um horário que cabe, o worker oferece pelo WhatsApp, na ordem.
 */
@ApiTags('Agenda')
@ApiBearerAuth()
@Controller('espera')
export class EsperaController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @Papeis(...BALCAO)
  @ApiOperation({ summary: 'Lista de espera do dia na unidade, na ordem de chegada' })
  listar(@Consulta(consultaEspera) q: z.infer<typeof consultaEspera>): Promise<EsperaDetalhe[]> {
    exigirUnidade(q.unidadeId, [...BALCAO]);
    return this.banco.daConta(async (tx) => {
      const lista = await tx.listaEspera.findMany({
        where: {
          unidadeId: q.unidadeId,
          dia: data(q.dia),
          status: { in: ['aguardando', 'oferecido'] },
        },
        orderBy: { criadoEm: 'asc' },
        include: {
          cliente: { select: { id: true, nome: true } },
          profissional: { include: { usuario: { select: { nome: true } } } },
        },
      });
      const servicos = await tx.servico.findMany({
        where: { id: { in: [...new Set(lista.flatMap((l) => l.servicoIds))] } },
        select: { id: true, nome: true },
      });
      const profs = await tx.profissional.findMany({
        where: { unidadeId: q.unidadeId },
        include: { usuario: { select: { nome: true } } },
      });
      const nomeProf = (id: string) => profs.find((p) => p.id === id)?.usuario.nome ?? '—';
      return lista.map((l) => {
        const oferta = l.oferta as { inicio: string; profissionalId: string } | null;
        return {
          id: l.id,
          cliente: l.cliente,
          profissional: l.profissional?.usuario.nome ?? null,
          servicos: l.servicoIds.map((id) => servicos.find((s) => s.id === id)?.nome ?? 'Serviço'),
          dia: dataTexto(l.dia),
          deMin: l.deMin,
          ateMin: l.ateMin,
          origem: l.origem as OrigemEspera,
          status: l.status as StatusEspera,
          oferta:
            l.status === 'oferecido' && oferta
              ? { inicio: oferta.inicio, profissional: nomeProf(oferta.profissionalId) }
              : null,
          criadoEm: l.criadoEm.toISOString(),
        };
      });
    });
  }

  private async cliente(tx: Transacao, d: EsperaEntrada): Promise<string> {
    if (d.clienteId) {
      if (!(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      return d.clienteId;
    }
    const telefone = d.clienteNovo!.telefone?.replace(/\D/g, '');
    const c = await tx.cliente.create({
      data: {
        nome: d.clienteNovo!.nome,
        telefone: telefone ? (telefone.length <= 11 ? `55${telefone}` : telefone) : null,
        unidadeOrigemId: d.unidadeId,
      },
    });
    return c.id;
  }

  @Post()
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Pôr o cliente na lista de espera do dia' })
  async incluir(@Corpo(esperaSchema) d: EsperaEntrada): Promise<{ id: string }> {
    exigirUnidade(d.unidadeId, [...BALCAO]);
    return this.banco.daConta(async (tx) => {
      if (d.profissionalId) {
        const p = await tx.profissional.findUnique({ where: { id: d.profissionalId } });
        if (!p || p.unidadeId !== d.unidadeId || !p.ativo)
          throw Erros.naoEncontrado('Profissional não encontrado nesta unidade.');
      }
      const servicos = await tx.servico.count({ where: { id: { in: d.servicoIds }, ativo: true } });
      if (servicos !== new Set(d.servicoIds).size)
        throw Erros.naoEncontrado('Serviço não encontrado.');
      const clienteId = await this.cliente(tx, d);
      const e = await tx.listaEspera.create({
        data: {
          unidadeId: d.unidadeId,
          clienteId,
          profissionalId: d.profissionalId,
          servicoIds: d.servicoIds,
          dia: data(d.dia),
          deMin: d.deMin,
          ateMin: d.ateMin,
          origem: 'balcao',
          criadoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'lista_espera',
        entidadeId: e.id,
        acao: 'incluir',
        depois: { ...d, clienteId },
      });
      return { id: e.id };
    });
  }

  @Post(':id/cancelar')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tirar da lista de espera' })
  async cancelar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const e = await tx.listaEspera.findUnique({ where: { id } });
      if (!e) throw Erros.naoEncontrado('Pedido não encontrado na lista.');
      exigirUnidade(e.unidadeId, [...BALCAO]);
      await tx.listaEspera.update({ where: { id }, data: { status: 'cancelado' } });
      await auditar(tx, {
        entidade: 'lista_espera',
        entidadeId: id,
        acao: 'cancelar',
        antes: { status: e.status },
        depois: { status: 'cancelado' },
      });
    });
  }
}

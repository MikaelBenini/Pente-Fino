import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hashCodigoAssistente, type Prisma, type Transacao } from '@pente-fino/db';
import {
  avisosEquipeSchema,
  CODIGO_ASSISTENTE_VALIDADE_MIN,
  lerAvisosEquipe,
  type AvisosEquipe,
  type CodigoAssistente,
  type EstadoAssistente,
} from '@pente-fino/shared';
import { randomInt } from 'node:crypto';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { TODOS } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';

/**
 * Assistente da equipe no WhatsApp, pelo Perfil: o profissional liga (gera um código e manda
 * "ATIVAR código" para o WhatsApp da unidade), escolhe os avisos e desliga.
 */
@ApiTags('Área do barbeiro')
@ApiBearerAuth()
@Controller('me/assistente')
export class AssistenteController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  /** A unidade onde o profissional atende (a primeira ativa) e o WhatsApp dela. */
  private async ondeAtende(tx: Transacao) {
    const p = await tx.profissional.findFirst({
      where: { usuarioId: Contexto.usuario().id, ativo: true },
      orderBy: { criadoEm: 'asc' },
      include: { unidade: { include: { botConexao: true } } },
    });
    if (!p) throw Erros.naoEncontrado('O assistente é para quem está na agenda de uma unidade.');
    return p;
  }

  private async estado(tx: Transacao): Promise<EstadoAssistente> {
    const p = await this.ondeAtende(tx);
    const a = await tx.assistenteEquipe.findUnique({ where: { usuarioId: Contexto.usuario().id } });
    const conexao = p.unidade.botConexao;
    const aguardando = !!a?.codigoExpiraEm && a.codigoExpiraEm > new Date();
    return {
      situacao: a?.confirmadoEm
        ? a.ativo
          ? 'ligado'
          : 'pausado'
        : aguardando
          ? 'aguardando'
          : 'desligado',
      unidade: p.unidade.nome,
      numeroBarbearia: conexao?.numero ?? null,
      whatsappConectado: conexao?.status === 'conectado',
      telefone: a?.confirmadoEm ? a.telefone : null,
      avisos: lerAvisosEquipe(a?.avisos),
      codigoExpiraEm: aguardando ? a!.codigoExpiraEm!.toISOString() : null,
    };
  }

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Situação do assistente da equipe no WhatsApp' })
  ver(): Promise<EstadoAssistente> {
    return this.banco.daConta((tx) => this.estado(tx));
  }

  @Post()
  @Papeis(...TODOS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ligar: gera o código para mandar ao WhatsApp da unidade ("ATIVAR código")',
  })
  ligar(): Promise<CodigoAssistente> {
    return this.banco.daConta(async (tx) => {
      const p = await this.ondeAtende(tx);
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiraEm = new Date(Date.now() + CODIGO_ASSISTENTE_VALIDADE_MIN * 60_000);
      const dados = {
        unidadeId: p.unidadeId,
        codigoHash: hashCodigoAssistente(codigo),
        codigoExpiraEm: expiraEm,
      };
      await tx.assistenteEquipe.upsert({
        where: { usuarioId: Contexto.usuario().id },
        create: { usuarioId: Contexto.usuario().id, ...dados },
        update: dados,
      });
      const numero = p.unidade.botConexao?.numero;
      return {
        codigo,
        expiraEm: expiraEm.toISOString(),
        link: numero
          ? `https://wa.me/${numero}?text=${encodeURIComponent(`ATIVAR ${codigo}`)}`
          : null,
      };
    });
  }

  @Put('avisos')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Escolher os avisos que o assistente manda' })
  avisos(@Corpo(avisosEquipeSchema) avisos: AvisosEquipe): Promise<EstadoAssistente> {
    return this.banco.daConta(async (tx) => {
      await this.ondeAtende(tx);
      const a = await tx.assistenteEquipe.findUnique({
        where: { usuarioId: Contexto.usuario().id },
      });
      if (!a) throw Erros.naoEncontrado('Ligue o assistente primeiro.');
      await tx.assistenteEquipe.update({
        where: { id: a.id },
        data: { avisos: avisos as unknown as Prisma.InputJsonValue },
      });
      return this.estado(tx);
    });
  }

  @Delete()
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Desligar: o número deixa de ser do assistente' })
  desligar(): Promise<EstadoAssistente> {
    return this.banco.daConta(async (tx) => {
      await tx.assistenteEquipe.updateMany({
        where: { usuarioId: Contexto.usuario().id },
        data: {
          telefone: null,
          confirmadoEm: null,
          ativo: false,
          codigoHash: null,
          codigoExpiraEm: null,
        },
      });
      return this.estado(tx);
    });
  }
}

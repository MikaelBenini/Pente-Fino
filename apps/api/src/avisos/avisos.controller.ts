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
import { PAPEIS, type CaixaDeAvisos, type TipoAviso } from '@pente-fino/shared';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';

/** Quantos avisos o histórico mostra. */
const LIMITE_HISTORICO = 100;

@ApiTags('Avisos')
@ApiBearerAuth()
@Controller('avisos')
export class AvisosController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @Papeis(...PAPEIS)
  @ApiOperation({ summary: 'Meus avisos (os mais novos primeiro) e quantos ainda não li' })
  listar(): Promise<CaixaDeAvisos> {
    const usuarioId = Contexto.usuario().id;
    return this.banco.daConta(async (tx) => {
      const [avisos, naoLidos] = await Promise.all([
        tx.aviso.findMany({
          where: { usuarioId },
          orderBy: { criadoEm: 'desc' },
          take: LIMITE_HISTORICO,
        }),
        tx.aviso.count({ where: { usuarioId, lidoEm: null } }),
      ]);
      return {
        naoLidos,
        avisos: avisos.map((a) => ({
          id: a.id,
          tipo: a.tipo as TipoAviso,
          titulo: a.titulo,
          texto: a.texto,
          link: a.link,
          criadoEm: a.criadoEm.toISOString(),
          lidoEm: a.lidoEm?.toISOString() ?? null,
        })),
      };
    });
  }

  @Post('lidos')
  @Papeis(...PAPEIS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todos os meus avisos como lidos' })
  async marcarTodos(): Promise<void> {
    const usuarioId = Contexto.usuario().id;
    await this.banco.daConta((tx) =>
      tx.aviso.updateMany({ where: { usuarioId, lidoEm: null }, data: { lidoEm: new Date() } }),
    );
  }

  @Post(':id/lido')
  @Papeis(...PAPEIS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar um aviso como lido' })
  async marcar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const usuarioId = Contexto.usuario().id;
    await this.banco.daConta((tx) =>
      tx.aviso.updateMany({ where: { id, usuarioId, lidoEm: null }, data: { lidoEm: new Date() } }),
    );
  }
}

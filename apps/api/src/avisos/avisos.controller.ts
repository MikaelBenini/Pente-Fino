import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  lerPreferenciasAvisos,
  PAPEIS,
  preferenciasAvisosSchema,
  tiposDoPapel,
  type CaixaDeAvisos,
  type PreferenciasAvisos,
  type TipoAviso,
} from '@pente-fino/shared';
import { Corpo } from '../comum/validacao.js';
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

  @Get('preferencias')
  @Papeis(...PAPEIS)
  @ApiOperation({ summary: 'Quais avisos vão para o celular e se o resumo vai por e-mail' })
  preferencias(): Promise<PreferenciasAvisos & { tipos: TipoAviso[] }> {
    const u = Contexto.usuario();
    return this.banco.daConta(async (tx) => {
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id } });
      return {
        ...lerPreferenciasAvisos(usuario.preferenciasAvisos),
        tipos: tiposDoPapel(u.papeis.map((p) => p.papel)),
      };
    });
  }

  @Put('preferencias')
  @Papeis(...PAPEIS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Salvar as preferências de avisos (só da própria pessoa)' })
  async salvarPreferencias(@Corpo(preferenciasAvisosSchema) d: PreferenciasAvisos): Promise<void> {
    const id = Contexto.usuario().id;
    await this.banco.daConta((tx) =>
      tx.usuario.update({ where: { id }, data: { preferenciasAvisos: d } }),
    );
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

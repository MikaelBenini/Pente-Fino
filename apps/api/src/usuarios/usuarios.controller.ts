import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  convidarUsuarioSchema,
  papeisUsuarioSchema,
  situacaoUsuarioSchema,
  type ConvidarUsuarioEntrada,
  type PapeisUsuarioEntrada,
  type UsuarioEquipe,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { Corpo } from '../comum/validacao.js';
import { ConvitesService, type ConviteCriado } from './convites.service.js';
import { UsuariosService } from './usuarios.service.js';
import { EmailConfirmadoGuard } from '../auth/email-confirmado.guard.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(ConvitesService) private readonly convites: ConvitesService,
    @Inject(UsuariosService) private readonly usuarios: UsuariosService,
  ) {}

  @Get()
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Equipe: usuários, papéis e situação (gestor vê só a unidade dele)' })
  listar(): Promise<UsuarioEquipe[]> {
    return this.usuarios.listar();
  }

  @Post('convites')
  @UseGuards(EmailConfirmadoGuard)
  @Papeis('dono', 'gestor')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convidar alguém para a equipe (e-mail e link de WhatsApp)' })
  convidar(@Corpo(convidarUsuarioSchema) dados: ConvidarUsuarioEntrada): Promise<ConviteCriado> {
    return this.convites.convidar(dados);
  }

  @Put(':id/papeis')
  @Papeis('dono', 'gestor')
  @Auditada()
  @ApiOperation({ summary: 'Trocar os papéis de um usuário (encerra as sessões dele)' })
  definirPapeis(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(papeisUsuarioSchema) dados: PapeisUsuarioEntrada,
  ): Promise<UsuarioEquipe> {
    return this.usuarios.definirPapeis(id, dados);
  }

  @Patch(':id')
  @Papeis('dono', 'gestor')
  @Auditada()
  @ApiOperation({ summary: 'Desativar ou reativar o acesso de um usuário' })
  definirSituacao(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(situacaoUsuarioSchema) { ativo }: z.infer<typeof situacaoUsuarioSchema>,
  ): Promise<UsuarioEquipe> {
    return this.usuarios.definirSituacao(id, ativo);
  }
}

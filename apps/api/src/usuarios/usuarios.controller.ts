import { Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { convidarUsuarioSchema, type ConvidarUsuarioEntrada } from '@pente-fino/shared';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { Corpo } from '../comum/validacao.js';
import { ConvitesService, type ConviteCriado } from './convites.service.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(@Inject(ConvitesService) private readonly convites: ConvitesService) {}

  @Post('convites')
  @Papeis('dono', 'gestor')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convidar alguém para a equipe (e-mail e link de WhatsApp)' })
  convidar(@Corpo(convidarUsuarioSchema) dados: ConvidarUsuarioEntrada): Promise<ConviteCriado> {
    return this.convites.convidar(dados);
  }
}

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
import {
  listarConversasSchema,
  responderConversaSchema,
  type ListaConversas,
  type MensagemDoCliente,
  type ResponderConversaEntrada,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { ConversasService, QUEM_CONVERSA } from './conversas.service.js';

@ApiTags('Conversas do bot')
@ApiBearerAuth()
@Controller('conversas')
export class ConversasController {
  constructor(@Inject(ConversasService) private readonly servico: ConversasService) {}

  @Get()
  @Papeis(...QUEM_CONVERSA)
  @ApiOperation({
    summary: 'Conversas da unidade: quem espera atendente primeiro, depois as mais recentes',
  })
  listar(
    @Consulta(listarConversasSchema) { unidadeId }: z.infer<typeof listarConversasSchema>,
  ): Promise<ListaConversas> {
    return this.servico.listar(unidadeId);
  }

  @Get(':id/mensagens')
  @Papeis(...QUEM_CONVERSA)
  @ApiOperation({ summary: 'Mensagens da conversa, em ordem (as 200 mais recentes)' })
  mensagens(@Param('id', ParseUUIDPipe) id: string): Promise<MensagemDoCliente[]> {
    return this.servico.mensagens(id);
  }

  @Post(':id/responder')
  @Papeis(...QUEM_CONVERSA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Responder pelo painel: a equipe assume e o bot fica quieto' })
  responder(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(responderConversaSchema) { texto }: ResponderConversaEntrada,
  ) {
    return this.servico.responder(id, texto);
  }

  @Post(':id/devolver')
  @Papeis(...QUEM_CONVERSA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Devolver ao bot, com a mensagem de encerramento' })
  devolver(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.devolver(id);
  }
}

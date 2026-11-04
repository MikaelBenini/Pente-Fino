import {
  Controller,
  Delete,
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
  horarioBotSchema,
  mensagensBotSchema,
  menuBotSchema,
  simularBotSchema,
  type EstadoBot,
  type HorarioBotEntrada,
  type MensagensBotEntrada,
  type MenuBot,
  type RespostaSimulacao,
  type SimularBotDados,
} from '@pente-fino/shared';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { GESTAO } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';
import { BotService } from './bot.service.js';

@ApiTags('Bot do WhatsApp')
@ApiBearerAuth()
@Controller('bot')
export class BotController {
  constructor(@Inject(BotService) private readonly servico: BotService) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Menu publicado e rascunho, mensagens prontas e horário de cada unidade',
  })
  estado(): Promise<EstadoBot> {
    return this.servico.estado();
  }

  @Put('menu')
  @Papeis('dono')
  @ApiOperation({
    summary: 'Salvar o rascunho do menu (pode estar incompleto; volta os problemas)',
  })
  salvar(@Corpo(menuBotSchema) menu: MenuBot) {
    return this.servico.salvarRascunho(menu);
  }

  @Delete('menu/rascunho')
  @Papeis('dono')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar o rascunho' })
  descartar() {
    return this.servico.descartarRascunho();
  }

  @Post('menu/publicar')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Publicar o rascunho (só sem problemas); o anterior fica guardado' })
  publicar() {
    return this.servico.publicar();
  }

  @Post('menu/restaurar')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Voltar à versão publicada antes desta' })
  restaurar() {
    return this.servico.restaurarAnterior();
  }

  @Put('mensagens')
  @Papeis('dono')
  @ApiOperation({ summary: 'Mensagens prontas (boas-vindas, fora do horário, não entendi…)' })
  mensagens(@Corpo(mensagensBotSchema) d: MensagensBotEntrada) {
    return this.servico.salvarMensagens(d);
  }

  @Put('horario/:unidadeId')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Horário do bot na unidade (null = segue o expediente da equipe)' })
  horario(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Corpo(horarioBotSchema) d: HorarioBotEntrada,
  ) {
    return this.servico.salvarHorario(unidadeId, d);
  }

  @Post('simular')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conversa de teste com o rascunho ou o menu publicado (não envia nada)',
  })
  simular(@Corpo(simularBotSchema) d: SimularBotDados): Promise<RespostaSimulacao> {
    return this.servico.simular(d);
  }
}

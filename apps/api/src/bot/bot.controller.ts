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
  pesquisaBotSchema,
  linkGoogleSchema,
  type LinkGoogleEntrada,
  menuBotSchema,
  simularBotSchema,
  type ConexaoBot,
  type EstadoBot,
  type HorarioBotEntrada,
  type MensagensBotEntrada,
  type MenuBot,
  type PesquisaBotEntrada,
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

  @Put('pesquisa')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Ligar ou desligar a pesquisa de 1 a 5 depois do atendimento' })
  pesquisa(@Corpo(pesquisaBotSchema) d: PesquisaBotEntrada) {
    return this.servico.salvarPesquisa(d.ativa);
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

  @Put('google/:unidadeId')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Link do Google da unidade para o convite depois da nota 5' })
  google(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Corpo(linkGoogleSchema) d: LinkGoogleEntrada,
  ) {
    return this.servico.salvarLinkGoogle(unidadeId, d.link);
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

  @Get('conexao/:unidadeId')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Estado do WhatsApp da unidade e o QR Code enquanto aguarda a leitura' })
  conexao(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<ConexaoBot> {
    return this.servico.conexao(unidadeId);
  }

  @Post('conexao/:unidadeId')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conectar (ou reconectar) o WhatsApp da unidade: devolve o QR Code' })
  conectar(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<ConexaoBot> {
    return this.servico.conectar(unidadeId);
  }

  @Delete('conexao/:unidadeId')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Desconectar o WhatsApp da unidade' })
  desconectar(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<ConexaoBot> {
    return this.servico.desconectar(unidadeId);
  }
}

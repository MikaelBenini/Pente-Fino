// Admin F6: rotas do chat. As do visitante são públicas (token da conversa no cabeçalho
// x-chat-token, com limite por IP); as da equipe exigem a sessão da administração.
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  avaliarChatSchema,
  inscricaoPushSchema,
  removerPushSchema,
  type EstadoPush,
  type InscricaoPushEntrada,
  iniciarChatSchema,
  type AvaliarChatEntrada,
  type RespostaPronta,
  mensagemChatSchema,
  type ChatDoVisitante,
  type ChatIniciado,
  type ConversaDaEquipe,
  type ConversaNaFila,
  type IniciarChatEntrada,
  type MensagemChatEntrada,
  type ResumoDoChat,
  type StatusChat,
} from '@pente-fino/shared';
import { AdminAtual, AdminGuard, PapeisPlataforma } from '../admin/admin.guard.js';
import type { AdminAutenticado } from '../admin/admin-auth.service.js';
import { LimiteAutenticacao, Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { ChatService } from './chat.service.js';

@ApiTags('Chat do site')
@Controller('chat')
@Publico()
export class ChatPublicoController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Post('conversas')
  @LimiteAutenticacao()
  @ApiOperation({ summary: 'Começar uma conversa no chat do site (visitante)' })
  iniciar(@Corpo(iniciarChatSchema) d: IniciarChatEntrada): Promise<ChatIniciado> {
    return this.chat.iniciar(d);
  }

  @Get('conversas/:id')
  @ApiOperation({ summary: 'Mensagens, situação e posição na fila (visitante)' })
  ver(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-chat-token') token?: string,
  ): Promise<ChatDoVisitante> {
    return this.chat.doVisitanteParaTela(id, token);
  }

  @Post('conversas/:id/avaliacao')
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Avaliar a conversa encerrada: foi útil? (visitante)' })
  avaliar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(avaliarChatSchema) d: AvaliarChatEntrada,
    @Headers('x-chat-token') token?: string,
  ): Promise<void> {
    return this.chat.avaliarComToken(id, token, d.util);
  }

  @Post('conversas/:id/mensagens')
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mandar uma mensagem (visitante)' })
  escrever(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mensagemChatSchema) d: MensagemChatEntrada,
    @Headers('x-chat-token') token?: string,
  ): Promise<void> {
    return this.chat.doVisitanteEscrever(id, token, d.texto);
  }
}

const PAPEIS_CHAT = ['admin', 'vendedor', 'suporte'] as const;

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin/chat')
@Publico()
@UseGuards(AdminGuard)
export class AdminChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get()
  @PapeisPlataforma(...PAPEIS_CHAT)
  @ApiOperation({ summary: 'Conversas do chat: fila e em atendimento, ou encerradas' })
  lista(@Query('status') status?: string): Promise<ConversaNaFila[]> {
    if (status && !['fila', 'atendendo', 'encerrada'].includes(status))
      throw Erros.requisicaoInvalida('status_invalido', 'Situação inválida.');
    return this.chat.lista(status as StatusChat | undefined);
  }

  @Get('push')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @ApiOperation({
    summary: 'Push do chat neste aparelho: chave pública e quantos aparelhos ligados',
  })
  push(@AdminAtual() a: AdminAutenticado): Promise<EstadoPush> {
    return this.chat.estadoPush(a.id);
  }

  @Post('push')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ligar o aviso do chat neste aparelho (push)' })
  ligarPush(
    @Corpo(inscricaoPushSchema) d: InscricaoPushEntrada,
    @AdminAtual() a: AdminAutenticado,
    @Headers('user-agent') agente?: string,
  ): Promise<void> {
    return this.chat.ligarPush(a.id, d, agente);
  }

  @Post('push/desligar')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desligar o aviso do chat neste aparelho' })
  desligarPush(
    @Corpo(removerPushSchema) d: { endpoint: string },
    @AdminAtual() a: AdminAutenticado,
  ): Promise<void> {
    return this.chat.desligarPush(a.id, d.endpoint);
  }

  @Get('respostas')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @ApiOperation({ summary: 'Respostas prontas, com os preços e os dias de teste atuais' })
  respostas(): Promise<RespostaPronta[]> {
    return this.chat.respostas();
  }

  @Get('resumo')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @ApiOperation({
    summary: 'Últimos 30 dias: conversas, quantas viraram cadastro e a primeira resposta',
  })
  resumo(): Promise<ResumoDoChat> {
    return this.chat.resumo();
  }

  @Get(':id')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @ApiOperation({ summary: 'Uma conversa com todas as mensagens' })
  ver(@Param('id', ParseUUIDPipe) id: string): Promise<ConversaDaEquipe> {
    return this.chat.daEquipe(id);
  }

  @Post(':id/assumir')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Assumir a conversa' })
  assumir(
    @Param('id', ParseUUIDPipe) id: string,
    @AdminAtual() a: AdminAutenticado,
  ): Promise<void> {
    return this.chat.assumir(id, a.id);
  }

  @Post(':id/mensagens')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Responder (assume a conversa se ninguém assumiu)' })
  responder(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mensagemChatSchema) d: MensagemChatEntrada,
    @AdminAtual() a: AdminAutenticado,
  ): Promise<void> {
    return this.chat.responder(id, a.id, d.texto);
  }

  @Post(':id/encerrar')
  @PapeisPlataforma(...PAPEIS_CHAT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar a conversa (o histórico fica guardado)' })
  encerrar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.chat.encerrar(id);
  }
}

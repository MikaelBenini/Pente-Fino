// Admin F6: o chat de suporte na Ajuda do painel, para quem já é cliente. Logado, qualquer papel:
// a conversa fica ligada à conta e ao usuário, sem pedir nome nem contato.
import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  avaliarChatSchema,
  mensagemChatSchema,
  type AvaliarChatEntrada,
  type ChatDoVisitante,
  type MensagemChatEntrada,
} from '@pente-fino/shared';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Corpo } from '../comum/validacao.js';
import { ChatService } from './chat.service.js';

@ApiTags('Chat do site')
@ApiBearerAuth()
@Controller('chat/minha')
export class ChatPainelController {
  constructor(
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  @Get()
  @Papeis('dono', 'gestor', 'recepcao', 'barbeiro')
  @ApiOperation({ summary: 'Minha conversa com o suporte (Ajuda do painel); null = nenhuma' })
  async minha(): Promise<{ conversa: ChatDoVisitante | null }> {
    return { conversa: await this.chat.doPainelParaTela(Contexto.usuario().id) };
  }

  @Post('avaliacao')
  @Papeis('dono', 'gestor', 'recepcao', 'barbeiro')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Avaliar a última conversa encerrada com o suporte' })
  avaliar(@Corpo(avaliarChatSchema) d: AvaliarChatEntrada): Promise<void> {
    return this.chat.avaliarDoPainel(Contexto.usuario().id, d.util);
  }

  @Post('mensagens')
  @Papeis('dono', 'gestor', 'recepcao', 'barbeiro')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mandar mensagem ao suporte (começa a conversa se não houver aberta)' })
  async escrever(@Corpo(mensagemChatSchema) d: MensagemChatEntrada): Promise<void> {
    const { id, contaId } = Contexto.usuario();
    const quem = await this.banco.daConta(async (tx) => {
      const [u, c] = await Promise.all([
        tx.usuario.findUniqueOrThrow({ where: { id }, select: { nome: true, email: true } }),
        tx.conta.findUniqueOrThrow({ where: { id: contaId }, select: { nome: true } }),
      ]);
      return { usuarioId: id, nome: u.nome, email: u.email, contaId, conta: c.nome };
    });
    await this.chat.doPainelEscrever(quem, d.texto);
  }
}

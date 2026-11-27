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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  automacoesSchema,
  dataLocal,
  escopoBotSchema,
  fluxoAnuncioSchema,
  type EscopoBotEntrada,
  type FluxoAnuncio,
  type FluxoAnuncioDoEscopo,
  type FluxoAnuncioEntrada,
  horarioBotSchema,
  mensagensBotSchema,
  pesquisaBotSchema,
  linkGoogleSchema,
  type LinkGoogleEntrada,
  menuBotSchema,
  simularBotSchema,
  type AutomacoesConta,
  type ConexaoBot,
  type EstadoAutomacoes,
  type EstadoBot,
  type HorarioBotEntrada,
  type MensagensBotEntrada,
  type MenuBot,
  type PesquisaBotEntrada,
  type RespostaSimulacao,
  type SimularBotDados,
  retomarAutomaticasSchema,
  type TesteDoNumero,
  type RetomarAutomaticasEntrada,
} from '@pente-fino/shared';
import { Auditada } from '../auditoria/auditoria.js';
import { ExigeRecurso, LivreDoPlano, Papeis } from '../auth/decoradores.js';
import { GESTAO } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { z } from 'zod';
import { BotService } from './bot.service.js';
import { EmailConfirmadoGuard } from '../auth/email-confirmado.guard.js';

const periodoAutomacoes = z.object({
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
});

@ApiTags('Bot do WhatsApp')
@ApiBearerAuth()
@ExigeRecurso('bot', { soEscrita: true })
@Controller('bot')
export class BotController {
  constructor(@Inject(BotService) private readonly servico: BotService) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Menu publicado e rascunho, mensagens prontas e horário de cada unidade',
  })
  estado(@Consulta(escopoBotSchema) e: EscopoBotEntrada): Promise<EstadoBot> {
    return this.servico.estado(e.unidadeId ?? null);
  }

  @Put('menu')
  @Papeis('dono')
  @ApiOperation({
    summary: 'Salvar o rascunho do menu (pode estar incompleto; volta os problemas)',
  })
  salvar(@Corpo(menuBotSchema) menu: MenuBot, @Consulta(escopoBotSchema) e: EscopoBotEntrada) {
    return this.servico.salvarRascunho(menu, e.unidadeId ?? null);
  }

  @Delete('menu/rascunho')
  @Papeis('dono')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar o rascunho' })
  descartar(@Consulta(escopoBotSchema) e: EscopoBotEntrada) {
    return this.servico.descartarRascunho(e.unidadeId ?? null);
  }

  @Post('menu/publicar')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Publicar o rascunho (só sem problemas); o anterior fica guardado' })
  publicar(@Consulta(escopoBotSchema) e: EscopoBotEntrada) {
    return this.servico.publicar(e.unidadeId ?? null);
  }

  @Post('menu/restaurar')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Voltar à versão publicada antes desta' })
  restaurar(@Consulta(escopoBotSchema) e: EscopoBotEntrada) {
    return this.servico.restaurarAnterior(e.unidadeId ?? null);
  }

  @Delete('unidade/:unidadeId/personalizacao')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'A unidade volta a usar o menu e as mensagens do padrão da barbearia' })
  usarPadrao(@Param('unidadeId', ParseUUIDPipe) unidadeId: string) {
    return this.servico.usarPadrao(unidadeId);
  }

  @Get('anuncio')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Mensagens automáticas de quem vem de anúncio' })
  anuncio(@Consulta(escopoBotSchema) e: EscopoBotEntrada): Promise<FluxoAnuncioDoEscopo> {
    return this.servico.fluxoAnuncio(e.unidadeId ?? null);
  }

  @Delete('anuncio')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'A unidade volta a usar as mensagens de anúncio da barbearia' })
  anuncioDoPadrao(@Consulta(escopoBotSchema.required()) e: Required<EscopoBotEntrada>) {
    return this.servico.anuncioDoPadrao(e.unidadeId);
  }

  @Put('anuncio')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({
    summary: 'Gravar o fluxo de quem vem de anúncio: frases, mensagens em sequência e a final',
  })
  salvarAnuncio(
    @Corpo(fluxoAnuncioSchema) d: FluxoAnuncioEntrada,
    @Consulta(escopoBotSchema) e: EscopoBotEntrada,
  ): Promise<FluxoAnuncio> {
    return this.servico.salvarFluxoAnuncio(d, e.unidadeId ?? null);
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
  mensagens(
    @Corpo(mensagensBotSchema) d: MensagensBotEntrada,
    @Consulta(escopoBotSchema) e: EscopoBotEntrada,
  ) {
    return this.servico.salvarMensagens(d, e.unidadeId ?? null);
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

  @Get('automacoes')
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Automações (retorno e aniversário) e os números de cada uma no período',
  })
  automacoes(
    @Consulta(periodoAutomacoes) p: z.infer<typeof periodoAutomacoes>,
  ): Promise<EstadoAutomacoes> {
    const hoje = dataLocal(new Date());
    return this.servico.automacoes(p.de ?? `${hoje.slice(0, 7)}-01`, p.ate ?? hoje);
  }

  @ExigeRecurso('automacoes')
  @Put('automacoes')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Ligar e desligar o convite de retorno e o parabéns' })
  salvarAutomacoes(@Corpo(automacoesSchema) d: AutomacoesConta): Promise<AutomacoesConta> {
    return this.servico.salvarAutomacoes(d);
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

  // O WhatsApp vale em todo plano (decisão do dono em 14/11): os avisos do agendamento saem por
  // ele. Sem as Automações, só o bot deixa de responder sozinho.
  @LivreDoPlano()
  @Post('conexao/:unidadeId')
  @UseGuards(EmailConfirmadoGuard)
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conectar (ou reconectar) o WhatsApp da unidade: devolve o QR Code' })
  conectar(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<ConexaoBot> {
    return this.servico.conectar(unidadeId);
  }

  @Post('conexao/:unidadeId/retomar')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retomar as mensagens automáticas pausadas pela proteção do número (com motivo)',
  })
  retomar(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Corpo(retomarAutomaticasSchema) d: RetomarAutomaticasEntrada,
  ): Promise<ConexaoBot> {
    return this.servico.retomarAutomaticas(unidadeId, d.motivo);
  }

  @Post('conexao/:unidadeId/testar')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Testar o número: manda uma mensagem para o WhatsApp de quem testa' })
  testar(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<TesteDoNumero> {
    return this.servico.testarNumero(unidadeId);
  }

  @Get('conexao/:unidadeId/testar/:mensagemId')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Como está a mensagem de teste do número' })
  situacaoDoTeste(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Param('mensagemId', ParseUUIDPipe) mensagemId: string,
  ): Promise<TesteDoNumero> {
    return this.servico.situacaoDoTeste(unidadeId, mensagemId);
  }

  @LivreDoPlano()
  @Delete('conexao/:unidadeId')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Desconectar o WhatsApp da unidade' })
  desconectar(@Param('unidadeId', ParseUUIDPipe) unidadeId: string): Promise<ConexaoBot> {
    return this.servico.desconectar(unidadeId);
  }
}

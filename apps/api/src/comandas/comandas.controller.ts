import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  alterarItemSchema,
  cancelarSchema,
  consultaComandasSchema,
  fecharComandaSchema,
  novaComandaSchema,
  novoItemSchema,
  reabrirSchema,
  type FecharComandaEntrada,
  type NovaComandaEntrada,
  type NovoItemEntrada,
} from '@pente-fino/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { ComandasService } from './comandas.service.js';

const impressaoSchema = z.object({
  unidadeId: z.uuid({ error: 'Unidade inválida.' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
  porFolha: z.coerce
    .number()
    .pipe(z.union([z.literal(4), z.literal(6)]))
    .default(4),
});

@ApiTags('Comandas')
@ApiBearerAuth()
@Controller('comandas')
export class ComandasController {
  constructor(@Inject(ComandasService) private readonly servico: ComandasService) {}

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({
    summary: 'Comandas do dia (barbeiro vê só as dele). status: lista separada por vírgula',
  })
  listar(@Consulta(consultaComandasSchema) filtro: z.infer<typeof consultaComandasSchema>) {
    return this.servico.listar(filtro);
  }

  @Get('impressao')
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'PDF A4 das comandas do dia (4 ou 6 por folha), com QR code' })
  async impressao(
    @Consulta(impressaoSchema) c: z.infer<typeof impressaoSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.servico.impressao(c.unidadeId, c.data, c.porFolha);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="comandas-${c.data}.pdf"`,
    });
    return new StreamableFile(Buffer.from(pdf));
  }

  @Get(':id')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Comanda com itens e pagamentos' })
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.buscar(id);
  }

  @Post()
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Abrir comanda na hora (cliente sem horário)' })
  abrir(@Corpo(novaComandaSchema) d: NovaComandaEntrada) {
    return this.servico.abrir(d);
  }

  @Post(':id/itens')
  @Papeis(...TODOS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lançar serviço, produto ou receita não operacional' })
  adicionarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(novoItemSchema) item: NovoItemEntrada,
  ) {
    return this.servico.adicionarItem(id, item);
  }

  @Patch(':id/itens/:itemId')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Ajustar quantidade, desconto ou trocar o serviço' })
  alterarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Corpo(alterarItemSchema) d: z.infer<typeof alterarItemSchema>,
  ) {
    return this.servico.alterarItem(id, itemId, d);
  }

  @Delete(':id/itens/:itemId')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Remover item' })
  removerItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.servico.removerItem(id, itemId);
  }

  @Post(':id/iniciar')
  @Papeis(...TODOS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Começar o atendimento' })
  iniciar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.iniciar(id);
  }

  @Post(':id/confirmar')
  @Papeis(...TODOS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Barbeiro confirma o que foi feito' })
  confirmar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.confirmar(id);
  }

  @Post(':id/nao-veio')
  @Papeis(...TODOS)
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passou da tolerância e o cliente não veio: cancela como atraso' })
  naoVeio(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.naoVeio(id);
  }

  @Post(':id/desfazer-nao-veio')
  @Papeis(...TODOS)
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desfazer o "Não veio" em até 5 min (o cliente chegou)' })
  desfazerNaoVeio(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.desfazerNaoVeio(id);
  }

  @Post(':id/fechar')
  @Papeis('dono', 'gestor', 'recepcao')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receber (várias formas) e fechar: entra no faturamento e na comissão' })
  fechar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(fecharComandaSchema) d: FecharComandaEntrada,
  ) {
    return this.servico.fechar(id, d);
  }

  @Post(':id/cancelar')
  @Papeis('dono', 'gestor', 'recepcao')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar (falta: true quando o cliente não veio)' })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(cancelarSchema) d: z.infer<typeof cancelarSchema>,
  ) {
    return this.servico.cancelar(id, d.motivo, d.falta);
  }

  @Post(':id/reabrir')
  @Papeis('dono', 'gestor')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabrir comanda fechada (motivo obrigatório, auditado)' })
  reabrir(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(reabrirSchema) d: z.infer<typeof reabrirSchema>,
  ) {
    return this.servico.reabrir(id, d.motivo);
  }
}

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
  pagamentoComissaoSchema,
  periodoSchema,
  type PagamentoComissaoEntrada,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { GESTAO, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { ComissoesService } from './comissoes.service.js';

@ApiTags('Comissões')
@ApiBearerAuth()
@Controller('comissoes')
export class ComissoesController {
  constructor(@Inject(ComissoesService) private readonly servico: ComissoesService) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Comissão por barbeiro no período: previsto, fechado, pago e a receber',
  })
  resumo(@Consulta(periodoSchema) p: z.infer<typeof periodoSchema>) {
    return this.servico.resumoGeral(p.unidadeId, p.de, p.ate);
  }

  @Get(':profissionalId/extrato')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Extrato item por item (barbeiro só o próprio)' })
  extrato(
    @Param('profissionalId', ParseUUIDPipe) id: string,
    @Consulta(periodoSchema) p: z.infer<typeof periodoSchema>,
  ) {
    return this.servico.extrato(id, p.de, p.ate);
  }

  @Post('pagamentos')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar comissão paga (até o que falta pagar no período)' })
  pagar(@Corpo(pagamentoComissaoSchema) d: PagamentoComissaoEntrada) {
    return this.servico.registrarPagamento(d);
  }
}

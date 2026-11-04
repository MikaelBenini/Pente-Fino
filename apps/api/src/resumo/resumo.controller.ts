import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ResumoDoDia, ResumoDoMes } from '@pente-fino/shared';
import { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { GESTAO } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { ResumoService } from './resumo.service.js';

const filtros = {
  unidadeId: z.uuid({ error: 'Unidade inválida.' }).optional(),
  profissionalId: z.uuid({ error: 'Profissional inválido.' }).optional(),
};
const diaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
  ...filtros,
});
const mesSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês inválido.' }),
  ...filtros,
});

@ApiTags('Resumo do dia')
@ApiBearerAuth()
@Controller('resumo')
export class ResumoController {
  constructor(@Inject(ResumoService) private readonly servico: ResumoService) {}

  @Get('dia')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'O que tem para o dia e o que já foi feito, por profissional' })
  dia(@Consulta(diaSchema) c: z.infer<typeof diaSchema>): Promise<ResumoDoDia> {
    return this.servico.dia(c.data, c.unidadeId, c.profissionalId);
  }

  @Get('mes')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'O mês dia a dia: agenda, faltas, clientes e faturamento' })
  mes(@Consulta(mesSchema) c: z.infer<typeof mesSchema>): Promise<ResumoDoMes> {
    return this.servico.mes(c.mes, c.unidadeId, c.profissionalId);
  }
}

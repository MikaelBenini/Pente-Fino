import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OcupacaoDaUnidade } from '@pente-fino/shared';
import { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { GESTAO } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { DesempenhoService } from './desempenho.service.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const consultaSchema = z.object({
  unidadeId: z.uuid({ error: 'Unidade inválida.' }),
  de: z.string().regex(DATA, { error: 'Data inválida.' }),
  ate: z.string().regex(DATA, { error: 'Data inválida.' }),
});
type ConsultaOcupacao = z.infer<typeof consultaSchema>;

@ApiTags('Desempenho da equipe')
@ApiBearerAuth()
@Controller('ocupacao')
export class OcupacaoController {
  constructor(@Inject(DesempenhoService) private readonly servico: DesempenhoService) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({
    summary:
      'Ocupação da unidade no período: total, por faixa do dia e hora a hora (mapa da semana)',
  })
  ocupacao(@Consulta(consultaSchema) c: ConsultaOcupacao): Promise<OcupacaoDaUnidade> {
    const dias = (Date.parse(`${c.ate}T12:00:00Z`) - Date.parse(`${c.de}T12:00:00Z`)) / 86_400_000;
    if (!(dias >= 0))
      throw Erros.validacao([{ campo: 'ate', mensagem: 'O fim vem depois do início.' }]);
    if (dias > 93) throw Erros.validacao([{ campo: 'ate', mensagem: 'Período de até 3 meses.' }]);
    return this.servico.ocupacaoDaUnidade(c.unidadeId, c.de, c.ate);
  }
}

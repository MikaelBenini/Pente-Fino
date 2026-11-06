import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PainelDaRede } from '@pente-fino/shared';
import { z } from 'zod';
import { ExigeRecurso, Papeis } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { GESTAO } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { DesempenhoService } from './desempenho.service.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const consultaSchema = z.object({
  de: z.string().regex(DATA, { error: 'Data inválida.' }),
  ate: z.string().regex(DATA, { error: 'Data inválida.' }),
});
type ConsultaRede = z.infer<typeof consultaSchema>;

@ApiTags('Desempenho da equipe')
@ApiBearerAuth()
@ExigeRecurso('rede')
@Controller('rede')
export class RedeController {
  constructor(@Inject(DesempenhoService) private readonly servico: DesempenhoService) {}

  @Get()
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Painel da rede: unidades lado a lado e o total (dono: todas; gestor: as dele)',
  })
  painel(@Consulta(consultaSchema) c: ConsultaRede): Promise<PainelDaRede> {
    const dias = (Date.parse(`${c.ate}T12:00:00Z`) - Date.parse(`${c.de}T12:00:00Z`)) / 86_400_000;
    if (!(dias >= 0))
      throw Erros.validacao([{ campo: 'ate', mensagem: 'O fim vem depois do início.' }]);
    if (dias > 93) throw Erros.validacao([{ campo: 'ate', mensagem: 'Período de até 3 meses.' }]);
    return this.servico.painelDaRede(c.de, c.ate);
  }
}

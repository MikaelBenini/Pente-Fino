import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FichaProfissional, LinhaRankingEquipe } from '@pente-fino/shared';
import { z } from 'zod';
import { ExigeRecurso, Papeis } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { GESTAO } from '../comum/escopo.js';
import { Consulta } from '../comum/validacao.js';
import { DesempenhoService } from './desempenho.service.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const periodoSchema = z.object({
  de: z.string().regex(DATA, { error: 'Data inválida.' }),
  ate: z.string().regex(DATA, { error: 'Data inválida.' }),
  unidadeId: z.uuid({ error: 'Unidade inválida.' }).optional(),
});
type Periodo = z.infer<typeof periodoSchema>;

function conferir({ de, ate }: Periodo) {
  const dias = (Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000;
  if (!(dias >= 0))
    throw Erros.validacao([{ campo: 'ate', mensagem: 'O fim vem depois do início.' }]);
  if (dias > 366) throw Erros.validacao([{ campo: 'ate', mensagem: 'Período de até um ano.' }]);
}

@ApiTags('Desempenho da equipe')
@ApiBearerAuth()
@ExigeRecurso('fichaProfissional')
@Controller('profissionais')
export class DesempenhoController {
  constructor(@Inject(DesempenhoService) private readonly servico: DesempenhoService) {}

  @Get('desempenho')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Ranking da equipe no período (dono: rede; gestor: sua unidade)' })
  ranking(@Consulta(periodoSchema) p: Periodo): Promise<LinhaRankingEquipe[]> {
    conferir(p);
    return this.servico.ranking(p.unidadeId, p.de, p.ate);
  }

  @Get(':id/desempenho')
  @Papeis('dono', 'gestor', 'barbeiro')
  @ApiOperation({
    summary: 'Ficha do profissional: dono e gestor da unidade, ou o próprio barbeiro (sem margem)',
  })
  ficha(
    @Param('id', ParseUUIDPipe) id: string,
    @Consulta(periodoSchema) p: Periodo,
  ): Promise<FichaProfissional> {
    conferir(p);
    return this.servico.ficha(id, p.de, p.ate);
  }
}

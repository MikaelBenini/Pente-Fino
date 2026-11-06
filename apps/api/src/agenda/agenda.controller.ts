import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  consultaAgendaSchema,
  consultaLivresSchema,
  novoAgendamentoSchema,
  remarcarSchema,
  type NovoAgendamentoEntrada,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { AgendaService } from './agenda.service.js';

@ApiTags('Agenda')
@ApiBearerAuth()
@Controller()
export class AgendaController {
  constructor(@Inject(AgendaService) private readonly servico: AgendaService) {}

  @Get('agenda')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Agenda da unidade no período (até 6 semanas)' })
  agenda(@Consulta(consultaAgendaSchema) c: z.infer<typeof consultaAgendaSchema>) {
    return this.servico.agenda(c.unidadeId, c.de, c.ate);
  }

  @Get('agenda/horarios-livres')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Horários livres por profissional para a duração pedida' })
  livres(@Consulta(consultaLivresSchema) c: z.infer<typeof consultaLivresSchema>) {
    return this.servico.livres(c.unidadeId, c.data, c.duracaoMin, c.profissionalId);
  }

  @Post('agendamentos')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agendar (cria a comanda prevista com os serviços)' })
  agendar(@Corpo(novoAgendamentoSchema) d: NovoAgendamentoEntrada) {
    return this.servico.agendar(d);
  }

  @Patch('agendamentos/:id')
  @Papeis('dono', 'gestor', 'recepcao')
  @Auditada()
  @ApiOperation({ summary: 'Remarcar (horário ou profissional) antes do atendimento começar' })
  remarcar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(remarcarSchema) d: z.infer<typeof remarcarSchema>,
  ) {
    return this.servico.remarcar(id, d.inicio, d.profissionalId, d.avisarCliente);
  }
}

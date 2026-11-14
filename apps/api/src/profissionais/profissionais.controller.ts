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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  bloqueioRecorrenteSchema,
  bloqueioSchema,
  type BloqueioRecorrenteEntrada,
  horariosSchema,
  novaRegraComissaoSchema,
  novoProfissionalSchema,
  profissionalParcialSchema,
  type BloqueioEntrada,
  type HorariosEntrada,
  type NovaRegraComissaoEntrada,
  type NovoProfissionalEntrada,
  servicosDoProfissionalSchema,
  type ServicosDoProfissional,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { GESTAO, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { ProfissionaisService } from './profissionais.service.js';

const filtroSchema = z.object({ unidadeId: z.uuid({ error: 'Unidade inválida.' }).optional() });
const periodoSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
});

@ApiTags('Profissionais')
@ApiBearerAuth()
@Controller('profissionais')
export class ProfissionaisController {
  constructor(@Inject(ProfissionaisService) private readonly servico: ProfissionaisService) {}

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({
    summary: 'Profissionais (barbeiro vê só o próprio cadastro; comissão só para dono e gestor)',
  })
  listar(@Consulta(filtroSchema) { unidadeId }: z.infer<typeof filtroSchema>) {
    return this.servico.listar(unidadeId);
  }

  @Post()
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Novo profissional (de alguém da equipe ou convidando um novo barbeiro)',
  })
  criar(@Corpo(novoProfissionalSchema) dados: NovoProfissionalEntrada) {
    return this.servico.criar(dados);
  }

  @Patch(':id')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Datas de entrada e saída; ativar ou desativar' })
  alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(profissionalParcialSchema) dados: z.infer<typeof profissionalParcialSchema>,
  ) {
    return this.servico.alterar(id, dados);
  }

  @Put(':id/horarios')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Expediente semanal (substitui o atual)' })
  horarios(@Param('id', ParseUUIDPipe) id: string, @Corpo(horariosSchema) dados: HorariosEntrada) {
    return this.servico.definirHorarios(id, dados);
  }

  @Put(':id/servicos')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary: 'Serviços que o barbeiro faz (vazio = todos); vale no link, bot e site',
  })
  servicos(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(servicosDoProfissionalSchema) dados: ServicosDoProfissional,
  ) {
    return this.servico.definirServicos(id, dados.servicoIds);
  }

  @Post(':id/regras-comissao')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nova regra de comissão a partir de uma data' })
  novaRegra(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(novaRegraComissaoSchema) dados: NovaRegraComissaoEntrada,
  ) {
    return this.servico.novaRegra(id, dados);
  }

  @Get(':id/bloqueios')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Bloqueios de agenda no período' })
  bloqueios(
    @Param('id', ParseUUIDPipe) id: string,
    @Consulta(periodoSchema) { de, ate }: z.infer<typeof periodoSchema>,
  ) {
    return this.servico.bloqueios(id, de, ate);
  }

  @Post(':id/bloqueios')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bloquear um horário (almoço, folga, compromisso)' })
  novoBloqueio(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(bloqueioSchema) dados: BloqueioEntrada,
  ) {
    return this.servico.novoBloqueio(id, dados);
  }

  @Delete(':id/bloqueios/:bloqueioId')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um bloqueio' })
  removerBloqueio(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bloqueioId', ParseUUIDPipe) bloqueioId: string,
  ) {
    return this.servico.removerBloqueio(id, bloqueioId);
  }

  @Get(':id/bloqueios-recorrentes')
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'Bloqueios que repetem toda semana (almoço de toda terça)' })
  bloqueiosRecorrentes(@Param('id', ParseUUIDPipe) id: string) {
    return this.servico.bloqueiosRecorrentes(id);
  }

  @Post(':id/bloqueios-recorrentes')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bloquear um horário toda semana' })
  novoBloqueioRecorrente(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(bloqueioRecorrenteSchema) dados: BloqueioRecorrenteEntrada,
  ) {
    return this.servico.novoBloqueioRecorrente(id, dados);
  }

  @Delete(':id/bloqueios-recorrentes/:bloqueioId')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um bloqueio que repete' })
  removerBloqueioRecorrente(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bloqueioId', ParseUUIDPipe) bloqueioId: string,
  ) {
    return this.servico.removerBloqueioRecorrente(id, bloqueioId);
  }
}

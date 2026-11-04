import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UnidadeResumo } from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';

@ApiTags('Unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @ApiOperation({ summary: 'Unidades que o usuário alcança (papel sem unidade = todas da conta)' })
  listar(): Promise<UnidadeResumo[]> {
    const { papeis } = Contexto.usuario();
    const todas = papeis.some((p) => p.unidadeId === null);
    const ids = papeis.map((p) => p.unidadeId).filter((id): id is string => id !== null);
    return this.banco.daConta((tx) =>
      tx.unidade.findMany({
        where: todas ? {} : { id: { in: ids } },
        select: { id: true, nome: true, ativa: true },
        orderBy: { nome: 'asc' },
      }),
    );
  }
}

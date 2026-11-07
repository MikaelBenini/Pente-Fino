import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { configuracaoDoSistema } from '@pente-fino/db';
import { avisoVigente, lerConfiguracaoPublica, type AvisoGeral } from '@pente-fino/shared';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { TODOS } from '../comum/escopo.js';

/** O que a administração do sistema avisa a todas as barbearias. */
@ApiTags('Conta')
@ApiBearerAuth()
@Controller('sistema')
export class SistemaController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get('aviso')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Aviso geral em vigor (manutenção programada, novidade) ou nenhum' })
  async aviso(): Promise<{ aviso: AvisoGeral | null }> {
    const c = lerConfiguracaoPublica(await configuracaoDoSistema(this.banco.prisma));
    return { aviso: avisoVigente(c.avisoGeral, new Date()) };
  }
}

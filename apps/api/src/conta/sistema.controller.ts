import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { configuracaoDoSistema } from '@pente-fino/db';
import {
  avisoVigente,
  contaNoPublico,
  lerConfiguracaoPublica,
  type AvisoGeral,
} from '@pente-fino/shared';
import { Contexto } from '../comum/contexto.js';
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
    const aviso = avisoVigente(c.avisoGeral, new Date());
    if (!aviso?.publico) return { aviso: aviso && { ...aviso, publico: undefined } };
    // Admin F8: aviso segmentado; a conta fora do público não recebe nem o texto.
    const conta = await this.banco.daConta((tx) =>
      tx.conta.findUniqueOrThrow({
        where: { id: Contexto.usuario().contaId },
        select: { id: true, plano: true, status: true },
      }),
    );
    return {
      aviso: contaNoPublico(aviso.publico, conta) ? { ...aviso, publico: undefined } : null,
    };
  }
}

import { Controller, Get, Inject, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { contaSchema, LIMITES_PLANO, type ContaEntrada } from '@pente-fino/shared';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Corpo } from '../comum/validacao.js';

@ApiTags('Conta')
@ApiBearerAuth()
@Controller('conta')
export class ContaController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @ApiOperation({ summary: 'Conta, plano e uso dos limites' })
  async ver() {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      const [unidades, profissionais] = await Promise.all([
        tx.unidade.count({ where: { ativa: true } }),
        tx.profissional.count({ where: { ativo: true } }),
      ]);
      const limites = LIMITES_PLANO[conta.plano];
      return {
        id: conta.id,
        nome: conta.nome,
        plano: conta.plano,
        status: conta.status,
        uso: { unidades, profissionais },
        limites: {
          unidades: Number.isFinite(limites.unidades) ? limites.unidades : null,
          profissionais: Number.isFinite(limites.profissionais) ? limites.profissionais : null,
        },
      };
    });
  }

  @Patch()
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Alterar o nome da barbearia' })
  alterar(@Corpo(contaSchema) dados: ContaEntrada) {
    return this.banco.daConta(async (tx) => {
      const id = Contexto.usuario().contaId;
      const antes = await tx.conta.findUniqueOrThrow({ where: { id } });
      const depois = await tx.conta.update({ where: { id }, data: { nome: dados.nome } });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: id,
        acao: 'alterar',
        antes: { nome: antes.nome },
        depois: { nome: depois.nome },
      });
      return { id, nome: depois.nome };
    });
  }
}

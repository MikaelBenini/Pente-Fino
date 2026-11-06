import { Controller, Get, HttpCode, HttpStatus, Inject, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { estadoAssinatura } from '@pente-fino/db';
import {
  assinarSchema,
  contaSchema,
  LIMITES_PLANO,
  precoPorMes,
  type AssinarEntrada,
  type AssinaturaDetalhe,
  type ContaEntrada,
  type EstadoDaConta,
  type FaturaDetalhe,
  trocarPlanoSchema,
  type PreviaTrocaPlano,
  type TrocarPlanoEntrada,
} from '@pente-fino/shared';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { LivreSemAssinatura, Papeis } from '../auth/decoradores.js';
import { CobrancaService } from '../cobranca/cobranca.service.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { emSequencia } from '../comum/sequencia.js';

@ApiTags('Conta')
@ApiBearerAuth()
@Controller('conta')
export class ContaController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CobrancaService) private readonly cobranca: CobrancaService,
  ) {}

  @Get('situacao')
  @ApiOperation({
    summary: 'Situação da assinatura (teste, em dia, atrasada, só consulta) para o aviso do painel',
  })
  situacao(): Promise<EstadoDaConta> {
    return this.banco.daConta((tx) => estadoAssinatura(tx));
  }

  @Get('assinatura')
  @Papeis('dono')
  @ApiOperation({ summary: 'Plano, situação, fatura pendente e histórico de faturas (dono)' })
  async assinatura(): Promise<AssinaturaDetalhe> {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findFirstOrThrow();
      const unidades = await tx.unidade.count({ where: { ativa: true } });
      const faturas = await tx.faturaAssinatura.findMany({
        orderBy: { vencimento: 'desc' },
        take: 24,
      });
      const dia = (d: Date) => d.toISOString().slice(0, 10);
      const lista: FaturaDetalhe[] = faturas.map((f) => ({
        id: f.id,
        plano: f.plano,
        ciclo: f.ciclo,
        valor: f.valor,
        vencimento: dia(f.vencimento),
        periodoInicio: dia(f.periodoInicio),
        periodoFim: dia(f.periodoFim),
        status: f.status,
        forma: f.forma,
        pagaEm: f.pagaEm?.toISOString() ?? null,
        motivoRecusa: f.motivoRecusa,
        linkPagamento: f.linkPagamento,
      }));
      const pendente =
        [...lista]
          .filter((f) => f.status === 'aberta' || f.status === 'recusada')
          .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null;
      return {
        estado: await estadoAssinatura(tx),
        plano: conta.plano,
        ciclo: conta.ciclo,
        testeAte: conta.testeAte?.toISOString() ?? null,
        precoPorMes: precoPorMes(conta.plano, conta.ciclo, Math.max(1, unidades)),
        unidades,
        pendente,
        faturas: lista,
        cobrancaAutomatica: conta.asaasAssinaturaId !== null,
      };
    });
  }

  @Post('assinatura')
  @Papeis('dono')
  @LivreSemAssinatura()
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Assinar: cria a assinatura no Asaas e devolve a página de pagamento (Pix, boleto ou cartão)',
  })
  assinar(@Corpo(assinarSchema) d: AssinarEntrada) {
    return this.cobranca.assinar(d);
  }

  @Get('plano/previa')
  @Papeis('dono')
  @LivreSemAssinatura()
  @ApiOperation({
    summary: 'Prévia da troca de plano: valor novo, o que impede e o que deixa de usar',
  })
  previaPlano(@Consulta(trocarPlanoSchema) d: TrocarPlanoEntrada): Promise<PreviaTrocaPlano> {
    return this.cobranca.previaTroca(d.plano);
  }

  @Put('plano')
  @Papeis('dono')
  @LivreSemAssinatura()
  @Auditada()
  @ApiOperation({
    summary: 'Trocar de plano (subir vale na hora; descer só cabendo no plano novo)',
  })
  trocarPlano(@Corpo(trocarPlanoSchema) d: TrocarPlanoEntrada): Promise<PreviaTrocaPlano> {
    return this.cobranca.trocarPlano(d.plano);
  }

  @Post('assinatura/conferir')
  @Papeis('dono')
  @LivreSemAssinatura()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '"Já paguei": busca as cobranças no Asaas e atualiza as faturas' })
  async conferir(): Promise<AssinaturaDetalhe> {
    await this.cobranca.conferir();
    return this.assinatura();
  }

  @Get()
  @ApiOperation({ summary: 'Conta, plano e uso dos limites' })
  async ver() {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      const [unidades, profissionais] = await emSequencia([
        tx.unidade.count({ where: { ativa: true } }),
        tx.profissional.count({ where: { ativo: true } }),
      ]);
      const limites = LIMITES_PLANO[conta.plano];
      return {
        id: conta.id,
        nome: conta.nome,
        plano: conta.plano,
        ciclo: conta.ciclo,
        status: conta.status,
        testeAte: conta.testeAte?.toISOString() ?? null,
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

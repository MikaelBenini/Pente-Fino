import { Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  converterLinha,
  dataLocal,
  importacaoSchema,
  TIPOS_IMPORTACAO,
  type LinhaConvertida,
  type RelatorioImportacao,
  type TipoImportacao,
} from '@pente-fino/shared';
import { z } from 'zod';
// Sem @Auditada(): a simulação não grava nada; a importação audita ao gravar.
import { auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data } from '../comum/escopo.js';
import { Corpo, PipeZod } from '../comum/validacao.js';
import { ProfissionaisService } from '../profissionais/profissionais.service.js';

// O uso em @Param('tipo', tipoParam) não é visto pela regra (decorador de parâmetro).
// eslint-disable-next-line no-useless-assignment
const tipoParam = new PipeZod(z.enum(TIPOS_IMPORTACAO, { error: 'Tipo de importação inválido.' }));

/**
 * Importa a planilha em duas etapas: simular (relatório de erros por linha, nada
 * gravado) e importar (grava só as linhas válidas). A linha 1 é o cabeçalho.
 */
@ApiTags('Importação')
@ApiBearerAuth()
@Controller('importacao')
export class ImportacaoController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ProfissionaisService) private readonly profissionais: ProfissionaisService,
  ) {}

  @Post(':tipo')
  @Papeis('dono')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conferir (simular: true) ou importar linhas da planilha' })
  async importar(
    @Param('tipo', tipoParam) tipo: TipoImportacao,
    @Corpo(importacaoSchema) { linhas, simular }: z.infer<typeof importacaoSchema>,
  ): Promise<RelatorioImportacao> {
    const erros: RelatorioImportacao['erros'] = [];
    const validas: { linha: number; valor: LinhaConvertida }[] = [];
    linhas.forEach((l, i) => {
      const r = converterLinha(tipo, l);
      if (r.ok) validas.push({ linha: i + 2, valor: r.valor });
      else erros.push({ linha: i + 2, mensagem: r.erro });
    });

    // Conferências contra o que já existe na conta.
    const prontas = await this.banco.daConta(async (tx) => {
      const ok: typeof validas = [];
      const unidades = new Map(
        (await tx.unidade.findMany()).map((u) => [u.nome.toLowerCase(), u.id]),
      );
      const servicos = new Map(
        (await tx.servico.findMany()).map((s) => [s.nome.toLowerCase(), s.id]),
      );
      const vistos = new Set<string>();
      for (const v of validas) {
        const x = v.valor;
        const erro = (mensagem: string) => erros.push({ linha: v.linha, mensagem });
        if (x.tipo === 'clientes') {
          if (
            x.telefone &&
            (vistos.has(x.telefone) ||
              (await tx.cliente.findFirst({ where: { telefone: x.telefone } })))
          ) {
            erro('Telefone já cadastrado (ou repetido na planilha).');
            continue;
          }
          if (x.telefone) vistos.add(x.telefone);
        } else if (x.tipo === 'servicos') {
          const k = x.nome.toLowerCase();
          if (servicos.has(k) || vistos.has(k)) {
            erro(`O serviço "${x.nome}" já existe.`);
            continue;
          }
          vistos.add(k);
        } else if (x.tipo === 'precos') {
          if (!servicos.has(x.servico.toLowerCase())) {
            erro(`Serviço "${x.servico}" não encontrado. Cadastre ou importe os serviços antes.`);
            continue;
          }
          if (!unidades.has(x.unidade.toLowerCase())) {
            erro(`Unidade "${x.unidade}" não encontrada.`);
            continue;
          }
        } else {
          if (!unidades.has(x.unidade.toLowerCase())) {
            erro(`Unidade "${x.unidade}" não encontrada.`);
            continue;
          }
          if (vistos.has(x.email) || (await tx.usuario.findUnique({ where: { email: x.email } }))) {
            erro(`O e-mail ${x.email} já está na equipe.`);
            continue;
          }
          vistos.add(x.email);
        }
        ok.push(v);
      }
      if (simular || tipo === 'profissionais') return ok;

      const hoje = dataLocal(new Date());
      for (const { valor: x } of ok) {
        if (x.tipo === 'clientes') {
          await tx.cliente.create({
            data: {
              nome: x.nome,
              telefone: x.telefone,
              email: x.email,
              aniversario: x.aniversario ? data(x.aniversario) : null,
            },
          });
        } else if (x.tipo === 'servicos') {
          await tx.servico.create({
            data: {
              nome: x.nome,
              categoria: x.categoria,
              duracaoMin: x.duracaoMin,
              custoProduto: x.custoProduto,
              ehExtra: x.ehExtra,
              pesoAtendimento: x.pesoAtendimento,
            },
          });
        } else if (x.tipo === 'precos') {
          const chave = {
            contaId: Contexto.usuario().contaId,
            servicoId: servicos.get(x.servico.toLowerCase())!,
            unidadeId: unidades.get(x.unidade.toLowerCase())!,
            vigenciaInicio: data(hoje),
          };
          await tx.precoServico.upsert({
            where: { contaId_servicoId_unidadeId_vigenciaInicio: chave },
            create: {
              servicoId: chave.servicoId,
              unidadeId: chave.unidadeId,
              vigenciaInicio: chave.vigenciaInicio,
              valor: x.valor,
            },
            update: { valor: x.valor },
          });
        }
      }
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: Contexto.usuario().contaId,
        acao: `importar_${tipo}`,
        depois: { linhas: ok.length },
      });
      return ok;
    });

    let gravadas = simular ? 0 : prontas.length;
    // Profissionais: cada um é um convite; vão um a um, fora da transação acima.
    if (!simular && tipo === 'profissionais') {
      gravadas = 0;
      const unidades = await this.banco.daConta((tx) => tx.unidade.findMany());
      for (const { linha, valor: x } of prontas) {
        if (x.tipo !== 'profissionais') continue;
        try {
          await this.profissionais.criar({
            unidadeId: unidades.find((u) => u.nome.toLowerCase() === x.unidade.toLowerCase())!.id,
            nome: x.nome,
            email: x.email,
            telefone: x.telefone ?? undefined,
            dataEntrada: x.dataEntrada,
            comissaoServico: { percentualBp: x.comissaoServicoBp, valorFixo: null },
            comissaoProduto: { percentualBp: x.comissaoProdutoBp, valorFixo: null },
          });
          gravadas += 1;
        } catch (e) {
          erros.push({
            linha,
            mensagem: e instanceof Error ? e.message : 'Não foi possível cadastrar.',
          });
        }
      }
      if (gravadas > 0) {
        await this.banco.daConta((tx) =>
          auditar(tx, {
            entidade: 'conta',
            entidadeId: Contexto.usuario().contaId,
            acao: 'importar_profissionais',
            depois: { linhas: gravadas },
          }),
        );
      }
    }
    if (!simular && gravadas === 0 && prontas.length === 0)
      throw Erros.validacao(
        erros.slice(0, 20).map((e) => ({ campo: `linha ${e.linha}`, mensagem: e.mensagem })),
      );
    return {
      total: linhas.length,
      validas: prontas.length,
      gravadas,
      erros: erros.sort((a, b) => a.linha - b.linha),
    };
  }
}

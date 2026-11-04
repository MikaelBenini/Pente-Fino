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
import { Prisma } from '@pente-fino/db';
import {
  buscaClientesSchema,
  clienteSchema,
  notaClienteSchema,
  temAlgumPapel,
  type ClienteDetalhe,
  type ClienteEntrada,
  type ClienteResumo,
  type MensagemDoCliente,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, filtroUnidade, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';

const POR_PAGINA = 50;

function telefoneRepetido(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    throw Erros.conflito('Já existe um cliente com esse telefone.');
  throw e;
}

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  /** Barbeiro (sem papel de balcão) vê só quem atendeu, e sem telefone se a conta esconder. */
  private async escopo(tx: Parameters<Parameters<BancoService['daConta']>[0]>[0]) {
    const quem = Contexto.usuario();
    const soBarbeiro = !temAlgumPapel(quem.papeis, ['dono', 'gestor', 'recepcao']);
    if (!soBarbeiro) return { soBarbeiro, filtro: {}, ocultar: false };
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: quem.contaId } });
    return {
      soBarbeiro,
      filtro: { comandas: { some: { profissional: { usuarioId: quem.id } } } },
      ocultar: conta.ocultarTelefoneBarbeiro,
    };
  }

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Buscar por nome ou telefone (50 por página)' })
  async listar(
    @Consulta(buscaClientesSchema) { busca, pagina }: z.infer<typeof buscaClientesSchema>,
  ): Promise<ClienteResumo[]> {
    return this.banco.daConta(async (tx) => {
      const { filtro, ocultar } = await this.escopo(tx);
      const digitos = busca?.replace(/\D/g, '') ?? '';
      const where = {
        ...filtro,
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' as const } },
                ...(digitos.length >= 4 && !ocultar ? [{ telefone: { contains: digitos } }] : []),
              ],
            }
          : {}),
      };
      const clientes = await tx.cliente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        include: {
          comandas: {
            where: { status: 'fechada' },
            select: { fechadaEm: true },
            orderBy: { fechadaEm: 'desc' },
          },
        },
      });
      return clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        telefone: ocultar ? null : c.telefone,
        email: ocultar ? null : c.email,
        aniversario: c.aniversario ? dataTexto(c.aniversario) : null,
        ultimaVisita: c.comandas[0]?.fechadaEm?.toISOString() ?? null,
        visitas: c.comandas.length,
      }));
    });
  }

  @Get(':id')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Cliente com histórico de comandas fechadas e anotações' })
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ClienteDetalhe> {
    return this.banco.daConta(async (tx) => {
      const { filtro, ocultar } = await this.escopo(tx);
      const c = await tx.cliente.findFirst({
        where: { id, ...filtro },
        include: {
          notas: { include: { autor: true }, orderBy: { criadoEm: 'desc' }, take: 50 },
          comandas: {
            where: { status: 'fechada' },
            orderBy: { fechadaEm: 'desc' },
            take: 30,
            include: {
              unidade: true,
              profissional: { include: { usuario: true } },
              itens: { include: { servico: true } },
            },
          },
        },
      });
      if (!c) throw Erros.naoEncontrado('Cliente não encontrado.');
      return {
        id: c.id,
        nome: c.nome,
        telefone: ocultar ? null : c.telefone,
        email: ocultar ? null : c.email,
        aniversario: c.aniversario ? dataTexto(c.aniversario) : null,
        ultimaVisita: c.comandas[0]?.fechadaEm?.toISOString() ?? null,
        visitas: await tx.comanda.count({ where: { clienteId: id, status: 'fechada' } }),
        origemLead: c.origemLead,
        consentimentoMsg: c.consentimentoMsg,
        consentimentoEm: c.consentimentoEm?.toISOString() ?? null,
        telefoneOculto: ocultar,
        notas: c.notas.map((n) => ({
          id: n.id,
          texto: n.texto,
          autor: n.autor?.nome ?? null,
          criadoEm: n.criadoEm.toISOString(),
        })),
        historico: c.comandas.map((m) => ({
          comandaId: m.id,
          fechadaEm: m.fechadaEm!.toISOString(),
          unidade: m.unidade.nome,
          profissional: m.profissional.usuario.nome,
          servicos: m.itens
            .filter((i) => i.tipo === 'servico')
            .map((i) => i.servico?.nome ?? 'Serviço'),
          total: m.totalLiquido,
        })),
      };
    });
  }

  @Post()
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Novo cliente (telefone único na conta)' })
  async criar(@Corpo(clienteSchema) d: ClienteEntrada) {
    return this.banco
      .daConta((tx) =>
        tx.cliente.create({
          data: {
            nome: d.nome,
            telefone: d.telefone ?? null,
            email: d.email ?? null,
            aniversario: d.aniversario ? data(d.aniversario) : null,
            origemLead: d.origemLead ?? null,
            consentimentoMsg: d.consentimentoMsg ?? false,
            // Só o aceite marcado no balcão conta como escolha; desmarcado, o bot ainda convida.
            consentimentoEm: d.consentimentoMsg ? new Date() : null,
          },
          select: { id: true, nome: true },
        }),
      )
      .catch(telefoneRepetido);
  }

  @Patch(':id')
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'Alterar cliente' })
  async alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(clienteSchema.partial()) d: Partial<ClienteEntrada>,
  ) {
    return this.banco
      .daConta(async (tx) => {
        const atual = await tx.cliente.findUnique({ where: { id } });
        if (!atual) throw Erros.naoEncontrado('Cliente não encontrado.');
        const mudouAvisos =
          d.consentimentoMsg !== undefined && d.consentimentoMsg !== atual.consentimentoMsg;
        return tx.cliente.update({
          where: { id },
          data: {
            nome: d.nome,
            telefone: d.telefone,
            email: d.email,
            aniversario:
              d.aniversario === undefined ? undefined : d.aniversario ? data(d.aniversario) : null,
            origemLead: d.origemLead,
            consentimentoMsg: d.consentimentoMsg,
            consentimentoEm: mudouAvisos ? new Date() : undefined,
          },
          select: { id: true, nome: true },
        });
      })
      .catch(telefoneRepetido);
  }

  @Get(':id/mensagens')
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'Mensagens do WhatsApp com o cliente (as 200 mais recentes)' })
  async mensagens(@Param('id', ParseUUIDPipe) id: string): Promise<MensagemDoCliente[]> {
    return this.banco.daConta(async (tx) => {
      if (!(await tx.cliente.findUnique({ where: { id }, select: { id: true } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      const ms = await tx.mensagem.findMany({
        where: { clienteId: id, ...filtroUnidade(['dono', 'gestor', 'recepcao']) },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 200,
        include: { unidade: { select: { nome: true } } },
      });
      return ms.reverse().map((m) => ({
        id: m.id,
        direcao: m.direcao,
        texto: m.texto,
        status: m.status,
        unidade: m.unidade.nome,
        criadoEm: m.criadoEm.toISOString(),
      }));
    });
  }

  @Post(':id/notas')
  @Papeis(...TODOS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Anotar algo do atendimento (preferências, cuidados)' })
  async anotar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(notaClienteSchema) { texto }: z.infer<typeof notaClienteSchema>,
  ) {
    const quem = Contexto.usuario();
    return this.banco.daConta(async (tx) => {
      const { filtro } = await this.escopo(tx);
      if (!(await tx.cliente.findFirst({ where: { id, ...filtro } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      const prof = await tx.profissional.findFirst({ where: { usuarioId: quem.id, ativo: true } });
      const n = await tx.notaCliente.create({
        data: { clienteId: id, texto, autorId: quem.id, profissionalId: prof?.id ?? null },
      });
      return { id: n.id, texto: n.texto, criadoEm: n.criadoEm.toISOString() };
    });
  }
}

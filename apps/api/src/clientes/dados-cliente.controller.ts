// Direitos do titular (LGPD, art. 18), Etapa 21. A barbearia é a controladora dos dados dos
// clientes dela; o dono atende o pedido do cliente por aqui:
//   GET  /clientes/:id/dados        tudo o que o sistema guarda dele (arquivo JSON para entregar)
//   POST /clientes/:id/anonimizar   apaga os dados pessoais; comandas e caixa ficam sem nome
// Só o dono: o arquivo junta todas as unidades e apagar não tem volta.
import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  anonimizarClienteSchema,
  NOME_CLIENTE_REMOVIDO,
  variantesTelefone,
  type AnonimizarClienteEntrada,
  type DadosDoCliente,
  type ResultadoAnonimizar,
} from '@pente-fino/shared';
import { Papeis } from '../auth/decoradores.js';
import { auditar, Auditada } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
const dia = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;
const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class DadosClienteController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get(':id/dados')
  @Papeis('dono')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'LGPD: tudo o que o sistema guarda do cliente, para entregar a ele' })
  async dados(@Param('id', ParseUUIDPipe) id: string): Promise<DadosDoCliente> {
    return this.banco.daConta(async (tx) => {
      const c = await tx.cliente.findUnique({ where: { id } });
      if (!c) throw Erros.naoEncontrado('Cliente não encontrado.');
      if (c.nome === NOME_CLIENTE_REMOVIDO)
        throw Erros.conflito('Os dados deste cliente já foram apagados.');
      const conta = await tx.conta.findUniqueOrThrow({
        where: { id: Contexto.usuario().contaId },
        select: { nome: true },
      });
      const telefones = c.telefone ? variantesTelefone(c.telefone) : [];
      const [notas, agendamentos, comandas, adesoes, avaliacoes, mensagens] = await Promise.all([
        tx.notaCliente.findMany({ where: { clienteId: id }, orderBy: { criadoEm: 'asc' } }),
        tx.agendamento.findMany({
          where: { clienteId: id },
          orderBy: { inicio: 'asc' },
          include: { unidade: { select: { nome: true } } },
        }),
        tx.comanda.findMany({
          where: { clienteId: id },
          orderBy: { criadoEm: 'asc' },
          include: {
            unidade: { select: { nome: true } },
            itens: {
              include: { servico: { select: { nome: true } }, produto: { select: { nome: true } } },
            },
          },
        }),
        tx.adesaoClube.findMany({
          where: { clienteId: id },
          include: { itemClube: { select: { nome: true } } },
        }),
        tx.avaliacao.findMany({ where: { clienteId: id }, orderBy: { criadoEm: 'asc' } }),
        tx.mensagem.findMany({
          where: {
            OR: [{ clienteId: id }, ...(telefones.length ? [{ telefone: { in: telefones } }] : [])],
          },
          orderBy: { criadoEm: 'asc' },
          include: { unidade: { select: { nome: true } } },
        }),
      ]);
      await auditar(tx, {
        entidade: 'cliente',
        entidadeId: id,
        acao: 'exportar_dados_lgpd',
        depois: { mensagens: mensagens.length, atendimentos: comandas.length },
      });
      return {
        geradoEm: new Date().toISOString(),
        barbearia: conta.nome,
        cliente: {
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          aniversario: dia(c.aniversario),
          aceitaMensagens: c.consentimentoMsg,
          escolheuEm: iso(c.consentimentoEm),
          cadastradoEm: c.criadoEm.toISOString(),
        },
        anotacoes: notas.map((n) => ({ texto: n.texto, criadaEm: n.criadoEm.toISOString() })),
        horarios: agendamentos.map((a) => ({
          inicio: a.inicio.toISOString(),
          unidade: a.unidade.nome,
          status: a.status,
          observacao: a.observacao,
        })),
        atendimentos: comandas.map((m) => ({
          data: (m.fechadaEm ?? m.criadoEm).toISOString(),
          unidade: m.unidade.nome,
          status: m.status,
          total: m.totalLiquido,
          itens: m.itens.map((i) => ({
            descricao: i.servico?.nome ?? i.produto?.nome ?? i.descricao ?? i.tipo,
            quantidade: i.quantidade,
            valor: i.precoUnitario * i.quantidade - i.desconto,
          })),
        })),
        clube: adesoes.map((a) => ({
          plano: a.itemClube.nome,
          status: a.status,
          inicio: dia(a.inicio)!,
          vencimento: dia(a.vencimento)!,
        })),
        avaliacoes: avaliacoes.map((a) => ({
          data: a.criadoEm.toISOString(),
          nota: a.notaAtendimento,
          comentario: a.comentario,
        })),
        mensagens: mensagens.map((m) => ({
          data: m.criadoEm.toISOString(),
          unidade: m.unidade.nome,
          direcao: m.direcao,
          texto: m.texto,
        })),
      };
    });
  }

  @Post(':id/anonimizar')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'LGPD: apaga os dados pessoais do cliente (nome, telefone, e-mail, conversas, anotações); comandas e caixa ficam sem nome',
  })
  async anonimizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(anonimizarClienteSchema) d: AnonimizarClienteEntrada,
  ): Promise<ResultadoAnonimizar> {
    return this.banco.daConta(async (tx) => {
      const c = await tx.cliente.findUnique({ where: { id } });
      if (!c) throw Erros.naoEncontrado('Cliente não encontrado.');
      if (c.nome === NOME_CLIENTE_REMOVIDO)
        throw Erros.conflito('Os dados deste cliente já foram apagados.');
      if (normalizar(d.confirmacao) !== normalizar(c.nome))
        throw Erros.requisicaoInvalida(
          'confirmacao_diferente',
          'Para confirmar, digite o nome do cliente exatamente como está no cadastro.',
        );
      // O que ainda está correndo precisa ser resolvido antes (senão some sem aviso).
      const [clube, online, futuros] = await Promise.all([
        tx.adesaoClube.count({ where: { clienteId: id, status: 'ativa' } }),
        tx.assinaturaClubeOnline.count({
          where: { clienteId: id, status: { in: ['aguardando', 'ativa'] } },
        }),
        tx.agendamento.count({
          where: {
            clienteId: id,
            inicio: { gt: new Date() },
            status: { in: ['agendado', 'confirmado'] },
          },
        }),
      ]);
      if (clube || online)
        throw Erros.conflito(
          'O cliente tem plano do clube ativo. Cancele a adesão no Clube antes de apagar os dados.',
        );
      if (futuros)
        throw Erros.conflito(
          'O cliente tem horário marcado. Cancele os horários futuros antes de apagar os dados.',
        );

      const telefones = c.telefone ? variantesTelefone(c.telefone) : [];
      const doCliente = {
        OR: [{ clienteId: id }, ...(telefones.length ? [{ telefone: { in: telefones } }] : [])],
      };
      const mensagens = (await tx.mensagem.deleteMany({ where: doCliente })).count;
      const sessoesBot = (await tx.botSessao.deleteMany({ where: doCliente })).count;
      const anotacoes = (await tx.notaCliente.deleteMany({ where: { clienteId: id } })).count;
      const listaEspera = (await tx.listaEspera.deleteMany({ where: { clienteId: id } })).count;
      await tx.tokenAgendamento.deleteMany({ where: { clienteId: id } });
      const avaliacoes = (
        await tx.avaliacao.updateMany({
          where: { clienteId: id },
          data: { comentario: null, telefone: '', motivo: null },
        })
      ).count;
      await tx.agendamento.updateMany({ where: { clienteId: id }, data: { observacao: null } });
      await tx.cliente.update({
        where: { id },
        data: {
          nome: NOME_CLIENTE_REMOVIDO,
          telefone: null,
          email: null,
          aniversario: null,
          origemLead: null,
          etapaLead: null,
          canalPreferido: null,
          consentimentoMsg: false,
          consentimentoEm: new Date(),
        },
      });
      const r = { mensagens, anotacoes, sessoesBot, listaEspera, avaliacoes };
      // A auditoria guarda que aconteceu e o motivo, nunca o dado apagado.
      await auditar(tx, {
        entidade: 'cliente',
        entidadeId: id,
        acao: 'anonimizar_lgpd',
        motivo: d.motivo,
        depois: r,
      });
      return r;
    });
  }
}

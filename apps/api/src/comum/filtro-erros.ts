import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@pente-fino/db';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { Contexto } from './contexto.js';
import { ErroApp, type RespostaErro } from './erros.js';

const PADRAO_POR_STATUS: Record<number, [string, string]> = {
  400: ['requisicao_invalida', 'Requisição inválida.'],
  401: ['nao_autenticado', 'Faça login para continuar.'],
  403: ['sem_permissao', 'Você não tem permissão para isso.'],
  404: ['nao_encontrado', 'Não encontrado.'],
  405: ['metodo_nao_permitido', 'Método não permitido.'],
  409: ['conflito', 'Esta ação conflita com dados existentes.'],
  413: ['muito_grande', 'O envio é grande demais.'],
  429: ['muitas_tentativas', 'Muitas tentativas. Aguarde um minuto e tente de novo.'],
};

/** Restrições do banco com mensagem própria. */
const RESTRICOES: Record<string, string> = {
  agendamento_sem_sobreposicao: 'Este profissional já tem um agendamento nesse horário.',
  usuario_email_key: 'Este e-mail já está cadastrado.',
  unidade_slug_key: 'Este endereço de agendamento já está em uso. Escolha outro.',
};

/** Todo erro sai no mesmo formato, em português, com o id da requisição. */
@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    const [status, corpo] = this.traduzir(excecao);
    corpo.requestId = Contexto.atual()?.requestId;
    if (status >= 500) this.logger.error(excecao);
    resposta.status(status).json(corpo);
  }

  private traduzir(excecao: unknown): [number, RespostaErro] {
    if (excecao instanceof ErroApp) {
      return [
        excecao.getStatus(),
        { erro: { codigo: excecao.codigo, mensagem: excecao.message, campos: excecao.campos } },
      ];
    }
    if (excecao instanceof ThrottlerException) return this.padrao(HttpStatus.TOO_MANY_REQUESTS);
    if (excecao instanceof HttpException) return this.padrao(excecao.getStatus());
    if (excecao instanceof Prisma.PrismaClientKnownRequestError) return this.doPrisma(excecao);
    // Restrição do banco vinda por outro caminho (driver): duas pessoas agendando ao mesmo tempo.
    if (excecao instanceof Error) {
      for (const [restricao, mensagem] of Object.entries(RESTRICOES)) {
        if (excecao.message.includes(restricao))
          return [HttpStatus.CONFLICT, { erro: { codigo: 'conflito', mensagem } }];
      }
    }
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      {
        erro: {
          codigo: 'erro_interno',
          mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
        },
      },
    ];
  }

  private padrao(status: number): [number, RespostaErro] {
    const [codigo, mensagem] = PADRAO_POR_STATUS[status] ?? [
      'erro',
      'Não foi possível concluir a ação.',
    ];
    return [status, { erro: { codigo, mensagem } }];
  }

  private doPrisma(e: Prisma.PrismaClientKnownRequestError): [number, RespostaErro] {
    const texto = `${e.message} ${JSON.stringify(e.meta ?? {})}`;
    for (const [restricao, mensagem] of Object.entries(RESTRICOES)) {
      if (texto.includes(restricao))
        return [HttpStatus.CONFLICT, { erro: { codigo: 'conflito', mensagem } }];
    }
    if (texto.includes('row-level security')) return this.padrao(HttpStatus.FORBIDDEN);
    switch (e.code) {
      case 'P2002':
        return [
          HttpStatus.CONFLICT,
          { erro: { codigo: 'conflito', mensagem: 'Já existe um cadastro com esses dados.' } },
        ];
      case 'P2025':
        return this.padrao(HttpStatus.NOT_FOUND);
      case 'P2003':
        return [
          HttpStatus.CONFLICT,
          {
            erro: {
              codigo: 'conflito',
              mensagem: 'Registro ligado a outro que não existe ou está em uso.',
            },
          },
        ];
      default:
        this.logger.error(e);
        return [
          HttpStatus.INTERNAL_SERVER_ERROR,
          {
            erro: {
              codigo: 'erro_interno',
              mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
            },
          },
        ];
    }
  }
}

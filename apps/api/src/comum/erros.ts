import { HttpException, HttpStatus } from '@nestjs/common';

export interface CampoInvalido {
  campo: string;
  mensagem: string;
}

/** Corpo de todo erro da API. */
export interface RespostaErro {
  erro: { codigo: string; mensagem: string; campos?: CampoInvalido[] };
  requestId?: string;
}

/** Erro de negócio com código estável (o front decide pelo código) e mensagem em pt-BR. */
export class ErroApp extends HttpException {
  constructor(
    status: HttpStatus,
    readonly codigo: string,
    mensagem: string,
    readonly campos?: CampoInvalido[],
  ) {
    super(mensagem, status);
  }
}

export const Erros = {
  validacao: (campos: CampoInvalido[]) =>
    new ErroApp(HttpStatus.BAD_REQUEST, 'validacao', 'Confira os campos destacados.', campos),
  naoAutenticado: (mensagem = 'Faça login para continuar.') =>
    new ErroApp(HttpStatus.UNAUTHORIZED, 'nao_autenticado', mensagem),
  semPermissao: (mensagem = 'Você não tem permissão para isso.') =>
    new ErroApp(HttpStatus.FORBIDDEN, 'sem_permissao', mensagem),
  naoEncontrado: (mensagem = 'Não encontrado.') =>
    new ErroApp(HttpStatus.NOT_FOUND, 'nao_encontrado', mensagem),
  conflito: (mensagem: string) => new ErroApp(HttpStatus.CONFLICT, 'conflito', mensagem),
  requisicaoInvalida: (codigo: string, mensagem: string) =>
    new ErroApp(HttpStatus.BAD_REQUEST, codigo, mensagem),
};

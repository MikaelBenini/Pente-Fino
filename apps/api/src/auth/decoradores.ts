import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { Papel } from '@pente-fino/shared';
import { Contexto, type UsuarioAutenticado } from '../comum/contexto.js';

export const ROTA_PUBLICA = 'rota_publica';
/** Rota sem login (login, renovação, convite, recuperação de senha, saúde). */
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);

export const PAPEIS_ACEITOS = 'papeis_aceitos';
/**
 * Papéis aceitos na rota. Se a requisição traz `unidadeId` (rota, query ou corpo), o
 * papel precisa valer nessa unidade; papel sem unidade vale em todas.
 */
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS_ACEITOS, papeis);

export const LIMITE_AUTENTICACAO = 'limite_autenticacao';
/** Aplica o limite de tentativas por minuto das rotas de autenticação. */
export const LimiteAutenticacao = () => SetMetadata(LIMITE_AUTENTICACAO, true);

/** Usuário autenticado da requisição. */
export const UsuarioAtual = createParamDecorator((): UsuarioAutenticado => Contexto.usuario());

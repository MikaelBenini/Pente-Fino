import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { Papel, Recurso } from '@pente-fino/shared';
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

export const LIVRE_SEM_ASSINATURA = 'livre_sem_assinatura';
/**
 * Rota que grava, mas continua valendo com a conta só para consulta (sair, trocar a senha,
 * pagar a assinatura): a pessoa precisa conseguir se resolver.
 */
export const LivreSemAssinatura = () => SetMetadata(LIVRE_SEM_ASSINATURA, true);

export const LIMITE_AUTENTICACAO = 'limite_autenticacao';
/** Aplica o limite de tentativas por minuto das rotas de autenticação. */
export const LimiteAutenticacao = () => SetMetadata(LIMITE_AUTENTICACAO, true);

/** Usuário autenticado da requisição. */
export const UsuarioAtual = createParamDecorator((): UsuarioAutenticado => Contexto.usuario());

export const RECURSO_DO_PLANO = 'recurso_do_plano';
export interface ExigenciaDePlano {
  recurso: Recurso;
  /** true: ler continua livre (o que já foi lançado aparece); só gravar exige o plano. */
  soEscrita: boolean;
}
/**
 * Recurso que só vale a partir de um plano (packages/shared/src/planos.ts). Sem o plano, a
 * API responde 403 "recurso_do_plano" com o convite para mudar.
 */
export const ExigeRecurso = (recurso: Recurso, opcoes: { soEscrita?: boolean } = {}) =>
  SetMetadata(RECURSO_DO_PLANO, {
    recurso,
    soEscrita: opcoes.soEscrita ?? false,
  } satisfies ExigenciaDePlano);

/** Rota livre do recurso exigido na classe (ex.: desconectar o WhatsApp num plano menor). */
export const LivreDoPlano = () => SetMetadata(RECURSO_DO_PLANO, null);

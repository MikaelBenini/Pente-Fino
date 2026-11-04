'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  esqueciSenhaSchema,
  loginSchema,
  senhaSchema,
  type LoginEntrada,
} from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/api';
import { aplicarErroDaApi } from '@/lib/formularios';
import { useHidratado } from '@/lib/hidratado';
import { destinoSeguro } from '@/lib/seguranca';
import { Aviso } from './aviso';

const link =
  'font-medium text-tinta underline decoration-borda-forte underline-offset-4 hover:decoration-modulo';

export function FormularioEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratado = useHidratado();
  const { register, handleSubmit, setError, formState } = useForm<LoginEntrada>({
    resolver: zodResolver(loginSchema),
  });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await api('auth/login', { corpo: dados });
      router.replace(destinoSeguro(params.get('voltar')));
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <form onSubmit={enviar} method="post" noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Entrar</h1>
        <p className="text-tinta-suave">Use o e-mail cadastrado na barbearia.</p>
      </div>
      {params.get('motivo') === 'sessao' && (
        <Aviso tom="info">Sua sessão terminou. Entre de novo para continuar.</Aviso>
      )}
      {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
      <Campo
        id="email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        erro={formState.errors.email?.message}
        {...register('email')}
      />
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        erro={formState.errors.senha?.message}
        {...register('senha')}
      />
      <Botao type="submit" disabled={!hidratado} carregando={formState.isSubmitting} larguraTotal>
        Entrar
      </Botao>
      <Link href="/esqueci-senha" className={`${link} self-start text-sm`}>
        Esqueci minha senha
      </Link>
    </form>
  );
}

export function FormularioEsqueciSenha() {
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratado = useHidratado();
  const { register, handleSubmit, setError, formState } = useForm<
    z.infer<typeof esqueciSenhaSchema>
  >({
    resolver: zodResolver(esqueciSenhaSchema),
  });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      const r = await api<{ mensagem: string }>('auth/esqueci-senha', { corpo: dados });
      setEnviado(r.mensagem);
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Recuperar senha</h1>
        <p className="text-tinta-suave">
          Enviamos um link para você criar uma senha nova. Ele vale por 1 hora.
        </p>
      </div>
      {enviado ? (
        <Aviso tom="sucesso">{enviado} Confira também a caixa de spam.</Aviso>
      ) : (
        <form onSubmit={enviar} method="post" noValidate className="flex flex-col gap-5">
          {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
          <Campo
            id="email"
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            erro={formState.errors.email?.message}
            {...register('email')}
          />
          <Botao
            type="submit"
            disabled={!hidratado}
            carregando={formState.isSubmitting}
            larguraTotal
          >
            Enviar link
          </Botao>
        </form>
      )}
      <Link href="/entrar" className={`${link} self-start text-sm`}>
        Voltar para o login
      </Link>
    </div>
  );
}

const novaSenhaSchema = z
  .object({ senha: senhaSchema, confirmar: z.string() })
  .refine((d) => d.senha === d.confirmar, {
    error: 'As senhas não são iguais.',
    path: ['confirmar'],
  });
type NovaSenha = z.infer<typeof novaSenhaSchema>;

/** Criar senha a partir de um link (convite ou redefinição). */
export function FormularioNovaSenha({ tipo }: { tipo: 'convite' | 'redefinir' }) {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [concluido, setConcluido] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratado = useHidratado();
  const { register, handleSubmit, setError, formState } = useForm<NovaSenha>({
    resolver: zodResolver(novaSenhaSchema),
  });

  const titulo = tipo === 'convite' ? 'Criar sua senha' : 'Nova senha';
  const intro =
    tipo === 'convite'
      ? 'Você foi convidado para a equipe. Crie uma senha para entrar.'
      : 'Escolha uma senha nova. As sessões abertas em outros aparelhos serão encerradas.';

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold">{titulo}</h1>
        <Aviso tom="erro">
          Este link está incompleto. Abra de novo pelo e-mail ou peça um novo.
        </Aviso>
        <Link
          href={tipo === 'convite' ? '/entrar' : '/esqueci-senha'}
          className={`${link} self-start text-sm`}
        >
          {tipo === 'convite' ? 'Ir para o login' : 'Pedir um novo link'}
        </Link>
      </div>
    );
  }

  const enviar = handleSubmit(async ({ senha }) => {
    setErroGeral(null);
    try {
      await api(tipo === 'convite' ? 'auth/convite' : 'auth/redefinir-senha', {
        corpo: { token, senha },
      });
      if (tipo === 'convite') {
        router.replace('/');
      } else {
        setConcluido(true);
      }
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  if (concluido) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold">Senha criada</h1>
        <Aviso tom="sucesso">Pronto. Entre com o seu e-mail e a senha nova.</Aviso>
        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center justify-center self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} method="post" noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{titulo}</h1>
        <p className="text-tinta-suave">{intro}</p>
      </div>
      {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="new-password"
        dica="Pelo menos 8 caracteres."
        erro={formState.errors.senha?.message}
        {...register('senha')}
      />
      <Campo
        id="confirmar"
        rotulo="Repita a senha"
        type="password"
        autoComplete="new-password"
        erro={formState.errors.confirmar?.message}
        {...register('confirmar')}
      />
      <Botao type="submit" disabled={!hidratado} carregando={formState.isSubmitting} larguraTotal>
        {tipo === 'convite' ? 'Criar senha e entrar' : 'Salvar senha nova'}
      </Botao>
    </form>
  );
}

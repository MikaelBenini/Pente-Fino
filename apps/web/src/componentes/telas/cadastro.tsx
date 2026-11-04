'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  cadastroContaSchema,
  NOME_PLANO,
  PLANOS,
  type CadastroContaEntrada,
} from '@pente-fino/shared';
import { Botao, Campo, cn } from '@pente-fino/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { api } from '@/lib/api';
import { aplicarErroDaApi } from '@/lib/formularios';
import { useHidratado } from '@/lib/hidratado';
import { Aviso } from '../aviso';

/** Preços e limites dos planos (CLAUDE.md, "Planos"). */
const RESUMO_PLANO = {
  basico: { preco: 'R$ 79,90/mês', limite: '1 unidade · até 3 profissionais' },
  pro: { preco: 'R$ 149,90/mês', limite: '1 unidade · até 10 profissionais · clube e bot' },
  premium: {
    preco: 'R$ 249,90/mês',
    limite: 'Várias unidades · profissionais ilimitados · lucro real',
  },
} as const;

export function FormularioCadastro() {
  const router = useRouter();
  const hidratado = useHidratado();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, control, formState } = useForm<
    z.input<typeof cadastroContaSchema>,
    unknown,
    CadastroContaEntrada
  >({
    resolver: zodResolver(cadastroContaSchema),
    defaultValues: { plano: 'pro' },
  });
  const plano = useWatch({ control, name: 'plano' });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await api('publico/contas', { corpo: dados });
      router.replace('/configuracao-inicial');
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <form method="post" noValidate onSubmit={enviar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Criar conta</h1>
        <p className="text-tinta-suave">
          14 dias para testar. Em 10 minutos a barbearia está configurada.
        </p>
      </div>
      {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
      <Campo
        id="cadastro-barbearia"
        rotulo="Nome da barbearia"
        autoComplete="organization"
        erro={formState.errors.barbearia?.message}
        {...register('barbearia')}
      />
      <Campo
        id="cadastro-nome"
        rotulo="Seu nome"
        autoComplete="name"
        erro={formState.errors.nome?.message}
        {...register('nome')}
      />
      <Campo
        id="cadastro-email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        erro={formState.errors.email?.message}
        {...register('email')}
      />
      <Campo
        id="cadastro-senha"
        rotulo="Senha"
        type="password"
        autoComplete="new-password"
        dica="Pelo menos 8 caracteres."
        erro={formState.errors.senha?.message}
        {...register('senha')}
      />
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium">Plano</legend>
        <div className="flex flex-col gap-2">
          {PLANOS.map((p) => (
            <label
              key={p}
              className={cn(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foco',
                plano === p ? 'border-modulo bg-superficie-2' : 'border-borda',
              )}
            >
              <input
                type="radio"
                value={p}
                checked={plano === p}
                onChange={() => setValue('plano', p)}
                className="size-5 accent-[var(--modulo)]"
                name="plano"
              />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">
                  {NOME_PLANO[p]} ·{' '}
                  <span className="font-denso tabular-nums">{RESUMO_PLANO[p].preco}</span>
                </span>
                <span className="text-sm text-tinta-suave">{RESUMO_PLANO[p].limite}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--acao)]"
          {...register('aceite', { setValueAs: (v) => v === true || v === 'on' })}
        />
        <span className="text-sm text-tinta-suave">
          Li e aceito os termos de uso e a política de privacidade (LGPD).
        </span>
      </label>
      {formState.errors.aceite && (
        <p className="text-sm text-perigo-texto">{formState.errors.aceite.message}</p>
      )}
      <Botao type="submit" disabled={!hidratado} carregando={formState.isSubmitting} larguraTotal>
        Criar conta
      </Botao>
      <p className="text-sm text-tinta-suave">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-tinta underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

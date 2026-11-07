'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  cadastroContaSchema,
  CICLOS,
  type Ciclo,
  DIAS_TESTE,
  formatarMoeda,
  LIMITES_PLANO,
  NOME_PLANO,
  PLANOS,
  type PlanoConta,
  precoPorMes,
  type CadastroContaEntrada,
} from '@pente-fino/shared';
import { Botao, Campo, cn } from '@pente-fino/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { api } from '@/lib/api';
import { useTabelaPrecos } from '@/lib/consultas';
import { aplicarErroDaApi } from '@/lib/formularios';
import { useHidratado } from '@/lib/hidratado';
import { Aviso } from '../aviso';

function limitePlano(p: PlanoConta) {
  if (p === 'premium') return 'Várias unidades · profissionais ilimitados';
  const l = LIMITES_PLANO[p];
  return `${l.unidades} unidade · até ${l.profissionais} profissionais`;
}

/** Plano e ciclo vindos da página de planos (?plano=pro&ciclo=anual); valor estranho é ignorado. */
function daUrl<T extends string>(valor: string | null, aceitos: readonly T[], padrao: T): T {
  return aceitos.includes(valor as T) ? (valor as T) : padrao;
}

export function FormularioCadastro() {
  const tabela = useTabelaPrecos();
  const router = useRouter();
  const params = useSearchParams();
  const hidratado = useHidratado();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, control, formState } = useForm<
    z.input<typeof cadastroContaSchema>,
    unknown,
    CadastroContaEntrada
  >({
    resolver: zodResolver(cadastroContaSchema),
    defaultValues: {
      plano: daUrl(params.get('plano'), PLANOS, 'pro'),
      ciclo: daUrl(params.get('ciclo'), CICLOS, 'mensal'),
    },
  });
  const plano = useWatch({ control, name: 'plano' });
  const ciclo: Ciclo = useWatch({ control, name: 'ciclo' }) ?? 'mensal';

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
          {DIAS_TESTE} dias para testar, sem cartão. Em 10 minutos a barbearia está configurada.
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
        <legend className="mb-1.5 text-sm font-medium">Pagamento depois do teste</legend>
        <div className="grid grid-cols-2 gap-2">
          {CICLOS.map((c) => (
            <label
              key={c}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foco',
                ciclo === c ? 'border-modulo bg-superficie-2' : 'border-borda',
              )}
            >
              <input
                type="radio"
                value={c}
                checked={ciclo === c}
                onChange={() => setValue('ciclo', c)}
                className="size-5 accent-[var(--modulo)]"
                name="ciclo"
              />
              <span className="font-medium">{c === 'mensal' ? 'Mensal' : 'Anual (-2 meses)'}</span>
            </label>
          ))}
        </div>
      </fieldset>
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
                  <span className="font-denso tabular-nums">
                    {formatarMoeda(precoPorMes(p, ciclo, 1, tabela))}/mês
                  </span>
                </span>
                <span className="text-sm text-tinta-suave">{limitePlano(p)}</span>
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
          Li e aceito os{' '}
          <Link href="/termos" target="_blank" className="text-tinta underline underline-offset-4">
            termos de uso
          </Link>{' '}
          e a{' '}
          <Link
            href="/privacidade"
            target="_blank"
            className="text-tinta underline underline-offset-4"
          >
            política de privacidade
          </Link>{' '}
          (LGPD).
        </span>
      </label>
      {formState.errors.aceite && (
        <p className="text-sm text-perigo-texto">{formState.errors.aceite.message}</p>
      )}
      <Botao type="submit" disabled={!hidratado} carregando={formState.isSubmitting} larguraTotal>
        Criar conta
      </Botao>
      <p className="text-sm text-tinta-suave">
        <Link href="/planos" className="font-medium text-tinta underline underline-offset-4">
          Comparar planos
        </Link>
        {' · '}Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-tinta underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

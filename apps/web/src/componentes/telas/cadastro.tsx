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
  aplicarDesconto,
  formatarPercentualBp,
  OFERTA_LANCAMENTO,
  precoPorMes,
  textoEconomiaAnual,
  type CadastroContaEntrada,
} from '@pente-fino/shared';
import { Botao, Campo, cn } from '@pente-fino/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { api, ErroApi } from '@/lib/api';
import { useTabelaPrecos } from '@/lib/consultas';
import { aplicarErroDaApi } from '@/lib/formularios';
import { useHidratado } from '@/lib/hidratado';
import { Aviso } from '../aviso';
import { eventoGoogle } from '../site/tag-google';

function limitePlano(p: PlanoConta) {
  if (p === 'premium') return 'Várias unidades · profissionais ilimitados';
  const l = LIMITES_PLANO[p];
  return `${l.unidades} unidade · até ${l.profissionais} profissionais`;
}

/** "(11) 98888-7777" enquanto digita; aceita colar com +55. */
function mascaraWhatsapp(v: string): string {
  const d = v
    .replace(/\D/g, '')
    .replace(/^55(?=\d{10,11}$)/, '')
    .slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Plano e ciclo vindos da página de planos (?plano=pro&ciclo=anual); valor estranho é ignorado. */
function daUrl<T extends string>(valor: string | null, aceitos: readonly T[], padrao: T): T {
  return aceitos.includes(valor as T) ? (valor as T) : padrao;
}

export function FormularioCadastro() {
  const tabela = useTabelaPrecos();
  const [cupom, setCupom] = useState<{ codigo: string; descontoBp: number } | null>(null);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  // Depois que a pessoa mexe no campo, vale o que ela digitou; antes, o cupom que veio no link.
  const [tocouCupom, setTocouCupom] = useState(false);
  async function conferirCupom(codigo: string) {
    setTocouCupom(true);
    setErroCupom(null);
    setCupom(null);
    if (!codigo.trim()) return;
    try {
      setCupom(
        await api<{ codigo: string; descontoBp: number }>(
          `publico/cupom/${encodeURIComponent(codigo.trim())}`,
        ),
      );
    } catch (e) {
      setErroCupom(
        e instanceof ErroApi
          ? (e.campos[0]?.mensagem ?? e.message)
          : 'Não deu para conferir o cupom.',
      );
    }
  }
  const [verSenha, setVerSenha] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const hidratado = useHidratado();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  // Proteção contra robôs: quando o formulário abriu e um campo isca que pessoas não veem.
  const [abertoEm] = useState(() => Date.now());
  const { register, handleSubmit, setError, setValue, control, formState } = useForm<
    z.input<typeof cadastroContaSchema>,
    unknown,
    CadastroContaEntrada
  >({
    resolver: zodResolver(cadastroContaSchema),
    defaultValues: {
      plano: daUrl(params.get('plano'), PLANOS, 'pro'),
      ciclo: daUrl(params.get('ciclo'), CICLOS, 'mensal'),
      cupom: params.get('cupom')?.slice(0, 30) ?? '',
      whatsapp: '',
    },
  });
  // Cupom vindo do link (ex.: anúncio "30% off"): confere ao abrir, para o desconto aparecer já.
  const cupomDoLink = params.get('cupom')?.trim().slice(0, 30) ?? '';
  const doLink = useQuery({
    queryKey: ['cupom', cupomDoLink],
    queryFn: () =>
      api<{ codigo: string; descontoBp: number }>(
        `publico/cupom/${encodeURIComponent(cupomDoLink)}`,
      ),
    enabled: cupomDoLink !== '',
    retry: false,
    staleTime: Infinity,
  });
  // A oferta de lançamento acabou e o visitante veio por um link antigo: o cupom some em silêncio.
  const ofertaDoLinkAcabou =
    doLink.isError && cupomDoLink.toUpperCase() === OFERTA_LANCAMENTO.codigo;
  useEffect(() => {
    if (ofertaDoLinkAcabou) setValue('cupom', '');
  }, [ofertaDoLinkAcabou, setValue]);
  const cupomAtivo = tocouCupom ? cupom : (doLink.data ?? null);
  const erroDoCupom = tocouCupom
    ? erroCupom
    : doLink.isError && !ofertaDoLinkAcabou
      ? doLink.error instanceof ErroApi
        ? (doLink.error.campos[0]?.mensagem ?? doLink.error.message)
        : 'Não deu para conferir o cupom.'
      : null;
  const plano = useWatch({ control, name: 'plano' });
  const ciclo: Ciclo = useWatch({ control, name: 'ciclo' }) ?? 'mensal';

  const enviar = (site: string) =>
    handleSubmit(async (dados) => {
      setErroGeral(null);
      try {
        await api('publico/contas', {
          corpo: { ...dados, abertoEm, site },
        });
        // Conversão para o Google Ads (só com a tag carregada e o aceite de cookies).
        eventoGoogle('cadastro_concluido', { plano: dados.plano, ciclo: dados.ciclo });
        router.replace('/configuracao-inicial');
      } catch (e) {
        setErroGeral(aplicarErroDaApi(e, setError));
      }
    });

  return (
    <form
      method="post"
      noValidate
      onSubmit={(e) => enviar(String(new FormData(e.currentTarget).get('site') ?? ''))(e)}
      className="flex flex-col gap-5"
    >
      {/* Campo isca: fora da tela e do teclado; só robô preenche. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="cadastro-site">Site da barbearia (deixe em branco)</label>
        <input id="cadastro-site" name="site" type="text" tabIndex={-1} autoComplete="off" />
      </div>
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
        required
        aria-required
        erro={formState.errors.barbearia?.message}
        {...register('barbearia')}
      />
      <Campo
        id="cadastro-nome"
        rotulo="Seu nome"
        autoComplete="name"
        required
        aria-required
        erro={formState.errors.nome?.message}
        {...register('nome')}
      />
      <Campo
        id="cadastro-email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        aria-required
        erro={formState.errors.email?.message}
        {...register('email')}
      />
      <div className="flex flex-col gap-1">
        <Campo
          id="cadastro-senha"
          rotulo="Senha"
          type={verSenha ? 'text' : 'password'}
          autoComplete="new-password"
          dica="Pelo menos 8 caracteres."
          required
          aria-required
          erro={formState.errors.senha?.message}
          {...register('senha')}
        />
        <button
          type="button"
          aria-controls="cadastro-senha"
          aria-pressed={verSenha}
          onClick={() => setVerSenha(!verSenha)}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-tinta-suave underline-offset-4 hover:text-tinta hover:underline focus-visible:outline-2 focus-visible:outline-foco"
        >
          {verSenha ? 'Esconder senha' : 'Mostrar senha'}
        </button>
      </div>
      <Campo
        id="cadastro-whatsapp"
        rotulo="WhatsApp (opcional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(00) 00000-0000"
        dica="Para ajudar na configuração. Não enviamos spam."
        erro={formState.errors.whatsapp?.message}
        {...register('whatsapp', {
          onChange: (e) => setValue('whatsapp', mascaraWhatsapp(e.target.value)),
        })}
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
              <span className="font-medium">{c === 'mensal' ? 'Mensal' : 'Anual'}</span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-acao-texto">No anual, {textoEconomiaAnual(tabela)}.</p>
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
                  {cupomAtivo && (
                    <s className="font-denso font-normal text-tinta-suave tabular-nums">
                      <span className="sr-only">de </span>
                      {formatarMoeda(precoPorMes(p, ciclo, 1, tabela))}
                    </s>
                  )}{' '}
                  <span className="font-denso tabular-nums">
                    {cupomAtivo && <span className="sr-only">por </span>}
                    {formatarMoeda(
                      aplicarDesconto(precoPorMes(p, ciclo, 1, tabela), cupomAtivo?.descontoBp),
                    )}
                    /mês
                  </span>
                </span>
                <span className="text-sm text-tinta-suave">{limitePlano(p)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Campo
        id="cadastro-cupom"
        rotulo="Cupom de desconto (opcional)"
        autoComplete="off"
        dica={
          cupomAtivo
            ? `${formatarPercentualBp(cupomAtivo.descontoBp)} de desconto para sempre aplicado (${cupomAtivo.codigo}).`
            : undefined
        }
        erro={formState.errors.cupom?.message ?? erroDoCupom ?? undefined}
        {...register('cupom', { onBlur: (e) => conferirCupom(e.target.value) })}
      />
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

'use client';

import { formatarMoeda, type ClubeParaAssinar } from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Check, Crown, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from './aviso';

/**
 * Link do clube (/assinar?u=slug&p=plano), aberto pelo WhatsApp: o cliente escolhe o plano,
 * informa nome, WhatsApp e CPF e vai para a página de pagamento do Asaas (Pix ou cartão).
 */
export function AssinarClube() {
  const params = useSearchParams();
  const slug = params.get('u') ?? '';
  const [escolhido, setEscolhido] = useState<string | null>(params.get('p'));
  const clube = useQuery({
    queryKey: ['publico', 'clube', slug],
    queryFn: () => api<ClubeParaAssinar>(`publico/clube/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    retry: false,
  });
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!slug || clube.isError)
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-3">
        <h1 className="text-2xl font-semibold">Link do clube não encontrado</h1>
        <p className="text-tinta-suave">
          {clube.error instanceof ErroApi
            ? clube.error.message
            : 'Confira o link com a barbearia e tente de novo.'}
        </p>
      </main>
    );
  if (clube.isPending) return <p className="text-tinta-suave">Carregando os planos…</p>;

  const c = clube.data;
  const plano =
    c.planos.find((p) => p.id === escolhido) ?? (c.planos.length === 1 ? c.planos[0] : undefined);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 font-denso text-sm font-semibold tracking-widest text-modulo-texto uppercase">
          <Crown aria-hidden className="size-4" /> Clube {c.barbearia}
        </p>
        <h1 className="text-3xl font-semibold">Assine e garanta seus atendimentos</h1>
        <p className="text-tinta-suave">
          Paga uma vez por mês, no Pix ou no cartão, e é atendido sem pagar na hora. Cancela quando
          quiser, com a barbearia.
        </p>
      </div>

      {c.planos.length === 0 ? (
        <Aviso tom="info">A barbearia ainda não tem planos abertos para assinar.</Aviso>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-semibold">Escolha o plano</legend>
          {c.planos.map((p) => {
            const ativo = plano?.id === p.id;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors ${
                  ativo
                    ? 'border-modulo bg-superficie-2'
                    : 'border-borda bg-superficie hover:border-borda-forte'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="plano"
                      value={p.id}
                      checked={ativo}
                      onChange={() => setEscolhido(p.id)}
                      className="size-5 accent-[var(--modulo)]"
                    />
                    <span className="text-lg font-semibold">{p.nome}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-denso text-2xl font-bold tabular-nums">
                      {formatarMoeda(p.valor)}
                    </span>
                    <span className="text-xs text-tinta-suave">por mês</span>
                  </span>
                </span>
                {p.descricao && <span className="text-sm text-tinta-suave">{p.descricao}</span>}
                <ul className="flex flex-col gap-1 text-sm">
                  {p.inclui.map((i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check aria-hidden className="size-4 shrink-0 text-acao-texto" />
                      {i}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </fieldset>
      )}

      {plano && (
        <form
          noValidate
          aria-label="Seus dados"
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setCampos({});
            setEnviando(true);
            try {
              const r = await api<{ link: string }>(
                `publico/clube/${encodeURIComponent(slug)}/assinar`,
                {
                  corpo: { itemClubeId: plano.id, nome, telefone, cpf, email },
                },
              );
              window.location.href = r.link;
            } catch (er) {
              if (er instanceof ErroApi && er.campos.length)
                setCampos(Object.fromEntries(er.campos.map((x) => [x.campo, x.mensagem])));
              setErro(
                er instanceof ErroApi ? er.message : 'Não foi possível continuar. Tente de novo.',
              );
              setEnviando(false);
            }
          }}
        >
          <h2 className="font-semibold">Seus dados</h2>
          <Campo
            id="ass-nome"
            rotulo="Nome completo"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            erro={campos.nome}
          />
          <Campo
            id="ass-tel"
            rotulo="WhatsApp com DDD"
            inputMode="tel"
            autoComplete="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            erro={campos.telefone}
          />
          <Campo
            id="ass-cpf"
            rotulo="CPF"
            inputMode="numeric"
            dica="Vai na cobrança, como em qualquer pagamento."
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            erro={campos.cpf}
          />
          <Campo
            id="ass-email"
            rotulo="E-mail (opcional, para o recibo)"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erro={campos.email}
          />
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Botao type="submit" carregando={enviando} className="min-h-12 text-lg">
            Assinar por {formatarMoeda(plano.valor)}/mês
          </Botao>
          <p className="flex items-center gap-2 text-xs text-tinta-suave">
            <Lock aria-hidden className="size-3.5" /> Pagamento seguro pelo Asaas. Você escolhe Pix
            ou cartão na próxima tela.
          </p>
        </form>
      )}
    </main>
  );
}

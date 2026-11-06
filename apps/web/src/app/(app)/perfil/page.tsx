'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { trocarSenhaSchema, type TrocarSenhaEntrada } from '@pente-fino/shared';
import { Botao, Campo, cn } from '@pente-fino/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AssistenteEquipe } from '@/componentes/assistente-equipe';
import { NotificacoesAparelho } from '@/componentes/notificacoes-aparelho';
import { Aviso } from '@/componentes/aviso';
import { useApp } from '@/componentes/contexto-app';
import { api } from '@/lib/api';
import { aplicarErroDaApi } from '@/lib/formularios';
import { useHidratado } from '@/lib/hidratado';
import { NOME_PAPEL } from '@/lib/sessao';
import { useTema } from '@/lib/tema';

export default function Perfil() {
  const { usuario, unidades } = useApp();
  const [tema, definirTema] = useTema();
  const nomeUnidade = (id: string | null) =>
    id === null ? 'todas as unidades' : (unidades.find((u) => u.id === id)?.nome ?? 'unidade');

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{usuario.nome}</h1>
        <p className="text-tinta-suave">{usuario.email}</p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-acessos">
        <h2
          id="titulo-acessos"
          className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
        >
          Acessos
        </h2>
        <ul className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
          {usuario.papeis.map((p) => (
            <li
              key={`${p.papel}-${p.unidadeId}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="font-semibold">{NOME_PAPEL[p.papel]}</span>
              <span className="text-tinta-suave">{nomeUnidade(p.unidadeId)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-tema">
        <h2
          id="titulo-tema"
          className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
        >
          Tema da tela
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="titulo-tema"
          className="inline-flex self-start rounded-md border border-borda bg-superficie p-1"
        >
          {(['escuro', 'claro'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tema === t}
              onClick={() => definirTema(t)}
              className={cn(
                'min-h-11 rounded-sm px-5 font-semibold capitalize focus-visible:outline-2 focus-visible:outline-foco',
                tema === t ? 'bg-modulo text-sobre-modulo' : 'text-tinta-suave hover:text-tinta',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-tinta-suave">
          O claro ajuda no balcão com muita luz. Vale só para este aparelho.
        </p>
      </section>

      <NotificacoesAparelho />

      <AssistenteEquipe />

      <TrocarSenha />
    </div>
  );
}

function TrocarSenha() {
  const [ok, setOk] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const hidratado = useHidratado();
  const { register, handleSubmit, setError, reset, formState } = useForm<TrocarSenhaEntrada>({
    resolver: zodResolver(trocarSenhaSchema),
  });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    setOk(false);
    try {
      await api('auth/trocar-senha', { corpo: dados });
      reset();
      setOk(true);
    } catch (e) {
      setErroGeral(aplicarErroDaApi(e, setError));
    }
  });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-senha">
      <h2
        id="titulo-senha"
        className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
      >
        Trocar senha
      </h2>
      <form onSubmit={enviar} method="post" noValidate className="flex max-w-sm flex-col gap-4">
        {ok && (
          <Aviso tom="sucesso">
            Senha alterada. As sessões em outros aparelhos foram encerradas.
          </Aviso>
        )}
        {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}
        <Campo
          id="senhaAtual"
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          erro={formState.errors.senhaAtual?.message}
          {...register('senhaAtual')}
        />
        <Campo
          id="novaSenha"
          rotulo="Senha nova"
          type="password"
          autoComplete="new-password"
          dica="Pelo menos 8 caracteres."
          erro={formState.errors.novaSenha?.message}
          {...register('novaSenha')}
        />
        <Botao
          type="submit"
          disabled={!hidratado}
          carregando={formState.isSubmitting}
          className="self-start"
        >
          Trocar senha
        </Botao>
      </form>
    </section>
  );
}

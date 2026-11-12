'use client';

// Preço por barbeiro (detalhe do dono em 12/11/2026): no perfil, o barbeiro muda o próprio preço
// de cada serviço da unidade. Vale quando marcam com ele e na comanda dele; vazio = o da unidade.
import {
  formatarMoeda,
  lerMoeda,
  valorParaCampo,
  type MeuPreco,
  type MeusPrecosEntrada,
} from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao } from '@/lib/consultas';
import { Aviso } from './aviso';

const CHAVE = ['me', 'precos'] as const;
const chaveDa = (m: Pick<MeuPreco, 'profissionalId' | 'servicoId'>) =>
  `${m.profissionalId}|${m.servicoId}`;

export function MeusPrecos() {
  const lista = useQuery({ queryKey: CHAVE, queryFn: () => api<MeuPreco[]>('me/precos') });
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const salvar = useAcao(
    (corpo: MeusPrecosEntrada) => api<MeuPreco[]>('me/precos', { metodo: 'PUT', corpo }),
    [CHAVE],
  );
  const linhas = lista.data ?? [];
  // Quem não atende como profissional não tem o que mudar aqui.
  if (linhas.length === 0) return null;
  const unidades = [...new Set(linhas.map((l) => l.unidade))];
  const texto = (m: MeuPreco) =>
    textos[chaveDa(m)] ?? (m.meuPreco === null ? '' : valorParaCampo(m.meuPreco));

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-meus-precos">
      <h2 id="titulo-meus-precos" className="text-lg font-semibold">
        Meus preços
      </h2>
      <p className="text-sm text-tinta-suave">
        Cobra diferente da tabela da unidade? Escreva o seu preço. Ele vale quando marcarem com você
        (agenda, WhatsApp e link de agendamento) e na sua comanda, de hoje em diante. Deixe vazio
        para usar o preço da unidade.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {salvo && <Aviso tom="sucesso">Preços salvos. Valem de hoje em diante.</Aviso>}
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setSalvo(false);
          const precos: MeusPrecosEntrada['precos'] = [];
          for (const m of linhas) {
            const t = texto(m).trim();
            const valor = t ? lerMoeda(t) : null;
            if (t && (valor === null || valor < 0))
              return setErro(`Valor inválido em "${m.servico}". Ex.: 55,00`);
            if (valor !== m.meuPreco)
              precos.push({ profissionalId: m.profissionalId, servicoId: m.servicoId, valor });
          }
          if (precos.length === 0) return setErro('Nenhum preço mudou.');
          try {
            await salvar.mutateAsync({ precos });
            setTextos({});
            setSalvo(true);
          } catch (er) {
            setErro(er instanceof ErroApi ? er.message : 'Não foi possível salvar.');
          }
        }}
      >
        {unidades.map((unidade) => (
          <fieldset key={unidade} className="flex flex-col gap-2">
            {unidades.length > 1 && <legend className="mb-1 text-sm font-medium">{unidade}</legend>}
            <ul className="flex flex-col gap-2" aria-label={`Meus preços em ${unidade}`}>
              {linhas
                .filter((m) => m.unidade === unidade)
                .map((m) => (
                  <li
                    key={chaveDa(m)}
                    className="flex flex-wrap items-end justify-between gap-3 border-b border-borda pb-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{m.servico}</span>
                      <span className="block text-sm text-tinta-suave">
                        Unidade:{' '}
                        {m.precoUnidade === null ? 'sem preço' : formatarMoeda(m.precoUnidade)}
                      </span>
                    </span>
                    <div className="w-36">
                      <Campo
                        id={`meu-preco-${chaveDa(m)}`}
                        rotulo={`Meu preço de ${m.servico} (R$)`}
                        inputMode="decimal"
                        placeholder="o da unidade"
                        value={texto(m)}
                        onChange={(e) => setTextos({ ...textos, [chaveDa(m)]: e.target.value })}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </fieldset>
        ))}
        <Botao type="submit" className="self-start" carregando={salvar.isPending}>
          Salvar meus preços
        </Botao>
      </form>
    </section>
  );
}

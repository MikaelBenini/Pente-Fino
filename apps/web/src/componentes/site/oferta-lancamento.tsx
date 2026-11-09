'use client';

// Oferta de lançamento em /planos: 30% para sempre para quem assinar até a data. A urgência vem
// da data; o contador de vagas só aparece quando sobra pouco. Se a oferta acabou (data, vagas ou
// desligada na administração), o bloco some.
import { DIAS_TESTE, formatarData, OFERTA_LANCAMENTO, textoVagasOferta } from '@pente-fino/shared';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LinkBotao } from './link-botao';

const DATA = formatarData(`${OFERTA_LANCAMENTO.ate}T12:00:00Z`);

export function OfertaLancamento() {
  const [estado, setEstado] = useState<{ restantes: number | null } | 'carregando' | 'encerrada'>(
    'carregando',
  );
  useEffect(() => {
    let vivo = true;
    api<{ restantes: number | null }>(`publico/cupom/${OFERTA_LANCAMENTO.codigo}`)
      .then((r) => vivo && setEstado({ restantes: r.restantes }))
      .catch(() => vivo && setEstado('encerrada'));
    return () => {
      vivo = false;
    };
  }, []);
  if (estado === 'encerrada') return null;
  const vagas = typeof estado === 'object' ? textoVagasOferta(estado.restantes) : null;

  return (
    <section aria-labelledby="oferta" className="border-y border-borda bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
            Oferta de lançamento · até {DATA}
          </p>
          <h2 id="oferta" className="font-denso text-3xl font-bold uppercase">
            30% de desconto <span className="text-modulo-texto">para sempre</span>
          </h2>
          <p className="max-w-2xl text-tinta-suave">
            Assine até {DATA}, em qualquer plano, e pague 30% a menos em todas as mensalidades
            enquanto a assinatura estiver ativa. Os {DIAS_TESTE} dias de teste continuam grátis e
            sem cartão: o desconto já fica guardado no cadastro.
          </p>
          {vagas && <p className="font-semibold text-perigo-texto">{vagas} com este desconto.</p>}
        </div>
        <LinkBotao
          href={`/cadastro?cupom=${OFERTA_LANCAMENTO.codigo}`}
          variante="modulo"
          className="shrink-0"
        >
          Testar grátis com 30% off
        </LinkBotao>
      </div>
    </section>
  );
}

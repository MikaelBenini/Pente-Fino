'use client';

import {
  disponivelNaUnidade,
  formatarMoeda,
  lerMoeda,
  valorParaCampo,
  type ProdutoDetalhe,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, EstadoVazio, Marcador } from '@pente-fino/ui';
import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chavesOperacao, useAcao, useProdutos } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';
import { CopiarCatalogo } from './servicos';

export function TelaProdutos() {
  const { papeis, unidadeAtiva, unidades } = useApp();
  const ehDono = papeis.includes('dono');
  const produtos = useProdutos();
  // Catálogo por unidade: só o que está na unidade escolhida ("todas" mostra tudo).
  const visiveis = (produtos.data ?? []).filter((p) => disponivelNaUnidade(p, unidadeAtiva));
  const nomes = (ids: string[]) =>
    unidades
      .filter((u) => ids.includes(u.id))
      .map((u) => u.nome)
      .join(', ');
  const [editando, setEditando] = useState<ProdutoDetalhe | 'novo' | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Produtos"
        pergunta="O que está à venda e quanto sobra de cada um?"
        acao={
          ehDono && (
            <Botao onClick={() => setEditando('novo')}>
              <Plus aria-hidden className="size-5" /> Novo produto
            </Botao>
          )
        }
      />
      <Estado consulta={produtos}>
        {() =>
          produtos.data!.length > 0 && visiveis.length === 0 ? (
            <div className="flex flex-col gap-4">
              <EstadoVazio
                icone={Package}
                titulo="Nenhum produto nesta unidade"
                texto="Cadastre os produtos desta unidade ou traga o catálogo de outra."
              />
              {ehDono && unidadeAtiva && unidadeAtiva !== 'todas' && (
                <CopiarCatalogo unidadeId={unidadeAtiva} />
              )}
            </div>
          ) : produtos.data!.length === 0 ? (
            <EstadoVazio
              icone={Package}
              titulo="Cadastre seus produtos"
              texto="Pomadas, óleos e o que mais a barbearia vende. A venda entra na comanda como receita de produto."
            />
          ) : (
            <Tabela rotulo="Produtos">
              <thead className="bg-superficie-2">
                <tr>
                  <th className={th}>Produto</th>
                  <th className={`${th} text-right`}>Preço</th>
                  <th className={`${th} text-right`}>Custo</th>
                  <th className={`${th} text-right`}>Margem</th>
                  {ehDono && (
                    <th className={th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => (
                  <tr key={p.id} className="border-t border-borda">
                    <td className={`${td} font-semibold`}>
                      {p.nome} {!p.ativo && <Ficha tom="neutro">Inativo</Ficha>}
                      {unidadeAtiva === 'todas' && unidades.length > 1 && (
                        <span className="block text-sm font-normal text-tinta-suave">
                          {p.unidadeIds.length ? nomes(p.unidadeIds) : 'Em nenhuma unidade'}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right font-denso tabular-nums`}>
                      {formatarMoeda(p.precoVenda)}
                    </td>
                    <td className={`${td} text-right font-denso tabular-nums text-tinta-suave`}>
                      {formatarMoeda(p.custo)}
                    </td>
                    <td className={`${td} text-right font-denso tabular-nums`}>
                      {formatarMoeda(p.precoVenda - p.custo)}
                    </td>
                    {ehDono && (
                      <td className={`${td} text-right`}>
                        <Botao variante="fantasma" onClick={() => setEditando(p)}>
                          Editar
                        </Botao>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        }
      </Estado>
      <FormProduto produto={editando} onFechar={() => setEditando(null)} />
    </div>
  );
}

function FormProduto({
  produto,
  onFechar,
}: {
  produto: ProdutoDetalhe | 'novo' | null;
  onFechar: () => void;
}) {
  const atual = produto && produto !== 'novo' ? produto : null;
  const { unidades, unidadeAtiva } = useApp();
  const ativas = unidades.filter((u) => u.ativa);
  const [f, setF] = useState<{ nome: string; preco: string; custo: string; ativo: boolean } | null>(
    null,
  );
  // "Disponível em": nasce na unidade escolhida (ou em todas, com "todas" no topo).
  const [unidadesEscolhidas, setUnidadesEscolhidas] = useState<string[] | null>(null);
  const escolhidas =
    unidadesEscolhidas ??
    atual?.unidadeIds ??
    (unidadeAtiva && unidadeAtiva !== 'todas' ? [unidadeAtiva] : ativas.map((u) => u.id));
  const v =
    f ??
    (atual
      ? {
          nome: atual.nome,
          preco: valorParaCampo(atual.precoVenda),
          custo: valorParaCampo(atual.custo),
          ativo: atual.ativo,
        }
      : { nome: '', preco: '', custo: '', ativo: true });
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (corpo: object) =>
      atual ? api(`produtos/${atual.id}`, { metodo: 'PATCH', corpo }) : api('produtos', { corpo }),
    [chavesOperacao.produtos],
  );
  function fechar() {
    setF(null);
    setErro(null);
    setUnidadesEscolhidas(null);
    onFechar();
  }
  return (
    <Dialogo
      aberto={produto !== null}
      titulo={atual ? `Editar ${atual.nome}` : 'Novo produto'}
      onFechar={fechar}
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const precoVenda = lerMoeda(v.preco);
          const custo = lerMoeda(v.custo || '0');
          if (precoVenda === null || custo === null)
            return setErro('Preço ou custo inválido. Ex.: 45,00');
          if (escolhidas.length === 0) return setErro('Escolha pelo menos uma unidade.');
          try {
            await salvar.mutateAsync({
              nome: v.nome,
              precoVenda,
              custo,
              ativo: v.ativo,
              unidadeIds: escolhidas,
            });
            fechar();
          } catch (er) {
            setErro(
              er instanceof ErroApi
                ? (er.campos[0]?.mensagem ?? er.message)
                : 'Não foi possível salvar.',
            );
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="produto-nome"
          rotulo="Nome"
          value={v.nome}
          onChange={(e) => setF({ ...v, nome: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Campo
            id="produto-preco"
            rotulo="Preço de venda (R$)"
            inputMode="decimal"
            value={v.preco}
            onChange={(e) => setF({ ...v, preco: e.target.value })}
          />
          <Campo
            id="produto-custo"
            rotulo="Custo (R$)"
            inputMode="decimal"
            value={v.custo}
            onChange={(e) => setF({ ...v, custo: e.target.value })}
          />
        </div>
        {ativas.length > 1 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">Disponível em</legend>
            {ativas.map((u) => (
              <Marcador
                key={u.id}
                id={`produto-unidade-${u.id}`}
                rotulo={u.nome}
                checked={escolhidas.includes(u.id)}
                onChange={(e) =>
                  setUnidadesEscolhidas(
                    e.target.checked ? [...escolhidas, u.id] : escolhidas.filter((x) => x !== u.id),
                  )
                }
              />
            ))}
          </fieldset>
        )}
        {atual && (
          <Marcador
            id="produto-ativo"
            rotulo="À venda"
            checked={v.ativo}
            onChange={(e) => setF({ ...v, ativo: e.target.checked })}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            {atual ? 'Salvar' : 'Cadastrar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

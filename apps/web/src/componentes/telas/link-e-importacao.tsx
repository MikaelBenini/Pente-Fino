'use client';

import {
  gerarSlug,
  lerCsv,
  MODELOS_CSV,
  modeloCsv,
  TIPOS_IMPORTACAO,
  type RelatorioImportacao,
  type TipoImportacao,
  type UnidadeDetalhe,
} from '@pente-fino/shared';
import { Botao, Campo, Marcador, Selecao } from '@pente-fino/ui';
import { Copy, Download, ExternalLink, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaves, chavesOperacao, useAcao, useUnidadesDetalhe } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { Estado, Ficha, Tabela, td, th } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';

// ─── Link de agendamento ──────────────────────────────────────────────────

const LINK_DA_FALTA: Record<string, string> = {
  servico: '/servicos?aba=precos',
  profissional: '/equipe',
};

export function LinkAgendamento() {
  const unidades = useUnidadesDetalhe();
  const { papeis } = useApp();
  const ehDono = papeis.includes('dono');
  return (
    <Estado consulta={unidades}>
      {() => (
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-tinta-suave">
            O cliente escolhe serviço, barbeiro e horário sozinho, sem conversa. O horário entra na
            agenda e já cria a comanda. Só aparecem serviços com preço na unidade.
          </p>
          {unidades
            .data!.filter((u) => u.ativa)
            .map((u) => (
              <LinkUnidade key={u.id} u={u} podeEditar={ehDono} />
            ))}
        </div>
      )}
    </Estado>
  );
}

function LinkUnidade({ u, podeEditar }: { u: UnidadeDetalhe; podeEditar: boolean }) {
  const [slug, setSlug] = useState(u.slug ?? gerarSlug(u.nome));
  const [erro, setErro] = useState<string | null>(null);
  /** Ligar recusado (painel A7): o que falta, cada um com o link para cadastrar. */
  const [falta, setFalta] = useState<{ campo: string; mensagem: string }[]>([]);
  const [copiado, setCopiado] = useState(false);
  const salvar = useAcao(
    (corpo: object) => api(`unidades/${u.id}`, { metodo: 'PATCH', corpo }),
    [chaves.unidades],
  );
  const link =
    typeof window !== 'undefined' && u.slug
      ? `${window.location.origin}/agendar?u=${u.slug}`
      : null;

  async function enviar(corpo: object) {
    setErro(null);
    setFalta([]);
    try {
      await salvar.mutateAsync(corpo);
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'link_incompleto') setFalta(e.campos);
      else setErro(mensagemDe(e));
    }
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
      aria-label={`Link de ${u.nome}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{u.nome}</h2>
        {u.agendamentoPublico ? (
          <Ficha tom="acao">Link ligado</Ficha>
        ) : (
          <Ficha tom="neutro">Link desligado</Ficha>
        )}
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {falta.length > 0 && (
        <Aviso tom="aviso">
          <p className="font-semibold">
            O link continua desligado: o cliente abriria a página e não teria como marcar.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {falta.map((f) => (
              <li key={f.campo}>
                {f.mensagem}{' '}
                <Link
                  href={LINK_DA_FALTA[f.campo] ?? '/configuracoes'}
                  className="font-semibold underline"
                >
                  {f.campo === 'servico' ? 'Cadastrar preços' : 'Abrir a equipe'}
                </Link>
              </li>
            ))}
          </ul>
        </Aviso>
      )}
      {link && u.agendamentoPublico && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-fundo px-3 py-2.5 font-denso text-base">
            {link}
          </code>
          <Botao
            variante="secundario"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              } catch {
                setErro('Não deu para copiar. Selecione o endereço e copie à mão.');
              }
            }}
          >
            <Copy aria-hidden className="size-4" /> {copiado ? 'Copiado' : 'Copiar'}
          </Botao>
          <a
            href={link}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-tinta-suave hover:bg-superficie-2 hover:text-tinta"
          >
            <ExternalLink aria-hidden className="size-4" /> Abrir
          </a>
        </div>
      )}
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Campo
              id={`slug-${u.id}`}
              rotulo="Endereço do link"
              dica="Letras minúsculas, números e hífen"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </div>
          <Botao
            variante="secundario"
            disabled={slug === u.slug}
            carregando={salvar.isPending}
            onClick={() => enviar({ slug })}
          >
            Salvar endereço
          </Botao>
          <Marcador
            id={`link-ativo-${u.id}`}
            rotulo="Link ligado"
            checked={u.agendamentoPublico}
            onChange={(e) =>
              enviar(
                e.target.checked
                  ? { slug: u.slug ?? slug, agendamentoPublico: true }
                  : { agendamentoPublico: false },
              )
            }
          />
        </div>
      )}
    </section>
  );
}

// ─── Importação ───────────────────────────────────────────────────────────

const NOME_TIPO: Record<TipoImportacao, string> = {
  clientes: 'Clientes',
  servicos: 'Serviços',
  precos: 'Preços',
  profissionais: 'Profissionais',
};

export function ImportarPlanilha() {
  const [tipo, setTipo] = useState<TipoImportacao>('clientes');
  const [arquivo, setArquivo] = useState<{ nome: string; linhas: Record<string, string>[] } | null>(
    null,
  );
  const [previa, setPrevia] = useState<RelatorioImportacao | null>(null);
  const [resultado, setResultado] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = useAcao(
    (d: { simular: boolean; linhas: Record<string, string>[] }) =>
      api<RelatorioImportacao>(`importacao/${tipo}`, { corpo: d }),
    [
      chaves.servicos,
      chaves.precos,
      chaves.profissionais,
      chaves.usuarios,
      chavesOperacao.clientes,
    ],
  );
  const modelo = MODELOS_CSV[tipo];
  const urlModelo = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${modeloCsv(tipo)}`)}`;

  function limpar() {
    setArquivo(null);
    setPrevia(null);
    setResultado(null);
    setErro(null);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Selecao
            id="importar-tipo"
            rotulo="O que importar"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoImportacao);
              limpar();
            }}
            opcoes={TIPOS_IMPORTACAO.map((t) => ({ valor: t, rotulo: NOME_TIPO[t] }))}
          />
        </div>
        <a
          href={urlModelo}
          download={`modelo-${tipo}.csv`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco"
        >
          <Download aria-hidden className="size-4" /> Baixar modelo
        </a>
      </div>
      <p className="text-tinta-suave">
        Colunas: <code className="font-denso">{modelo.colunas.join(';')}</code>. {modelo.descricao}
      </p>
      <label
        htmlFor="importar-arquivo"
        className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-borda-forte bg-superficie p-4 text-center hover:border-modulo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foco"
      >
        <FileUp aria-hidden className="size-6 text-modulo-texto" />
        <span className="font-semibold">{arquivo ? arquivo.nome : 'Escolher arquivo CSV'}</span>
        <span className="text-sm text-tinta-suave">
          No Excel: Arquivo › Salvar como › CSV (separado por ponto e vírgula)
        </span>
        <input
          id="importar-arquivo"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            limpar();
            if (f.size > 2_000_000)
              return setErro('Arquivo grande demais (até 2 MB). Divida em partes.');
            const { colunas, linhas } = lerCsv(await f.text());
            const faltando = modelo.colunas.filter(
              (c) => ['nome', 'servico', 'valor', 'email'].includes(c) && !colunas.includes(c),
            );
            if (faltando.length)
              return setErro(`Faltam colunas: ${faltando.join(', ')}. Use o modelo.`);
            if (linhas.length === 0) return setErro('O arquivo não tem linhas além do cabeçalho.');
            setArquivo({ nome: f.name, linhas });
            try {
              setPrevia(await enviar.mutateAsync({ simular: true, linhas }));
            } catch (er) {
              setErro(mensagemDe(er));
            }
          }}
        />
      </label>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {previa && !resultado && (
        <section className="flex flex-col gap-3" aria-label="Prévia da importação">
          <p className="font-denso text-lg tabular-nums">
            {previa.total} linhas ·{' '}
            <span className="text-acao-texto">{previa.validas} prontas</span> ·{' '}
            <span className={previa.erros.length ? 'text-perigo-texto' : ''}>
              {previa.erros.length} com problema
            </span>
          </p>
          <RelatorioErros erros={previa.erros} />
          <div className="flex gap-2">
            <Botao
              disabled={previa.validas === 0}
              carregando={enviar.isPending}
              onClick={async () => {
                setErro(null);
                try {
                  setResultado(
                    await enviar.mutateAsync({ simular: false, linhas: arquivo!.linhas }),
                  );
                } catch (er) {
                  setErro(mensagemDe(er));
                }
              }}
            >
              Importar {previa.validas} {previa.validas === 1 ? 'linha' : 'linhas'}
            </Botao>
            <Botao variante="fantasma" onClick={limpar}>
              Cancelar
            </Botao>
          </div>
        </section>
      )}
      {resultado && (
        <section className="flex flex-col gap-3">
          <Aviso tom="sucesso">
            {resultado.gravadas}{' '}
            {resultado.gravadas === 1 ? 'linha importada' : 'linhas importadas'}.
            {tipo === 'profissionais' ? ' Cada profissional recebeu o convite por e-mail.' : ''}
          </Aviso>
          <RelatorioErros erros={resultado.erros} />
          <Botao variante="secundario" className="self-start" onClick={limpar}>
            Importar outro arquivo
          </Botao>
        </section>
      )}
    </div>
  );
}

function RelatorioErros({ erros }: { erros: RelatorioImportacao['erros'] }) {
  if (erros.length === 0) return null;
  return (
    <Tabela rotulo="Linhas com problema" className="max-h-80 overflow-y-auto">
      <thead className="sticky top-0 bg-superficie-2">
        <tr>
          <th className={`${th} w-20 text-right`}>Linha</th>
          <th className={th}>Problema</th>
        </tr>
      </thead>
      <tbody>
        {erros.map((e, i) => (
          <tr key={`${e.linha}-${i}`} className="border-t border-borda">
            <td className={`${td} text-right font-denso tabular-nums`}>{e.linha}</td>
            <td className={td}>{e.mensagem}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  );
}

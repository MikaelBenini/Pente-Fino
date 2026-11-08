'use client';

// Nota fiscal das mensalidades do Pente Fino (Etapa 23): o Asaas emite a NFS-e de cada cobrança
// da assinatura das barbearias. Aqui: conferir os dados fiscais no Asaas, escolher o serviço e o
// ISS, ligar e aplicar às assinaturas que já existem.
import {
  NOME_QUANDO_EMITIR_NOTA,
  QUANDO_EMITIR_NOTA,
  type ConfigNotaFiscal,
  type ResultadoAplicarNota,
  type ServicoMunicipal,
  type SituacaoFiscalAsaas,
} from '@pente-fino/shared';
import { Botao, Campo, CampoTexto, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { adminApi } from './admin-api';

const BASE = 'configuracoes/nota-fiscal';
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';
const numero = (t: string) => {
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : -1;
};
const texto = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function SituacaoAsaas() {
  const q = useQuery({
    queryKey: ['admin', 'nota-fiscal', 'asaas'],
    queryFn: () => adminApi<SituacaoFiscalAsaas>(`${BASE}/asaas`),
    retry: false,
  });
  if (q.isPending) return <p className="text-sm text-tinta-suave">Conferindo no Asaas…</p>;
  if (q.isError) return <Aviso tom="erro">{mensagemDe(q.error)}</Aviso>;
  const s = q.data;
  if (!s.configurada)
    return (
      <Aviso tom="erro">
        Os dados fiscais da empresa ainda não estão no Asaas. No painel do Asaas, abra Notas fiscais
        → Configurações e preencha a inscrição municipal, o regime e o acesso à prefeitura
        (certificado ou senha). Depois volte aqui.
      </Aviso>
    );
  return (
    <p role="status" className="text-sm text-acao-texto">
      Dados fiscais no Asaas: inscrição municipal {s.inscricaoMunicipal ?? '—'}
      {s.simplesNacional === null
        ? ''
        : s.simplesNacional
          ? ' · Simples Nacional'
          : ' · regime normal'}
      {s.acessoPrefeitura ? ' · acesso à prefeitura enviado' : ' · falta o acesso à prefeitura'}.
    </p>
  );
}

export function NotaFiscalAdmin({ atual }: { atual: ConfigNotaFiscal }) {
  const cliente = useQueryClient();
  const [ativa, setAtiva] = useState(atual.ativa);
  const [servicoId, setServicoId] = useState(atual.servicoMunicipalId);
  const [codigo, setCodigo] = useState(atual.codigoServico);
  const [nome, setNome] = useState(atual.nomeServico);
  const [iss, setIss] = useState(texto(atual.iss));
  const [retencoes, setRetencoes] = useState({
    pis: texto(atual.pis),
    cofins: texto(atual.cofins),
    csll: texto(atual.csll),
    inss: texto(atual.inss),
    ir: texto(atual.ir),
  });
  const [quando, setQuando] = useState(atual.quando);
  const [observacoes, setObservacoes] = useState(atual.observacoes);
  const [busca, setBusca] = useState('');
  const [servicos, setServicos] = useState<ServicoMunicipal[] | null>(null);
  const [acao, setAcao] = useState<'buscar' | 'salvar' | 'aplicar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState<ResultadoAplicarNota | null>(null);

  async function executar(qual: NonNullable<typeof acao>, f: () => Promise<string | null>) {
    setAcao(qual);
    setErro(null);
    setOk(null);
    try {
      setOk(await f());
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAcao(null);
    }
  }

  const buscar = () =>
    executar('buscar', async () => {
      const r = await adminApi<ServicoMunicipal[]>(
        `${BASE}/servicos?busca=${encodeURIComponent(busca.trim())}`,
      );
      setServicos(r);
      return r.length ? null : 'Nenhum serviço encontrado. Use o código do serviço abaixo.';
    });

  const escolher = (s: ServicoMunicipal) => {
    setServicoId(s.id);
    const [cod, ...resto] = s.descricao.split(' - ');
    if (cod) setCodigo(cod.trim());
    if (resto.length && !nome.trim()) setNome(resto.join(' - '));
    // A lista do Asaas costuma vir com ISS 0 (sem alíquota cadastrada): mantém o digitado.
    if (s.iss) setIss(texto(s.iss));
    setServicos(null);
  };

  const salvar = () =>
    executar('salvar', async () => {
      await adminApi(BASE, {
        metodo: 'PUT',
        corpo: {
          ativa,
          servicoMunicipalId: servicoId,
          codigoServico: codigo,
          nomeServico: nome,
          iss: numero(iss),
          pis: numero(retencoes.pis),
          cofins: numero(retencoes.cofins),
          csll: numero(retencoes.csll),
          inss: numero(retencoes.inss),
          ir: numero(retencoes.ir),
          quando,
          observacoes,
        },
      });
      await cliente.invalidateQueries({ queryKey: ['admin', 'configuracoes'] });
      return ativa
        ? 'Salvo. As assinaturas novas já saem com nota; use "Aplicar às assinaturas atuais" para as que existem.'
        : 'Salvo. A nota está desligada para as assinaturas novas.';
    });

  const aplicar = () =>
    executar('aplicar', async () => {
      const r = await adminApi<ResultadoAplicarNota>(`${BASE}/aplicar`, { metodo: 'POST' });
      setAplicado(r);
      return `Aplicado em ${r.aplicadas} assinatura(s).`;
    });

  return (
    <section
      aria-labelledby="titulo-nota-fiscal"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 id="titulo-nota-fiscal" className="text-lg font-semibold">
        Nota fiscal das mensalidades
      </h2>
      <p className="text-sm text-tinta-suave">
        O Asaas emite a nota de serviço (NFS-e) de cada mensalidade que as barbearias pagam pelo
        sistema e manda por e-mail para elas. Confira o código do serviço e o ISS com o seu contador
        antes de ligar.
      </p>
      <SituacaoAsaas />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Campo
            id="nota-busca"
            rotulo="Buscar serviço da prefeitura"
            dica='Por código ou nome, por exemplo "1.05" ou "programa".'
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void buscar();
              }
            }}
          />
        </div>
        <Botao variante="secundario" carregando={acao === 'buscar'} onClick={buscar}>
          Buscar
        </Botao>
      </div>
      {servicos && servicos.length > 0 && (
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border border-borda p-1">
          {servicos.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => escolher(s)}
                className="min-h-11 w-full rounded px-2 text-left text-sm hover:bg-fundo"
              >
                {s.descricao}
                {!!s.iss && <span className="text-tinta-suave"> · ISS {texto(s.iss)}%</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {servicoId && (
        <p className="text-sm">
          Serviço da prefeitura escolhido.{' '}
          <button type="button" className="underline" onClick={() => setServicoId(null)}>
            Usar só o código
          </button>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Campo
          id="nota-codigo"
          rotulo="Código do serviço"
          dica="Lista da LC 116."
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <Campo
          id="nota-nome"
          rotulo="Descrição do serviço na nota"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          id="nota-iss"
          rotulo="ISS (%)"
          inputMode="decimal"
          value={iss}
          onChange={(e) => setIss(e.target.value.replace(/[^\d,.]/g, ''))}
        />
        <div className="sm:col-span-2">
          <Selecao
            id="nota-quando"
            rotulo="Quando emitir"
            value={quando}
            onChange={(e) => setQuando(e.target.value as typeof quando)}
            opcoes={QUANDO_EMITIR_NOTA.map((q) => ({
              valor: q,
              rotulo: NOME_QUANDO_EMITIR_NOTA[q],
            }))}
          />
        </div>
      </div>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2">
          Retenções federais (no Simples Nacional, normalmente zero)
        </summary>
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-5">
          {(['pis', 'cofins', 'csll', 'inss', 'ir'] as const).map((k) => (
            <Campo
              key={k}
              id={`nota-${k}`}
              rotulo={`${k.toUpperCase()} (%)`}
              inputMode="decimal"
              value={retencoes[k]}
              onChange={(e) =>
                setRetencoes((r) => ({ ...r, [k]: e.target.value.replace(/[^\d,.]/g, '') }))
              }
            />
          ))}
        </div>
      </details>
      <CampoTexto
        id="nota-observacoes"
        rotulo="Observações na nota (opcional)"
        rows={2}
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
      />
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={ativa}
          onChange={(e) => setAtiva(e.target.checked)}
          className="size-5 accent-[var(--modulo)]"
        />
        Emitir nota fiscal das mensalidades
      </label>

      <div className="flex flex-wrap gap-2">
        <Botao carregando={acao === 'salvar'} onClick={salvar}>
          Salvar nota fiscal
        </Botao>
        <Botao
          variante="secundario"
          carregando={acao === 'aplicar'}
          disabled={!atual.ativa}
          onClick={aplicar}
        >
          Aplicar às assinaturas atuais
        </Botao>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && (
        <p role="status" className="text-sm text-acao-texto">
          {ok}
        </p>
      )}
      {aplicado && aplicado.falhas.length > 0 && (
        <Aviso tom="erro">
          {aplicado.falhas.length} assinatura(s) não aceitaram:{' '}
          {aplicado.falhas.map((f) => `${f.conta} (${f.motivo})`).join('; ')}
        </Aviso>
      )}
    </section>
  );
}

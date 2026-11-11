'use client';

import {
  formatarData,
  formatarDataHora,
  NOME_PAPEL_PLATAFORMA,
  NOME_PLANO,
  PLANOS,
  TOTAL_PASSOS_ATIVACAO,
  SEM_ORIGEM,
  type ContaNaPlataforma,
  type RespostaEntrarAdmin,
  type UsuarioPlataformaSessao,
  type VendasDoVendedor,
} from '@pente-fino/shared';
import { Abas, Botao, Campo, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Marca } from '../marca';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';
import { AuditoriaAdmin, EquipeAdmin } from './equipe-admin';
import { FichaConta } from './ficha-conta';
import { CobrancaAdmin, InicioAdmin } from './inicio-admin';
import { ConfiguracoesAdmin, SaudeAdmin } from './config-admin';
import { NovaVenda, VendasPorOrigemAdmin, VendasPorVendedor } from './nova-venda';

const CHAVE_EU = ['admin', 'eu'] as const;
const NOME_STATUS: Record<ContaNaPlataforma['status'], string> = {
  teste: 'Em teste',
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  cancelada: 'Cancelada',
};
const TOM_STATUS: Record<ContaNaPlataforma['status'], 'acao' | 'aviso' | 'neutro' | 'perigo'> = {
  teste: 'aviso',
  ativa: 'acao',
  suspensa: 'perigo',
  cancelada: 'neutro',
};

/** Administração do sistema: login próprio com segundo fator e, depois, o painel. */
export function TelaAdmin() {
  const eu = useQuery({
    queryKey: CHAVE_EU,
    queryFn: () => adminApi<UsuarioPlataformaSessao>('eu'),
    retry: false,
  });
  if (eu.isPending) return null;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-[max(1rem,env(safe-area-inset-left))] py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Marca />
          <span className="rounded-sm border border-modulo px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-modulo-texto">
            Administração
          </span>
        </div>
        {eu.data && <Sair u={eu.data} />}
      </header>
      {eu.data ? <Painel u={eu.data} /> : <Entrar />}
    </div>
  );
}

function Sair({ u }: { u: UsuarioPlataformaSessao }) {
  const cliente = useQueryClient();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-tinta-suave">
        {u.nome} · {NOME_PAPEL_PLATAFORMA[u.papel]}
      </span>
      <Botao
        variante="secundario"
        onClick={async () => {
          await adminApi('auth/sair', { corpo: {} }).catch(() => undefined);
          // Refaz tudo da administração: sem sessão, a tela volta ao login.
          await cliente.resetQueries({ queryKey: ['admin'] });
        }}
      >
        Sair
      </Botao>
    </div>
  );
}

function QrDoAutenticador({ otpauth }: { otpauth: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void QRCode.toDataURL(otpauth, { margin: 1, width: 220 }).then((u) => vivo && setSrc(u));
    return () => {
      vivo = false;
    };
  }, [otpauth]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR code para o aplicativo autenticador"
      width={220}
      height={220}
      className="rounded-md bg-white p-2"
    />
  ) : null;
}

function Entrar() {
  const cliente = useQueryClient();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<RespostaEntrarAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pedeCodigo = etapa?.etapa === 'codigo' || etapa?.etapa === 'configurar';

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Entrar na administração</h1>
        <p className="text-tinta-suave">
          Acesso de quem opera o Pente Fino. Senha e código do autenticador.
        </p>
      </div>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setEnviando(true);
          try {
            const r = await adminApi<RespostaEntrarAdmin>('auth/entrar', {
              corpo: { email, senha, ...(pedeCodigo && codigo ? { codigo } : {}) },
            });
            if (r.etapa === 'pronto') {
              setSenha('');
              await cliente.invalidateQueries({ queryKey: CHAVE_EU });
            } else setEtapa(r);
          } catch (er) {
            setErro(er instanceof ErroApi ? er.message : 'Não foi possível entrar.');
            setCodigo('');
          } finally {
            setEnviando(false);
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Campo
          id="admin-email"
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pedeCodigo}
        />
        <Campo
          id="admin-senha"
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={pedeCodigo}
        />
        {etapa?.etapa === 'configurar' && (
          <section
            aria-labelledby="titulo-configurar"
            className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
          >
            <h2 id="titulo-configurar" className="flex items-center gap-2 font-semibold">
              <ShieldCheck aria-hidden className="size-5 text-acao-texto" /> Configure o segundo
              fator
            </h2>
            <p className="text-sm text-tinta-suave">
              Leia o QR code no aplicativo autenticador (Google Authenticator, Microsoft
              Authenticator, 1Password…) e digite o código de 6 dígitos que aparecer.
            </p>
            <QrDoAutenticador otpauth={etapa.otpauth} />
            <p className="text-sm text-tinta-suave">
              Sem câmera? Digite a chave:{' '}
              <code className="break-all font-denso text-tinta">{etapa.segredo}</code>
            </p>
          </section>
        )}
        {pedeCodigo && (
          <Campo
            id="admin-codigo"
            rotulo="Código do autenticador"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoFocus
          />
        )}
        <Botao type="submit" carregando={enviando}>
          {pedeCodigo ? 'Confirmar código' : 'Continuar'}
        </Botao>
      </form>
    </main>
  );
}

const ABAS_VENDEDOR = ['inicio', 'contas', 'cobranca'];

/** Painel: abas por assunto; a ficha da conta e a nova venda abrem de qualquer aba. */
function Painel({ u }: { u: UsuarioPlataformaSessao }) {
  // A aba fica no endereço (#contas), para voltar nela ao recarregar. O painel só monta no
  // navegador (depois de conferir a sessão), então dá para ler o endereço aqui.
  const [aba, setAbaEstado] = useState(() =>
    typeof window === 'undefined' ? 'inicio' : window.location.hash.slice(1) || 'inicio',
  );
  const [aberta, setAberta] = useState<string | null>(null);
  const [vender, setVender] = useState(false);
  const setAba = (id: string) => {
    setAbaEstado(id);
    window.history.replaceState(null, '', `#${id}`);
  };
  // Admin R10: trocar o endereço com a página aberta (link, voltar do navegador, digitar
  // /admin#contas) também troca a aba; antes, só valia ao carregar a página.
  useEffect(() => {
    const seguirEndereco = () => setAbaEstado(window.location.hash.slice(1) || 'inicio');
    window.addEventListener('hashchange', seguirEndereco);
    return () => window.removeEventListener('hashchange', seguirEndereco);
  }, []);
  const abas = [
    {
      id: 'inicio',
      rotulo: 'Início',
      conteudo: <InicioAdmin u={u} onAbrirConta={setAberta} onIrPara={setAba} />,
    },
    { id: 'contas', rotulo: 'Contas', conteudo: <ContasAdmin u={u} onAbrirConta={setAberta} /> },
    { id: 'cobranca', rotulo: 'Cobrança', conteudo: <CobrancaAdmin onAbrirConta={setAberta} /> },
    {
      id: 'vendas',
      rotulo: 'Vendas',
      conteudo: (
        <div className="flex flex-col gap-8">
          <VendasPorOrigemAdmin />
          <VendasPorVendedor />
        </div>
      ),
    },
    { id: 'equipe', rotulo: 'Equipe', conteudo: <EquipeAdmin u={u} /> },
    { id: 'auditoria', rotulo: 'Auditoria', conteudo: <AuditoriaAdmin onAbrirConta={setAberta} /> },
    { id: 'configuracoes', rotulo: 'Configurações', conteudo: <ConfiguracoesAdmin /> },
    { id: 'saude', rotulo: 'Saúde do sistema', conteudo: <SaudeAdmin /> },
  ].filter((x) => u.papel === 'admin' || ABAS_VENDEDOR.includes(x.id));
  return (
    <main className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Botao onClick={() => setVender(true)}>Nova venda</Botao>
      </div>
      <Abas
        rotulo="Administração"
        atual={abas.some((x) => x.id === aba) ? aba : 'inicio'}
        onTrocar={setAba}
        abas={abas}
      />
      <FichaConta id={aberta} onFechar={() => setAberta(null)} papel={u.papel} />
      <NovaVenda aberto={vender} onFechar={() => setVender(false)} onAbrirConta={setAberta} />
    </main>
  );
}

type Ordem = 'criada' | 'nome' | 'acesso' | 'fechadas' | 'teste' | 'ativacao';
const ORDENAR: Record<Ordem, (a: ContaNaPlataforma, b: ContaNaPlataforma) => number> = {
  criada: (a, b) => b.criadaEm.localeCompare(a.criadaEm),
  nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
  acesso: (a, b) => (a.ultimoAcessoEm ?? '').localeCompare(b.ultimoAcessoEm ?? ''),
  fechadas: (a, b) => b.fechadas7Dias - a.fechadas7Dias,
  teste: (a, b) => (a.testeAte ?? '9').localeCompare(b.testeAte ?? '9'),
  ativacao: (a, b) => a.ativacao - b.ativacao || b.criadaEm.localeCompare(a.criadaEm),
};

/** Primeira coluna presa ao rolar a tabela para o lado (admin U2). */
const FIXA = 'sticky left-0 z-10 bg-superficie';

/** Planilha (CSV com ponto e vírgula, abre direto no Excel em português). */
function baixarCsv(contas: ContaNaPlataforma[]) {
  const campo = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    [
      'Barbearia',
      'Plano',
      'Ciclo',
      'Situação',
      'Criada',
      'Teste até',
      'Unidades',
      'Profissionais',
      'WhatsApp',
      'Fechadas 7 dias',
      'Último acesso',
      'Cobrança',
      'Conta interna',
      'Origem',
      'Ativação',
    ],
    ...contas.map((c) => [
      c.nome,
      NOME_PLANO[c.plano],
      c.ciclo,
      NOME_STATUS[c.status],
      formatarData(c.criadaEm),
      c.testeAte ? formatarData(c.testeAte) : '',
      c.unidades,
      c.profissionais,
      c.whatsappConectado ? 'Conectado' : 'Não',
      c.fechadas7Dias,
      c.ultimoAcessoEm ? formatarDataHora(c.ultimoAcessoEm) : '',
      c.cobrancaAutomatica ? 'Asaas' : 'Manual',
      c.interna ? 'Sim' : 'Não',
      c.origem ?? SEM_ORIGEM,
      `${c.ativacao}/${TOTAL_PASSOS_ATIVACAO}`,
    ]),
  ];
  const texto = '\ufeff' + linhas.map((l) => l.map(campo).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `contas-pente-fino-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ContasAdmin({
  u,
  onAbrirConta,
}: {
  u: UsuarioPlataformaSessao;
  onAbrirConta: (id: string) => void;
}) {
  const contas = useQuery({
    queryKey: ['admin', 'contas'],
    queryFn: () => adminApi<ContaNaPlataforma[]>('contas'),
  });
  const [ordem, setOrdem] = useState<Ordem>('criada');
  const [busca, setBusca] = useState('');
  const [plano, setPlano] = useState('');
  const [situacao, setSituacao] = useState('');
  const [vendedor, setVendedor] = useState('');
  const vendas = useQuery({
    queryKey: ['admin', 'vendas'],
    queryFn: () => adminApi<VendasDoVendedor[]>('vendas'),
    enabled: u.papel === 'admin',
  });
  const termo = busca.trim().toLowerCase();
  const filtradas = (contas.data ?? [])
    .filter(
      (c) =>
        (!termo || c.nome.toLowerCase().includes(termo)) &&
        (!plano || c.plano === plano) &&
        (!situacao || (situacao === 'interna' ? c.interna : c.status === situacao && !c.interna)) &&
        (!vendedor || (vendedor === 'site' ? c.vendedorId === null : c.vendedorId === vendedor)),
    )
    .sort(ORDENAR[ordem]);
  return (
    <section aria-labelledby="titulo-contas" className="flex flex-col gap-4">
      <h1 id="titulo-contas" className="text-3xl font-semibold">
        Contas
      </h1>
      <p className="text-sm text-tinta-suave">
        Plano, situação, datas e uso. Dados de clientes, comandas e conversas das barbearias não
        aparecem aqui.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Campo
            id="busca-conta"
            rotulo="Buscar barbearia"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Selecao
          id="filtro-plano"
          rotulo="Plano"
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Todos' },
            ...PLANOS.map((p) => ({ valor: p, rotulo: NOME_PLANO[p] })),
          ]}
        />
        <Selecao
          id="filtro-situacao"
          rotulo="Situação"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          opcoes={[
            { valor: '', rotulo: 'Todas' },
            ...(Object.keys(NOME_STATUS) as ContaNaPlataforma['status'][]).map((s) => ({
              valor: s,
              rotulo: NOME_STATUS[s],
            })),
            { valor: 'interna', rotulo: 'Conta interna' },
          ]}
        />
        {u.papel === 'admin' && (
          <Selecao
            id="filtro-vendedor"
            rotulo="Vendedor"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            opcoes={[
              { valor: '', rotulo: 'Todos' },
              { valor: 'site', rotulo: 'Cadastro pelo site' },
              ...(vendas.data ?? []).map((v) => ({ valor: v.vendedorId, rotulo: v.nome })),
            ]}
          />
        )}
        <Selecao
          id="ordem-contas"
          rotulo="Ordenar por"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          opcoes={[
            { valor: 'criada', rotulo: 'Mais novas' },
            { valor: 'nome', rotulo: 'Nome' },
            { valor: 'teste', rotulo: 'Teste acabando' },
            { valor: 'acesso', rotulo: 'Sem acesso há mais tempo' },
            { valor: 'fechadas', rotulo: 'Mais comandas na semana' },
            { valor: 'ativacao', rotulo: 'Menos configuradas' },
          ]}
        />
        <Botao
          variante="secundario"
          disabled={!filtradas.length}
          onClick={() => baixarCsv(filtradas)}
        >
          Exportar planilha
        </Botao>
      </div>
      <p className="text-sm text-tinta-suave" aria-live="polite">
        {filtradas.length} de {contas.data?.length ?? 0} contas
      </p>
      <Estado consulta={contas}>
        {() => (
          <Tabela rotulo="Contas das barbearias">
            <thead>
              <tr className="border-b border-borda">
                {[
                  'Barbearia',
                  'Plano',
                  'Situação',
                  'Ativação',
                  'Origem',
                  'Criada',
                  'Unidades',
                  'Profissionais',
                  'WhatsApp',
                  'Fechadas (7 dias)',
                  'Última fechada',
                  'Último acesso',
                ].map((c, i) => (
                  <th key={c} scope="col" className={i === 0 ? `${th} ${FIXA}` : th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} className="border-b border-borda">
                  <th scope="row" className={`${td} ${FIXA} font-semibold`}>
                    <button
                      type="button"
                      onClick={() => onAbrirConta(c.id)}
                      className="text-left underline decoration-borda-forte underline-offset-4 hover:decoration-modulo focus-visible:outline-2 focus-visible:outline-foco"
                    >
                      {c.nome}
                    </button>
                  </th>
                  <td className={td}>
                    {NOME_PLANO[c.plano]} · {c.ciclo}
                  </td>
                  <td className={td}>
                    <Ficha tom={TOM_STATUS[c.status]}>{NOME_STATUS[c.status]}</Ficha>
                    {c.interna && (
                      <span className="ml-1">
                        <Ficha tom="neutro">Interna</Ficha>
                      </span>
                    )}
                    {c.status === 'teste' && c.testeAte && (
                      <span className="block text-xs text-tinta-suave">
                        até {formatarData(c.testeAte)}
                      </span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums whitespace-nowrap`}>
                    {c.ativacao}/{TOTAL_PASSOS_ATIVACAO}
                    <span className="sr-only"> primeiros passos feitos</span>
                  </td>
                  <td className={`${td} text-sm`}>
                    {c.origem ?? <span className="text-tinta-suave">{SEM_ORIGEM}</span>}
                  </td>
                  <td className={`${td} tabular-nums`}>{formatarData(c.criadaEm)}</td>
                  <td className={`${td} tabular-nums`}>{c.unidades}</td>
                  <td className={`${td} tabular-nums`}>{c.profissionais}</td>
                  <td className={td}>{c.whatsappConectado ? 'Conectado' : 'Não'}</td>
                  <td className={`${td} tabular-nums`}>{c.fechadas7Dias}</td>
                  <td className={`${td} tabular-nums`}>
                    {c.ultimaFechadaEm ? formatarDataHora(c.ultimaFechadaEm) : '—'}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {c.ultimoAcessoEm ? formatarDataHora(c.ultimoAcessoEm) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Estado>
    </section>
  );
}

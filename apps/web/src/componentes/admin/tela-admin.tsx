'use client';

import {
  formatarData,
  formatarDataHora,
  NOME_PAPEL_PLATAFORMA,
  NOME_PLANO,
  type ContaNaPlataforma,
  type RespostaEntrarAdmin,
  type UsuarioPlataformaSessao,
} from '@pente-fino/shared';
import { Botao, Campo } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Marca } from '../marca';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';

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

function Painel({ u }: { u: UsuarioPlataformaSessao }) {
  const contas = useQuery({
    queryKey: ['admin', 'contas'],
    queryFn: () => adminApi<ContaNaPlataforma[]>('contas'),
    enabled: u.papel === 'admin',
  });
  if (u.papel !== 'admin')
    return (
      <p className="text-tinta-suave">
        As contas que você vender aparecem aqui quando a venda presencial estiver pronta.
      </p>
    );
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Contas</h1>
      <p className="text-sm text-tinta-suave">
        Plano, situação, datas e uso. Dados de clientes, comandas e conversas das barbearias não
        aparecem aqui.
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
                  'Criada',
                  'Unidades',
                  'Profissionais',
                  'WhatsApp',
                  'Fechadas (7 dias)',
                  'Última fechada',
                ].map((c) => (
                  <th key={c} scope="col" className={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contas.data!.map((c) => (
                <tr key={c.id} className="border-b border-borda">
                  <th scope="row" className={`${td} font-semibold`}>
                    {c.nome}
                  </th>
                  <td className={td}>
                    {NOME_PLANO[c.plano]} · {c.ciclo}
                  </td>
                  <td className={td}>
                    <Ficha tom={TOM_STATUS[c.status]}>{NOME_STATUS[c.status]}</Ficha>
                    {c.status === 'teste' && c.testeAte && (
                      <span className="block text-xs text-tinta-suave">
                        até {formatarData(c.testeAte)}
                      </span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums`}>{formatarData(c.criadaEm)}</td>
                  <td className={`${td} tabular-nums`}>{c.unidades}</td>
                  <td className={`${td} tabular-nums`}>{c.profissionais}</td>
                  <td className={td}>{c.whatsappConectado ? 'Conectado' : 'Não'}</td>
                  <td className={`${td} tabular-nums`}>{c.fechadas7Dias}</td>
                  <td className={`${td} tabular-nums`}>
                    {c.ultimaFechadaEm ? formatarDataHora(c.ultimaFechadaEm) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Estado>
    </main>
  );
}

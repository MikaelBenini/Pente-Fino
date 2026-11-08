'use client';

import {
  formatarData,
  formatarMoeda,
  NOME_SITUACAO_RECEBIMENTO,
  NOME_TIPO_EMPRESA,
  TIPOS_EMPRESA,
  lerMoeda,
  type RecebimentoClube,
  type RecebimentoNaTela,
} from '@pente-fino/shared';
import { Botao, Campo, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, MessageCircle, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { mesAtual } from '@/lib/periodo';
import { Aviso } from '../aviso';
import { SeletorMes } from '../indicadores';
import { Estado, Ficha, Tabela, td, th } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível concluir.';
const chaveRecebimento = ['clube', 'recebimento'] as const;

/** "Copiar link" e "Mandar pelo WhatsApp" de um plano (mensagem pronta). */
export function CompartilharPlano({ planoId }: { planoId: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function pegar() {
    setErro(null);
    setOcupado(true);
    try {
      return await api<{ link: string; mensagem: string }>(`clube/itens/${planoId}/link`);
    } catch (e) {
      setErro(mensagemDe(e));
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          carregando={ocupado}
          onClick={async () => {
            const r = await pegar();
            if (!r) return;
            await navigator.clipboard.writeText(r.link).catch(() => undefined);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          }}
        >
          <Copy aria-hidden className="size-4" /> {copiado ? 'Link copiado' : 'Copiar link'}
        </Botao>
        <Botao
          variante="secundario"
          disabled={ocupado}
          onClick={async () => {
            // Abre já com a mensagem: a recepção escolhe o contato no WhatsApp.
            const janela = window.open('', '_blank');
            const r = await pegar();
            if (!r) return janela?.close();
            const url = `https://wa.me/?text=${encodeURIComponent(r.mensagem)}`;
            if (janela) janela.location.href = url;
            else window.location.href = url;
          }}
        >
          <MessageCircle aria-hidden className="size-4" /> Mandar pelo WhatsApp
        </Botao>
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}

/** Lista vazia: cria os planos sugeridos a partir dos serviços e preços da unidade. */
export function PlanosSugeridos({
  unidadeId,
  onCriados,
}: {
  unidadeId: string;
  onCriados: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <Botao
        carregando={ocupado}
        onClick={async () => {
          setErro(null);
          setOcupado(true);
          try {
            await api('clube/planos-sugeridos', { corpo: { unidadeId } });
            onCriados();
          } catch (e) {
            setErro(mensagemDe(e));
          } finally {
            setOcupado(false);
          }
        }}
      >
        <Sparkles aria-hidden className="size-5" /> Criar planos sugeridos
      </Botao>
      <p className="text-sm text-tinta-suave">
        Corte, Corte + Barba e Corte à vontade, com preço já com desconto. Dá para editar depois.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}

const TOM_SITUACAO = {
  documentos: 'aviso',
  analise: 'aviso',
  aprovada: 'acao',
  recusada: 'perigo',
} as const;

/** Aba "Receber online": conta no Asaas, documentos, taxa, saldo e o que entrou pelo link. */
export function ReceberOnline() {
  const q = useQuery({
    queryKey: chaveRecebimento,
    queryFn: () => api<RecebimentoNaTela>('clube/recebimento'),
  });
  return (
    <Estado consulta={q}>
      {() =>
        q.data!.situacao === null ? (
          <AtivarRecebimento taxaBp={q.data!.taxaBp} />
        ) : (
          <ContaAtiva r={q.data!} />
        )
      }
    </Estado>
  );
}

const pct = (bp: number) => `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function AtivarRecebimento({ taxaBp }: { taxaBp: number }) {
  const cliente = useQueryClient();
  const [tipo, setTipo] = useState<'pf' | 'pj'>('pj');
  const [f, setF] = useState({
    nome: '',
    documento: '',
    email: '',
    telefone: '',
    nascimento: '',
    tipoEmpresa: 'MEI',
    faturamento: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const mudar = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Wallet aria-hidden className="size-6 text-modulo-texto" /> Receba o clube pelo link
        </h2>
        <ul className="flex flex-col gap-1.5 text-tinta-suave">
          <li>1. O cliente recebe o link pelo WhatsApp e assina sozinho, no Pix ou no cartão.</li>
          <li>2. A mensalidade é cobrada todo mês, sem a recepção dar baixa.</li>
          <li>3. O dinheiro cai na sua conta no Asaas e você saca para o seu banco.</li>
        </ul>
        <p className="text-sm text-tinta-suave">
          Taxas: a do Asaas (Pix ou cartão) e {pct(taxaBp)} do Pente Fino sobre cada mensalidade
          paga pelo link. A baixa no balcão continua sem taxa.
        </p>
      </section>

      <form
        noValidate
        aria-label="Dados para receber"
        className="flex flex-col gap-4 rounded-xl border border-borda bg-superficie p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setCampos({});
          setEnviando(true);
          try {
            await api('clube/recebimento', {
              corpo: {
                tipo,
                nome: f.nome,
                documento: f.documento,
                email: f.email,
                telefone: f.telefone,
                ...(tipo === 'pf'
                  ? { nascimento: f.nascimento || undefined }
                  : { tipoEmpresa: f.tipoEmpresa }),
                faturamentoMensal: lerMoeda(f.faturamento) ?? 0,
                cep: f.cep,
                endereco: f.endereco,
                numero: f.numero,
                complemento: f.complemento || undefined,
                bairro: f.bairro,
              },
            });
            await cliente.invalidateQueries({ queryKey: chaveRecebimento });
          } catch (er) {
            if (er instanceof ErroApi && er.campos.length)
              setCampos(Object.fromEntries(er.campos.map((c) => [c.campo, c.mensagem])));
            setErro(mensagemDe(er));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Dados da conta (vão para o Asaas)</h2>
        <Selecao
          id="rec-tipo"
          rotulo="A conta é de"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'pf' | 'pj')}
          opcoes={[
            { valor: 'pj', rotulo: 'Empresa (CNPJ)' },
            { valor: 'pf', rotulo: 'Pessoa física (CPF)' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="rec-nome"
            rotulo={tipo === 'pj' ? 'Razão social' : 'Nome completo'}
            value={f.nome}
            onChange={mudar('nome')}
            erro={campos.nome}
          />
          <Campo
            id="rec-doc"
            rotulo={tipo === 'pj' ? 'CNPJ' : 'CPF'}
            inputMode="numeric"
            value={f.documento}
            onChange={mudar('documento')}
            erro={campos.documento}
          />
          {tipo === 'pj' ? (
            <Selecao
              id="rec-empresa"
              rotulo="Tipo de empresa"
              value={f.tipoEmpresa}
              onChange={mudar('tipoEmpresa')}
              opcoes={TIPOS_EMPRESA.map((t) => ({ valor: t, rotulo: NOME_TIPO_EMPRESA[t] }))}
            />
          ) : (
            <Campo
              id="rec-nasc"
              rotulo="Data de nascimento"
              type="date"
              value={f.nascimento}
              onChange={mudar('nascimento')}
              erro={campos.nascimento}
            />
          )}
          <Campo
            id="rec-fat"
            rotulo={tipo === 'pj' ? 'Faturamento por mês (R$)' : 'Renda por mês (R$)'}
            inputMode="decimal"
            value={f.faturamento}
            onChange={mudar('faturamento')}
            erro={campos.faturamentoMensal}
          />
          <Campo
            id="rec-email"
            rotulo="E-mail (login no Asaas)"
            type="email"
            value={f.email}
            onChange={mudar('email')}
            erro={campos.email}
          />
          <Campo
            id="rec-tel"
            rotulo="Celular"
            inputMode="tel"
            value={f.telefone}
            onChange={mudar('telefone')}
            erro={campos.telefone}
          />
          <Campo
            id="rec-cep"
            rotulo="CEP"
            inputMode="numeric"
            value={f.cep}
            onChange={mudar('cep')}
            erro={campos.cep}
          />
          <Campo
            id="rec-bairro"
            rotulo="Bairro"
            value={f.bairro}
            onChange={mudar('bairro')}
            erro={campos.bairro}
          />
          <Campo
            id="rec-end"
            rotulo="Rua"
            value={f.endereco}
            onChange={mudar('endereco')}
            erro={campos.endereco}
          />
          <div className="grid grid-cols-2 gap-4">
            <Campo
              id="rec-num"
              rotulo="Número"
              value={f.numero}
              onChange={mudar('numero')}
              erro={campos.numero}
            />
            <Campo
              id="rec-comp"
              rotulo="Complemento"
              value={f.complemento}
              onChange={mudar('complemento')}
            />
          </div>
        </div>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" className="self-start" carregando={enviando}>
          Criar conta para receber
        </Botao>
        <p className="text-xs text-tinta-suave">
          O Asaas manda um e-mail para você criar a senha e pede os documentos. Os dados ficam com o
          Asaas, que é quem guarda e repassa o dinheiro.
        </p>
      </form>
    </div>
  );
}

function ContaAtiva({ r }: { r: RecebimentoNaTela }) {
  const [mes, setMes] = useState(mesAtual());
  const [erro, setErro] = useState<string | null>(null);
  const recebimentos = useQuery({
    queryKey: ['clube', 'recebimentos', mes],
    queryFn: () => api<RecebimentoClube[]>(`clube/recebimentos?mes=${mes}`),
  });
  const total = (recebimentos.data ?? []).reduce(
    (s, x) => ({ valor: s.valor + x.valor, repasse: s.repasse + x.repasse }),
    { valor: 0, repasse: 0 },
  );
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-xl border border-borda bg-superficie p-5 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tinta-suave">Conta no Asaas</span>
          <span className="font-semibold">{r.nome}</span>
          <Ficha tom={TOM_SITUACAO[r.situacao!]}>{NOME_SITUACAO_RECEBIMENTO[r.situacao!]}</Ficha>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tinta-suave">Saldo para sacar</span>
          <span className="font-denso text-3xl font-semibold tabular-nums">
            {r.saldo === null ? '—' : formatarMoeda(r.saldo)}
          </span>
          <span className="text-xs text-tinta-suave">Saque pelo app ou site do Asaas (Pix).</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tinta-suave">Taxa do Pente Fino</span>
          <span className="font-denso text-3xl font-semibold tabular-nums">{pct(r.taxaBp)}</span>
          <span className="text-xs text-tinta-suave">Sobre cada mensalidade paga pelo link.</span>
        </div>
      </section>

      {(r.situacao === 'documentos' || r.situacao === 'recusada') && (
        <Aviso tom="aviso">
          <span className="flex flex-col gap-2">
            <span>
              {r.situacao === 'documentos'
                ? 'Falta enviar os documentos ao Asaas. Os clientes já podem assinar, mas o saque só libera depois da aprovação.'
                : 'O Asaas recusou a conta. Abra a página do Asaas para ver o motivo e reenviar.'}
            </span>
            <Botao
              variante="secundario"
              className="self-start"
              onClick={async () => {
                setErro(null);
                const janela = window.open('', '_blank');
                try {
                  const { link } = await api<{ link: string | null }>(
                    'clube/recebimento/documentos',
                  );
                  if (!link) {
                    janela?.close();
                    setErro('Nada a enviar agora: os documentos já estão em análise.');
                  } else if (janela) janela.location.href = link;
                } catch (e) {
                  janela?.close();
                  setErro(mensagemDe(e));
                }
              }}
            >
              <ExternalLink aria-hidden className="size-4" /> Enviar documentos no Asaas
            </Botao>
          </span>
        </Aviso>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recebidos pelo link</h2>
          <SeletorMes mes={mes} onMudar={setMes} />
        </div>
        <Estado consulta={recebimentos}>
          {() =>
            recebimentos.data!.length === 0 ? (
              <p className="rounded-lg border border-borda bg-superficie p-5 text-tinta-suave">
                Nenhuma mensalidade paga pelo link neste mês. Mande o link dos planos na aba Planos.
              </p>
            ) : (
              <>
                <p className="text-sm text-tinta-suave">
                  Entrou {formatarMoeda(total.valor)} · para você{' '}
                  <strong className="text-tinta">{formatarMoeda(total.repasse)}</strong>
                </p>
                <Tabela rotulo="Mensalidades recebidas pelo link">
                  <thead>
                    <tr className="border-b border-borda">
                      {[
                        'Cliente',
                        'Plano',
                        'Pago em',
                        'Valor',
                        'Taxa Asaas',
                        'Taxa Pente Fino',
                        'Para você',
                        'Crédito',
                      ].map((c) => (
                        <th key={c} scope="col" className={th}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recebimentos.data!.map((x) => (
                      <tr key={x.id} className="border-b border-borda">
                        <th scope="row" className={`${td} font-semibold`}>
                          {x.cliente}
                        </th>
                        <td className={td}>{x.plano}</td>
                        <td className={`${td} tabular-nums`}>
                          {x.pagoEm.split('-').reverse().join('/')}
                        </td>
                        <td className={`${td} tabular-nums`}>{formatarMoeda(x.valor)}</td>
                        <td className={`${td} tabular-nums text-tinta-suave`}>
                          {formatarMoeda(x.taxaAsaas)}
                        </td>
                        <td className={`${td} tabular-nums text-tinta-suave`}>
                          {formatarMoeda(x.taxaPlataforma)}
                        </td>
                        <td className={`${td} font-semibold tabular-nums`}>
                          {formatarMoeda(x.repasse)}
                        </td>
                        <td className={`${td} tabular-nums`}>
                          {x.creditoPrevisto ? formatarData(`${x.creditoPrevisto}T12:00:00`) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </>
            )
          }
        </Estado>
      </section>
    </div>
  );
}

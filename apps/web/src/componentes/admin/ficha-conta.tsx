'use client';

import {
  dataLocal,
  fimDoPeriodo,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  FORMAS_PAGAMENTO_MANUAL,
  lerMoeda,
  NOME_FORMA_MANUAL,
  NOME_PLANO,
  PLANOS,
  aplicarDesconto,
  precoPorMes,
  LIMITE_TESTE_DIAS,
  NOME_PROXIMO_PASSO,
  PROXIMOS_PASSOS,
  TOTAL_PASSOS_ATIVACAO,
  diasRestantesDoTeste,
  notaInternaSchema,
  proximaCobrancaDaConta,
  whatsappDoDono,
  type NotaInterna,
  type AcaoConta,
  type FichaContaPlataforma,
  type ProximoPasso,
  type PapelPlataforma,
} from '@pente-fino/shared';
import { Botao, Campo, CampoTexto, Dialogo, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado, Ficha, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';
import { useTabelasAdmin } from './precos-admin';

const NOME_ACAO: Record<string, string> = {
  mudar_plano: 'Mudou o plano',
  mudar_teste: 'Mudou o fim do teste',
  bloquear: 'Bloqueou',
  desbloquear: 'Desbloqueou',
  cancelar: 'Cancelou',
  reativar: 'Reativou',
  cortesia: 'Deu cortesia',
  cobrar: 'Marcou o início da cobrança',
  marcar_interna: 'Marcou como conta interna',
  desmarcar_interna: 'Desmarcou conta interna',
  registrar_pagamento: 'Registrou pagamento',
  nota_interna: 'Escreveu uma nota interna',
};

const NOME_STATUS: Record<FichaContaPlataforma['status'], string> = {
  teste: 'Em teste',
  ativa: 'Ativa',
  suspensa: 'Bloqueada',
  cancelada: 'Cancelada',
};

/** O que dá para fazer em cada situação (a regra completa está em situacao-conta.ts). */
function acoesPara(f: FichaContaPlataforma): { valor: AcaoConta; rotulo: string }[] {
  const auto = f.cobrancaAutomatica;
  switch (f.status) {
    case 'teste':
      return [
        { valor: 'bloquear', rotulo: 'Bloquear (só consulta; desbloquear volta ao teste)' },
        ...(auto ? [] : [{ valor: 'cortesia' as const, rotulo: 'Dar cortesia até a data' }]),
        { valor: 'cancelar', rotulo: 'Cancelar (só consulta; nada se apaga)' },
      ];
    case 'ativa':
      return [
        { valor: 'bloquear', rotulo: 'Bloquear (só consulta; desbloquear volta a ativa)' },
        ...(auto
          ? []
          : [
              { valor: 'cortesia' as const, rotulo: 'Dar cortesia até a data' },
              { valor: 'cobrar' as const, rotulo: 'Começar a cobrar a partir da data' },
            ]),
        { valor: 'cancelar', rotulo: 'Cancelar (para a cobrança; nada se apaga)' },
      ];
    case 'suspensa':
      return [
        {
          valor: 'desbloquear',
          rotulo: `Desbloquear (volta a ${NOME_STATUS[f.statusAnterior ?? 'ativa'].toLowerCase()})`,
        },
        { valor: 'cancelar', rotulo: 'Cancelar (para a cobrança; nada se apaga)' },
      ];
    case 'cancelada':
      return [{ valor: 'reativar', rotulo: 'Reativar com o próximo passo' }];
  }
}

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível salvar.';

/** Bloco de ação com motivo: cada mudança fica na auditoria da plataforma com o motivo. */
function Acao({
  titulo,
  children,
  podeEnviar,
  textoBotao,
  tom = 'acao',
  enviar,
}: {
  titulo: string;
  children: ReactNode;
  podeEnviar: boolean;
  textoBotao: string;
  tom?: 'acao' | 'perigo';
  enviar: () => Promise<unknown>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      method="post"
      noValidate
      aria-label={titulo}
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        setOk(false);
        setEnviando(true);
        try {
          await enviar();
          setOk(true);
        } catch (er) {
          setErro(mensagemDe(er));
        } finally {
          setEnviando(false);
        }
      }}
    >
      <h3 className="font-semibold">{titulo}</h3>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {ok && (
        <p role="status" className="text-sm text-acao-texto">
          Feito. Ficou registrado no histórico.
        </p>
      )}
      {children}
      <Botao
        type="submit"
        className="self-start"
        variante={tom === 'perigo' ? 'perigo' : 'acao'}
        disabled={!podeEnviar}
        carregando={enviando}
      >
        {textoBotao}
      </Botao>
    </form>
  );
}

function CampoMotivo({
  id,
  valor,
  onMudar,
}: {
  id: string;
  valor: string;
  onMudar: (v: string) => void;
}) {
  return (
    <Campo
      id={id}
      rotulo="Motivo"
      dica="Obrigatório: fica no histórico da conta."
      value={valor}
      onChange={(e) => onMudar(e.target.value)}
    />
  );
}

/** Ficha da conta na administração: dados de quem paga, estrutura, cobrança, ações e histórico. */
export function FichaConta({
  id,
  onFechar,
  papel,
}: {
  id: string | null;
  onFechar: () => void;
  papel: PapelPlataforma;
}) {
  const cliente = useQueryClient();
  const chave = ['admin', 'conta', id] as const;
  const ficha = useQuery({
    queryKey: chave,
    queryFn: () => adminApi<FichaContaPlataforma>(`contas/${id}`),
    enabled: !!id,
  });
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin'] });
  return (
    <Dialogo
      aberto={!!id}
      titulo={ficha.data?.nome ?? 'Conta'}
      descricao="Assinatura, estrutura e cobrança. Sem dados de clientes da barbearia."
      onFechar={onFechar}
      largura="larga"
    >
      <Estado consulta={ficha}>
        {() => (
          <Conteudo
            f={ficha.data!}
            contaId={id!}
            atualizar={atualizar}
            admin={papel === 'admin'}
            podePagar={papel !== 'suporte'}
          />
        )}
      </Estado>
    </Dialogo>
  );
}

function Conteudo({
  f,
  contaId,
  atualizar,
  admin,
  podePagar,
}: {
  f: FichaContaPlataforma;
  contaId: string;
  atualizar: () => Promise<void>;
  /** Vendedor e financeiro só registram pagamento; o resto é do admin. */
  admin: boolean;
  /** Admin U6: o suporte só lê a ficha. */
  podePagar: boolean;
}) {
  const hoje = dataLocal(new Date());
  const [plano, setPlano] = useState(f.plano);
  const [ciclo, setCiclo] = useState(f.ciclo);
  const [motivoPlano, setMotivoPlano] = useState('');
  // Padrão: 7 dias depois do fim do teste atual (ou de hoje, se já acabou); nunca encurta sem querer.
  const baseTeste =
    f.testeAte && dataLocal(new Date(f.testeAte)) > hoje ? dataLocal(new Date(f.testeAte)) : hoje;
  // Sugere +7 dias, mas nunca além do limite do teste (admin R6): a tela não sugere uma data
  // que o servidor vai recusar.
  const [ate, setAte] = useState(() => {
    const sugerida = somarDias(baseTeste, 7);
    const limite = somarDias(hoje, LIMITE_TESTE_DIAS);
    return sugerida > limite ? limite : sugerida;
  });
  const [motivoTeste, setMotivoTeste] = useState('');
  const opcoesSituacao = acoesPara(f);
  const [acao, setAcao] = useState<AcaoConta>(opcoesSituacao[0]!.valor);
  const [proximo, setProximo] = useState<ProximoPasso>('teste');
  const [dataSituacao, setDataSituacao] = useState(() => somarDias(hoje, 14));
  const [motivoSituacao, setMotivoSituacao] = useState('');
  const [motivoInterna, setMotivoInterna] = useState('');
  // Ação que leva data: cortesia, início da cobrança e reativar.
  const pedeData = acao === 'cortesia' || acao === 'cobrar' || acao === 'reativar';
  const rotuloData =
    acao === 'cobrar' || (acao === 'reativar' && proximo === 'cobranca')
      ? 'Cobrar a partir de'
      : acao === 'cortesia' || (acao === 'reativar' && proximo === 'cortesia')
        ? 'Cortesia até'
        : 'Teste até';
  const unidades = Math.max(1, f.unidades.filter((u) => u.ativa).length);
  const tabelaConta = useTabelasAdmin().vigente(f.precosDesde);
  const sugerido =
    aplicarDesconto(precoPorMes(f.plano, f.ciclo, unidades, tabelaConta), f.descontoBp) *
    (f.ciclo === 'anual' ? 12 : 1);
  const [valor, setValor] = useState((sugerido / 100).toFixed(2).replace('.', ','));
  const [forma, setForma] = useState<(typeof FORMAS_PAGAMENTO_MANUAL)[number]>('pix');
  const [pagoEm, setPagoEm] = useState(hoje);
  const [inicio, setInicio] = useState(hoje);
  const [comprovante, setComprovante] = useState('');
  const motivoOk = (m: string) => m.trim().length >= 5;
  const base = `contas/${contaId}`;

  const proxima = proximaCobrancaDaConta(f, sugerido, hoje);
  const diasTeste = diasRestantesDoTeste(f, hoje);

  return (
    <div className="flex flex-col gap-6">
      {/* Admin U3: o que importa na primeira olhada. */}
      <dl className="grid gap-3 rounded-lg border border-borda p-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Próxima cobrança
          </dt>
          <dd className="font-semibold tabular-nums">{proxima.titulo}</dd>
          {proxima.detalhe && <dd className="text-sm text-tinta-suave">{proxima.detalhe}</dd>}
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Teste</dt>
          <dd className="tabular-nums">
            {diasTeste === null
              ? 'Já passou do teste'
              : diasTeste === 0
                ? 'Termina hoje'
                : `${diasTeste} ${diasTeste === 1 ? 'dia restante' : 'dias restantes'}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Ativação
          </dt>
          <dd className="tabular-nums">
            {f.ativacao} de {TOTAL_PASSOS_ATIVACAO} primeiros passos
          </dd>
          <dd className="text-sm text-tinta-suave">
            {f.ativacao >= TOTAL_PASSOS_ATIVACAO
              ? 'Configurou tudo.'
              : f.ativacao <= 2
                ? 'Quase nada configurado: vale uma ligação.'
                : 'No caminho.'}
          </dd>
        </div>
      </dl>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Plano</dt>
          <dd className="font-semibold">
            {NOME_PLANO[f.plano]} · {f.ciclo} ·{' '}
            {f.cobrancaAutomatica ? 'cobrança automática' : 'cobrança manual'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Situação
          </dt>
          <dd>
            <Ficha tom={f.status === 'ativa' ? 'acao' : f.status === 'teste' ? 'aviso' : 'perigo'}>
              {f.cortesiaAte && f.status === 'ativa' && f.cortesiaAte >= hoje
                ? 'Cortesia'
                : NOME_STATUS[f.status]}
            </Ficha>
            {f.testeAte && f.status === 'teste' && (
              <span className="ml-2 text-sm text-tinta-suave">até {formatarData(f.testeAte)}</span>
            )}
            {f.status === 'suspensa' && f.statusAnterior && (
              <span className="block text-sm text-tinta-suave">
                Era {NOME_STATUS[f.statusAnterior].toLowerCase()} antes do bloqueio
              </span>
            )}
            {f.cortesiaAte && f.cortesiaAte >= hoje && (
              <span className="block text-sm text-tinta-suave">
                Cortesia até {formatarData(`${f.cortesiaAte}T12:00:00Z`)}
              </span>
            )}
            {f.cobrarAPartirDe && !f.cobrancaAutomatica && f.status === 'ativa' && (
              <span className="block text-sm text-tinta-suave">
                Cobrança a partir de {formatarData(`${f.cobrarAPartirDe}T12:00:00Z`)}
              </span>
            )}
            {f.interna && (
              <span className="ml-2">
                <Ficha tom="neutro">Conta interna</Ficha>
              </span>
            )}
            {f.motivoCancelamento && (
              <span className="block text-sm text-tinta-suave">Motivo: {f.motivoCancelamento}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Desde</dt>
          <dd className="tabular-nums">{formatarData(f.criadaEm)}</dd>
          {/* Admin F2: de onde veio o cadastro (anúncio, campanha, site). */}
          <dd className="text-sm text-tinta-suave">
            {f.origem ? `Veio de: ${f.origem}` : 'Origem: direto ou sem dado'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Quem paga
          </dt>
          <dd>
            {f.donos.length === 0
              ? '—'
              : f.donos.map((d) => (
                  <span key={d.email} className="block">
                    {d.nome} · {d.email}
                    {d.telefone ? ` · ${d.telefone}` : ''}
                    {whatsappDoDono(d.telefone, d.nome) && (
                      <>
                        {' · '}
                        <a
                          href={whatsappDoDono(d.telefone, d.nome)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-acao-texto underline underline-offset-2"
                        >
                          Chamar no WhatsApp
                          <span className="sr-only"> (abre em outra aba)</span>
                        </a>
                      </>
                    )}
                  </span>
                ))}
            {f.documento && (
              <span className="block text-sm text-tinta-suave">CPF/CNPJ {f.documento}</span>
            )}
            {f.cupom && (
              <span className="block text-sm text-tinta-suave">
                Cupom {f.cupom} ({f.descontoBp / 100}% de desconto)
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Estrutura
          </dt>
          <dd>
            {f.unidades.map((u) => u.nome + (u.ativa ? '' : ' (inativa)')).join(', ') || '—'} ·{' '}
            {f.profissionais} {f.profissionais === 1 ? 'profissional' : 'profissionais'}
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        {podePagar && (
          <Acao
            titulo="Registrar pagamento"
            textoBotao="Registrar pagamento"
            podeEnviar={(lerMoeda(valor) ?? 0) > 0}
            enviar={async () => {
              await adminApi(`${base}/pagamentos`, {
                corpo: {
                  valor: lerMoeda(valor),
                  forma,
                  pagoEm,
                  periodoInicio: inicio,
                  comprovante: comprovante.trim() || null,
                },
              });
              await atualizar();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id="pag-valor"
                rotulo="Valor (R$)"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <Selecao
                id="pag-forma"
                rotulo="Forma"
                value={forma}
                onChange={(e) => setForma(e.target.value as typeof forma)}
                opcoes={FORMAS_PAGAMENTO_MANUAL.map((x) => ({
                  valor: x,
                  rotulo: NOME_FORMA_MANUAL[x],
                }))}
              />
              <Campo
                id="pag-data"
                rotulo="Pago em"
                type="date"
                value={pagoEm}
                onChange={(e) => setPagoEm(e.target.value)}
              />
              <Campo
                id="pag-inicio"
                rotulo="Cobre a partir de"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                dica={`Até ${formatarData(`${fimDoPeriodo(inicio, f.ciclo)}T12:00:00Z`)} (${f.ciclo})`}
              />
            </div>
            <Campo
              id="pag-comprovante"
              rotulo="Comprovante (opcional)"
              dica="Código do Pix, número do recibo ou do boleto."
              value={comprovante}
              onChange={(e) => setComprovante(e.target.value)}
            />
          </Acao>
        )}

        {admin && (
          <Acao
            titulo="Mudar plano"
            textoBotao="Mudar plano"
            podeEnviar={motivoOk(motivoPlano) && (plano !== f.plano || ciclo !== f.ciclo)}
            enviar={async () => {
              await adminApi(`${base}/plano`, {
                metodo: 'PUT',
                corpo: { plano, ciclo, motivo: motivoPlano },
              });
              setMotivoPlano('');
              await atualizar();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao
                id="conta-plano"
                rotulo="Plano"
                value={plano}
                onChange={(e) => setPlano(e.target.value as typeof plano)}
                opcoes={PLANOS.map((p) => ({ valor: p, rotulo: NOME_PLANO[p] }))}
              />
              <Selecao
                id="conta-ciclo"
                rotulo="Ciclo"
                value={ciclo}
                onChange={(e) => setCiclo(e.target.value as typeof ciclo)}
                opcoes={[
                  { valor: 'mensal', rotulo: 'Mensal' },
                  { valor: 'anual', rotulo: 'Anual' },
                ]}
              />
            </div>
            <CampoMotivo id="motivo-plano" valor={motivoPlano} onMudar={setMotivoPlano} />
          </Acao>
        )}

        {admin && (
          <Acao
            titulo="Estender teste"
            textoBotao="Salvar data"
            podeEnviar={motivoOk(motivoTeste)}
            enviar={async () => {
              await adminApi(`${base}/teste`, {
                metodo: 'PUT',
                corpo: { ate, motivo: motivoTeste },
              });
              setMotivoTeste('');
              await atualizar();
            }}
          >
            <Campo
              id="teste-ate"
              rotulo="Teste até"
              type="date"
              min={hoje}
              max={somarDias(hoje, LIMITE_TESTE_DIAS)}
              dica={`No máximo ${LIMITE_TESTE_DIAS} dias a partir de hoje. Para mais tempo sem pagar, use cortesia.`}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
            <CampoMotivo id="motivo-teste" valor={motivoTeste} onMudar={setMotivoTeste} />
          </Acao>
        )}

        {admin && (
          <Acao
            titulo="Situação da conta"
            textoBotao={
              opcoesSituacao.find((o) => o.valor === acao)?.rotulo.split(' (')[0] ?? 'Salvar'
            }
            tom={acao === 'bloquear' || acao === 'cancelar' ? 'perigo' : 'acao'}
            podeEnviar={motivoOk(motivoSituacao) && (!pedeData || !!dataSituacao)}
            enviar={async () => {
              await adminApi(`${base}/situacao`, {
                metodo: 'PUT',
                corpo: {
                  acao,
                  motivo: motivoSituacao,
                  ...(acao === 'reativar' ? { proximo } : {}),
                  ...(pedeData ? { data: dataSituacao } : {}),
                },
              });
              setMotivoSituacao('');
              await atualizar();
            }}
          >
            <Selecao
              id="conta-acao"
              rotulo="O que fazer"
              value={acao}
              onChange={(e) => setAcao(e.target.value as AcaoConta)}
              opcoes={opcoesSituacao}
            />
            {acao === 'reativar' && (
              <Selecao
                id="conta-proximo"
                rotulo="Próximo passo"
                value={proximo}
                onChange={(e) => setProximo(e.target.value as ProximoPasso)}
                opcoes={PROXIMOS_PASSOS.map((p) => ({ valor: p, rotulo: NOME_PROXIMO_PASSO[p] }))}
              />
            )}
            {pedeData && (
              <Campo
                id="conta-data"
                rotulo={rotuloData}
                type="date"
                min={hoje}
                value={dataSituacao}
                onChange={(e) => setDataSituacao(e.target.value)}
              />
            )}
            <CampoMotivo id="motivo-situacao" valor={motivoSituacao} onMudar={setMotivoSituacao} />
            <p className="text-sm text-tinta-suave">
              {acao === 'cancelar' && f.cobrancaAutomatica
                ? 'Cancelar também para a cobrança automática no Asaas. '
                : ''}
              {acao === 'cortesia' || (acao === 'reativar' && proximo === 'cortesia')
                ? 'Na cortesia a barbearia usa sem pagar; a cobrança começa no dia seguinte ao fim. '
                : ''}
              Bloqueada ou cancelada, a barbearia continua lendo tudo e exportando os dados; só não
              grava.
            </p>
          </Acao>
        )}

        {admin && (
          <Acao
            titulo="Conta interna"
            textoBotao={f.interna ? 'Desmarcar conta interna' : 'Marcar como conta interna'}
            tom="acao"
            podeEnviar={motivoOk(motivoInterna)}
            enviar={async () => {
              await adminApi(`${base}/interna`, {
                metodo: 'PUT',
                corpo: { interna: !f.interna, motivo: motivoInterna },
              });
              setMotivoInterna('');
              await atualizar();
            }}
          >
            <p className="text-sm text-tinta-suave">
              {f.interna
                ? 'Esta conta é da própria equipe: fica fora do MRR, dos números, do "Precisa de atenção" e da cobrança manual.'
                : 'Para contas da própria equipe (testes, demonstração, implantação): saem do MRR, dos números, do "Precisa de atenção" e da cobrança manual. A barbearia não vê diferença.'}
            </p>
            <CampoMotivo id="motivo-interna" valor={motivoInterna} onMudar={setMotivoInterna} />
          </Acao>
        )}
      </div>

      <Notas contaId={contaId} notas={f.notas} podeEscrever={admin} atualizar={atualizar} />

      <section aria-labelledby="titulo-faturas-conta" className="flex flex-col gap-2">
        <h3 id="titulo-faturas-conta" className="font-semibold">
          Cobranças
        </h3>
        {f.faturas.length === 0 ? (
          <p className="text-sm text-tinta-suave">Nenhuma cobrança ainda.</p>
        ) : (
          <Tabela rotulo="Cobranças da conta">
            <thead>
              <tr className="border-b border-borda">
                {['Período', 'Valor', 'Situação', 'Origem', 'Pago em'].map((c) => (
                  <th key={c} scope="col" className={th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.faturas.map((x, i) => (
                <tr key={i} className="border-b border-borda">
                  <td className={`${td} tabular-nums`}>
                    {formatarData(`${x.periodoInicio}T12:00:00Z`)} a{' '}
                    {formatarData(`${x.periodoFim}T12:00:00Z`)}
                  </td>
                  <td className={`${td} tabular-nums`}>{formatarMoeda(x.valor)}</td>
                  <td className={td}>{x.status}</td>
                  <td className={td}>
                    {x.origem === 'manual' ? 'Manual' : 'Asaas'}
                    {x.forma ? ` · ${x.forma}` : ''}
                    {x.comprovante ? ` · ${x.comprovante}` : ''}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {x.pagaEm ? formatarDataHora(x.pagaEm) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      <section aria-labelledby="titulo-historico-conta" className="flex flex-col gap-2">
        <h3 id="titulo-historico-conta" className="font-semibold">
          Histórico da administração
        </h3>
        {f.historico.length === 0 ? (
          <p className="text-sm text-tinta-suave">Nenhuma ação ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Histórico da conta">
            {f.historico.map((h, i) => (
              <li
                key={i}
                className="flex flex-wrap justify-between gap-x-3 border-b border-borda py-1"
              >
                <span>
                  <strong>{NOME_ACAO[h.acao] ?? h.acao}</strong>
                  {h.quem ? ` · ${h.quem}` : ''}
                  {h.motivo ? ` · “${h.motivo}”` : ''}
                </span>
                <span className="tabular-nums text-tinta-suave">
                  {formatarDataHora(h.criadoEm)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Notas internas da equipe sobre a conta (admin U3): a barbearia não vê. */
function Notas({
  contaId,
  notas,
  podeEscrever,
  atualizar,
}: {
  contaId: string;
  notas: NotaInterna[];
  podeEscrever: boolean;
  atualizar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const valido = notaInternaSchema.safeParse({ texto }).success;
  const salvar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      await adminApi(`contas/${contaId}/notas`, { metodo: 'POST', corpo: { texto } });
      setTexto('');
      await atualizar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu para salvar a nota. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section aria-labelledby="titulo-notas-conta" className="flex flex-col gap-2">
      <h3 id="titulo-notas-conta" className="font-semibold">
        Notas da equipe
      </h3>
      <p className="text-sm text-tinta-suave">
        O que foi combinado, ligações, próximos passos. A barbearia não vê.
      </p>
      {podeEscrever && (
        <div className="flex flex-col gap-2">
          <CampoTexto
            id="nota-conta"
            rotulo="Nova nota"
            dica="Até 2.000 letras."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
          />
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div>
            <Botao onClick={salvar} disabled={!valido || enviando}>
              {enviando ? 'Salvando…' : 'Salvar nota'}
            </Botao>
          </div>
        </div>
      )}
      {notas.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma nota ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Notas da conta">
          {notas.map((n) => (
            <li key={n.id} className="rounded-lg border border-borda p-2 text-sm">
              <p className="whitespace-pre-wrap">{n.texto}</p>
              <p className="mt-1 text-xs text-tinta-suave tabular-nums">
                {n.autor ?? 'Equipe'} · {formatarDataHora(n.criadoEm)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

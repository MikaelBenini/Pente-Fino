'use client';

// Abrir outro negócio com o mesmo login (duas contas, um login; ADR 0015): o dono cria mais uma
// conta (outra licença, se quiser), com o mesmo e-mail e a mesma senha, 20% de desconto na
// mensalidade dela, e troca pelo menu ("Seus outros negócios").
import {
  aplicarDesconto,
  DESCONTO_SEGUNDA_CONTA_BP,
  formatarMoeda,
  LICENCAS_A_VENDA,
  NOME_LICENCA,
  NOME_PLANO,
  PARA_QUEM_LICENCA,
  PLANOS_DA_LICENCA,
  precoPorMes,
  SEGMENTOS_DA_LICENCA,
  segmentoPadraoDaLicenca,
  vocabulario,
  type Licenca,
  type PlanoConta,
  type Segmento,
} from '@pente-fino/shared';
import { Botao, Campo, Selecao } from '@pente-fino/ui';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { guardarNegocio } from '@/lib/sessao';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina } from '../pagina';

export function TelaOutroNegocio() {
  const app = useApp();
  const [nome, setNome] = useState('');
  const [licenca, setLicenca] = useState<Licenca>('barbearia');
  const [segmento, setSegmento] = useState<Segmento>('barbearia');
  const [plano, setPlano] = useState<PlanoConta>('basico');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  if (!app.papeis.includes('dono'))
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Abrir outro negócio" pergunta="Só o dono abre outro negócio." />
        <Aviso tom="info">Peça ao dono da conta para abrir o novo negócio.</Aviso>
      </div>
    );

  const planos = PLANOS_DA_LICENCA[licenca];
  const cheio = precoPorMes(plano, 'mensal', 1, undefined, false, licenca);
  const comDesconto = aplicarDesconto(cheio, DESCONTO_SEGUNDA_CONTA_BP);

  const mudarLicenca = (l: Licenca) => {
    setLicenca(l);
    setSegmento(segmentoPadraoDaLicenca(l));
    if (!PLANOS_DA_LICENCA[l].includes(plano)) setPlano(PLANOS_DA_LICENCA[l][0]!);
  };

  const criar = async () => {
    setErro(null);
    setCriando(true);
    try {
      const r = await api<{ usuario: { contaId: string } }>('conta/outro-negocio', {
        corpo: { nome, licenca, segmento, plano, ciclo: 'mensal' },
      });
      guardarNegocio(r.usuario.contaId, true);
      // Recarga completa: o painel abre já no negócio novo.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/inicio');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir o negócio agora.');
      setCriando(false);
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Abrir outro negócio"
        pergunta="Mais um negócio no mesmo login, com 20% de desconto na mensalidade dele"
      />
      <p className="text-tinta-suave">
        Você entra nos dois com o mesmo e-mail e a mesma senha e troca pelo menu. Cada negócio tem a
        sua agenda, os seus clientes, a sua equipe e a sua assinatura. O novo começa no teste
        grátis.
      </p>
      <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
        <Campo
          id="negocio-nome"
          rotulo="Nome do negócio"
          placeholder="Ex.: Clínica Bela"
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Selecao
          id="negocio-licenca"
          rotulo="Licença"
          value={licenca}
          onChange={(e) => mudarLicenca(e.target.value as Licenca)}
          opcoes={LICENCAS_A_VENDA.map((l) => ({
            valor: l,
            rotulo: `${NOME_LICENCA[l]}: ${PARA_QUEM_LICENCA[l]}`,
          }))}
        />
        {SEGMENTOS_DA_LICENCA[licenca].length > 1 && (
          <Selecao
            id="negocio-segmento"
            rotulo="Tipo de negócio"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value as Segmento)}
            opcoes={SEGMENTOS_DA_LICENCA[licenca].map((s) => ({
              valor: s,
              rotulo: vocabulario(s).nomeSegmento,
            }))}
          />
        )}
        {planos.length > 1 && (
          <Selecao
            id="negocio-plano"
            rotulo="Plano"
            value={plano}
            onChange={(e) => setPlano(e.target.value as PlanoConta)}
            opcoes={planos.map((p) => ({ valor: p, rotulo: NOME_PLANO[p] }))}
          />
        )}
        <p className="text-sm">
          Depois do teste: <s className="text-tinta-suave tabular-nums">{formatarMoeda(cheio)}</s>{' '}
          <span className="font-semibold tabular-nums">{formatarMoeda(comDesconto)} por mês</span>{' '}
          (20% de desconto por ser o seu segundo negócio).
        </p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao
          className="self-start"
          disabled={nome.trim().length < 2}
          carregando={criando}
          onClick={criar}
        >
          Abrir o negócio
        </Botao>
      </div>
    </div>
  );
}

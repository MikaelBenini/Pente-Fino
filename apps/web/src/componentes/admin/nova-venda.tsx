'use client';

import {
  NOME_PLANO,
  PLANOS,
  precoPorMes,
  type VendaCriada,
  type VendasDoVendedor,
} from '@pente-fino/shared';
import { formatarMoeda } from '@pente-fino/shared';
import { Botao, Campo, Dialogo, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { Estado, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';
import { useTabelasAdmin } from './precos-admin';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível criar a conta.';

/**
 * Venda presencial: barbearia, dono, plano e dias de teste. A conta nasce na hora; o dono
 * recebe o convite por e-mail e o vendedor manda pelo WhatsApp do próprio celular.
 */
export function NovaVenda({
  aberto,
  onFechar,
  onAbrirConta,
}: {
  aberto: boolean;
  onFechar: () => void;
  onAbrirConta: (id: string) => void;
}) {
  const cliente = useQueryClient();
  const [barbearia, setBarbearia] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [plano, setPlano] = useState<(typeof PLANOS)[number]>('pro');
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal');
  const [dias, setDias] = useState('14');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const tabelaHoje = useTabelasAdmin().vigente();
  const [venda, setVenda] = useState<VendaCriada | null>(null);

  function fechar() {
    setVenda(null);
    setErro(null);
    setBarbearia('');
    setNome('');
    setEmail('');
    setTelefone('');
    onFechar();
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo="Nova venda"
      descricao="A conta nasce agora; o dono recebe o convite para criar a senha."
      onFechar={fechar}
      largura="larga"
    >
      {venda ? (
        <div className="flex flex-col gap-4">
          <Aviso tom="sucesso">
            Conta criada. O convite foi para {email}. Mande também pelo WhatsApp e, se ele já pagou,
            registre o pagamento.
          </Aviso>
          <div className="flex flex-wrap gap-2">
            {venda.linkWhatsapp && (
              <a
                href={venda.linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-acao px-4 font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-foco"
              >
                <MessageCircle aria-hidden className="size-5" /> Mandar convite pelo WhatsApp
              </a>
            )}
            <Botao
              variante="secundario"
              onClick={() => {
                const id = venda.contaId;
                fechar();
                onAbrirConta(id);
              }}
            >
              Registrar pagamento agora
            </Botao>
          </div>
          <p className="text-sm text-tinta-suave break-all">
            Link do convite (vale 7 dias): {venda.linkConvite}
          </p>
        </div>
      ) : (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setEnviando(true);
            try {
              const r = await adminApi<VendaCriada>('contas', {
                corpo: {
                  barbearia,
                  dono: { nome, email, telefone: telefone.trim() || null },
                  plano,
                  ciclo,
                  diasTeste: Number(dias) || 0,
                },
              });
              setVenda(r);
              await cliente.invalidateQueries({ queryKey: ['admin'] });
            } catch (er) {
              setErro(mensagemDe(er));
            } finally {
              setEnviando(false);
            }
          }}
        >
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <Campo
            id="venda-barbearia"
            rotulo="Nome da barbearia"
            value={barbearia}
            onChange={(e) => setBarbearia(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              id="venda-dono"
              rotulo="Nome do dono"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Campo
              id="venda-email"
              rotulo="E-mail do dono"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Campo
              id="venda-telefone"
              rotulo="WhatsApp do dono"
              inputMode="tel"
              dica="Com DDD."
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao
              id="venda-plano"
              rotulo="Plano"
              value={plano}
              onChange={(e) => setPlano(e.target.value as typeof plano)}
              opcoes={PLANOS.map((p) => ({
                valor: p,
                rotulo: `${NOME_PLANO[p]} · ${formatarMoeda(precoPorMes(p, ciclo, 1, tabelaHoje))}/mês`,
              }))}
            />
            <Selecao
              id="venda-ciclo"
              rotulo="Cobrança"
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value as typeof ciclo)}
              opcoes={[
                { valor: 'mensal', rotulo: 'Mensal' },
                { valor: 'anual', rotulo: 'Anual' },
              ]}
            />
            <Campo
              id="venda-dias"
              rotulo="Dias de teste"
              inputMode="numeric"
              dica="0 = já paga hoje."
              value={dias}
              onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Botao type="submit" className="self-start" carregando={enviando}>
            Criar conta e mandar convite
          </Botao>
        </form>
      )}
    </Dialogo>
  );
}

/** Admin: quem vendeu quanto (contas criadas, ativadas pelo dono e pagas). */
export function VendasPorVendedor() {
  const v = useQuery({
    queryKey: ['admin', 'vendas'],
    queryFn: () => adminApi<VendasDoVendedor[]>('vendas'),
  });
  return (
    <section aria-labelledby="titulo-vendas" className="flex flex-col gap-3">
      <h2 id="titulo-vendas" className="text-2xl font-semibold">
        Vendas por vendedor
      </h2>
      <Estado consulta={v}>
        {() =>
          v.data!.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma venda presencial ainda.</p>
          ) : (
            <Tabela rotulo="Vendas por vendedor">
              <thead>
                <tr className="border-b border-borda">
                  {['Vendedor', 'Contas criadas', 'Ativadas pelo dono', 'Pagas'].map((c) => (
                    <th key={c} scope="col" className={th}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.data!.map((x) => (
                  <tr key={x.vendedorId} className="border-b border-borda">
                    <th scope="row" className={`${td} font-semibold`}>
                      {x.nome}
                    </th>
                    <td className={`${td} tabular-nums`}>{x.criadas}</td>
                    <td className={`${td} tabular-nums`}>{x.ativadas}</td>
                    <td className={`${td} tabular-nums`}>{x.pagas}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )
        }
      </Estado>
    </section>
  );
}

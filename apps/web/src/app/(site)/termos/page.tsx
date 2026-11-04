import { DIAS_TESTE } from '@pente-fino/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DocumentoLegal, type SecaoLegal } from '@/componentes/site/documento-legal';
import { EMAIL_CONTATO } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Regras de uso do Pente Fino: conta, teste grátis, planos, cobrança e cancelamento.',
  alternates: { canonical: '/termos' },
};

const SECOES: readonly SecaoLegal[] = [
  {
    id: 'aceite',
    titulo: 'Aceite',
    conteudo: (
      <p>
        Ao criar uma conta, você declara ter lido e aceito estes termos e a{' '}
        <Link href="/privacidade" className="text-tinta underline underline-offset-4">
          política de privacidade
        </Link>
        . Se usa o Pente Fino em nome de uma barbearia, declara ter poderes para aceitá-los por ela.
        A data e a versão do aceite ficam registradas na conta.
      </p>
    ),
  },
  {
    id: 'servico',
    titulo: 'O serviço',
    conteudo: (
      <p>
        O Pente Fino é um sistema de gestão para barbearias, acessado pela internet: agenda,
        comandas, caixa, comissões, despesas, indicadores, app do barbeiro e link de agendamento.
        Recursos marcados como “em breve” ainda não fazem parte do serviço contratado.
      </p>
    ),
  },
  {
    id: 'conta',
    titulo: 'Conta e acessos',
    conteudo: (
      <ul>
        <li>O dono da conta responde pelos usuários que convida (gestor, recepção, barbeiros).</li>
        <li>Senhas são pessoais. Avise-nos se suspeitar de uso indevido.</li>
        <li>
          Os dados lançados devem ser verdadeiros e obtidos de forma lícita, incluindo os dados dos
          seus clientes.
        </li>
      </ul>
    ),
  },
  {
    id: 'teste',
    titulo: 'Teste grátis',
    conteudo: (
      <p>
        Toda conta nova tem {DIAS_TESTE} dias de teste com os recursos do plano escolhido, sem
        cartão. Para continuar depois do teste é preciso assinar um plano; nada é cobrado
        automaticamente e os dados lançados no teste continuam na conta.
      </p>
    ),
  },
  {
    id: 'planos',
    titulo: 'Planos, preços e cobrança',
    conteudo: (
      <ul>
        <li>
          Os preços e limites de cada plano estão em{' '}
          <Link href="/planos" className="text-tinta underline underline-offset-4">
            /planos
          </Link>
          . Os limites (unidades e profissionais ativos) são aplicados pelo sistema.
        </li>
        <li>O plano mensal é cobrado todo mês, adiantado. O anual é cobrado de uma vez.</li>
        <li>
          Reajustes são avisados com pelo menos 30 dias de antecedência e valem a partir da próxima
          cobrança. O plano anual mantém o preço até o fim do período pago.
        </li>
        <li>
          Com pagamento atrasado há mais de 15 dias, a conta passa a só leitura até a regularização.
          Nenhum dado é apagado por atraso.
        </li>
      </ul>
    ),
  },
  {
    id: 'cancelamento',
    titulo: 'Cancelamento',
    conteudo: (
      <p>
        Não há fidelidade nem multa. O cancelamento vale ao fim do período já pago, sem reembolso
        proporcional do anual, salvo o direito de arrependimento de 7 dias da primeira contratação
        (Código de Defesa do Consumidor, art. 49), quando aplicável. Os dados ficam guardados por 90
        dias após o fim da assinatura para exportação e depois são apagados.
      </p>
    ),
  },
  {
    id: 'uso',
    titulo: 'Uso aceitável',
    conteudo: (
      <ul>
        <li>Não use o sistema para enviar mensagens em massa não solicitadas.</li>
        <li>Não tente acessar dados de outra conta nem burlar limites ou permissões.</li>
        <li>
          O WhatsApp conectado é da barbearia; as regras do WhatsApp continuam valendo para ele.
        </li>
      </ul>
    ),
  },
  {
    id: 'disponibilidade',
    titulo: 'Disponibilidade e suporte',
    conteudo: (
      <p>
        Trabalhamos para manter o sistema no ar e com cópias de segurança diárias, mas podem ocorrer
        interrupções para manutenção ou por falhas de terceiros (internet, hospedagem, WhatsApp).
        Manutenções programadas são feitas fora do horário comercial sempre que possível. Suporte
        por e-mail em {EMAIL_CONTATO}.
      </p>
    ),
  },
  {
    id: 'responsabilidade',
    titulo: 'Responsabilidade',
    conteudo: (
      <p>
        Os cálculos (comissão, lucro, projeção) seguem as regras e os valores cadastrados pela
        barbearia. Confira-os antes de pagar comissões ou tomar decisões fiscais; o Pente Fino não
        substitui contador. A responsabilidade total do Pente Fino fica limitada ao valor pago nos
        últimos 12 meses.
      </p>
    ),
  },
  {
    id: 'mudancas',
    titulo: 'Mudanças nestes termos',
    conteudo: (
      <p>
        Mudanças relevantes são avisadas por e-mail e no sistema com 30 dias de antecedência. A
        versão vigente fica sempre nesta página, com a data no topo.
      </p>
    ),
  },
  {
    id: 'foro',
    titulo: 'Lei e foro',
    conteudo: (
      <p>
        Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do contratante para
        resolver qualquer questão.
      </p>
    ),
  },
];

export default function Pagina() {
  return (
    <DocumentoLegal
      titulo="Termos de uso"
      resumo="Em poucas palavras: teste sem cartão, sem fidelidade, seus dados são seus e você pode exportá-los quando quiser."
      secoes={SECOES}
    />
  );
}

import type { Metadata } from 'next';
import { DocumentoLegal, type SecaoLegal } from '@/componentes/site/documento-legal';
import { EMAIL_PRIVACIDADE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description:
    'Como o Pente Fino trata dados pessoais segundo a LGPD: papéis, finalidades, segurança, prazos e direitos.',
  alternates: { canonical: '/privacidade' },
};

const SECOES: readonly SecaoLegal[] = [
  {
    id: 'papeis',
    titulo: 'Quem é responsável pelos dados',
    conteudo: (
      <>
        <p>
          <strong>Dados dos clientes da barbearia</strong> (nome, telefone, histórico de
          atendimentos): a barbearia é a <strong>controladora</strong> e o Pente Fino é o{' '}
          <strong>operador</strong>, tratando esses dados só para prestar o serviço e conforme as
          instruções da barbearia.
        </p>
        <p>
          <strong>Dados de quem usa o sistema</strong> (dono, gestor, recepção, barbeiros) e de
          cadastro da conta: o Pente Fino é o controlador.
        </p>
      </>
    ),
  },
  {
    id: 'dados',
    titulo: 'Quais dados tratamos',
    conteudo: (
      <ul>
        <li>Conta: nome da barbearia, nome, e-mail e senha (guardada só como hash).</li>
        <li>Operação: agenda, comandas, pagamentos, comissões, despesas e metas.</li>
        <li>Clientes da barbearia: nome, telefone e, se informados, e-mail e aniversário.</li>
        <li>Segurança: registro de acessos, endereço IP e ações sensíveis (auditoria).</li>
      </ul>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Para que usamos e com qual base legal',
    conteudo: (
      <ul>
        <li>Prestar o serviço contratado (execução de contrato).</li>
        <li>Segurança, prevenção a fraude e auditoria (legítimo interesse).</li>
        <li>Obrigações fiscais e de cobrança (obrigação legal).</li>
        <li>
          Avisos sobre a conta e o serviço. Não vendemos dados nem usamos dados dos clientes da
          barbearia para publicidade.
        </li>
      </ul>
    ),
  },
  {
    id: 'compartilhamento',
    titulo: 'Com quem compartilhamos',
    conteudo: (
      <p>
        Só com fornecedores necessários ao serviço: hospedagem do servidor, envio de e-mail e
        processamento de pagamento da assinatura. O WhatsApp usado pelo bot é o da própria
        barbearia. Os dados ficam em servidor no Brasil ou em país com proteção adequada.
      </p>
    ),
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    conteudo: (
      <ul>
        <li>Conexão sempre criptografada (HTTPS).</li>
        <li>
          Cada barbearia isolada no banco de dados por regra do próprio banco (Row Level Security),
          além das permissões por papel.
        </li>
        <li>Senhas com hash forte; sessões em cookie protegido, renovadas e revogáveis.</li>
        <li>Cópias de segurança diárias, guardadas fora do servidor principal.</li>
        <li>O barbeiro vê só os próprios dados e o telefone do cliente pode ser ocultado dele.</li>
      </ul>
    ),
  },
  {
    id: 'prazos',
    titulo: 'Por quanto tempo guardamos',
    conteudo: (
      <p>
        Enquanto a conta estiver ativa. Após o cancelamento, por 90 dias para permitir a exportação;
        depois, os dados são apagados, exceto o que a lei obriga a guardar (por exemplo, registros
        de cobrança e de acesso).
      </p>
    ),
  },
  {
    id: 'direitos',
    titulo: 'Seus direitos',
    conteudo: (
      <>
        <p>
          Pela LGPD (art. 18), você pode pedir confirmação, acesso, correção, portabilidade,
          anonimização ou eliminação dos seus dados, e informações sobre compartilhamento.
        </p>
        <p>
          <strong>Cliente de uma barbearia?</strong> Fale primeiro com ela, que é a controladora dos
          seus dados; se precisar, nós ajudamos a barbearia a atender o pedido.
        </p>
        <p>O dono da conta exporta os dados da barbearia em planilha pelo próprio sistema.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    titulo: 'Cookies',
    conteudo: (
      <p>
        Usamos apenas cookies necessários para manter a sessão de quem entra no sistema e a
        preferência de tema. Não usamos cookies de publicidade nem de rastreamento de terceiros.
      </p>
    ),
  },
  {
    id: 'contato',
    titulo: 'Encarregado (DPO) e contato',
    conteudo: (
      <p>
        Pedidos e dúvidas sobre privacidade:{' '}
        <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="text-tinta underline underline-offset-4">
          {EMAIL_PRIVACIDADE}
        </a>
        . Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de
        Dados (ANPD).
      </p>
    ),
  },
];

export default function Pagina() {
  return (
    <DocumentoLegal
      titulo="Política de privacidade"
      resumo="A barbearia é dona dos dados dos clientes dela; nós cuidamos deles para prestar o serviço, com isolamento por conta e sem vender nada a ninguém."
      secoes={SECOES}
    />
  );
}

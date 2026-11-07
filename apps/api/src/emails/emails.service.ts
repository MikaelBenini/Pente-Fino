import { Inject, Injectable } from '@nestjs/common';
import { configuracaoDoSistema } from '@pente-fino/db';
import {
  emailPronto,
  FUSO_EXIBICAO,
  lerConfiguracaoPublica,
  montarEmail as montar,
  type ChaveModeloEmail,
  type TextoModeloEmail,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Filas } from '../filas/filas.module.js';

function dataHora(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: FUSO_EXIBICAO,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Os modelos personalizados são relidos depois disto (a administração pode ter mudado). */
const RELER_MS = 60_000;

/** Textos dos e-mails do sistema. O envio é do worker (fila "emails"). */
@Injectable()
export class EmailsService {
  private modelos?: { ate: number; valor: Partial<Record<ChaveModeloEmail, TextoModeloEmail>> };

  constructor(
    @Inject(Filas) private readonly filas: Filas,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  /** A administração mudou um modelo: vale no próximo e-mail. */
  esquecerModelos(): void {
    this.modelos = undefined;
  }

  /** Textos personalizados na administração (sem conseguir ler, vale o padrão). */
  private async personalizados() {
    if (this.modelos && this.modelos.ate > Date.now()) return this.modelos.valor;
    const valor = await configuracaoDoSistema(this.banco.prisma)
      .then((c) => lerConfiguracaoPublica(c).modelosEmail)
      .catch(() => ({}));
    this.modelos = { ate: Date.now() + RELER_MS, valor };
    return valor;
  }

  private async doModelo(
    para: string,
    chave: ChaveModeloEmail,
    vars: Record<string, string>,
    link?: string,
  ): Promise<void> {
    await this.enfileirar(emailPronto(para, chave, await this.personalizados(), vars, link));
  }

  private async enfileirar(email: TrabalhoEmail): Promise<void> {
    await this.filas.emails.add('enviar', email);
  }

  convite(d: {
    para: string;
    nome: string;
    conta: string;
    convidadoPor: string;
    link: string;
    expiraEm: Date;
  }) {
    return this.doModelo(
      d.para,
      'convite_equipe',
      {
        nome: d.nome,
        conta: d.conta,
        convidadoPor: d.convidadoPor,
        validade: dataHora(d.expiraEm),
      },
      d.link,
    );
  }

  /** Venda presencial: a conta já existe; o dono cria a senha e cai na configuração guiada. */
  ativacaoConta(d: {
    para: string;
    nome: string;
    conta: string;
    vendedor: string;
    link: string;
    expiraEm: Date;
  }) {
    return this.doModelo(
      d.para,
      'ativacao_conta',
      { nome: d.nome, conta: d.conta, vendedor: d.vendedor, validade: dataHora(d.expiraEm) },
      d.link,
    );
  }

  redefinirSenha(d: { para: string; nome: string; link: string }) {
    return this.doModelo(d.para, 'redefinir_senha', { nome: d.nome }, d.link);
  }

  /** Mensalidade paga (Asaas ou registrada pela administração). */
  pagamentoRecebido(d: {
    para: string;
    nome: string;
    conta: string;
    valor: string;
    periodo: string;
  }) {
    return this.doModelo(d.para, 'pagamento_recebido', {
      nome: d.nome,
      conta: d.conta,
      valor: d.valor,
      periodo: d.periodo,
    });
  }

  senhaAlterada(d: { para: string; nome: string }) {
    return this.enfileirar(
      montar(d.para, 'Sua senha foi alterada', [
        `Olá, ${d.nome}!`,
        `Sua senha do Pente Fino foi alterada em ${dataHora(new Date())}. Por segurança, as outras sessões foram encerradas.`,
        'Se não foi você, fale agora com o dono da barbearia.',
      ]),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { configuracaoDoSistema } from '@pente-fino/db';
import {
  emailPronto,
  FUSO_EXIBICAO,
  lerConfiguracaoPublica,
  type ChaveModeloEmail,
  type TextoModeloEmail,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
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
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
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
    await this.enfileirar(
      emailPronto(para, chave, await this.personalizados(), vars, link, {
        site: this.config.appUrl,
      }),
    );
  }

  private async enfileirar(email: TrabalhoEmail): Promise<void> {
    await this.filas.emails.add('enviar', email);
  }

  /** E-mail de texto simples para a equipe da plataforma (ex.: conversa nova no chat, admin F6). */
  texto(email: TrabalhoEmail): Promise<void> {
    return this.enfileirar(email);
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
    return this.doModelo(d.para, 'senha_alterada', {
      nome: d.nome,
      data: dataHora(new Date()),
    });
  }

  /** O WhatsApp de uma unidade caiu sozinho: o botão leva à tela Bot para ler o QR Code. */
  whatsappCaiu(d: { para: string; nome: string; conta: string; unidade: string; caiuEm: Date }) {
    return this.doModelo(
      d.para,
      'whatsapp_caiu',
      {
        nome: d.nome.split(' ')[0] ?? d.nome,
        conta: d.conta,
        unidade: d.unidade,
        data: dataHora(d.caiuEm),
      },
      `${this.config.appUrl}/bot`,
    );
  }

  /** Novo link de confirmação do e-mail ("Reenviar e-mail" no painel). */
  confirmarEmail(d: { para: string; nome: string; link: string; expiraEm: Date }) {
    return this.doModelo(
      d.para,
      'confirmar_email',
      { nome: d.nome.split(' ')[0] ?? d.nome, validade: dataHora(d.expiraEm) },
      d.link,
    );
  }

  /** Cadastro pelo site: boas-vindas com o botão de confirmar o e-mail e os primeiros passos. */
  boasVindas(d: {
    para: string;
    nome: string;
    conta: string;
    testeAte: Date;
    dias: number;
    link?: string;
  }) {
    return this.doModelo(
      d.para,
      'boas_vindas',
      {
        nome: d.nome.split(' ')[0] ?? d.nome,
        conta: d.conta,
        dias: String(d.dias),
        data: d.testeAte.toLocaleDateString('pt-BR', { timeZone: FUSO_EXIBICAO }),
      },
      d.link ?? `${this.config.appUrl}/app`,
    );
  }
}

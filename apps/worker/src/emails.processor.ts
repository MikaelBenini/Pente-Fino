import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { configuracaoSmtp, decifrar } from '@pente-fino/db';
import { FILA_EMAILS, smtpGuardadoSchema, type TrabalhoEmail } from '@pente-fino/shared';
import { type Job, Worker } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';
import { Banco } from './banco.js';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

type Enviar = (mensagem: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => Promise<unknown>;

/** Quem envia agora: remetente e a função de envio (SMTP da administração ou do .env). */
export interface Envio {
  remetente: string;
  enviar: Enviar;
}

/** Entrega um e-mail da fila. Separado do Worker para ser testável sem Redis. */
export function processadorDeEmail(envio: () => Promise<Envio> | Envio) {
  return async (job: Job<TrabalhoEmail>): Promise<void> => {
    const { remetente, enviar } = await envio();
    const { para, assunto, texto, html } = job.data;
    await enviar({ from: remetente, to: para, subject: assunto, text: texto, html });
  };
}

/** A configuração do SMTP é lida de novo depois disto (a administração pode ter mudado). */
const RELER_MS = 60_000;

/**
 * Consome a fila "emails". Usa o SMTP configurado na administração (senha decifrada com a
 * PLATAFORMA_CHAVE); sem ele, ou se não der para decifrar, o do .env continua valendo.
 */
@Injectable()
export class EmailsProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Emails');
  private worker?: Worker<TrabalhoEmail>;
  private reserva?: Transporter;
  private atual?: { ate: number; chave: string; envio: Envio; transporte?: Transporter };

  constructor(
    @Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker,
    @Inject(Banco) private readonly banco: Banco,
  ) {}

  /** SMTP do .env (reserva). */
  private envioReserva(): Envio {
    const c = this.config;
    this.reserva ??= createTransport({
      host: c.SMTP_HOST,
      port: c.SMTP_PORT,
      secure: c.SMTP_SECURE,
      auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASSWORD } : undefined,
    });
    const t = this.reserva;
    return { remetente: c.EMAIL_FROM, enviar: (m) => t.sendMail(m) };
  }

  async envio(): Promise<Envio> {
    if (this.atual && this.atual.ate > Date.now()) return this.atual.envio;
    let envio = this.envioReserva();
    let chave = 'reserva';
    let transporte: Transporter | undefined;
    try {
      const guardado = smtpGuardadoSchema.safeParse(await configuracaoSmtp(this.banco.prisma));
      if (guardado.success && this.config.PLATAFORMA_CHAVE) {
        const g = guardado.data;
        const senha = g.senhaCifrada
          ? decifrar(g.senhaCifrada, Buffer.from(this.config.PLATAFORMA_CHAVE, 'base64'))
          : '';
        chave = JSON.stringify([g.host, g.porta, g.seguro, g.usuario, g.senhaCifrada, g.remetente]);
        transporte =
          this.atual?.chave === chave && this.atual.transporte
            ? this.atual.transporte
            : createTransport({
                host: g.host,
                port: g.porta,
                secure: g.seguro,
                auth: g.usuario ? { user: g.usuario, pass: senha } : undefined,
              });
        const t = transporte;
        envio = { remetente: g.remetente, enviar: (m) => t.sendMail(m) };
      }
    } catch (e) {
      this.logger.error(
        `SMTP da administração inválido, usando o do .env: ${(e as Error).message}`,
      );
    }
    if (this.atual?.transporte && this.atual.transporte !== transporte)
      this.atual.transporte.close();
    this.atual = { ate: Date.now() + RELER_MS, chave, envio, transporte };
    return envio;
  }

  onModuleInit(): void {
    this.worker = new Worker<TrabalhoEmail>(
      FILA_EMAILS,
      processadorDeEmail(() => this.envio()),
      {
        connection: { url: this.config.REDIS_URL },
        concurrency: 5,
      },
    );
    this.worker.on('completed', (job) =>
      this.logger.log(`E-mail "${job.data.assunto}" entregue (job ${job.id}).`),
    );
    this.worker.on('failed', (job, erro) =>
      this.logger.error(
        `E-mail falhou (job ${job?.id}, tentativa ${job?.attemptsMade}): ${erro.message}`,
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    this.reserva?.close();
    this.atual?.transporte?.close();
  }
}

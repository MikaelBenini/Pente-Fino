import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { FILA_EMAILS, type TrabalhoEmail } from '@pente-fino/shared';
import { type Job, Worker } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

type Enviar = (mensagem: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => Promise<unknown>;

/** Entrega um e-mail da fila. Separado do Worker para ser testável sem Redis. */
export function processadorDeEmail(remetente: string, enviar: Enviar) {
  return async (job: Job<TrabalhoEmail>): Promise<void> => {
    const { para, assunto, texto, html } = job.data;
    await enviar({ from: remetente, to: para, subject: assunto, text: texto, html });
  };
}

/** Consome a fila "emails" e entrega pelo SMTP (Mailpit em desenvolvimento). */
@Injectable()
export class EmailsProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Emails');
  private worker?: Worker<TrabalhoEmail>;
  private transporte?: Transporter;

  constructor(@Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker) {}

  onModuleInit(): void {
    const c = this.config;
    const transporte = createTransport({
      host: c.SMTP_HOST,
      port: c.SMTP_PORT,
      secure: c.SMTP_SECURE,
      auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASSWORD } : undefined,
    });
    this.transporte = transporte;
    this.worker = new Worker<TrabalhoEmail>(
      FILA_EMAILS,
      processadorDeEmail(c.EMAIL_FROM, (m) => transporte.sendMail(m)),
      { connection: { url: c.REDIS_URL }, concurrency: 5 },
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
    this.transporte?.close();
  }
}

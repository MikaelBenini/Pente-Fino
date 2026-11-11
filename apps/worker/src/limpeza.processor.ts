// Rotina diária de limpeza de dados (Etapa 15.4), às 3h30 (depois do backup das 3h): avisa e
// apaga contas paradas ou sem confirmação, limpa o que passou de 90 dias em todas as contas e
// grava o total de cada tipo em execucao_limpeza (Saúde do sistema, na administração).
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  apagarContaNaLimpeza,
  avisosDeExclusao,
  configuracaoDoSistema,
  contasParaLimpeza,
  limparDadosDaConta,
  limparSessoesDaAdministracao,
  situacaoDaContaNaLimpeza,
  type PrismaClient,
} from '@pente-fino/db';
import {
  DIAS_GUARDA,
  FILA_EMAILS,
  FILA_EVENTOS,
  FILA_LIMPEZA,
  FILA_NOTIFICACOES,
  FILA_WHATSAPP_ENTRADA,
  FILA_WHATSAPP_SAIDA,
  lerConfiguracaoPublica,
  type ExecucaoLimpezaNaTela,
  type TipoLimpeza,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import { Queue, Worker } from 'bullmq';
import { Banco } from './banco.js';
import { Batimento } from './batimento.js';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

type Apagados = Partial<Record<TipoLimpeza, number>>;

export interface DependenciasLimpeza {
  appUrl: string;
  enviarEmail: (e: TrabalhoEmail) => Promise<unknown>;
  /** Trabalhos concluídos ou com falha há mais de 90 dias nas filas; devolve quantos saíram. */
  limparFilas: (antesDeMs: number) => Promise<number>;
  agora?: Date;
  lote?: number;
}

const somar = (total: Apagados, parte: Apagados) => {
  for (const [k, v] of Object.entries(parte) as [TipoLimpeza, number][])
    total[k] = (total[k] ?? 0) + v;
};

/** A rotina inteira; separada do Worker para ser testável sem Redis. */
export async function executarLimpeza(
  prisma: PrismaClient,
  d: DependenciasLimpeza,
  log: Pick<Logger, 'error'> = new Logger('Limpeza'),
): Promise<ExecucaoLimpezaNaTela> {
  const agora = d.agora ?? new Date();
  const execucao = await prisma.execucaoLimpeza.create({ data: { iniciadaEm: agora } });
  const apagados: Apagados = {};
  const retidas: ExecucaoLimpezaNaTela['retidas'] = [];
  const falhas: string[] = [];
  const { modelosEmail } = lerConfiguracaoPublica(await configuracaoDoSistema(prisma));

  for (const conta of await contasParaLimpeza(prisma)) {
    try {
      const s = await situacaoDaContaNaLimpeza(prisma, conta.id, agora);
      if (!s) continue;
      if (s.decisao.tipo === 'avisar')
        for (const e of avisosDeExclusao(conta.nome, s, {
          appUrl: d.appUrl,
          modelos: modelosEmail,
        }))
          await d.enviarEmail(e);
      if (s.decisao.tipo === 'apagar') {
        if (s.retencao) {
          retidas.push({ contaId: conta.id, conta: conta.nome, motivo: s.retencao });
        } else {
          await apagarContaNaLimpeza(prisma, conta.id, conta.nome, s.decisao.motivo);
          const tipo =
            s.decisao.motivo === 'sem_confirmar' ? 'contasSemConfirmar' : 'contasParadas';
          apagados[tipo] = (apagados[tipo] ?? 0) + 1;
          continue;
        }
      }
      somar(apagados, await limparDadosDaConta(prisma, conta.id, { agora, lote: d.lote }));
    } catch (e) {
      // Uma conta com problema não para a rotina das outras.
      const msg = `Conta ${conta.id}: ${(e as Error).message}`;
      log.error(msg);
      falhas.push(msg);
    }
  }
  try {
    apagados.sessoesAdmin = await limparSessoesDaAdministracao(prisma, d.lote);
    apagados.filas = await d.limparFilas(DIAS_GUARDA * 86_400_000);
  } catch (e) {
    falhas.push((e as Error).message);
  }

  const terminadaEm = new Date();
  const erro = falhas.length ? falhas.slice(0, 5).join(' · ').slice(0, 1000) : null;
  await prisma.execucaoLimpeza.update({
    where: { id: execucao.id },
    data: { terminadaEm, apagados, retidas, erro },
  });
  return {
    iniciadaEm: agora.toISOString(),
    terminadaEm: terminadaEm.toISOString(),
    apagados,
    retidas,
    erro,
  };
}

const FILAS_LIMPAS = [
  FILA_EMAILS,
  FILA_EVENTOS,
  FILA_NOTIFICACOES,
  FILA_WHATSAPP_ENTRADA,
  FILA_WHATSAPP_SAIDA,
  FILA_LIMPEZA,
];

@Injectable()
export class LimpezaProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Limpeza');
  private fila?: Queue;
  private emails?: Queue<TrabalhoEmail>;
  private worker?: Worker;

  constructor(
    @Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker,
    @Inject(Banco) private readonly banco: Banco,
    @Inject(Batimento) private readonly batimento: Batimento,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.config.REDIS_URL };
    this.fila = new Queue(FILA_LIMPEZA, {
      connection,
      defaultJobOptions: { removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } },
    });
    this.emails = new Queue<TrabalhoEmail>(FILA_EMAILS, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    void this.fila
      .upsertJobScheduler(
        'limpeza-diaria',
        { pattern: '30 3 * * *', tz: 'America/Sao_Paulo' },
        { name: 'limpeza', data: {} },
      )
      .catch((e: Error) => this.logger.error(`Agendar a limpeza: ${e.message}`));

    const emails = this.emails;
    this.worker = new Worker(
      FILA_LIMPEZA,
      async () => {
        const r = await executarLimpeza(
          this.banco.prisma,
          {
            appUrl: this.config.APP_URL,
            enviarEmail: (e) => emails.add('limpeza', e),
            limparFilas: async (antesDeMs) => {
              let total = 0;
              for (const nome of FILAS_LIMPAS) {
                const q = new Queue(nome, { connection });
                try {
                  for (const tipo of ['completed', 'failed'] as const)
                    total += (await q.clean(antesDeMs, 10_000, tipo)).length;
                } finally {
                  await q.close();
                }
              }
              return total;
            },
          },
          this.logger,
        );
        const soma = Object.values(r.apagados).reduce((a, b) => a + (b ?? 0), 0);
        return `limpeza: ${soma} itens, ${r.retidas.length} conta(s) retida(s)`;
      },
      { connection, concurrency: 1 },
    );
    this.worker.on('failed', (_job, erro) => this.logger.error(`Limpeza falhou: ${erro.message}`));
    this.worker.on('completed', (_job, r) => void this.batimento.registrarRotina('limpeza', r));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.fila?.close();
    await this.emails?.close();
  }
}

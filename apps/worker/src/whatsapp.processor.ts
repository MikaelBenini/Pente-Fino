import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  atenderMensagem,
  enviarLembrete,
  iniciarPesquisa,
  lembretesDoAgendamento,
  avisarNotaBaixa,
  oferecerVaga,
  remarcacaoPorAtraso,
  contasParaAvisos,
  lembretesPerdidos,
  rotinaDosAvisos,
  contasParaAvisosDaAssinatura,
  rotinaAvisosDaAssinatura,
  configuracaoDoSistema,
  avisoHorarioCancelado,
  avisoHorarioMudou,
  contasComAutomacoes,
  rodarAutomacoes,
  encerrarEsperaDoAtendente,
  avisarProximoCliente,
  trabalhoNotaBaixa,
  primeirasRotinas,
  rodarRotinaEquipe,
  naConta,
  prepararEnvio,
  registrarEnvio,
  type PrismaClient,
  type ResultadoAtendimento,
} from '@pente-fino/db';
import {
  FILA_NOTIFICACOES,
  FILA_WHATSAPP_ENTRADA,
  FILA_WHATSAPP_SAIDA,
  ESPERA_ATENDENTE_MAX_MIN,
  HORA_DAS_AUTOMACOES,
  INTERVALO_PENDENTES_MIN,
  lerConfiguracaoPublica,
  FILA_EMAILS,
  type TrabalhoEmail,
  NOTA_BAIXA_ESPERA_MIN,
  TENTATIVAS_REPETIVEIS,
  proximoEnvio,
  type TrabalhoNotificacao,
  type TrabalhoWhatsappEntrada,
  type TrabalhoWhatsappSaida,
} from '@pente-fino/shared';
import { ProvedorEvolution, ProvedorFalso, type ProvedorWhatsApp } from '@pente-fino/whatsapp';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Banco } from './banco.js';
import { Batimento, rotinaDoTrabalho } from './batimento.js';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

/** Onde a próxima mensagem de cada número da barbearia pode sair (ms). */
export interface RelogioDeEnvio {
  ultimo(instancia: string): Promise<number | null>;
  marcar(instancia: string, quando: number): Promise<void>;
}

export const TENTATIVAS_ENVIO = 3;

/**
 * Coloca as respostas na fila de saída, uma atrás da outra, com o intervalo mínimo e uma
 * variação aleatória por número (proteção contra bloqueio do WhatsApp).
 */
export async function agendarRespostas(
  r: Pick<
    Extract<ResultadoAtendimento, { tipo: 'respondida' }>,
    'contaId' | 'instancia' | 'saidas'
  >,
  deps: {
    relogio: RelogioDeEnvio;
    adicionar: (t: TrabalhoWhatsappSaida, atrasoMs: number) => Promise<unknown>;
    agora?: () => number;
    aleatorio?: () => number;
  },
): Promise<void> {
  const agora = deps.agora?.() ?? Date.now();
  let ultimo = await deps.relogio.ultimo(r.instancia);
  for (const mensagemId of r.saidas) {
    const quando = proximoEnvio(ultimo, agora, deps.aleatorio?.() ?? Math.random());
    await deps.adicionar({ contaId: r.contaId, mensagemId }, quando - agora);
    ultimo = quando;
  }
  if (ultimo !== null) await deps.relogio.marcar(r.instancia, ultimo);
}

/** Uma mensagem da fila de saída: confere se pode sair, envia e registra. */
export function processadorDeSaida(prisma: PrismaClient, provedor: ProvedorWhatsApp) {
  return async (job: Job<TrabalhoWhatsappSaida>): Promise<'enviada' | 'pulada'> => {
    const { contaId, mensagemId } = job.data;
    const preparo = await prepararEnvio(prisma, contaId, mensagemId);
    if (preparo.tipo === 'pular') return 'pulada';
    try {
      const r = await provedor.enviarTexto(preparo.instancia, preparo.telefone, preparo.texto);
      await registrarEnvio(prisma, contaId, mensagemId, { ok: true, idExterno: r.idExterno });
      return 'enviada';
    } catch (e) {
      const ultima = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (ultima)
        await registrarEnvio(prisma, contaId, mensagemId, {
          ok: false,
          erro: (e as Error).message,
        });
      throw e;
    }
  };
}

export function criarProvedor(c: ConfiguracaoWorker): ProvedorWhatsApp {
  if (c.WHATSAPP_PROVEDOR === 'falso') return new ProvedorFalso();
  return new ProvedorEvolution({ url: c.EVOLUTION_API_URL, chave: c.EVOLUTION_API_KEY });
}

/**
 * Bot do WhatsApp: a fila de entrada roda o menu para cada mensagem recebida (uma por vez,
 * para a sessão de cada número andar em ordem); a fila de saída envia as respostas.
 */
@Injectable()
export class WhatsappProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('WhatsApp');
  private entrada?: Worker<TrabalhoWhatsappEntrada>;
  private saida?: Worker<TrabalhoWhatsappSaida>;
  private filaSaida?: Queue<TrabalhoWhatsappSaida>;
  private filaEntrada?: Queue<TrabalhoWhatsappEntrada>;
  private filaNotificacoes?: Queue<TrabalhoNotificacao>;
  private filaEmails?: Queue<TrabalhoEmail>;
  private redis?: Redis;

  constructor(
    @Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker,
    @Inject(Banco) private readonly banco: Banco,
    @Inject(Batimento) private readonly batimento: Batimento,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.config.REDIS_URL };
    const provedor = criarProvedor(this.config);
    if (provedor.nome === 'falso')
      this.logger.warn('WHATSAPP_PROVEDOR=falso: as respostas não saem de verdade.');
    const filaSaida = new Queue<TrabalhoWhatsappSaida>(FILA_WHATSAPP_SAIDA, {
      connection,
      defaultJobOptions: {
        attempts: TENTATIVAS_ENVIO,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    this.filaSaida = filaSaida;
    // Lembretes do horário marcado pela conversa: trabalhos atrasados na própria fila de entrada.
    const filaEntrada = new Queue<TrabalhoWhatsappEntrada>(FILA_WHATSAPP_ENTRADA, {
      connection,
      defaultJobOptions: { removeOnComplete: { count: 1_000 }, removeOnFail: { count: 5_000 } },
    });
    this.filaEntrada = filaEntrada;
    const filaNotificacoes = new Queue<TrabalhoNotificacao>(FILA_NOTIFICACOES, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    this.filaNotificacoes = filaNotificacoes;
    // Resumo do dia por e-mail (quem escolheu no Perfil).
    const filaEmails = new Queue<TrabalhoEmail>(FILA_EMAILS, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    this.filaEmails = filaEmails;
    // Automações do pós-atendimento: todo dia às 10 h (São Paulo).
    void filaEntrada
      .upsertJobScheduler(
        'automacoes-diarias',
        { pattern: `0 ${HORA_DAS_AUTOMACOES} * * *`, tz: 'America/Sao_Paulo' },
        { name: 'automacoes', data: { tipo: 'automacoes' } },
      )
      .catch((e: Error) => this.logger.error(`Agendar as automações: ${e.message}`));
    // Central de avisos: comandas pendentes a cada 15 minutos (cada unidade só no expediente).
    void filaEntrada
      .upsertJobScheduler(
        'avisos-da-equipe',
        { pattern: `*/${INTERVALO_PENDENTES_MIN} * * * *`, tz: 'America/Sao_Paulo' },
        { name: 'avisos', data: { tipo: 'avisos' } },
      )
      .catch((e: Error) => this.logger.error(`Agendar os avisos: ${e.message}`));
    // Avisos da assinatura (fim do teste, vencimento da conta manual, cobrança vencida): 9 h.
    void filaEntrada
      .upsertJobScheduler(
        'cobranca-manual-diaria',
        { pattern: '0 9 * * *', tz: 'America/Sao_Paulo' },
        { name: 'cobranca_manual', data: { tipo: 'cobranca_manual' } },
      )
      .catch((e: Error) => this.logger.error(`Agendar a cobrança manual: ${e.message}`));
    const redis = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: 3 });
    this.redis = redis;
    const chave = (instancia: string) => `whatsapp:proximo-envio:${instancia}`;
    const relogio: RelogioDeEnvio = {
      ultimo: async (instancia) => {
        const v = await redis.get(chave(instancia));
        return v ? Number(v) : null;
      },
      marcar: async (instancia, quando) => {
        await redis.set(chave(instancia), String(quando), 'PX', 300_000);
      },
    };

    const adicionar = (t: TrabalhoWhatsappSaida, atrasoMs: number) =>
      filaSaida.add('enviar', t, { delay: Math.max(0, atrasoMs), jobId: t.mensagemId });
    this.entrada = new Worker<TrabalhoWhatsappEntrada>(
      FILA_WHATSAPP_ENTRADA,
      async (job) => {
        // Escrita no painel (Conversas): só entra na fila de saída, no mesmo relógio do número.
        if (job.data.tipo === 'enviar') {
          const { contaId, instancia, mensagemIds } = job.data;
          await agendarRespostas(
            { contaId, instancia, saidas: mensagemIds },
            { relogio, adicionar },
          );
          return 'agendada';
        }
        // Pesquisa depois do atendimento: confere de novo e manda a primeira pergunta.
        if (job.data.tipo === 'pesquisa') {
          const p = await iniciarPesquisa(
            this.banco.prisma,
            job.data.contaId,
            job.data.avaliacaoId,
          );
          if (p.tipo === 'pular') return `pesquisa: ${p.motivo}`;
          await agendarRespostas(
            { contaId: p.contaId, instancia: p.instancia, saidas: p.mensagemIds },
            { relogio, adicionar },
          );
          return 'pesquisa enviada';
        }
        // Hora de lembrar o horário: confere de novo e manda.
        if (job.data.tipo === 'lembrete') {
          const l = await enviarLembrete(this.banco.prisma, job.data);
          if (l.tipo === 'pular') return `lembrete: ${l.motivo}`;
          await agendarRespostas(
            { contaId: l.contaId, instancia: l.instancia, saidas: l.mensagemIds },
            { relogio, adicionar },
          );
          return 'lembrete enviado';
        }
        // Assistente da equipe: próximo cliente em 15 minutos.
        if (job.data.tipo === 'proximo_cliente') {
          const a = await avisarProximoCliente(this.banco.prisma, job.data);
          if (!a) return 'próximo cliente: pulado';
          await agendarRespostas(
            { contaId: a.contaId, instancia: a.instancia, saidas: a.mensagemIds },
            { relogio, adicionar },
          );
          return 'próximo cliente avisado';
        }
        // Assistente da equipe: agenda do dia ou resumo, e já agenda a próxima.
        if (job.data.tipo === 'rotina_equipe') {
          const { aviso, proxima } = await rodarRotinaEquipe(this.banco.prisma, job.data);
          if (proxima)
            await filaEntrada.add(proxima.dados.tipo, proxima.dados, {
              delay: proxima.atrasoMs,
              jobId: proxima.jobId,
            });
          if (!aviso) return `${job.data.rotina}: pulada`;
          await agendarRespostas(
            { contaId: aviso.contaId, instancia: aviso.instancia, saidas: aviso.mensagemIds },
            { relogio, adicionar },
          );
          return `${job.data.rotina} enviada`;
        }
        // Nota 1 ou 2: dono e gestor ficam sabendo (uma vez por avaliação).
        if (job.data.tipo === 'nota_baixa') {
          const avisos = await avisarNotaBaixa(this.banco.prisma, job.data);
          for (const a of avisos)
            await agendarRespostas(
              { contaId: a.contaId, instancia: a.instancia, saidas: a.mensagemIds },
              { relogio, adicionar },
            );
          return `nota baixa: ${avisos.length} aviso(s)`;
        }
        // Pedido de atendente sem resposta em 2 h: o bot volta e avisa o cliente.
        if (job.data.tipo === 'atendente_expira') {
          const a = await encerrarEsperaDoAtendente(this.banco.prisma, job.data);
          if (!a) return 'atendente: já respondido';
          await agendarRespostas(
            { contaId: a.contaId, instancia: a.instancia, saidas: a.mensagemIds },
            { relogio, adicionar },
          );
          return 'atendente: bot voltou';
        }
        // Rotina diária: retorno e aniversário em cada conta que ligou as automações.
        if (job.data.tipo === 'cobranca_manual') {
          let total = 0;
          // Textos personalizados na administração (os demais usam o padrão).
          const { modelosEmail, tabelasPreco } = lerConfiguracaoPublica(
            await configuracaoDoSistema(this.banco.prisma),
          );
          for (const contaId of await contasParaAvisosDaAssinatura(this.banco.prisma)) {
            try {
              for (const e of await rotinaAvisosDaAssinatura(this.banco.prisma, contaId, {
                appUrl: this.config.APP_URL,
                modelos: modelosEmail,
                tabelas: tabelasPreco,
              })) {
                await filaEmails.add('cobranca_manual', e);
                total++;
              }
            } catch (e) {
              this.logger.error(
                `Avisos da assinatura da conta ${contaId}: ${(e as Error).message}`,
              );
            }
          }
          return `cobranca_manual: ${total} avisos`;
        }
        if (job.data.tipo === 'avisos') {
          let total = 0;
          for (const contaId of await contasParaAvisos(this.banco.prisma)) {
            try {
              const r = await rotinaDosAvisos(
                this.banco.prisma,
                contaId,
                new Date(),
                this.config.APP_URL,
              );
              for (const n of r.notificacoes) {
                await filaNotificacoes.add('push', n);
                total++;
              }
              for (const e of r.emails) await filaEmails.add('resumo_dia', e);
            } catch (e) {
              this.logger.error(`Avisos da conta ${contaId}: ${(e as Error).message}`);
            }
            // V4: lembrete que não entrou na fila (Redis fora na hora de marcar) entra agora. O
            // id fixo não duplica, e o worker confere na hora se o lembrete já saiu.
            try {
              for (const l of await lembretesPerdidos(this.banco.prisma, contaId, new Date())) {
                await filaEntrada.add(l.dados.tipo, l.dados, {
                  delay: l.atrasoMs,
                  jobId: l.jobId,
                  ...TENTATIVAS_REPETIVEIS,
                });
              }
            } catch (e) {
              this.logger.error(`Lembretes da conta ${contaId}: ${(e as Error).message}`);
            }
          }
          return `avisos: ${total} notificações`;
        }
        if (job.data.tipo === 'automacoes') {
          let total = 0;
          for (const contaId of await contasComAutomacoes(this.banco.prisma)) {
            try {
              const envios = await rodarAutomacoes(
                this.banco.prisma,
                contaId,
                new Date(),
                this.config.APP_URL,
              );
              for (const e of envios) {
                total += e.mensagemIds.length;
                await agendarRespostas(
                  { contaId: e.contaId, instancia: e.instancia, saidas: e.mensagemIds },
                  { relogio, adicionar },
                );
              }
            } catch (erro) {
              // Uma conta com problema não impede as outras.
              this.logger.error(`Automações da conta ${contaId}: ${(erro as Error).message}`);
            }
          }
          return `automações: ${total} mensagem(ns)`;
        }
        // "Não veio" por atraso, passado o tempo de desfazer: manda a remarcação rápida.
        if (job.data.tipo === 'atraso') {
          const r = await remarcacaoPorAtraso(
            this.banco.prisma,
            job.data,
            new Date(),
            this.config.APP_URL,
          );
          if (!r) return 'atraso: desfeito ou sem aviso';
          await agendarRespostas(
            { contaId: r.contaId, instancia: r.instancia, saidas: r.mensagemIds },
            { relogio, adicionar },
          );
          return 'atraso: remarcação enviada';
        }
        // A barbearia moveu o horário (passado o tempo de desfazer): avisa o cliente.
        if (job.data.tipo === 'horario_mudou') {
          const r = await avisoHorarioMudou(
            this.banco.prisma,
            job.data,
            new Date(),
            this.config.APP_URL,
          );
          if (!r) return 'horario_mudou: desfeito ou sem aviso';
          await agendarRespostas(
            { contaId: r.contaId, instancia: r.instancia, saidas: r.mensagemIds },
            { relogio, adicionar },
          );
          return 'horario_mudou: aviso enviado';
        }
        // A barbearia cancelou o horário e marcou "Avisar o cliente".
        if (job.data.tipo === 'horario_cancelado') {
          const r = await avisoHorarioCancelado(this.banco.prisma, job.data, new Date());
          if (!r) return 'horario_cancelado: sem aviso';
          await agendarRespostas(
            { contaId: r.contaId, instancia: r.instancia, saidas: r.mensagemIds },
            { relogio, adicionar },
          );
          return 'horario_cancelado: aviso enviado';
        }
        // Vagou um horário: oferece para quem está na lista de espera e cabe nele.
        if (job.data.tipo === 'vaga') {
          const o = await oferecerVaga(this.banco.prisma, job.data);
          if (!o) return 'vaga: ninguém na lista cabe';
          await agendarRespostas(
            { contaId: o.contaId, instancia: o.instancia, saidas: o.mensagemIds },
            { relogio, adicionar },
          );
          return `vaga: oferecida a ${o.mensagemIds.length}`;
        }
        if (job.data.tipo !== 'mensagem') return;
        const r = await atenderMensagem(this.banco.prisma, job.data, {
          appUrl: this.config.APP_URL,
        });
        if (r.tipo !== 'respondida') return r.tipo;
        await agendarRespostas(r, { relogio, adicionar });
        if (r.agendamento) {
          const trabalhos = await naConta(this.banco.prisma, r.contaId, (tx) =>
            lembretesDoAgendamento(tx, r.contaId, r.agendamento!.id),
          );
          for (const l of trabalhos)
            await filaEntrada.add(l.dados.tipo, l.dados, {
              delay: l.atrasoMs,
              jobId: l.jobId,
              ...(l.dados.tipo === 'lembrete' ? TENTATIVAS_REPETIVEIS : {}),
            });
        }
        if (r.notificacao) await filaNotificacoes.add('push', r.notificacao);
        // Vagou um horário pela conversa: oferecer para a lista de espera.
        if (r.vaga)
          await filaEntrada.add('vaga', r.vaga, {
            jobId: `vaga_${r.vaga.profissionalId}_${Date.parse(r.vaga.inicio)}_${Date.now()}`,
          });
        if (r.notaBaixa) {
          const t = trabalhoNotaBaixa(
            r.contaId,
            r.notaBaixa.avaliacaoId,
            r.notaBaixa.concluida,
            NOTA_BAIXA_ESPERA_MIN * 60_000,
          );
          await filaEntrada.add(t.dados.tipo, t.dados, { delay: t.atrasoMs, jobId: t.jobId });
        }
        if (r.esperaAtendente) {
          const desde = r.esperaAtendente;
          await filaEntrada.add(
            'atendente_expira',
            {
              tipo: 'atendente_expira',
              contaId: r.contaId,
              unidadeId: r.unidadeId,
              telefone: job.data.telefone,
              desde,
            },
            {
              delay: Math.max(
                0,
                Date.parse(desde) + ESPERA_ATENDENTE_MAX_MIN * 60_000 - Date.now(),
              ),
              jobId: `atendente_${r.unidadeId}_${job.data.telefone}_${Date.parse(desde)}`,
            },
          );
        }
        if (r.assistenteAtivado) {
          const rotinas = await naConta(this.banco.prisma, r.contaId, (tx) =>
            primeirasRotinas(tx, r.contaId, r.assistenteAtivado!),
          );
          for (const t of rotinas)
            await filaEntrada.add(t.dados.tipo, t.dados, { delay: t.atrasoMs, jobId: t.jobId });
        }
        return r.tipo;
      },
      { connection, concurrency: 1 },
    );
    this.entrada.on('completed', (job, resultado) => {
      const rotina = rotinaDoTrabalho(job.data.tipo);
      if (rotina) void this.batimento.registrarRotina(rotina, resultado);
    });
    this.entrada.on('failed', (job, erro) =>
      this.logger.error(`Mensagem recebida falhou (job ${job?.id}): ${erro.message}`),
    );

    this.saida = new Worker<TrabalhoWhatsappSaida>(
      FILA_WHATSAPP_SAIDA,
      processadorDeSaida(this.banco.prisma, provedor),
      { connection, concurrency: 3 },
    );
    this.saida.on('failed', (job, erro) =>
      this.logger.error(
        `Envio falhou (mensagem ${job?.data.mensagemId}, tentativa ${job?.attemptsMade}): ${erro.message}`,
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.entrada?.close(), this.saida?.close()]);
    await this.filaSaida?.close();
    await this.filaEntrada?.close();
    await this.filaNotificacoes?.close();
    await this.filaEmails?.close();
    this.redis?.disconnect();
  }
}

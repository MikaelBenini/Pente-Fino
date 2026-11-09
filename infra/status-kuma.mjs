// Configura o Uptime Kuma (Etapa 15.4) pela API de socket.io dele: monitores, alerta por e-mail
// e página pública de status. Chamado pelo status.sh dentro de um contêiner Node na rede do
// Compose; não roda sozinho. Pode rodar de novo: o que já existe (pelo nome) não é duplicado.
//
// Entrada (variáveis de ambiente): KUMA_URL, KUMA_USUARIO, KUMA_SENHA, KUMA_CODIGO (2FA,
// opcional), DOMINIO, ALERTA_EMAIL e SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM.
// Saída (stdout, uma linha por item): "PUSH <CHAVE_DO_ENV> <url>" e mensagens "OK ..."/"AVISO ...".
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const env = process.env;
const DOMINIO = env.DOMINIO;
const SLUG = 'pente-fino';
const PUBLICO = `https://status.${DOMINIO}`;

const socket = io(env.KUMA_URL, {
  transports: ['websocket'],
  reconnection: false,
  timeout: 15_000,
});
const pedir = (evento, ...args) =>
  new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(`sem resposta do Uptime Kuma (${evento})`)), 20_000);
    socket.emit(evento, ...args, (r) => {
      clearTimeout(t);
      ok(r);
    });
  });
const sair = (msg) => {
  console.log(`ERRO ${msg}`);
  socket.close();
  process.exit(1);
};

let monitores = {};
let notificacoes = [];
socket.on('monitorList', (m) => (monitores = m));
socket.on('notificationList', (n) => (notificacoes = n));
socket.on('connect_error', (e) => sair(`não conectou no Uptime Kuma: ${e.message}`));

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

socket.on('connect', async () => {
  try {
    const login = await pedir('login', {
      username: env.KUMA_USUARIO,
      password: env.KUMA_SENHA,
      token: env.KUMA_CODIGO || '',
    });
    if (login.tokenRequired) sair('a conta tem verificação em duas etapas: informe o código.');
    if (!login.ok) sair(`login recusado: ${login.msg ?? 'usuário ou senha errados'}`);
    await esperar(1_500); // o Kuma manda as listas logo depois do login

    // ─── Alerta por e-mail (SMTP do .env) ───
    let alertaId = notificacoes.find((n) => n.name === 'E-mail (Pente Fino)')?.id ?? null;
    if (!alertaId && env.SMTP_HOST && env.SMTP_HOST !== 'localhost' && env.ALERTA_EMAIL) {
      const r = await pedir(
        'addNotification',
        {
          name: 'E-mail (Pente Fino)',
          type: 'smtp',
          isDefault: true,
          applyExisting: true,
          smtpHost: env.SMTP_HOST,
          smtpPort: Number(env.SMTP_PORT || 587),
          smtpSecure: String(env.SMTP_PORT) === '465',
          smtpIgnoreTLSError: false,
          smtpUsername: env.SMTP_USER,
          smtpPassword: env.SMTP_PASSWORD,
          smtpFrom: env.EMAIL_FROM,
          smtpTo: env.ALERTA_EMAIL,
        },
        null,
      );
      if (!r.ok) console.log(`AVISO alerta por e-mail não criado: ${r.msg}`);
      else {
        alertaId = r.id;
        console.log(`OK alerta por e-mail para ${env.ALERTA_EMAIL}`);
      }
    } else if (!alertaId) {
      console.log(
        'AVISO sem SMTP no .env (ou sem e-mail para alerta): monitores sem aviso por e-mail.',
      );
    } else {
      console.log('OK alerta por e-mail já existia');
    }

    // ─── Monitores ───
    const base = {
      interval: 60,
      retryInterval: 60,
      resendInterval: 0,
      maxretries: 2,
      method: 'GET',
      maxredirects: 10,
      accepted_statuscodes: ['200-299'],
      ignoreTls: false,
      upsideDown: false,
      expiryNotification: true,
      notificationIDList: alertaId ? { [alertaId]: true } : {},
    };
    const desejados = [
      { grupo: 'Sistema', name: 'Site e painel', type: 'http', url: `https://${DOMINIO}/entrar` },
      {
        grupo: 'Sistema',
        name: 'API',
        type: 'keyword',
        url: `https://api.${DOMINIO}/health`,
        keyword: 'ok',
      },
      {
        grupo: 'Sistema',
        name: 'Painel do WhatsApp (Evolution)',
        type: 'http',
        url: `https://wa.${DOMINIO}`,
        // Protegido por senha: 401 quer dizer que está no ar.
        accepted_statuscodes: ['200-299', '401'],
      },
      {
        grupo: 'Servidor',
        name: 'Backup do dia',
        type: 'push',
        interval: 26 * 3600,
        retryInterval: 3600,
        maxretries: 0,
        chaveEnv: 'BACKUP_AVISO_URL',
      },
      {
        grupo: 'Servidor',
        name: 'Disco e memória',
        type: 'push',
        interval: 15 * 60,
        retryInterval: 5 * 60,
        maxretries: 1,
        chaveEnv: 'VIGIA_AVISO_URL',
      },
    ];
    const ids = {};
    for (const d of desejados) {
      const { chaveEnv } = d;
      const campos = { ...d };
      delete campos.grupo;
      delete campos.chaveEnv;
      const existente = Object.values(monitores).find((m) => m.name === d.name);
      if (existente) {
        ids[d.name] = existente.id;
        if (chaveEnv && existente.pushToken)
          console.log(`PUSH ${chaveEnv} ${PUBLICO}/api/push/${existente.pushToken}`);
        console.log(`OK monitor já existia: ${d.name}`);
        continue;
      }
      const pushToken = d.type === 'push' ? randomBytes(16).toString('hex') : undefined;
      const r = await pedir('add', { ...base, ...campos, ...(pushToken ? { pushToken } : {}) });
      if (!r.ok) sair(`monitor "${d.name}" não criado: ${r.msg}`);
      ids[d.name] = r.monitorID;
      if (chaveEnv) console.log(`PUSH ${chaveEnv} ${PUBLICO}/api/push/${pushToken}`);
      console.log(`OK monitor criado: ${d.name}`);
    }

    // ─── Página pública ───
    const pagina = await pedir('getStatusPage', SLUG);
    if (!pagina.ok) {
      const r = await pedir('addStatusPage', 'Pente Fino', SLUG);
      if (!r.ok) sair(`página de status não criada: ${r.msg}`);
    }
    const grupos = ['Sistema', 'Servidor'].map((nome) => ({
      name: nome,
      monitorList: desejados.filter((d) => d.grupo === nome).map((d) => ({ id: ids[d.name] })),
    }));
    const config = {
      slug: SLUG,
      title: 'Pente Fino',
      description: 'Situação do sistema Pente Fino: site, API, WhatsApp e servidor.',
      icon: `https://${DOMINIO}/icones/icone-192.png`,
      theme: 'auto',
      published: true,
      showTags: false,
      domainNameList: [],
      // Visual do Pente Fino (infra/status.css, montado ao lado pelo status.sh).
      customCSS: existsSync('status.css') ? readFileSync('status.css', 'utf8') : '',
      footerText: `Pente Fino · https://${DOMINIO}`,
      showPoweredBy: false,
      googleAnalyticsId: null,
    };
    const salvo = await pedir('saveStatusPage', SLUG, config, config.icon, grupos);
    if (!salvo.ok) sair(`página de status não salva: ${salvo.msg}`);
    console.log(`OK página pública: ${PUBLICO}/status/${SLUG}`);
    socket.close();
    process.exit(0);
  } catch (e) {
    sair(e.message);
  }
});

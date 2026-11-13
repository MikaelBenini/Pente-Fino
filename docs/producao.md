# Produção (VPS)

Uma VPS Ubuntu 24.04 (Hostinger) com Docker Compose atrás do Caddy. Tudo fica em `/opt/barbearia`:
`docker-compose.prod.yml`, `Caddyfile`, `postgres/init/`, os scripts e o `.env` (permissão 600,
nunca sai do servidor). Os arquivos vêm de `infra/` no repositório.

## Acesso

- SSH só por chave, usuário `deploy` (sudo). Root e senha bloqueados no SSH.
- Sem a chave: terminal do navegador no painel da Hostinger, com a senha de root.
- Fail2ban bloqueia quem erra o login; para liberar um IP: `sudo fail2ban-client set sshd unbanip <ip>`.
- Firewall (UFW): só 22, 80 e 443. Banco, Redis e Evolution API nunca publicam porta.

## Primeira instalação

1. DNS: registros A de `@`, `www`, `app`, `api` e `wa` apontando para o IP da VPS (o site fica no domínio principal; `www` e `app.` redirecionam para ele).
2. `cd /opt/barbearia && ./instalar.sh seudominio.com.br voce@email.com` — cria o `.env` com as
   senhas sorteadas no próprio servidor.
3. `./atualizar.sh` — baixa as imagens, roda as migrações e sobe tudo; o Caddy emite o HTTPS.
4. `./admin.sh --email voce@email.com --nome "Seu Nome"` — cria quem administra (`/admin`).
5. E-mail e Asaas: `nano .env` (campos marcados com PREENCHER) e `./atualizar.sh` de novo.
   O SMTP também pode ser configurado em `/admin → Configurações`.

## Asaas: cobrança e clube online

- A conta do Pente Fino no Asaas precisa ser de **pessoa jurídica (CNPJ)**: só ela cria as subcontas
  das barbearias para o clube online (com conta de CPF o Asaas responde 403).
- Webhook no Asaas (Integrações → Webhooks): `https://api.seudominio/webhooks/asaas`, com o token
  `ASAAS_WEBHOOK_TOKEN`, eventos de cobrança **e de nota fiscal** (`INVOICE_*`). O mesmo webhook
  atende a assinatura do sistema, as mensalidades do clube online e a situação das notas.
- A taxa do clube online fica em `/admin` → Configurações → "Clube online".
- Nota fiscal das mensalidades (NFS-e): primeiro, no painel do Asaas, Notas fiscais →
  Configurações (inscrição municipal, regime, certificado ou senha da prefeitura). Depois, em
  `/admin` → Configurações → "Nota fiscal das mensalidades": escolha o serviço (código e ISS
  conferidos com o contador) e salve, mesmo com a emissão desligada. "Conferir de novo no Asaas"
  diz o que falta (dados fiscais, inscrição de exemplo, o acesso que a prefeitura exige); só com
  "Tudo conferido" a emissão liga. Então marque "Emitir nota fiscal", salve e clique em "Aplicar
  às assinaturas atuais". As assinaturas novas já saem com a nota; o Asaas manda a nota por
  e-mail para a barbearia, que também a baixa na fatura (Configurações → Assinatura). Acompanhe a
  primeira nota em Saúde do sistema → "Nota fiscal das mensalidades": nota que não sai aparece
  lá com o motivo da prefeitura.
- Sem o acesso fiscal, deixe a emissão desligada: nada muda para as barbearias, as mensalidades
  seguem cobradas normalmente, só sem nota.

## Segurança dos webhooks

- **Asaas:** do corpo recebido o sistema só usa o evento e o id. A cobrança e a nota são
  buscadas no próprio Asaas (`GET /payments/{id}` e `GET /invoices/{id}`) com a chave da API, então
  nem um token vazado permite inventar pagamento, valor ou repasse.
- **WhatsApp:** `/webhooks/whatsapp` responde 404 para fora (Caddy). A Evolution chama a API por
  dentro (`http://api:3001`, `WHATSAPP_WEBHOOK_URL` no `docker-compose.prod.yml`).
- **Segredos:** `ASAAS_WEBHOOK_TOKEN` e `WHATSAPP_WEBHOOK_SEGREDO` com 32 caracteres ou mais
  (`openssl rand -hex 32`). Mais curto, a Saúde do sistema avisa. O token de produção existe só no
  `.env` do servidor; os do desenvolvimento são de teste (sandbox). Trocar o do Asaas: novo valor no
  `.env`, `docker compose up -d api` e o mesmo valor no webhook do painel do Asaas. Trocar o do
  WhatsApp: novo valor, subir a API e o worker e reconectar cada unidade (a assinatura é gravada ao
  conectar).
- **Tentativas:** chamada com o segredo errado fica registrada com o IP (Saúde do sistema →
  "Webhooks recusados"). Depois de 20 erros em 10 minutos, o IP leva 429 por 10 minutos.
- **Teste do webhook do Asaas no Codespaces:** a porta 3001 pública abre a API de desenvolvimento
  inteira (inclusive `/docs`), não só o webhook. Deixe pública só durante o teste, com o token do
  sandbox, e volte para privada (aba Portas → botão direito → Visibilidade da porta → Private).

## Limpeza automática de dados

O worker roda todo dia às 3h30 (depois do backup) e apaga o que passou do prazo da política de
privacidade. O resultado de cada execução fica em `/admin` → Saúde do sistema → "Limpeza de
dados". Se aparecer uma conta **retida**, ela já devia ter saído mas ainda tem cobrança ativa no
Asaas. Cancele a assinatura no painel do Asaas; o vínculo na conta (`asaas_assinatura_id`) ainda
precisa ser limpo direto no banco. O cancelamento pela administração, que faz as duas coisas, está
planejado na Etapa 23. A rotina tenta de novo no dia seguinte.

## Fotos do site da barbearia

Desde o lote 7c da seção 7, as fotos que o dono põe no site (logotipo, banner, sobre a casa,
barbeiros e galeria) ficam no volume `fotos_site`, montado na API em `/dados/fotos`
(`FOTOS_DIR`). Cada foto vira dois arquivos WebP, de 640 px e de 1600 px, com uns 300 KB no total,
já sem os dados da câmera. O limite é de 300 fotos por unidade. O `backup.sh` guarda o volume todo
dia e o `restaurar.sh` devolve. Foto trocada ou tirada do site continua no disco por enquanto: a
limpeza das fotos sem uso fica para depois. O site entrega em `/f/<id>-<tamanho>.webp`, com cache
de um ano no navegador.

## Atualizar e voltar versão (rollback)

- `./atualizar.sh` — versão do `.env` (`TAG`, padrão `latest`: o último merge na `main`).
- `./atualizar.sh <sha>` — uma versão específica (sha completo do commit na `main`).
- `./atualizar.sh anterior` — volta para a versão de antes da última atualização.

Migração de banco não se desfaz sozinha: voltar a versão só funciona se o banco novo ainda servir
para o código antigo. Antes de uma migração que apaga ou renomeia coluna, faça backup.

## Deploy automático

Cada merge na `main` gera as imagens e o job **Implantar na VPS** entra por SSH e roda
`infra/implantar.sh <sha>`: baixa os arquivos de `infra/` daquele commit, sobe a versão com
`./atualizar.sh <sha>` e recarrega o Caddy se ele mudou. A chave do GitHub só consegue rodar esse
script (sem terminal). Para ligar, uma vez, no terminal do navegador da Hostinger:

```bash
su - deploy
cd /opt/barbearia && ./chave-deploy.sh
```

E no GitHub (Settings → Secrets and variables → Actions): secret `DEPLOY_SSH_KEY` com a chave
privada mostrada, e as variáveis `DEPLOY_HOST` e `DEPLOY_KNOWN_HOSTS` com os valores mostrados.

## Monitoramento

- **Push no celular (painel e chat da equipe):** as notificações no celular só saem com `VAPID_CHAVE_PUBLICA` e `VAPID_CHAVE_PRIVADA` no `.env` da VPS. Para gerar as duas uma vez: `npx web-push generate-vapid-keys`. Sem elas, o painel e a aba Chat escondem o botão de aviso no celular, e o log do worker avisa.

- **Alertas da equipe (admin F3):** o worker usa a `DATABASE_PLATAFORMA_URL`, que já vem no ambiente comum do compose, para mandar os alertas de hora em hora. Sem ela, os alertas ficam desligados e o log do worker avisa.

- Uptime Kuma em `https://status.seudominio` (registro A `status`). **Crie a conta de administrador
  logo no primeiro acesso.** Depois, na VPS:

  ```bash
  cd /opt/barbearia && ./status.sh
  ```

  O script pede o login do Kuma (não grava) e o e-mail que recebe os alertas, e então:
  - cria os monitores "Site e painel", "API" (`/health` com a palavra `ok`), "Painel do WhatsApp"
    (401 conta como no ar, porque tem senha), "Backup do dia" (push, 26 h) e "Disco e memória"
    (push, 15 min);
  - cria o alerta por e-mail com o SMTP do `.env` (Brevo), ligado em todos os monitores;
  - monta a página pública `https://status.seudominio/status/pente-fino`, em dois grupos (Sistema e
    Servidor);
  - grava `BACKUP_AVISO_URL` e `VIGIA_AVISO_URL` no `.env` e já manda o primeiro aviso.

  Pode rodar de novo: o que já existe não é duplicado. O painel interno continua com login. A
  página pública sai com o visual do Pente Fino (`infra/status.css`, aplicado pelo script; dá para
  colar também em Editar página → CSS personalizado).
- Worker (bot, lembretes e rotinas): o healthcheck confere o batimento a cada 30 s. Travado, o
  contêiner fica `unhealthy` e o `vigia.sh` (cron de 5 min) reinicia e avisa o Kuma como "down",
  com o nome. Na tela: `/admin` → Saúde do sistema mostra o worker (no ar ou parado) e a última
  execução de cada rotina (avisos a cada 15 min, automações às 10 h, avisos da assinatura às 9 h e
  limpeza às 3h30), com "Atrasada" quando passa do prazo.
- Saúde do sistema → "Servidor" (admin U9): versão em produção (`APP_VERSAO`, a `TAG` do `.env`)
  e desde quando a API está no ar (o último deploy); último backup (data, tamanho, cópia externa,
  erro; "atrasado" depois de 26 h), gravado pelo `backup.sh` em `configuracao_plataforma`
  (chave `estado_backup`), inclusive quando falha; disco, memória e validade do certificado HTTPS,
  gravados pelo `vigia.sh` a cada 5 minutos (chave `estado_servidor`); e o último aviso do Asaas
  aceito. Se a gravação falhar, o backup e o vigia seguem normalmente.
- Backup: ver docs/restaurar.md.

## IP real na auditoria

A auditoria e o login guardam o IP de quem acessou. O Caddy manda o IP do visitante para o web e
para a API (`X-Forwarded-For`, com `TRUST_PROXY=true`). Se o acesso chega por **IPv6** e a rede do
Docker é só IPv4, o Docker repassa a conexão e o Caddy vê o IP da própria rede (`172.18.0.1`): o IP
real se perde antes de chegar ao sistema.

- **Como saber:** Saúde do sistema avisa "acessos com IP interno" quando isso acontece. Para
  confirmar, `dig AAAA seudominio +short`: se responde um endereço, o domínio aceita IPv6.
- **Correção rápida, sem mexer no servidor:** apagar o registro **AAAA** do domínio (e de `www`,
  `api`, `wa` e `status`) no painel de DNS. Todos passam a chegar por IPv4, com o IP certo. Vale em
  minutos a algumas horas, conforme o TTL.
- **Para manter o IPv6:** ligar o IPv6 no Docker (`/etc/docker/daemon.json` com `"ipv6": true`,
  `"fixed-cidr-v6": "fd00:1::/64"` e `"ip6tables": true`, depois `systemctl restart docker`) e na
  rede do projeto (`enable_ipv6: true` na rede padrão do `docker-compose.prod.yml`). A rede precisa
  ser recriada (`docker compose down` e `up -d`), então faça numa janela de manutenção e confira o
  site e o WhatsApp em seguida.

## Comandos úteis

```bash
cd /opt/barbearia
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f api worker
cat .wa-senha   # senha do painel da Evolution em https://wa.seudominio (usuário admin)
```

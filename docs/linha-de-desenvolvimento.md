# Linha de desenvolvimento

O caminho completo, da pasta vazia no computador até o sistema no ar numa VPS com HTTPS, backup e monitoramento. Cada etapa só começa quando a anterior está marcada.

## Etapa 0 · Preparação

Contas, ferramentas e nomes definidos antes da primeira linha de código.

**Contas**

- [x] GitHub com repositório privado
- [ ] Domínio registrado (Registro.br para .com.br)
- [ ] Provedor de VPS escolhido (Ubuntu 24.04 LTS, mínimo 2 vCPU e 4 GB de RAM para começar)
- [ ] Armazenamento externo compatível com S3 para backup
- [ ] Serviço de e-mail transacional (convite e recuperação de senha)
- [ ] Um chip de WhatsApp dedicado para testes e um por unidade em produção
- [ ] Conta no Asaas (só na V3)

**Ferramentas no computador**

- [ ] Git
- [x] Node.js na versão LTS ativa, instalado com nvm ou fnm
- [x] pnpm (ativado com `corepack enable`)
- [ ] Docker Desktop (Windows e Mac) ou Docker Engine (Linux)
- [ ] VS Code com extensões ESLint, Prettier, Prisma, Tailwind CSS e Docker
- [ ] Chave SSH criada com `ssh-keygen -t ed25519`

**Nomes**

- [ ] Nome do produto e domínio
- [ ] Subdomínios: `app.` (sistema), `api.` (API), `wa.` (Evolution API), `status.` (monitoramento), `homolog.` (homologação)

## Etapa 1 · Pasta e repositório

Um monorepo: front, API, worker e pacotes compartilhados no mesmo repositório, com regras de cálculo escritas uma vez só.

```bash
mkdir barbearia && cd barbearia
git init -b main
corepack enable
pnpm init
```

Estrutura de pastas:

```text
barbearia/
├─ apps/
│  ├─ web/        Next.js: painel, app do barbeiro (PWA), TV, link de agendamento
│  ├─ api/        NestJS: regras, permissões, auditoria
│  └─ worker/     bot do WhatsApp e rotinas agendadas
├─ packages/
│  ├─ db/         Prisma: schema, migrações, políticas RLS, seed
│  ├─ shared/     tipos, validações (zod) e regras de cálculo
│  └─ ui/         componentes e tema
├─ infra/         docker-compose, Caddyfile, scripts de backup e deploy
└─ docs/          decisões técnicas e guia de implantação
```

- [x] `pnpm-workspace.yaml` com `apps/*` e `packages/*`
- [x] Turborepo (`turbo.json`) para rodar `dev`, `build`, `lint` e `test` em todos os pacotes
- [x] `tsconfig.base.json` com `strict: true`
- [x] `.editorconfig`, `.gitignore`, `.nvmrc` com a versão do Node, `.env.example`
- [x] ESLint e Prettier na raiz; Husky e lint-staged rodando antes de cada commit
- [x] commitlint com Conventional Commits (`feat:`, `fix:`, `chore:`)
- [x] Criar o front: `pnpm create next-app apps/web --ts --tailwind --app --eslint`
- [x] Criar a API: `pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git`
- [x] Criar o worker como aplicação NestJS sem servidor HTTP
- [x] README com como rodar o projeto em 3 comandos
- [x] Subir para o GitHub: `git remote add origin …` e `git push -u origin main`
- [ ] Proteger a branch `main`: só entra por pull request com CI verde (bloqueado: repositório privado em conta Free exige GitHub Pro ou repositório público)
- [x] Modelos de issue e de pull request; quadro de projeto com estas etapas
- [x] Fluxo de trabalho: uma branch por tarefa (`feat/comanda-fechar`), pull request, merge com squash

## Etapa 2 · Ambiente local

Um comando sobe tudo que o sistema precisa no computador.

- [x] `infra/docker-compose.dev.yml` com PostgreSQL, Redis, Evolution API e Mailpit (caixa de e-mail falsa para testes)
- [x] Volumes nomeados para não perder dados ao reiniciar
- [x] `.env.example` com todas as variáveis: banco, Redis, JWT, URL e chave da Evolution API, e-mail, URLs públicas
- [x] Scripts na raiz: `pnpm dev`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm test`, `pnpm lint`
- [x] Conectar o WhatsApp de teste no painel da Evolution API pelo QR Code (`pnpm whatsapp:qr`; instância `teste` em estado `open`, 03/11/2026)
- [x] Conferir o nome atual da imagem Docker da Evolution API no repositório oficial do projeto (`evoapicloud/evolution-api:v2.3.7`; repositório em `evolution-foundation/evolution-api`, conferido em 03/11/2026)
- [x] **Pronto quando:** um colega clona o repositório, copia o `.env.example` e roda `pnpm dev` sem ajuda (comprovado pelo job "Ambiente de desenvolvimento sobe" do CI, que faz isso num ambiente limpo a cada PR)

## Etapa 3 · Banco de dados

O schema da seção 5 do documento principal vira código, com isolamento por conta garantido pelo próprio PostgreSQL.

- [ ] `packages/db` com Prisma e o schema completo do MVP (conta, unidade, usuário, papéis, profissional, serviço, preço com vigência, cliente, agendamento, comanda, item, pagamento, caixa, despesa, auditoria)
- [ ] Dinheiro em centavos (`Int`), datas em UTC no banco e fuso `America/Sao_Paulo` na exibição
- [ ] Primeira migração: `pnpm prisma migrate dev --name inicial`
- [ ] Migração SQL com políticas RLS: cada tabela filtra por `current_setting('app.conta_id')`
- [ ] Usuário do banco da aplicação sem permissão de superusuário (senão o RLS é ignorado)
- [ ] Índices e restrições da seção 5, incluindo a que impede dois agendamentos no mesmo horário do mesmo profissional
- [ ] Função de consulta do preço vigente e da regra de comissão vigente numa data
- [ ] Seed com modelos prontos: serviços comuns, categorias de despesa, menu padrão do bot, modelos de mensagem
- [ ] Seed de demonstração: uma conta fictícia com 2 unidades, 5 barbeiros e um mês de comandas
- [ ] **Pronto quando:** um teste conecta como conta A e não enxerga nenhuma linha da conta B

## Etapa 4 · Base da API

Tudo que todo módulo vai usar, pronto antes do primeiro módulo de negócio.

- [ ] Configuração validada na subida (variáveis faltando = a API não sobe)
- [ ] Autenticação: login com senha (hash argon2), token de acesso curto e token de renovação, recuperação de senha por e-mail
- [ ] Convite de usuário por e-mail e por link de WhatsApp
- [ ] Guarda de papéis (dono, gestor, recepção, barbeiro) e de unidade em cada rota
- [ ] Middleware que define `app.conta_id` na conexão do banco a cada requisição
- [ ] Interceptador de auditoria: grava antes e depois em alterações sensíveis
- [ ] Validação de entrada com zod, usando os esquemas de `packages/shared`
- [ ] Erros padronizados com mensagem em português para o usuário
- [ ] Documentação automática da API (OpenAPI/Swagger) só em desenvolvimento e homologação
- [ ] Limite de requisições no login e nas rotas públicas
- [ ] Logs estruturados (pino) com id da requisição
- [ ] Rota de saúde `/health` checando banco e Redis
- [ ] Fila (BullMQ) e publicação de eventos de domínio
- [ ] **Pronto quando:** login, convite e troca de senha funcionam de ponta a ponta com testes

## Etapa 5 · Base do front-end

O esqueleto das telas, a identidade visual e o app instalável no celular.

- [ ] Tema do mapa: fundo escuro, amarelo dos módulos, verde de ação, cores dos planos; tema claro opcional
- [ ] Fontes Barlow e Barlow Condensed
- [ ] Biblioteca de componentes em `packages/ui`: botão, campo, tabela editável, cartão de indicador, barra de meta, etiqueta de estado, bloco de agenda, modal de confirmação
- [ ] Telas de login, convite, recuperar senha e escolha de unidade
- [ ] Menu montado pelo papel do usuário
- [ ] Cliente HTTP com renovação automática de token; cache de dados com TanStack Query
- [ ] Formulários com react-hook-form e os mesmos esquemas zod da API
- [ ] Formatação em pt-BR: moeda, data, hora, telefone
- [ ] PWA: manifesto, ícones, instalação no celular, fila local para lançamentos sem internet
- [ ] Layout responsivo testado em celular, tablet e computador
- [ ] Estados vazios com orientação ("Cadastre seu primeiro serviço") e telas de carregamento
- [ ] **Pronto quando:** cada papel entra e vê só o menu dele, no celular e no computador

## Etapa 6 · Módulos do MVP

A ordem segue as dependências: cada módulo usa os anteriores. Cada um sai com API, tela, testes e dados de demonstração.

- [ ] **6.1 Conta e unidades:** cadastro, dias de trabalho, capacidade, calendário de folgas e feriados
- [ ] **6.2 Usuários e papéis:** convites, troca de papel, desativar acesso
- [ ] **6.3 Serviços:** duração, categoria, custo de produto, extra (sim/não), peso em atendimentos
- [ ] **6.4 Preços:** tabela serviço × unidade, novo preço a partir de uma data, histórico
- [ ] **6.5 Profissionais:** data de entrada, horários, bloqueios, regra de comissão com vigência
- [ ] **6.6 Clientes:** cadastro, busca por telefone, histórico, anotações, telefone oculto para barbeiro
- [ ] **6.7 Agenda:** visão por profissional em dia, semana e mês; agendar, remarcar, cancelar; consulta de horários livres
- [ ] **6.8 Comanda:** criada pelo agendamento, aberta na hora, itens, ajuste, confirmação do barbeiro, pendente, cancelada por falta, reaberta com motivo e auditoria
- [ ] **6.9 Fechamento e caixa:** várias formas de pagamento, desconto, caixa do dia, divergência
- [ ] **6.10 Comissões:** cálculo por item na hora do fechamento, extrato por barbeiro, marcar como paga
- [ ] **6.11 Despesas:** categorias (fixa, variável, manutenção, investimento, retirada do dono, cartão e resgates), competência, pago ou não
- [ ] **6.12 Indicadores:** faturamento, clientes, ticket, atendimentos, extras, % de despesas, com filtro de unidade e período
- [ ] **6.13 App do barbeiro:** hoje, comandas, clientes, desempenho, comissões
- [ ] **6.14 Comanda impressa:** PDF A4 com 4 ou 6 por folha e QR code que abre a comanda
- [ ] **6.15 Link de agendamento:** página pública da unidade, escolha de serviço, profissional e horário, confirmação por WhatsApp
- [ ] **6.16 Importação da planilha:** modelo CSV de serviços, preços, profissionais e clientes, com prévia e relatório de erros
- [ ] **6.17 Configuração guiada:** assistente de primeiro acesso que usa os modelos do seed
- [ ] **6.18 Exportação para o contador:** relatório do mês em CSV e PDF

## Etapa 7 · Testes

O dinheiro tem que bater. As regras de cálculo são testadas com casos reais da planilha antes de qualquer tela.

- [ ] Testes unitários (Vitest) das regras de cálculo em `packages/shared`: faturamento, cliente, ticket, atendimentos, extras, % de despesas, projeção, comissão, lucro por serviço
- [ ] Casos montados a partir dos prints da planilha, incluindo os erros que ela tinha ("outros", cliente que muda por mês, hidratação do dia 31)
- [ ] Testes de integração da API com banco real em container (Testcontainers)
- [ ] Teste de isolamento: cada rota tentando ler e alterar dados de outra conta
- [ ] Teste de permissão: cada papel tentando acessar o que não pode
- [ ] Testes de ponta a ponta (Playwright) dos fluxos críticos: agendar → atender → confirmar → fechar → ver comissão; cliente que não veio; reabrir comanda
- [ ] Teste do app do barbeiro sem internet: lança, reconecta, envia
- [ ] Teste de carga simples na agenda e nos indicadores com o seed de demonstração
- [ ] Cobertura mínima de 80% em `packages/shared` (proposta)
- [ ] **Pronto quando:** toda a suíte roda verde no CI e os indicadores batem com uma conferência manual da planilha

## Etapa 8 · Integração contínua

Toda mudança passa por verificação automática antes de entrar na `main`, e toda versão vira uma imagem Docker pronta para publicar.

- [ ] GitHub Actions no pull request: instalar, lint, checagem de tipos, testes unitários, integração e ponta a ponta
- [ ] Cache do pnpm e do Turborepo para o CI rodar rápido
- [ ] `Dockerfile` de várias etapas para `web`, `api` e `worker` (imagem final pequena, usuário sem root)
- [ ] No merge na `main`: build das imagens e envio para o GitHub Container Registry com a tag do commit
- [ ] Verificação de dependências vulneráveis (Dependabot)
- [ ] Segredos só nos Secrets do GitHub, nunca no código
- [ ] **Pronto quando:** um pull request com teste quebrado é bloqueado e um merge gera as três imagens

## Etapa 9 · Preparação da VPS

Um servidor Ubuntu 24.04 LTS seguro antes de receber qualquer dado.

- [ ] Criar a VPS com a chave SSH da Etapa 0
- [ ] DNS: registros A de `app`, `api`, `wa`, `status` e `homolog` apontando para o IP da VPS
- [ ] Usuário de trabalho, sem entrar como root:

```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

- [ ] Em `/etc/ssh/sshd_config`: `PermitRootLogin no` e `PasswordAuthentication no`; depois `sudo systemctl restart ssh`
- [ ] Atualizar e instalar proteções:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo timedatectl set-timezone America/Sao_Paulo
```

- [ ] Atualizações de segurança automáticas (`sudo dpkg-reconfigure unattended-upgrades`)
- [ ] Arquivo de swap de 2 GB
- [ ] Docker Engine e plugin Compose; usuário `deploy` no grupo `docker`
- [ ] Rotação de logs do Docker em `/etc/docker/daemon.json` (tamanho máximo por arquivo)
- [ ] Atenção: o Docker ignora o UFW para portas publicadas. Banco, Redis e Evolution API **nunca** publicam porta; ficam só na rede interna do Compose
- [ ] **Pronto quando:** login só por chave, root bloqueado, só portas 22, 80 e 443 abertas por fora

## Etapa 10 · Publicação com HTTPS

Tudo roda em containers na VPS, atrás do Caddy, que emite e renova o certificado HTTPS sozinho.

- [ ] `infra/docker-compose.prod.yml` com: Caddy, web, api, worker, PostgreSQL, Redis e Evolution API, cada um com reinício automático e checagem de saúde
- [ ] `infra/Caddyfile`: `app.` para o web, `api.` para a API, `wa.` para a Evolution API com acesso restrito (senha ou IP), cabeçalhos de segurança
- [ ] `.env` de produção criado direto na VPS, com permissão `600`, senhas longas e diferentes das de desenvolvimento
- [ ] Pasta `/opt/barbearia` com o compose, o Caddyfile e o `.env`
- [ ] Primeira subida: `docker compose pull`, migrações do banco, `docker compose up -d`
- [ ] Conectar o WhatsApp da unidade-piloto pelo QR Code
- [ ] Deploy automático: ao gerar as imagens, o GitHub Actions entra por SSH, baixa a nova tag, roda as migrações e reinicia os serviços
- [ ] Rollback: voltar para a tag anterior com um comando documentado em `docs/`
- [ ] Ambiente de homologação no mesmo servidor (`homolog.`), com banco separado, para testar antes de produção
- [ ] **Pronto quando:** `https://app.seudominio` abre com cadeado, o login funciona e um merge na `main` chega ao ar sozinho

## Etapa 11 · Backup

Um backup que nunca foi restaurado não é backup. A restauração é testada antes do piloto e todo mês.

- [ ] Script `infra/backup.sh`: `pg_dump` compactado do banco de produção
- [ ] Envio para o armazenamento externo com rclone, criptografado
- [ ] Cópia também do volume de sessões da Evolution API (evita escanear o QR de novo)
- [ ] Agendado no cron da VPS todo dia de madrugada
- [ ] Retenção: 30 diários e 12 mensais
- [ ] Snapshot semanal da VPS no painel do provedor
- [ ] Restauração testada num banco vazio, com o passo a passo em `docs/restaurar.md`
- [ ] **Pronto quando:** o banco é restaurado do zero a partir do armazenamento externo e o sistema volta a abrir

## Etapa 12 · Monitoramento

Saber do problema antes do cliente ligar, com ferramentas que rodam no próprio servidor.

- [ ] Uptime Kuma em `status.`: verifica `app`, `api/health` e a conexão do WhatsApp a cada minuto, avisa por e-mail ou Telegram
- [ ] Rastreamento de erros no front e na API (GlitchTip, que roda no próprio servidor, ou Sentry)
- [ ] Alerta de disco acima de 80% e de memória alta
- [ ] Alerta quando a sessão do WhatsApp cair (evento da Evolution API)
- [ ] Alerta quando o backup do dia falhar
- [ ] Painel simples de uso: contas ativas, comandas por dia, erros por dia
- [ ] **Pronto quando:** derrubar a API de propósito gera um aviso em menos de 2 minutos

## Etapa 13 · E-mail transacional

Convites e recuperação de senha chegando na caixa de entrada, não no spam.

- [ ] Escolher o serviço de envio e conferir o limite do plano gratuito
- [ ] Domínio de envio configurado com SPF, DKIM e DMARC
- [ ] Modelos de e-mail: convite, recuperar senha, boas-vindas, aviso de pagamento do plano
- [ ] Em desenvolvimento, tudo cai no Mailpit
- [ ] **Pronto quando:** convite enviado para Gmail e Outlook chega na caixa de entrada

## Etapa 14 · Segurança e LGPD

Dados de clientes e de dinheiro exigem cuidado desde o primeiro dia.

- [ ] HTTPS em tudo; cookies seguros; CORS liberando só os domínios do sistema
- [ ] Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options) no Caddy
- [ ] Senhas com argon2; bloqueio temporário após tentativas erradas de login
- [ ] Revisão de permissões: cada rota com papel e unidade conferidos
- [ ] Auditoria imutável de comandas fechadas, preços, comissões e despesas
- [ ] Política de privacidade e termos de uso publicados e aceitos no cadastro
- [ ] Consentimento do cliente para receber mensagens de WhatsApp, com opção de sair
- [ ] Exportar e apagar os dados de um cliente quando ele pedir
- [ ] Telefone do cliente oculto para o barbeiro quando o dono ativar
- [ ] Contrato com a barbearia dizendo quem é responsável pelos dados (a barbearia controla, o sistema opera)
- [ ] Atualização mensal de dependências e da imagem da Evolution API
- [ ] **Pronto quando:** a checklist acima está toda marcada e revisada por uma segunda pessoa

## Etapa 15 · Homologação e piloto

Uma barbearia real usa o sistema por um mês antes de qualquer venda.

- [ ] Rodar a suíte inteira em homologação com o seed de demonstração
- [ ] Importar a planilha da barbearia-piloto (serviços, preços, profissionais, clientes)
- [ ] Configuração guiada feita junto com o dono
- [ ] Treino de 30 minutos com a recepção e com os barbeiros; vídeo curto de cada fluxo
- [ ] Barbeiros instalam o PWA no celular
- [ ] Primeira semana em paralelo com a planilha, conferindo o caixa todo dia
- [ ] Canal direto de suporte (grupo de WhatsApp) e registro de cada atrito
- [ ] Correções semanais publicadas em homologação e depois em produção
- [ ] **Pronto quando:** duas semanas seguidas sem divergência de caixa e 90% das comandas confirmadas pelo barbeiro

## Etapa 16 · Lançamento comercial

O sistema passa a cobrar das barbearias e a receber clientes sozinho.

- [ ] Módulo de assinatura do sistema: planos Básico, Pro e Premium, mensal e anual, limites de unidades e profissionais aplicados pela API
- [ ] Teste grátis de 14 dias sem cartão; aviso 3 dias antes do fim
- [ ] Cobrança das barbearias pelo Asaas (assinatura recorrente), com bloqueio suave após atraso: o sistema vira só leitura, nunca apaga dados
- [ ] Cupom do plano fundador: 30% para os 20 primeiros clientes
- [ ] Página de vendas: frase "Saiba quanto sobra, não só quanto entrou", preços, comparativo, depoimento do piloto, botão de teste grátis
- [ ] Central de ajuda com os vídeos do piloto e perguntas frequentes
- [ ] WhatsApp de suporte com horário definido
- [ ] Termos de uso e política de privacidade com as condições dos planos e do cancelamento
- [ ] Exportação completa dos dados para quem cancelar
- [ ] **Pronto quando:** uma barbearia desconhecida se cadastra, testa, assina e paga sem falar com ninguém

## Etapa 17 · Operação contínua e próximas versões

O trabalho depois do lançamento, para o sistema seguir estável e crescer.

**Toda semana**

- [ ] Revisar erros do rastreador e alertas do monitoramento
- [ ] Ler os pedidos de suporte e transformar os repetidos em melhoria
- [ ] Publicar correções em homologação, testar e levar para produção

**Todo mês**

- [ ] Testar a restauração do backup
- [ ] Atualizar dependências, imagem da Evolution API e pacotes do Ubuntu
- [ ] Acompanhar receita recorrente, cancelamentos, clientes por plano e uso de disco e memória da VPS
- [ ] Quando a VPS passar de 70% de memória ou CPU com frequência, subir de plano ou separar o banco

**Próximas versões**

- [ ] V2: metas, ritmo e projeção, ocupação, clube, lucro real e lucratividade, bot WhatsApp com menu e agendamento, sinal por Pix no link de agendamento, painel da rede
- [ ] V3: cobrança automática do clube, campeonato e TV, estoque completo, fidelidade e recorrência, Google Agenda, importação do histórico
- [ ] Revisar os preços a cada 6 meses com a tabela de mercado do documento principal

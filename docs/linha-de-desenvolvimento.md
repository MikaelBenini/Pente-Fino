# Linha de desenvolvimento

O caminho completo, da pasta vazia no computador até o sistema no ar numa VPS com HTTPS, backup e monitoramento. Cada etapa só começa quando a anterior está marcada.

## Etapa 0 · Preparação

Contas, ferramentas e nomes definidos antes da primeira linha de código.

**Contas**

- [x] GitHub com repositório privado
- [x] Domínio registrado (Registro.br para .com.br)
- [x] Provedor de VPS escolhido (Ubuntu 24.04 LTS, mínimo 2 vCPU e 4 GB de RAM para começar)
- [ ] Armazenamento externo compatível com S3 para backup
- [x] Serviço de e-mail transacional (convite e recuperação de senha)
- [ ] Um chip de WhatsApp dedicado para testes e um por unidade em produção
- [x] Conta no Asaas (cobrança das barbearias na Etapa 23; cobrança do clube na Etapa 24)

**Ferramentas no computador**

- [x] Git
- [x] Node.js na versão LTS ativa, instalado com nvm ou fnm
- [x] pnpm (ativado com `corepack enable`)
- [x] Docker Desktop (Windows e Mac) ou Docker Engine (Linux)
- [x] VS Code com extensões ESLint, Prettier, Prisma, Tailwind CSS e Docker
- [x] Chave SSH criada com `ssh-keygen -t ed25519`

**Nomes**

- [x] Nome do produto e domínio
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

- [x] `packages/db` com Prisma e o schema completo do MVP (conta, unidade, usuário, papéis, profissional, serviço, preço com vigência, cliente, agendamento, comanda, item, pagamento, caixa, despesa, auditoria) — Prisma 7.10.1, 27 tabelas em `packages/db/prisma/schema.prisma`, incluindo calendário, horários, bloqueios, regra de comissão, produto, categoria de despesa, comissão paga, meta, conexão e menu do bot e modelos de mensagem. Clube, estoque e conversas do bot ficam para as etapas deles
- [x] Dinheiro em centavos (`Int`), datas em UTC no banco e fuso `America/Sao_Paulo` na exibição (percentual em pontos-base: 10000 = 100%; datas sem hora em `date`)
- [x] Primeira migração: `pnpm prisma migrate dev --name inicial` (precedida pela migração `base`, com a função `conta_atual()` e a extensão `btree_gist`)
- [x] Migração SQL com políticas RLS: cada tabela filtra por `current_setting('app.conta_id')` (migração `rls`: RLS ligado e forçado nas 27 tabelas; `conta_id` é preenchido pelo próprio banco; tabela nova chama `habilitar_isolamento_conta('tabela')`)
- [x] Usuário do banco da aplicação sem permissão de superusuário (senão o RLS é ignorado) — permissões dadas nas migrações ao papel de grupo `pente_fino_aplicacao`, criado no init do PostgreSQL
- [x] Índices e restrições da seção 5, incluindo a que impede dois agendamentos no mesmo horário do mesmo profissional (migração `restricoes`: exclusão por intervalo, CHECKs de valores e auditoria imutável)
- [x] Função de consulta do preço vigente e da regra de comissão vigente numa data (`preco_servico_vigente` e `regra_comissao_vigente` no SQL; `precoServicoVigente` e `regraComissaoVigente` no TypeScript; regra pura `selecionarVigente` no `packages/shared`)
- [x] Seed com modelos prontos: serviços comuns, categorias de despesa, menu padrão do bot, modelos de mensagem (`aplicarModelosIniciais` em `packages/db/src/modelos.ts`, reaproveitado no cadastro de conta da Etapa 4)
- [x] Seed de demonstração: uma conta fictícia com 2 unidades, 5 barbeiros e um mês de comandas (`pnpm db:seed`; recria a conta de demonstração a cada execução; usuários ainda sem senha, que chega com a autenticação na Etapa 4)
- [x] **Pronto quando:** um teste conecta como conta A e não enxerga nenhuma linha da conta B (`pnpm test:db`, job "Banco de dados" no CI)

## Etapa 4 · Base da API

Tudo que todo módulo vai usar, pronto antes do primeiro módulo de negócio.

- [x] Configuração validada na subida (variáveis faltando = a API não sobe) — zod em `apps/api/src/config`; em produção recusa o segredo JWT de exemplo. O worker também valida a dele
- [x] Autenticação: login com senha (hash argon2), token de acesso curto e token de renovação, recuperação de senha por e-mail — JWT de 15 min; renovação por token opaco de 30 dias com rotação (reuso de token já trocado encerra a sessão inteira); só o hash SHA-256 dos tokens fica no banco (`token_acesso`); o login acha o usuário pela política RLS `login_por_email`
- [x] Convite de usuário por e-mail e por link de WhatsApp (`POST /usuarios/convites` devolve o link `wa.me` com a mensagem pronta; `POST /auth/convite` aceita criando a senha; dono convida qualquer papel, gestor só recepção e barbeiro na própria unidade)
- [x] Guarda de papéis (dono, gestor, recepção, barbeiro) e de unidade em cada rota (`@Papeis(...)`; com `unidadeId` na requisição, o papel precisa valer nela; regras em `packages/shared/src/permissoes.ts`)
- [x] Middleware que define `app.conta_id` na conexão do banco a cada requisição (contexto da requisição em `AsyncLocalStorage`; `banco.daConta()` abre a transação com a conta do token)
- [x] Interceptador de auditoria: grava antes e depois em alterações sensíveis (`auditar(tx, ...)` na mesma transação, sem senha nem token; rota `@Auditada()` que não auditou vira erro em dev e alerta em produção)
- [x] Validação de entrada com zod, usando os esquemas de `packages/shared` (`@Corpo(esquema)` valida e documenta no OpenAPI)
- [x] Erros padronizados com mensagem em português para o usuário (`{ erro: { codigo, mensagem, campos? }, requestId }`, inclusive erros do banco e do limite de tentativas)
- [x] Documentação automática da API (OpenAPI/Swagger) só em desenvolvimento e homologação (`/docs`; `API_DOCS=true` liga em homologação)
- [x] Limite de requisições no login e nas rotas públicas (300/min por IP em tudo; `LIMITE_AUTH_POR_MINUTO` por IP + e-mail em login, convite e senha. Guardado em memória: basta enquanto houver uma instância da API)
- [x] Logs estruturados (pino) com id da requisição (`X-Request-Id` aceito do Caddy ou gerado, devolvido na resposta; `authorization` e cookies ocultos)
- [x] Rota de saúde `/health` checando banco e Redis
- [x] Fila (BullMQ) e publicação de eventos de domínio (filas `emails` e `eventos`; o worker entrega e-mails pelo SMTP e, por enquanto, só registra os eventos)
- [x] **Pronto quando:** login, convite e troca de senha funcionam de ponta a ponta com testes (`pnpm test:e2e`: 18 testes contra PostgreSQL e Redis reais, no CI)

## Etapa 5 · Base do front-end

O esqueleto das telas, a identidade visual e o app instalável no celular.

- [x] Tema do mapa: fundo escuro, amarelo dos módulos, verde de ação, cores dos planos; tema claro opcional (tokens em `apps/web/src/app/globals.css`; tema claro por aparelho, no perfil e no menu)
- [x] Fontes Barlow e Barlow Condensed (`next/font`, números tabulares nas colunas)
- [x] Biblioteca de componentes em `packages/ui`: botão, campo, tabela editável, cartão de indicador, barra de meta, etiqueta de estado, bloco de agenda, modal de confirmação (mais estado vazio e carregamento; a tabela aceita colar da planilha)
- [x] Telas de login, convite, recuperar senha e escolha de unidade (mais nova senha, perfil com troca de senha e página sem internet)
- [x] Menu montado pelo papel do usuário (`menuPara` em `packages/shared`; vale o papel da unidade ativa; endereço de outro papel mostra "não faz parte do seu acesso")
- [x] Cliente HTTP com renovação automática de token; cache de dados com TanStack Query (ponte `/api` no Next guarda os tokens em cookie httpOnly e renova no servidor, sem disputa entre abas; recusa pedidos de outra origem)
- [x] Formulários com react-hook-form e os mesmos esquemas zod da API (erros por campo vindos da API vão para o campo certo)
- [x] Formatação em pt-BR: moeda, data, hora, telefone (`packages/shared/src/formatacao.ts`)
- [x] PWA: manifesto, ícones, instalação no celular, fila local para lançamentos sem internet (service worker abre as telas já vistas sem sinal; fila no IndexedDB envia na ordem quando a conexão volta)
- [x] Layout responsivo testado em celular, tablet e computador (menu lateral no computador; barra inferior com 4 atalhos e "Mais" no celular)
- [x] Estados vazios com orientação ("Cadastre seu primeiro serviço") e telas de carregamento
- [x] **Pronto quando:** cada papel entra e vê só o menu dele, no celular e no computador (`apps/web/e2e`: Playwright com dono, gestor, recepção e barbeiro, no computador e no celular, no CI)

**Acabamento e movimento (pedido em 04/11/2026)**

Movimento curto e com um ritmo só, em CSS (sem biblioteca), mexendo só em `transform` e `opacity`; tudo termina visível e "reduzir movimento" desliga. Classes em `apps/web/src/app/globals.css`, conferidas por `apps/web/e2e/movimento.spec.ts`.

- [x] Toda tela entra com um deslize curto (`template.tsx` do app, do site e das telas públicas)
- [x] Barra fina no topo enquanto a próxima tela carrega
- [x] Carregando com o desenho da tela (cartões e lista) e um brilho que passa, no lugar do piscar; só aparece se a carga demorar
- [x] Cartões de indicadores, listas da equipe e cartões dos barbeiros chegam um após o outro
- [x] Barras de meta e dos gráficos crescem a partir da base; troca de aba e de preço (mensal/anual) com transição
- [x] Botões afundam de leve no toque; diálogos abrem com escala; linha da tabela acende sob o cursor
- [x] Site: a comanda de exemplo "sai da impressora" linha a linha e a sobra é carimbada; seções sobem ao entrar na tela; cabeçalho ganha sombra ao rolar; perguntas abrem deslizando; rolagem suave nas âncoras
- [ ] Transição entre telas com a View Transitions do React/Next quando sair do experimental

## Etapa 6 · Módulos do MVP

A ordem segue as dependências: cada módulo usa os anteriores. Cada um sai com API, tela, testes e dados de demonstração.

- [x] **6.1 Conta e unidades:** cadastro, dias de trabalho, capacidade, calendário de folgas e feriados (limite de unidades do plano aplicado na API; tela Configurações)
- [x] **6.2 Usuários e papéis:** convites, troca de papel, desativar acesso (gestor só mexe em recepção e barbeiro da unidade dele; a conta nunca fica sem dono; trocar papel ou desativar encerra as sessões)
- [x] **6.3 Serviços:** duração, categoria, custo de produto, extra (sim/não), peso em atendimentos (custo visível só para dono e gestor)
- [x] **6.4 Preços:** tabela serviço × unidade, novo preço a partir de uma data, histórico (aceita colar da planilha; vigência só de hoje em diante; mudanças programadas listadas)
- [x] **6.5 Profissionais:** data de entrada, horários, bloqueios, regra de comissão com vigência (cadastro já convida o barbeiro novo; limite de profissionais do plano aplicado na API)
- [x] **6.6 Clientes:** cadastro, busca por telefone, histórico, anotações, telefone oculto para barbeiro (barbeiro só vê quem atendeu; ocultar telefone é configuração da conta, ligada por padrão)
- [x] **6.7 Agenda:** visão por profissional em dia, semana e mês; agendar, remarcar, cancelar; consulta de horários livres (respeita expediente, calendário da unidade e bloqueios; o banco impede sobreposição)
- [x] **6.8 Comanda:** criada pelo agendamento, aberta na hora, itens, ajuste, confirmação do barbeiro, pendente, cancelada por falta, reaberta com motivo e auditoria (regras de estado em `packages/shared/src/comanda.ts`; pendente = horário terminou há 15 min sem confirmação; barbeiro lança extra sem internet pela fila offline)
- [x] **6.9 Fechamento e caixa:** várias formas de pagamento, desconto, caixa do dia, divergência (desconto rateado entre os itens; comissão calculada no fechamento pela regra vigente; caixa fechado trava o dia até o gestor reabrir)
- [x] **6.10 Comissões:** cálculo por item na hora do fechamento, extrato por barbeiro, marcar como paga (previsto, fechado, pago e a receber; pagamento limitado ao que falta)
- [x] **6.11 Despesas:** categorias (fixa, variável, manutenção, investimento, retirada do dono, cartão e resgates), competência, pago ou não (despesa da rede é do dono; gestor lança na unidade dele)
- [x] **6.12 Indicadores:** faturamento, clientes, ticket, atendimentos, extras, % de despesas, com filtro de unidade e período (mais lucro, projeção pelo calendário, metas e lucro por serviço; regras em `packages/shared/src/indicadores.ts`)
- [x] **6.13 App do barbeiro:** hoje, comandas, clientes, desempenho, comissões (e metas da unidade)
- [x] **6.14 Comanda impressa:** PDF A4 com 4 ou 6 por folha e QR code que abre a comanda (linhas para anotar extras à mão; gerado na API com pdf-lib, sem navegador no servidor)
- [x] **6.15 Link de agendamento:** página pública da unidade, escolha de serviço, profissional e horário, confirmação por WhatsApp (`/agendar?u=<endereço>`; liga e desliga por unidade; até 2 horários futuros por telefone; janela de 45 dias)
- [x] **6.16 Importação da planilha:** modelo CSV de serviços, preços, profissionais e clientes, com prévia e relatório de erros (aceita ; do Excel; confere duplicados e nomes contra o cadastro)
- [x] **6.17 Configuração guiada:** assistente de primeiro acesso que usa os modelos do seed (com cadastro de conta em `/cadastro`)
- [x] **6.18 Exportação para o contador:** relatório do mês em CSV e PDF (CSV abre direto no Excel; células que começam com =, +, - ou @ não viram fórmula)

## Etapa 7 · Testes

O dinheiro tem que bater. As regras de cálculo são testadas com casos reais da planilha antes de qualquer tela.

- [x] Testes unitários (Vitest) das regras de cálculo em `packages/shared`: faturamento, cliente, ticket, atendimentos, extras, % de despesas, projeção, comissão, lucro por serviço (162 testes)
- [x] Casos montados a partir dos prints da planilha, incluindo os erros que ela tinha ("outros", cliente que muda por mês, hidratação do dia 31) (`packages/shared/src/planilha.test.ts`, a partir do briefing de 03/11/2026: prints 1 a 6 e o dashboard de exemplo; o dia 31 também na API, com fuso)
- [x] Testes de integração da API com banco real em container (Testcontainers) (PostgreSQL e Redis reais, na mesma imagem do docker compose, que o CI sobe; dispensa a biblioteca Testcontainers)
- [x] Teste de isolamento: cada rota tentando ler e alterar dados de outra conta (`apps/api/test/varreduras.e2e-spec.ts`: 23 leituras e 27 alterações)
- [x] Teste de permissão: cada papel tentando acessar o que não pode (matriz com barbeiro, recepção e gestor: 42 tentativas, todas 403)
- [x] Testes de ponta a ponta (Playwright) dos fluxos críticos: agendar → atender → confirmar → fechar → ver comissão; cliente que não veio; reabrir comanda
- [x] Teste do app do barbeiro sem internet: lança, reconecta, envia (`apps/web/e2e/offline.spec.ts`)
- [x] Teste de carga simples na agenda e nos indicadores com o seed de demonstração (`pnpm carga`; no Codespace, 20 simultâneos: p95 de 454 ms na agenda da semana e 479 ms nos indicadores; roda no CI)
- [x] Cobertura mínima de 80% em `packages/shared` (proposta) (`pnpm --filter @pente-fino/shared test:cobertura`, cobrada no CI)
- [x] **Pronto quando:** toda a suíte roda verde no CI e os indicadores batem com uma conferência manual da planilha (os números dos prints do briefing batem nos testes)

## Etapa 8 · Integração contínua

Toda mudança passa por verificação automática antes de entrar na `main`, e toda versão vira uma imagem Docker pronta para publicar.

- [x] GitHub Actions no pull request: instalar, lint, checagem de tipos, testes unitários, integração e ponta a ponta (`.github/workflows/ci.yml`, desde a Etapa 2)
- [x] Cache do pnpm e do Turborepo para o CI rodar rápido (feito: `actions/cache` da pasta `.turbo` por job, com a chave do commit e a do último commit como reserva)
- [x] `Dockerfile` de várias etapas para `web`, `api` e `worker` (imagem final pequena, usuário sem root) (feito: `apps/*/Dockerfile` com `turbo prune`, build completo e imagem final só com as dependências de produção, rodando como `node`; web na saída `standalone` do Next (`NEXT_STANDALONE=1`); API com `HEALTHCHECK` e o alvo `migracoes` (CLI do Prisma, para `prisma migrate deploy` e `pnpm admin:criar` no servidor). Tamanhos: web 317 MB, worker 434 MB, API 512 MB; conferidas subindo em modo produção)
- [x] No merge na `main`: build das imagens e envio para o GitHub Container Registry com a tag do commit (feito: `.github/workflows/imagens.yml` publica `ghcr.io/<dono>/pente-fino-{api,migracoes,worker,web}` com a tag do commit e `latest`, com cache do build; entra com o token do próprio workflow)
- [x] Verificação de dependências vulneráveis (Dependabot) (feito: `.github/dependabot.yml` semanal para pacotes (agrupando produção e desenvolvimento), GitHub Actions e as imagens base)
- [x] Segredos só nos Secrets do GitHub, nunca no código (feito: o CI falha se um `.env` real entrar no repositório; o envio das imagens usa o token do workflow, sem segredo guardado; os segredos de produção (chaves, `PLATAFORMA_CHAVE`, Asaas) ficam no servidor, Etapa 16)
- [ ] **Pronto quando:** um pull request com teste quebrado é bloqueado e um merge gera as três imagens

## Etapas 9 a 15 · O produto completo antes do servidor

Tudo o que a página de planos promete precisa existir antes do piloto. Cada etapa sai como os módulos da Etapa 6: API, tela, regras de cálculo em `packages/shared` com teste antes da tela, isolamento por conta (`habilitar_isolamento_conta` em toda tabela nova), linha nova na matriz de permissões, teste Playwright do fluxo principal no computador e no celular, e dados na conta de demonstração. Ao entregar um recurso, ele deixa de aparecer como "em breve" em `RECURSOS_PLANO`. Toda tela nova usa o mesmo movimento (entrada, carregando com desenho, listas escalonadas).

## Etapa 9 · Ficha do profissional e desempenho da equipe

O dono e o gestor veem tudo sobre cada profissional numa tela só, para conversar com dados e não com impressão. O barbeiro vê a mesma ficha, só a dele.

- [x] Regras novas em `packages/shared`, com teste antes da tela: taxa de retorno (cliente que volta ao mesmo profissional em até N dias; padrão 45, configurável), clientes novos e recorrentes, intervalo médio entre visitas, ocupação do profissional (minutos agendados ÷ minutos de expediente menos bloqueios), tempo real por serviço (início do atendimento até a confirmação) contra a duração cadastrada, % de comandas confirmadas pelo barbeiro antes do fechamento, faltas dos clientes dele (`packages/shared/src/desempenho.ts`, 100% das linhas cobertas; a comanda passou a gravar quem confirmou, `confirmada_por_id`, porque o fechamento preenche a hora da confirmação)
- [x] Ficha do profissional (`/equipe/:id`), aberta pela tela Equipe, com filtro de período (este mês, mês passado, intervalo) e de unidade (em `/equipe/ficha?id=`, com o período na URL; a unidade é a do profissional e o ranking segue a unidade ativa)
- [x] Resumo: faturamento gerado, atendimentos, clientes, ticket médio, % de extras, ocupação, comissão (prevista, a receber e paga) e quanto ele contribuiu para a meta da unidade
- [x] Técnica: serviços feitos (quantidade, receita, tempo real x previsto), extras e produtos que mais vende e, só para o dono, margem de cada serviço (tempo real medido nas comandas com um serviço só, para não chutar a divisão)
- [x] Comandas atendidas: lista com data, cliente, itens, valor e estado, abrindo a comanda; reaberturas e cancelamentos destacados
- [x] Clientes: recorrentes (quantas vezes voltaram, última visita, intervalo habitual), novos no período, os que sumiram (passaram do intervalo habitual) e faltas (mais: botão "Chamar" no WhatsApp com a mensagem pronta e o link de agendamento, só para dono e gestor)
- [x] Rotina: comandas confirmadas no prazo, pendentes, tempo médio até confirmar e atrasos (atendimento começou depois do horário marcado)
- [x] Avaliações: nota média, distribuição das notas e comentários (os dados chegam com a Etapa 12; até lá a área explica como ligar a pesquisa)
- [x] Evolução dos últimos 6 meses e comparação com a média da unidade
- [x] Tela Equipe com ranking ordenável: faturamento, ticket, retorno, nota, ocupação e % de confirmação (aba "Desempenho", a primeira da tela; a ordenação por nota entra com a Etapa 12)
- [x] Barbeiro: "Desempenho" passa a ser a mesma ficha, só a dele, sem custo nem margem e sem ver os números dos colegas; o telefone dos clientes segue a regra de ocultar
- [x] Exportar a ficha em PDF para a conversa de feedback ("Imprimir ou salvar PDF": folha branca, sem menu, pelo próprio navegador)
- [x] Permissões: dono vê todos, gestor só os da unidade dele, recepção não vê, barbeiro só a própria ficha (`apps/api/test/desempenho.e2e-spec.ts` e as varreduras de isolamento e permissão)
- [x] **Pronto quando:** o dono abre a ficha de um barbeiro e responde sem planilha quanto ele faturou, que serviços faz, quantos clientes voltam para ele, quais comandas atendeu e como está a nota; os números batem com os indicadores da unidade (conferido com a demonstração e nos testes `apps/web/e2e/desempenho.spec.ts`)

**Resumo do dia (pedido no meio da etapa, para dono e gestor)**

- [x] Tela "Resumo do dia" (`/dia`), logo depois do Início: o que tem para hoje e o que já foi feito, por barbeiro, com atualização a cada minuto
- [x] Totais do dia: atendidos de marcados, faturamento fechado, o que ainda vai entrar, ocupação
- [x] "Fique de olho": comandas sem confirmação, prontas para fechar, faltas, clientes na primeira vez e aniversariantes
- [x] Cartão de cada barbeiro: próximo cliente, agenda com hora, cliente, serviços, valor, estado, origem (balcão, link, WhatsApp, sem horário) e observação; toque abre a comanda
- [x] Filtros: dia (anterior, seguinte, hoje), barbeiro, situação (a atender, em atendimento, aguardando fechamento, fechadas, faltas)
- [x] Aba "Mês dia a dia": agendados, faltas, clientes, faturamento, ticket e comissão por dia, filtro por barbeiro e só dias de trabalho; toque no dia abre o resumo daquele dia
- [x] Regras em `packages/shared/src/resumo-dia.ts` com testes; API `GET /resumo/dia` e `GET /resumo/mes` só para dono e gestor (gestor na unidade dele), nas varreduras de isolamento e permissão

## Etapa 10 · Bot do WhatsApp: conexão e respostas automáticas

O dono monta como o bot responde, sem inteligência artificial: menu numerado, palavras-chave e mensagens prontas. Nada chega ao cliente sem ter sido configurado e testado.

- [x] Conectar o WhatsApp da unidade pelo painel: QR Code na tela Bot, estado da conexão (conectado, lendo QR, desconectado), reconectar e desconectar; um número por unidade (`bot_conexao`) (aba Conexão; dono e gestor da unidade; o QR se renova sozinho e a tela avisa quando conecta; desconectar fica na auditoria)
- [x] Webhook da Evolution API entra numa fila do worker, com segredo conferido; mensagem repetida (mesmo id) é descartada (`POST /webhooks/whatsapp`, assinatura HMAC por instância no cabeçalho; fila `whatsapp-entrada` com o id da mensagem e índice único em `mensagem`; mudança de conexão gravada na hora)
- [x] Provedor atrás de uma interface (`ProvedorWhatsApp`: enviar, estado, QR), para trocar a Evolution API sem reescrever o fluxo (`packages/whatsapp`, com a Evolution e um provedor falso para testes: `WHATSAPP_PROVEDOR=falso`)
- [x] Motor de fluxo em `packages/shared`, com testes: nós de mensagem, menu numerado, palavra-chave, pergunta com resposta guardada e ação; sessão por número que expira em 30 minutos sem resposta e volta ao menu (`bot_sessao`) (`packages/shared/src/bot.ts`, puro e testado; os números das opções saem da ordem, então não repetem; guardar a sessão no banco chega com a conexão)
- [x] Construtor do menu (tela Bot): árvore editável, reordenar opções, textos com variáveis (`{nome}`, `{unidade}`, `{endereco}`, `{horario}`); avisa opção repetida e caminho sem saída (tela Bot, aba Menu: submenus até 3 níveis, subir e descer opções, problemas apontados enquanto edita)
- [x] Palavras-chave reconhecidas em qualquer ponto da conversa ("preço", "endereço", "horário", "clube"), com sinônimos, sem diferenciar acento nem maiúscula
- [x] Mensagens prontas editáveis: boas-vindas, fora do horário, não entendi, transferência para atendente, encerramento (`modelo_mensagem`) (mais "parar avisos" e "voltar a receber")
- [x] Horário do bot por unidade (segue o expediente ou tem horário próprio); fora do horário, responde e oferece agendar mesmo assim (feriado do calendário conta como fechado; sem expediente cadastrado, o bot não diz que está fechado)
- [x] Simulador de conversa no painel: o dono testa o menu como se fosse o cliente, antes de publicar (com respostas rápidas, cliente cadastrado ou número novo, e "fora do horário")
- [x] Rascunho e publicação: editar não afeta quem está conversando; publicar troca a versão; dá para voltar à versão anterior (versões em `bot_menu`; o banco garante um rascunho e um publicado por conta)
- [x] Menu modelo na configuração guiada: Agendar, Meus horários, Preços, Endereço e horário, Clube, Falar com atendente (Agendar, Preços, Endereço e horário, Atendente; "Meus horários" e "Clube" entram nas etapas 11 e 13)
- [x] Respostas prontas ligadas ao cadastro: preços vigentes da unidade, endereço com link do mapa, horário de funcionamento e feriados do calendário (preços vigentes da unidade, endereço com `{mapa}`, horário por extenso)
- [x] Cliente reconhecido pelo telefone: o bot cumprimenta pelo nome; número novo vira cliente com origem "bot" (acha com ou sem o nono dígito; o nome do perfil do WhatsApp vira o nome do cadastro)
- [x] Consentimento: na primeira conversa o cliente aceita receber avisos; "SAIR" a qualquer momento desliga lembretes, pesquisas e convites (`cliente.consentimento_msg`), "RECEBER" religa ("voltar" é palavra de navegação do menu); a escolha fica registrada com data (aceite explícito: a primeira conversa termina com o convite "responda RECEBER", mensagem pronta editável; `cliente.consentimento_em`; o perfil do cliente mostra a escolha)
- [x] Proteção do número: fila de envio espaçado e com intervalo aleatório, limite por minuto, nenhuma mensagem para quem nunca falou com a barbearia, nenhum envio em massa (fila `whatsapp-saida`: no máximo 30 por minuto por número, 2 s + até 1,5 s aleatório entre mensagens; mensagem para quem nunca escreveu é descartada antes de sair; não existe rota de envio em massa)
- [x] Histórico de mensagens no perfil do cliente (`mensagem`), para dono, gestor e recepção (`GET /clientes/:id/mensagens`; enviadas, pendentes e não enviadas marcadas)
- [x] Aviso no painel quando a conexão cair, com o passo a passo para reconectar (faixa no topo para dono e gestor, com link para a aba Conexão; desconectar pelo painel não conta como queda)
- [ ] **Pronto quando:** o dono conecta o número, edita o menu, testa no simulador e publica; um cliente recebe as respostas certas por número e por palavra-chave, e "SAIR" para os avisos dele (testado com a Evolution local até o envio; falta conferir com um celular de verdade lendo o QR)

## Etapa 10.1 · Ajustes pedidos no teste (2026-11-04)

Pedidos do dono depois de testar o sistema. Entram antes da Etapa 11, porque vários mexem em telas que a Etapa 11 vai usar (Conversas, bot, menu por papel). Itens que adiantam uma etapa futura dizem qual.

**Correções**

- [x] Configuração guiada e Configurações: o campo "cadeiras" (capacidade) aceita número negativo. Mínimo 1 no campo, no zod compartilhado e no banco (CHECK). As setas de subir e descer do campo numérico estão sem estilo: trocar por botões − e + do `packages/ui`, que valem para todo campo de quantidade (o zod e o CHECK já recusavam; a tela agora usa `CampoQuantidade`, que só aceita dígitos e volta para o intervalo ao sair do campo; vale também para duração e peso do serviço)
- [x] Convidar barbeiro: quem foi convidado por "Acesso ao sistema" sem estar cadastrado em Barbeiros não aparece para adicionar em Barbeiros. Ao aceitar convite com papel barbeiro, criar o profissional ligado ao usuário. Em Barbeiros, poder escolher um usuário já convidado em vez de digitar o e-mail de novo (em vez de criar a ficha sozinho, sem comissão definida: a aba Profissionais mostra "Falta completar o cadastro" com quem tem o papel e não tem ficha, e "Completar cadastro" abre o formulário com a pessoa escolhida; regra `barbeirosSemCadastro` em `packages/shared/src/equipe.ts`; o convite de barbeiro avisa o passo seguinte)
- [x] Fechar comanda: dá para escolher a mesma forma (ex.: crédito) duas vezes, mas há só 4 formas. Cada forma aparece uma vez: a forma já usada sai das outras listas, e "Dividir em outra forma" oferece só as que sobraram. Dois cartões de crédito somam na mesma linha. A API recusa forma repetida (zod compartilhado)
- [x] Desempenho do barbeiro (aba do barbeiro): conferir cada métrica com a conta de demonstração (faturamento, atendimentos, clientes, ticket, extras, ocupação, comissão, retorno, rotina, evolução) e corrigir o que vier vazio ou divergente da ficha vista pelo dono (conferido pela API, barbeiro × dono: números iguais; o barbeiro não recebe margem nem a média da unidade, de propósito; avaliações chegam com a Etapa 12)
- [x] Demonstração com 6 meses de histórico: hoje o seed cria só o mês passado e o atual, então no mês passado todo cliente conta como novo (retorno 0%) e a evolução mostra 4 meses zerados. Cuidar dos testes que conferem os números da planilha no mês passado (feito: o mês atual e os 6 anteriores completos, 700 clientes fiéis a um barbeiro (80% das visitas), despesas de todos os meses e comissões pagas mês a mês; retorno do mês passado em torno de 50% e evolução com 6 meses. Com esse volume a ficha passava de 5 s: `dataLocal` criava um formatador de data por chamada; agora reaproveita, de 3,6 s para 0,09 s em 20 mil chamadas)
- [x] Seed: a conexão do WhatsApp do Centro começa desconectada (estava "conectado" sem celular nenhum, e o teste de conectar pelo QR falhava no CI)

**Bot**

- [x] Não repetir o menu inteiro a cada resposta errada. Primeira resposta não entendida: "não entendi" curto com as opções em uma linha. Segunda seguida: oferecer o atendente. Terceira em diante: silêncio até o cliente mandar algo válido ou "menu". Contador de erros na sessão (`bot_sessao`), regra em `packages/shared/src/bot.ts` com teste (`sessao.erros`; o 2º erro usa a mensagem pronta nova "Não entendi de novo", editável: "Digite 0 para ver as opções ou ATENDENTE")
- [x] Respostas parecidas: aceitar o número com texto ("2", "2.", "opção 2", "dois") e o rótulo da opção sem acento ("precos", "endereco") (`opcaoEscolhida`: pelo nome, só quando uma opção só combina; "horário" está em duas e não escolhe no chute)
- [x] Variáveis: `{unidade}` hoje é o nome da unidade (na demonstração, "Centro"), e a boas-vindas sai "Aqui é a Centro". Criar `{barbearia}` (nome da conta) e usar nas mensagens padrão; `{unidade}` continua para quem tem mais de uma. Atualizar os textos padrão, o simulador e a lista de variáveis do construtor (migração troca o texto padrão nas contas que não editaram)
- [x] Pedido de atendente aparece em Conversas: quando o cliente escolhe "Falar com atendente", a conversa fica marcada como esperando atendente e entra na tela Conversas da unidade, com aviso na hora (adianta a tela Conversas da Etapa 11) (`bot_sessao.atendente_desde`; contador no menu e faixa em qualquer tela; responder pelo painel assume a conversa e sai pela fila do worker, com a mesma proteção do número; "Devolver ao bot" manda o encerramento; com atendente, o bot espera 2 horas antes de voltar sozinho)
- [x] Botões "Chamar" e "Enviar mensagem" do painel: o dono escolhe se abre o WhatsApp do aparelho (link `wa.me` com o texto pronto, como hoje) ou se o próprio bot envia pelo número da barbearia. O envio pelo bot passa pela fila `whatsapp-saida` e só sai para quem já conversou com a barbearia e não pediu SAIR, a mesma proteção do número; fica no histórico do cliente (sem configuração: a janela "Mensagem para…" traz o texto pronto, editável, e as duas saídas; quando o bot não pode, diz o porquê e fica o link. Enviar pelo bot deixa a conversa "com a equipe", para a resposta cair em Conversas. Na ficha do cliente, "Mandar mensagem"; na ficha do profissional, "Chamar", só para dono, gestor e recepção)
- [ ] Listas e botões do WhatsApp (o "Selecionar" com as opções e "Adicionar serviço · Prosseguir"), no lugar do menu numerado: o provedor ganha `enviarLista` e `enviarBotoes`, a resposta escolhida chega pelo id da opção e cai no mesmo motor. Liga e desliga em Bot → Mensagens, começa desligado e o texto numerado continua como reserva. Cuidado: pela conexão por QR (Baileys), o WhatsApp não garante esses formatos; a Evolution 2.3.7, a que usamos, tem um erro conhecido que quebra listas e botões (funciona na 2.3.6). Testar num celular de verdade antes de ligar por padrão; se não firmar, usar enquete (funciona pela conexão por QR) para escolher serviço e profissional (avaliado em 2026-11-05: **fica o menu numerado**. Pela conexão por QR não há garantia de entrega de listas e botões, e a Evolution 2.3.7 tem erro conhecido nelas; a enquete chega com o voto criptografado e depende de guardar a mensagem original, sem confirmação de que a Evolution entregue o voto legível. A API oficial está fora de cogitação. Reavaliar só se a Evolution corrigir e der para testar num celular)

**Pedidos do teste no celular (2026-11-05)**

- [x] Mensagens legíveis no celular: o "não entendi" traz as opções uma por linha (a linha corrida com "·" quebrava no meio); "oi", "oii", "bom dia", "e aí" no meio da conversa recebem as boas-vindas e o menu, em vez de "não entendi" (`ehSaudacao`)
- [x] Avisos com som e notificação do navegador quando um cliente passa a esperar atendente; cada aparelho liga e desliga em Conversas → "Avisos neste aparelho" (o push com o app fechado fica na Etapa 15)
- [x] Botão "Assumir conversa" em Conversas, sem precisar escrever (`POST /conversas/:id/assumir`)
- [x] Cookies analisados: base certa (httpOnly, Secure, SameSite=Lax, renovação única). Corrigidos: vai-e-volta entre /entrar e /app com cookie de sessão recusado pela API; sair apaga as telas guardadas pelo PWA; apagar o cookie repete os atributos de segurança

**Menu por papel**

- [x] Rever o menu lateral de cada papel (dono, gestor, recepção, barbeiro) numa tabela na matriz de permissões em `docs/`. Regra: o que a recepção vê, dono e gestor também veem. Hoje "Conversas do bot" e "Caixa do dia" estão só na recepção; passar para dono e gestor também. Separar o menu em grupos por função (Atendimento, Gestão, Bot, Conta) para não virar uma lista longa (seções Dia a dia, Gestão, Cadastros, WhatsApp e Conta, só no menu com mais de 7 itens; tabela atualizada em `docs/documentacao-do-produto.md`, "Navegação por papel")
- [x] Teste do menu (`packages/shared/src/menu.test.ts` e Playwright) garantindo que todo item da recepção está no menu de dono e gestor

**Métricas e avaliações**

- [x] Produtos: mais vendidos (quantidade e receita), margem de cada um (preço − custo) e "vale investir": margem × giro no período, com os que vendem pouco e os que dão mais lucro por real investido em estoque. Regra em `packages/shared` com teste (Métricas e metas → "Produtos: o que vende e o que vale a pena": destaques de mais vendido, mais lucro e melhor retorno; tabela com lucro, margem, retorno por R$ 1 de custo e situação — investir, divulgar, rever preço, repensar ou parado — comparando com a mediana dos produtos do mês; `lucratividadePorProduto` em `packages/shared/src/indicadores.ts`)
- [x] Serviços: mais consumidos (quantidade, atendimentos e receita), ao lado do lucro por serviço que já existe ("Serviços: lucro e procura", com "Ordenar por: mais lucro / mais consumidos" e a coluna "Procura", a fatia de cada serviço no total do mês)
- [x] Avaliação do barbeiro e avaliação da barbearia (atendimento, ambiente): adiantar da Etapa 12 a tabela `avaliacao`, a pesquisa pelo bot depois do fechamento, a nota na ficha do profissional e no ranking da Equipe, e a nota da barbearia no Início e nas Métricas (feito: tabela `avaliacao` com RLS e CHECK das notas; pesquisa pelo bot uma hora depois do fechamento — nota do atendimento, da barbearia e comentário, mensagens editáveis com `{profissional}`; só para quem aceitou avisos e já conversou com o WhatsApp da unidade, uma por cliente a cada 7 dias, vale 48 h; liga e desliga em Bot → Mensagens. Nota na ficha (o barbeiro vê a dele, sem o nome do cliente), no ranking da Equipe ("Nota"), em Métricas com notas baixas e comentários, e no Início. Fica para a Etapa 12: aviso imediato da nota baixa, registro do tratamento e convite para o Google)

**Assinatura do sistema** (o lado do dono; o do admin e do vendedor fica na Etapa 15.1)

- [x] Conta de teste para a cobrança: no seed, uma conta com teste vencido (`expirado@demo.pentefino.dev`) e uma com fatura recusada, para testar o sistema bloqueado sem esperar 14 dias. Ambiente sandbox do Asaas no `.env.example` (adianta parte da Etapa 23) (feito: `expirado@demo.pentefino.dev` e `recusado@demo.pentefino.dev`, senha da demonstração; a conta principal tem 3 faturas pagas e a do mês em aberto. O sandbox do Asaas foi ligado: assinar, pagar e "conferir" testados de ponta a ponta com a chave de teste)
- [x] Bloqueio suave ao fim do teste ou com fatura em atraso: o sistema fica só leitura, com aviso e botão para assinar; nunca apaga dado (feito: `situacaoAssinatura` em `packages/shared/src/assinatura.ts`, tolerância de 5 dias depois do vencimento; a trava `AssinaturaGuard` responde 402 a qualquer gravação, deixa ler, sair, trocar a senha; o link público de agendamento também para; aviso no topo do painel para todos, com "Ver assinatura" para o dono. Falta: o bot seguir respondendo ou não com a conta bloqueada, decidir na Etapa 23)
- [x] Aba "Assinatura" em Configurações (só dono): plano atual, mensal ou anual, dias que restam do teste grátis, próxima cobrança, faturas (paga, em aberto, recusada) com o motivo da recusa e o botão para pagar de novo ou trocar o cartão (feito: plano e preço por mês, situação, próxima cobrança, "Pagamento recusado" com o motivo e o botão para pagar ou trocar o cartão, histórico de faturas; tabela `fatura_assinatura` com RLS, gravada só pelo sistema. Assinar pela aba: plano, ciclo e CPF/CNPJ → assinatura no Asaas (Pix, boleto ou cartão na página dele); "Já paguei, conferir" busca as cobranças; webhook `POST /webhooks/asaas` com token aplica criação, pagamento e recusa. Funciona com a conta bloqueada)
- [ ] **Pronto quando:** cada item acima foi conferido na conta de demonstração, no computador e no celular, com teste nos pontos de regra (capacidade, forma de pagamento única, erros do bot, menu por papel, bloqueio por plano)

## Etapa 11 · Atendimento e agendamento pelo WhatsApp ou pelo site

O cliente escolhe por onde quer marcar: conversando com o bot ou pelo link. Os dois canais usam a mesma agenda e as mesmas regras e criam a mesma comanda prevista.

- [x] Regras de agendamento da unidade num lugar só, valendo para bot, site e balcão: antecedência mínima, janela máxima (hoje 45 dias), limite de horários futuros por telefone (hoje 2), prazo para o cliente remarcar ou cancelar sozinho, intervalo entre atendimentos (feito: Configurações → Agendamento, por unidade: antecedência mínima, até quantos dias, horários por cliente, prazo para remarcar ou cancelar, intervalo entre atendimentos, horas dos dois lembretes e liga/desliga do agendamento pela conversa. Bot e site respeitam tudo; o balcão marca livre para encaixe e só respeita o intervalo. `unidade.regras_agendamento` (JSON validado em `packages/shared/src/regras-agendamento.ts`))
- [x] Canais por unidade: o dono liga WhatsApp, site ou os dois (WhatsApp: "Agendar pela conversa" nas regras; site: "Link de agendamento")
- [x] Escolha do cliente: em "Agendar", o bot pergunta se ele quer marcar pela conversa ou pelo site e segue pelo escolhido; o site mostra "Prefere pelo WhatsApp?" com link que abre a conversa já no agendamento (feito: com o site ligado, "Agendar" no bot pergunta "1. Por aqui, na conversa · 2. Pelo site"; o site mostra "Prefere marcar pelo WhatsApp?", que abre a conversa com "AGENDAR POR AQUI" e o bot vai direto aos serviços)
- [x] Preferência guardada no cliente (`canal_preferido`): da próxima vez o bot já segue pelo canal que ele usou, com a opção de trocar (feito: `cliente.canal_preferido` guarda o último canal usado (marcar pela conversa ou pelo site, ou a escolha na pergunta); com "site", o bot já manda o link e "1" troca para a conversa)
- [x] Agendamento pela conversa: serviço (com preço e duração) → profissional ou "sem preferência" → dia → horários livres de 6 em 6 → resumo e confirmação, pela mesma API de horários livres (feito: `packages/db/src/agendar-bot.ts`, com as mesmas regras do balcão e do site, que saíram da API para `packages/db/src/agenda.ts`; textos e leitura da resposta em `packages/shared/src/agendar-bot.ts`. Só mostra dias que têm horário; um profissional só pula a escolha; "atendente" ou "menu" no meio largam o agendamento; o simulador faz o passo a passo sem gravar)
- [x] Mais de um serviço no mesmo horário (corte + barba), somando a duração (feito: "1 e 3" na lista de serviços)
- [x] Link do site vindo do bot com o telefone já preenchido por um token curto e de uso único, sem dado pessoal na URL (feito: `/agendar?u=slug&c=token`, token de 10 caracteres em `token_agendamento` (só o hash), vale 48 h e serve uma vez; a página traz nome e telefone preenchidos ("Não é você?" limpa), e ao agendar vale o telefone do token, não o digitado)
- [x] Horário disputado: se outro cliente confirmar antes, o bot avisa e oferece os próximos livres (o banco já impede sobreposição) (feito: na confirmação, se o horário foi ocupado, avisa e mostra os que sobraram do mesmo dia)
- [x] "Meus horários": o cliente vê os próximos agendamentos e remarca ou cancela pela conversa ou pelo link de gerenciamento enviado na confirmação, dentro do prazo da unidade (feito pela conversa: opção no menu padrão e palavras-chave "meus horários", "remarcar", "desmarcar"; remarcar reaproveita o passo a passo com os mesmos serviços e profissional; cancelar pede confirmação, libera o horário sem contar falta e fica na auditoria como "pelo cliente"; menos de 2 h antes, com a recepção. Link de gerenciamento: `/horario?t=token`, gerado na confirmação do site e do bot (marcado e remarcado), com token aleatório guardado só como hash em `link_horario` (RLS por `app.token_horario`); um link novo substitui o anterior. Pela página o cliente vê o horário, remarca com o mesmo serviço e profissional (horários livres ignorando o próprio horário) ou cancela, dentro do prazo da unidade; fora do prazo, mostra o motivo e o botão de falar com a barbearia. Remarcar pelo cliente virou uma função só para bot e site (`remarcarPeloCliente`), com auditoria, lembretes refeitos e aviso ao barbeiro. A página fica fora dos buscadores e não envia a URL a outros sites)
- [x] No site, caixa para aceitar receber lembretes pelo WhatsApp (feito: a caixa "Quero receber lembrete do horário pelo WhatsApp" começa desmarcada e só aparece com o WhatsApp da unidade conectado e lembretes ligados nas regras; marcada, grava o aceite no cliente. Como o número só escreve para quem já falou com ele (proteção do WhatsApp), a confirmação mostra "Ativar lembretes no WhatsApp", que abre a conversa com o número do bot e "RECEBER LEMBRETES" pronto; o bot confirma e os lembretes passam a sair (o worker confere na hora de cada lembrete). Quem já conversou com a unidade fica com os lembretes ligados direto)
- [x] Lembretes (proposta: 24 h e 2 h antes, configuráveis) para quem aceitou, com "1 Confirmo · 2 Remarcar · 3 Cancelar"; a resposta muda o agendamento e a agenda mostra quem confirmou (feito: trabalhos atrasados na fila criados ao marcar ou remarcar pelo balcão, site e bot; o de 24 h só se marcado com mais de um dia, o de 2 h só se com mais de 2 h; o worker confere de novo na hora — mesmo horário, não cancelado, cliente com avisos e que já conversou, WhatsApp conectado. "1" confirma e a agenda mostra "✓ confirmou"; no de 24 h, "2" remarca e "3" cancela; no de 2 h, mudar é com a recepção. Remarcar zera os lembretes e a confirmação. Horas configuráveis por unidade em Configurações → Agendamento. A abertura de cada lembrete é editável em Bot → Mensagens ("Lembrete (o primeiro)" e "Lembrete (perto do horário)", com {cliente}, {barbearia}, {unidade} e {profissional}); dia, hora, serviços e opções seguem fixos porque a resposta 1/2/3 depende deles)
- [x] Cancelamento pelo cliente libera o horário e cancela a comanda prevista sem contar como falta; a falta continua sendo marcada pela recepção (pela conversa; `cancelarPeloCliente` em `packages/db/src/agenda.ts`)
- [x] Cliente com muitas faltas (proposta: 3 em 90 dias) só agenda falando com a recepção (feito: regra da unidade em Configurações → Agendamento, "Faltas para marcar só com a recepção" (padrão 3, 0 desliga) e "Contando faltas dos últimos (dias)" (padrão 90); vale no bot, que manda responder ATENDENTE, e no site, que manda falar com a barbearia; o balcão continua marcando)
- [x] Falar com atendente: pausa o bot naquele número e avisa a recepção; o bot volta quando a recepção encerra, ou depois de 2 horas sem resposta, avisando o cliente (feito na 10.1: o bot pausa, a conversa entra em Conversas com aviso, e "Devolver ao bot" manda o encerramento. Agora também: se ninguém da equipe assumir nem responder em 2 h, o bot volta sozinho e avisa o cliente com o texto editável "Equipe não respondeu"; o trabalho atrasado `atendente_expira` confere se a espera ainda é a mesma)
- [x] Tela Conversas (recepção e gestor): caixa de entrada da unidade, quem está com atendente, responder pelo painel, assumir e devolver ao bot, atalhos para agendar e abrir o cliente (feito na 10.1: caixa de entrada por unidade, quem espera atendente, responder, assumir e devolver, "Ver cliente". Agora também o atalho "Agendar", que abre a Agenda com o novo agendamento já com o cliente)
- [x] Aviso ao barbeiro quando entra, muda ou cai um horário dele (notificação no celular) (feito: push do PWA. Perfil → "Notificações neste aparelho" liga, desliga e manda um teste; cada aparelho fica em `inscricao_push` (RLS). Horário novo, remarcado ou cancelado pelo balcão, site ou bot vai para a fila `notificacoes`, e o worker entrega com Web Push (chaves VAPID no `.env`; sem elas, o push fica desligado e a seção some do Perfil); aparelho que o serviço diz que acabou (404/410) sai da lista. Mesma janela de horário dos avisos do WhatsApp. Ao tocar, abre a Agenda. No iPhone, só com o app adicionado à tela de início)
- [x] Assistente da equipe no WhatsApp: o barbeiro liga no Perfil, confirma o próprio número com um código e escolhe os avisos que quer receber do número da barbearia (feito: Perfil → "Assistente no WhatsApp" gera um código; o profissional manda "ATIVAR código" do próprio WhatsApp para o da unidade — o código fica só como hash e vale 30 min; o número da equipe nunca vira cliente. Avisos escolhidos: horário novo; remarcado ou cancelado. `assistente_equipe` com RLS)
- [x] Avisos do assistente: horário novo, remarcado ou cancelado; "próximo cliente em 15 minutos" (com serviço e se é a primeira vez); agenda do dia de manhã; resumo do dia no fim do expediente (atendidos e comissão) (feito: horário novo, remarcado e cancelado pelo balcão, site e bot; "⏰ Próximo cliente às 14:00: João (primeira vez) · Corte" 15 min antes, conferido na hora (remarcado ou cancelado não sai); agenda do dia 1 h antes do primeiro turno (dia sem horário não manda nada); resumo 15 min depois do último turno com atendimentos fechados, comissão do dia, faltas e quantos horários amanhã. Cada aviso liga e desliga no Perfil; respeitam PARAR, o limite de 30 por dia e a conexão. Agenda e resumo são uma sequência na fila: cada um agenda o próximo, começa no ATIVAR e acaba quando o assistente é desligado no Perfil; trabalho atrasado não manda a agenda de outro dia)
- [x] Respostas simples ao assistente, sem IA: "agenda" (agenda de hoje), "amanhã", "comissão" (do mês); só para o número confirmado, e nunca com telefone de cliente quando a conta oculta (feito: AGENDA, AMANHÃ, COMISSÃO (fechada no mês), PARAR, LIGAR e ajuda; só para o número confirmado e só com o primeiro nome do cliente)
- [x] Silêncio fora do expediente dele e limite de mensagens por dia; "PARAR" desliga na hora (feito: avisos só de uma hora antes do primeiro turno até meia hora depois do último; no máximo 30 por dia; PARAR pausa)
- [x] Dono e gestor podem receber o mesmo tipo de aviso (falta, nota baixa, resumo do dia) pelo WhatsApp (feito: dono e gestor ligam o assistente no Perfil mesmo fora da agenda — o número é o da unidade onde atendem ou a primeira que gerem, de preferência conectada — e escolhem três avisos de gestão: falta marcada ("🚫 Falta · Centro — Marcos não veio às 10:00 com Rafael"), nota 1 ou 2 (com o comentário e o wa.me do cliente; sai uma vez só, no fim da pesquisa ou 15 min depois se o cliente parar de responder, `avaliacao.gestao_avisada_em`) e o resumo da unidade 15 min depois do último turno da unidade (faturamento e clientes pela regra de `calcularIndicadores`, ticket, faltas, notas baixas e comandas esperando fechamento; várias unidades em blocos). RESUMO no WhatsApp manda o dia até agora. Gestor de uma unidade só recebe dela; quem deixa de ser dono/gestor para de receber. Quem atende e gere vê as duas listas no Perfil)
- [x] Origem do agendamento registrada (balcão, site, bot) e indicador de agendamentos por canal nas métricas (feito: Métricas → "Por onde os clientes marcam": marcados, atendidos, faltas, cancelados, comparecimento, faturamento e fatia por canal — WhatsApp, site, balcão e "chegou sem horário"; `porCanal` em `packages/shared/src/canais.ts`, `GET /canais`)
- [ ] **Pronto quando:** um cliente marca, remarca e cancela pelo WhatsApp e outro pelo site, sem ajuda; os dois aparecem na agenda com comanda prevista e recebem o lembrete

## Etapa 12 · Pós-atendimento: avaliação e retorno do cliente

Depois que a comanda fecha, o cliente avalia o atendimento pelo WhatsApp. A nota vai para a ficha do barbeiro e o dono fica sabendo na hora quando algo deu errado.

- [x] Pesquisa automática depois do fechamento (proposta: 1 hora depois, configurável), só para quem aceitou mensagens e no máximo uma por cliente a cada 7 dias (adiantado na 10.1)
- [x] Pergunta curta: nota de 1 a 5 para o atendimento, depois comentário opcional; resposta por número (adiantado na 10.1, com a nota da barbearia também)
- [x] Tabela `avaliacao` (comanda, profissional, cliente, nota, comentário, respondida em), uma por comanda, com isolamento por conta (adiantado na 10.1)
- [x] A pesquisa expira se não for respondida (proposta: 48 horas), sem insistir (adiantado na 10.1)
- [x] Nota 1 ou 2: aviso imediato para dono e gestor, com o comentário e atalho para falar com o cliente; o tratamento fica registrado (resolvido, com anotação) (feito: o aviso pelo WhatsApp com comentário e link do cliente saiu na Etapa 11, pelo assistente da equipe. Em Métricas → "Notas baixas para resolver", cada nota tem "Ver cliente" e "Marcar como resolvida" com o que foi feito; fica gravado quem resolveu e quando (`avaliacao.tratada_em`, `tratada_por_id`, `tratamento`) e na auditoria; as resolvidas descem na lista)
- [x] Nota 5: convite opcional para avaliar a barbearia no Google (link configurado pelo dono) (feito: Bot → Mensagens → pesquisa, "Link para avaliar no Google" por unidade (só https; vazio desliga); no fim da pesquisa, nota 5 da barbearia (ou do atendimento, quando a da barbearia não veio) e nenhuma nota baixa recebem o convite, com texto editável "Convite para avaliar no Google" e a variável {google})
- [x] Ficha do profissional e indicadores: nota média, número de respostas, taxa de resposta e comentários do período (adiantado na 10.1)
- [x] Barbeiro vê a própria média e os comentários, sem o telefone do cliente, e não vê as notas dos colegas (adiantado na 10.1)
- [x] Mensagem de retorno: cliente que passou do intervalo habitual de visitas (pelo histórico; padrão 30 dias) recebe um convite para agendar, uma vez por ciclo (feito: Bot → Automações, "Convidar para voltar quem passou do tempo de costume"; o tempo de costume é a mediana das últimas visitas (14 a 120 dias), e quem veio uma vez usa o padrão da conta (30); quem tem horário marcado não recebe; um convite por ciclo (`cliente.retorno_convidado_em`); texto editável "Convite de retorno". Rotina diária às 10 h no worker (agendador do BullMQ), pela unidade da última visita, só para quem aceitou mensagens e já conversou com ela, até 20 por número por dia. Começa desligada)
- [x] Mensagem de aniversário com o modelo da barbearia (liga e desliga) (feito: Bot → Automações, "Mandar parabéns no aniversário", para quem tem a data no cadastro, uma vez por ano (`cliente.aniversario_enviado_em`), texto editável "Aniversário"; no dia do parabéns o convite de retorno não sai junto. Começa desligada)
- [x] Lista "clientes para recuperar": os que sumiram, deram nota baixa ou faltaram (feito: Clientes → aba "Para recuperar" para recepção, gestor e dono: nota 1 ou 2 sem resolver, falta nos últimos 90 dias sem visita depois, e quem passou do tempo de costume sem horário marcado (mesma regra do convite de retorno, `motivosParaRecuperar` em `packages/shared`); cada linha mostra o motivo, a última visita, o costume, se o convite de retorno já saiu, e leva à ficha (mandar mensagem) ou ao novo agendamento; `GET /clientes/recuperar`)
- [x] Cada automação mostra quantas mensagens saíram, quantas foram respondidas e quantos agendamentos gerou (feito: Bot → Automações → "Resultado no mês" para retorno, aniversário, pesquisa e lembrete: enviadas, responderam (escreveu de volta em até 48 h) e marcaram (horário criado em até 7 dias); cada mensagem guarda a automação de origem em `mensagem.automacao`)
- [ ] **Pronto quando:** uma comanda fechada gera a pesquisa, a nota aparece na ficha do barbeiro e uma nota 1 chega ao dono em menos de 1 minuto

## Etapa 13 · Clube da barbearia

Assinatura, combos e convênios reconhecidos na comanda, com o dono vendo se o clube dá lucro.

- [x] Itens do clube: assinatura, combo e convênio, com valor por unidade, serviços inclusos e limite de uso por mês (`item_clube`, `item_clube_servico`) (feito: Clube → Planos, só o dono cadastra: tipo, nome, valor por mês, unidade, limite total opcional de atendimentos no mês e os serviços inclusos com "vezes no mês" (vazio = à vontade) e comissão fixa opcional; editar troca os serviços e vale para os próximos atendimentos; desativado não recebe assinante novo. `item_clube` e `item_clube_servico` com RLS e na auditoria)
- [x] Adesão do cliente: início, vencimento, situação e usos no ciclo (`adesao_clube`) (feito: Clube → Assinantes, dono, gestor e recepção: coloca o cliente (ou cadastra na hora) no plano com início e vencimento um mês depois (o vencimento é o dia em que renova; o ciclo vai do vencimento anterior até a véspera); um plano ativo por cliente (índice único no banco); cancelar pede motivo e o histórico fica; a lista mostra situação (em dia, vencida, cancelada), vencimento e o que resta no ciclo; a ficha do cliente mostra o plano. Os usos do ciclo saem das comandas (`item_comanda.adesao_id`), nunca de um contador, e as regras de ciclo e cobertura ficam em `packages/shared/src/clube.ts` com teste)
- [x] A comanda reconhece o assinante: o que o plano cobre entra com valor zero e conta no uso; acima do limite ou fora do plano entra com preço normal, como extra (RN-07) (feito: ao lançar um serviço para o cliente (agendamento pelo balcão, site ou bot, comanda aberta na hora, item lançado ou trocado), `partesDoServico` em `packages/db/src/clube.ts` decide: a parte que o plano cobre entra com valor zero, marcada como do clube e ligada à adesão; o que passa do limite do serviço ou do plano entra num item separado com o preço normal. Só vale a adesão em dia e na unidade do plano. Mudar a quantidade de um item do clube lança de novo, e o limite não estoura. Comanda toda coberta fecha sem pagamento. Selo "Clube" na comanda. Cancelar a comanda devolve o uso)
- [x] Comissão do item do clube sobre o preço de tabela da unidade na data, ou valor fixo definido pelo dono (regra em `packages/shared` com testes) (feito: ao fechar, o item do clube recebe a comissão fixa que o dono definiu para o serviço no plano, ou o % do barbeiro sobre o preço de tabela da unidade na data (`comissaoDoClube`, com teste))
- [x] Mensalidade sem gateway: QR Pix da chave da barbearia e baixa pela recepção; receita do clube separada da receita de serviço (feito: Clube → Planos, o dono cadastra a chave Pix, o nome e a cidade de quem recebe; em cada assinante, "Receber mensalidade" mostra o valor do plano, o QR e o Pix copia e cola (BR Code estático gerado em `packages/shared/src/pix.ts`, com CRC16 e teste) e a forma (Pix, dinheiro, débito, crédito); a recepção confere o extrato e confirma. A baixa fica em `pagamento_clube` (receita do clube, fora do faturamento das comandas) e o vencimento anda um mês, mantendo o dia; vencida há mais de um ciclo, recomeça de hoje)
- [x] Rotina diária: vence adesões, zera os usos no novo ciclo e avisa o cliente pelo bot antes do vencimento (feito: vencer e zerar os usos não precisam de rotina: a situação (em dia ou vencida) e o ciclo saem do vencimento a cada leitura, e os usos são contados das comandas do ciclo. O aviso entra na rotina das 10 h: Bot → Automações, "Avisar o assinante do clube 3 dias antes de renovar" (ligado por padrão), com texto editável "Clube: aviso de vencimento" ({plano}, {valor}, {vencimento}) e, logo depois, o Pix copia e cola numa mensagem separada; um por ciclo (`adesao_clube.aviso_vencimento_em`, zerado na baixa), só para quem aceitou mensagens e já conversou com a unidade, dentro do limite diário; aparece nos números das automações)
- [x] Bot: a opção "Clube" mostra os planos e, para o assinante, usos que restam e vencimento (feito: ação "Clube" no editor do menu; para o assinante da unidade mostra o plano, quando renova (ou que venceu) e o que resta no mês; para os outros, os planos ativos da unidade com o valor e o que incluem, e o convite para falar com a recepção; `textoClubeNoBot` em `packages/shared/src/clube.ts`)
- [x] Relatório do clube: assinantes ativos, cancelamentos, mensalidades recebidas x comissões pagas em atendimentos do clube (feito: Clube → aba "Resultado" para dono e gestor, por mês: mensalidades recebidas (`pagamento_clube`, receita do clube fora do faturamento), comissões e custo de produto dos atendimentos cobertos (comandas fechadas), lucro do clube no total e por plano, assinantes em dia, vencidos, novos, cancelamentos e os motivos; `resumirClube` em `packages/shared/src/clube.ts`; `GET /clube/relatorio`. O clube saiu do "em breve" no comparativo de `/planos`)
- [x] Mensalidade do clube no resultado do mês (decisão do dono em 2026-11-11, comparação com a planilha) (feito: `calcularIndicadores` recebe as mensalidades do período (`receitaClube`, `clientesAvulsos`, `atendimentosClube`, `valorPorAtendimentoClube`); faturamento = serviços + produtos + mensalidades; ticket médio = (serviços + produtos) ÷ clientes avulsos; na API, `ResultadosService.clube()` soma `repasse ?? valor` pelo dia do pagamento e por unidade, em indicadores (atual e anterior), projeção (soma o que entrou, sem projetar), meta, relatório e 12 meses, resumo do dia e do mês (sem filtro de barbeiro), rede por unidade e exportação CSV e PDF; o desempenho por barbeiro fica de fora. Na tela, cartão "Clube" e linha "Clube (mensalidades)" no Financeiro. Testes em `indicadores.test.ts` e `apps/api/test/clube.e2e-spec.ts`)
- [x] **Pronto quando:** um assinante é atendido, a comanda não cobra o que o plano cobre, o uso desconta do mês e o relatório mostra se o clube deu lucro (conferido nos testes de ponta a ponta da API (`apps/api/test/clube.e2e-spec.ts`: o assinante é atendido, o coberto entra com valor zero, o terceiro corte passa do limite e é cobrado, a comissão sai da tabela, cancelar devolve o uso, o relatório mostra o lucro por plano) e no navegador (`apps/web/e2e/clube.spec.ts`))

## Etapa 14 · Agenda completa: lista de espera, encaixe e ocupação

Horário vago vira atendimento sem a recepção pegar o telefone.

- [x] Lista de espera: o cliente pede dia, faixa de horário e profissional, pelo balcão, pelo bot ou pelo site (feito: balcão em Agenda → "Lista de espera" (cliente, serviços, barbeiro ou qualquer um, dia e faixa); bot: a lista de horários do dia ganhou "Nenhum serve: me avise se vagar neste dia"; site: "Avise-me se vagar neste dia" quando o dia não tem horário, que também grava o aceite de mensagens e mostra "Ativar avisos no WhatsApp" se o número nunca escreveu. `lista_espera` com RLS e auditoria)
- [x] Quando um horário vaga, o bot oferece para a lista em ordem; o primeiro que confirmar leva e os demais recebem "já foi preenchido" (feito: cancelamento ou falta na comanda, remarcação pelo balcão, cancelar ou remarcar pelo link ou pela conversa põem a vaga na fila (`vaga`); o worker escolhe, na ordem de chegada, quem cabe (dia, faixa, barbeiro ou qualquer um, a duração dos serviços cabendo na agenda, com aceite de mensagens e conversa com a unidade) e oferece para até 3 ao mesmo tempo, com validade de 30 min; a resposta "1" marca com comanda prevista (ou antecipa o horário que a pessoa tem), "2" recusa e continua na lista; os outros recebem "já foi preenchido" e voltam a esperar; resposta atrasada recebe "a oferta não vale mais". Os números aparecem em Automações como "Oferta da lista de espera")
- [x] Encaixe: a recepção marca fora da grade, com aviso de conflito (feito: no novo agendamento, "Encaixe: digitar o horário, mesmo fora da grade"; se cair fora do expediente, em cima de bloqueio ou com a unidade fechada, o sistema avisa e pede "Encaixar mesmo assim" (`encaixe_com_aviso`); outro cliente no mesmo horário continua impossível (`avisosDoEncaixe` e o banco))
- [x] Bloqueio recorrente (almoço toda terça) e férias do profissional (feito: Agenda → "Bloquear horário" com três tipos: uma vez, toda semana (`bloqueio_recorrente`, a partir de uma data e até outra opcional) e férias/folga de dias; lista e remove os que repetem e os próximos; os horários livres do balcão, do site e do bot e o encaixe respeitam todos; a agenda mostra os que repetem em cada dia e as férias recortadas dia a dia)
- [x] Ocupação por unidade, profissional e faixa de horário (com a capacidade da unidade) no Início e na ficha do profissional (feito: `mapaDeOcupacao` em `packages/shared/src/ocupacao.ts` calcula hora a hora o expediente livre de bloqueio, limitado às cadeiras da unidade, contra os horários marcados; `GET /ocupacao` (dono e gestor, até hoje); o Início mostra o card "Ocupação da agenda no mês" com manhã, tarde e noite; a ficha e o ranking da equipe já mostravam a ocupação de cada barbeiro e agora descontam também os bloqueios que repetem)
- [x] Mapa da semana com os horários mais vazios e mais cheios, para decidir escala e promoções (feito: Métricas → "Mapa da semana", dia da semana × hora das últimas 4 semanas, com a cor indo do vazio até a hora mais cheia do período e as listas "Mais vazios" e "Mais cheios" (só horas com pelo menos 2 h de agenda no período, `extremosDoMapa`); com "Todas as unidades", escolhe a unidade)
- [x] **Avisar se vagar antes** (pedido em 2026-11-05): depois de agendar, o bot pergunta "quer que eu avise se vagar um horário antes do seu?" **só quando o cliente foi empurrado para depois**, e entra na lista de espera dos horários anteriores daquele dia (feito: `deveOferecerAntecipar` em `packages/shared/src/espera.ts` com um teste para cada caso; bot pergunta depois de marcar e "1" põe na lista para antecipar com a faixa até 15 min antes do horário dele; site mostra "Queria mais cedo? Me avise se vagar antes" na confirmação só para quem aceitou mensagens. Quando vaga antes, a oferta diz "Vagou um horário antes do seu" e "1" move o horário dele (o antigo vira nova vaga para a lista))
  - Pergunta quando todos os horários do dia **antes** do escolhido estavam ocupados (a partir da abertura, ou de agora com a antecedência mínima, se for hoje), para o profissional escolhido, ou para todos em "sem preferência"
  - Exemplo confirmado: das 9h às 11h tudo ocupado, marcou 11h30 (o primeiro livre) com 12h também livre → **pergunta**: ele pegou o mais cedo que tinha e provavelmente queria antes
  - Não pergunta: dia com horários livres antes do escolhido (ele escolheu por preferência); escolheu entre horários livres; marcou o primeiro horário do dia (não há como antecipar); já está na lista daquele dia
  - Regra pura em `packages/shared` (`deveOferecerAntecipar`), com teste para cada caso acima, usando a mesma grade de horários livres do agendamento
  - Vale para agendamento pelo bot (a conversa está aberta) e pelo site (só se marcou que aceita mensagens); pelo balcão, a recepção marca na hora
  - Quando vaga um horário antes (cancelamento ou falta avisada), oferece em ordem para quem pediu; o primeiro que responder "1" leva e o horário dele é liberado para a lista; os outros recebem "já foi preenchido". Mesma proteção do número (fila espaçada, nada para quem não aceitou)
  - Resposta "não": não pergunta de novo naquele agendamento
- [x] **Tolerância de atraso e remarcação rápida** (pedido em 2026-11-05) (feito: "Tolerância de atraso (minutos)" em Configurações → Agendamento (padrão 10), avisada na confirmação do bot e do site e no lembrete; passada a tolerância sem começar, a comanda mostra "Cliente não chegou?" com Chegou e Não veio, o "Hoje" do barbeiro avisa e a agenda marca "Não chegou?"; nada acontece sozinho. "Não veio" (`POST /comandas/:id/nao-veio`, também com o horário já terminado) cancela como atraso (`agendamento.atrasou`, conta nas faltas, separado da falta comum) e, 5 min depois, a vaga vai para a lista de espera e o bot manda os próximos 3 horários com o mesmo barbeiro mais "outro dia" pelo site; responder o número já marca. "Desfazer" em até 5 min volta o horário se ainda estiver livre, e os trabalhos atrasados conferem e não mandam nada. `estaAtrasado` e `proximosHorariosParaRemarcar` em `packages/shared/src/atraso.ts`, com teste)
  - Tolerância por unidade (padrão 10 minutos, o dono muda em Configurações), avisada ao cliente em toda confirmação de agendamento (bot, site, balcão) e no lembrete: "tolerância de 10 minutos; depois disso o horário pode ser cancelado"
  - O sistema **identifica** o atraso, mas **não cancela sozinho**: passada a tolerância sem a comanda entrar em atendimento, a comanda e o "Hoje" do barbeiro mostram "Cliente não chegou?" com dois botões, **Chegou** (inicia o atendimento) e **Não veio** (confirma o atraso). Também aparece para a recepção na agenda
  - Só a confirmação de "Não veio" dispara o fluxo. Assim, se o barbeiro esqueceu de iniciar a comanda com o cliente na cadeira, ninguém recebe mensagem de cancelamento à toa. Sem confirmação, nada acontece e o aviso some quando a comanda é iniciada, fechada ou cancelada
  - O fluxo depois de "Não veio": a comanda prevista é cancelada como **atraso** (conta nas faltas do cliente, separado da falta comum no relatório), o horário é liberado e oferecido à lista de espera e a quem pediu "avisar se vagar antes", e o bot manda ao cliente (se ele aceita mensagens) "seu horário das 14h foi cancelado pelo atraso. Quer remarcar?" com os **próximos 3 horários livres** com o mesmo barbeiro, mais "outro dia" (link do site com o telefone preenchido). Responder o número já marca, sem passar pelo menu
  - Desfazer em até 5 minutos (cliente chegou logo depois): reabre o horário se ainda estiver livre e não manda mais nada
  - Regra pura em `packages/shared` (`estaAtrasado`, `proximosHorariosParaRemarcar`), com teste; a remarcação usa a mesma API de horários livres e o mesmo motor de agendamento pela conversa da Etapa 11
- [x] **Mover agendamento arrastando** (pedido em 2026-11-05): na agenda do computador e do tablet, dono, gestor e recepção seguram e arrastam o horário para outro barbeiro (outra coluna) e/ou outro horário (feito: `@dnd-kit/core` na visão do dia, com mouse e toque (segurar 250 ms no tablet), de 15 em 15 min (`minutosDoArrasto`); só comanda prevista. Ao soltar, "Mover o horário de Corte do João das 14:00 com Rafael para 14:30 com Thiago?"; a API confere expediente, bloqueios e sobreposição como na remarcação e devolve o motivo se não pode. Depois de mover, "Desfazer" por 10 s (`DESFAZER_MOVER_S`), e o aviso ao cliente (`horario_mudou`) só sai depois disso e se o horário ainda é o mesmo. Mudou o horário: avisa (se aceita mensagens), com o link do horário; mudou só o barbeiro: quem move marca "Avisar o cliente da troca de barbeiro". No celular e pelo teclado: botão "Mover horário" na comanda (barbeiro, dia e horário livre) com a mesma confirmação. A agenda abre num dia com `?dia=`. Ainda não existe cadastro de quais serviços cada barbeiro faz; quando existir, entra na mesma conferência)
  - Ao soltar, confere: o barbeiro de destino faz o serviço, está no expediente, sem bloqueio, e o horário não se sobrepõe (o banco já impede); se não pode, volta ao lugar com o motivo
  - Confirmação curta antes de gravar ("Mover o corte do João das 14h com Rafael para 14h30 com Thiago?"); a comanda prevista acompanha; fica na auditoria; botão **Desfazer** por alguns segundos
  - Se mudou o horário, o cliente recebe aviso pelo bot (se aceita mensagens); se mudou só o barbeiro, o dono escolhe se avisa
  - No celular não arrasta (tela pequena): o mesmo movimento pelo botão "Mover" da comanda, com a escolha de barbeiro e horário. Pelo teclado também, para acessibilidade
  - Biblioteca de arrastar com suporte a toque e teclado (`@dnd-kit`); teste Playwright arrastando entre colunas
- [x] **Pronto quando:** um cancelamento vira atendimento de alguém da lista de espera sem a recepção intervir (conferido no teste de banco `lista de espera` em `packages/db/test/agendar-bot.db.test.ts`: o dono do horário cancela, a vaga é oferecida na ordem, o primeiro "1" vira agendamento com comanda prevista e o outro recebe "já foi preenchido", sem ninguém do balcão)

## Etapa 15 · Avisos, rotinas, rede e planos

Cada pessoa recebe só o aviso que precisa agir, e cada plano entrega exatamente o que promete.

- [x] Comandas pendentes: a cada 15 minutos no expediente, aviso para a recepção (feito: rotina `avisos` no worker de 15 em 15 min; em cada unidade com expediente agora, as comandas de hoje que passaram 15 min do fim sem a confirmação do barbeiro e ainda não foram avisadas (`pendente_avisada_em`) viram um aviso "Comandas esperando confirmação" para a recepção; sem recepção na unidade, vai ao gestor e, sem gestor, ao dono (`destinatariosDoAviso`). Não repete a mesma comanda)
- [x] Fechamento do dia: consolida o dia e avisa o gestor quando o caixa tem divergência (feito: fechar o caixa com diferença avisa gestor e dono na hora, com o link para o caixa daquele dia (`/caixa?dia=`); meia hora depois do último turno (`fimDoDiaDaUnidade`), a rotina dos avisos manda o resumo do dia e, se o caixa recebeu e não foi fechado, "Caixa ainda aberto" para gestor e dono, uma vez por dia)
- [x] Resumo diário do dono (WhatsApp ou e-mail, ele escolhe): faturamento do dia, ritmo do mês, pendências e notas baixas (feito: no fim do dia da unidade, aviso "Resumo de 01/12 · Centro" na central para dono e gestor com faturamento, clientes e ticket do dia, o mês até hoje com a projeção (`projetar` pelos dias de trabalho da unidade), faltas, notas baixas e comandas esperando fechamento; por e-mail para quem marcou em Perfil → Avisos; o resumo do WhatsApp (assistente) ganhou a linha do mês)
- [x] Central de avisos no app, com histórico (feito: tabela `aviso` com RLS, uma linha por pessoa, sem repetir a mesma chave; sino no topo do menu (e na barra do celular) com o número de não lidos, revisto a cada minuto; `/avisos` com os últimos 100, abrir marca como lido e "Marcar todos como lidos"; quem tem push ligado recebe também no celular)
- [x] Notificações no celular (push do PWA) com permissão por aparelho; cada tipo liga e desliga no Perfil (feito: o push por aparelho e as mudanças na agenda do barbeiro saíram na Etapa 11; em Perfil → Avisos, cada tipo de aviso da central e "Horário novo, remarcado ou cancelado na minha agenda" (para quem atende) ligam e desligam no celular; o sino mostra tudo de qualquer jeito)
- [x] Painel da rede: unidades lado a lado com faturamento, lucro, ticket, ocupação, nota média e retorno (RF-23) (feito: Gestão → "Painel da rede" (`GET /rede`, dono vê todas, gestor as dele), mês a mês: cada unidade com faturamento, lucro (despesas operacionais da unidade; as da conta só no total), ticket, ocupação até hoje, nota da barbearia e retorno no prazo, a melhor de cada indicador marcada (`destaquesDaRede`) e a linha da rede pesada pelo tamanho de cada unidade (`totalDaRede`); no celular, um cartão por unidade. O limite ao plano Premium entra com os recursos por plano)
- [x] Recursos por plano aplicados na API e na tela (`incluiRecurso` em `packages/shared`); o que não está no plano aparece com convite para mudar, sem esconder dado já lançado (feito: `RECURSOS` e `temRecurso` em `packages/shared/src/planos.ts`; na API, `@ExigeRecurso` e o `PlanoGuard` respondem 403 `recurso_do_plano` com a frase do convite; clube, bot, metas e lista de espera bloqueiam só gravar (o que já foi lançado continua aparecendo); comissões, ficha e ranking, avaliações, canais, painel da rede, lucro real e automações bloqueiam também a leitura; desconectar o WhatsApp é sempre livre; o site não oferece nem aceita lista de espera sem o recurso. Na tela, `SoNoPlano`, `ConviteSeFaltar` e as consultas só chamam a API do que o plano tem; o convite diz em que plano está e leva o dono à assinatura; os outros papéis são orientados a falar com o dono. `conta/situacao` traz o plano. Conta de demonstração `basico@demo.pentefino.dev` para ver os convites)
- [x] Ficha do profissional, avaliações, canais de agendamento e lista de espera incluídos em `RECURSOS_PLANO` e no comparativo de `/planos` (feito: os quatro entram no Pro, junto com comissões, metas, clube e bot; Premium traz painel da rede, lucro real e automações; o comparativo lista cada recurso conferido pela API no plano certo (teste em `planos.test.ts`); bot, lista de espera e automações deixaram de aparecer como "em breve")
- [x] Troca de plano pelo próprio dono, conferindo os limites antes de descer (feito: Configurações → Assinatura → "Mudar de plano" com a prévia (`GET /conta/plano/previa`): valor de hoje e o novo, o que impede (unidades e profissionais ativos acima do limite; no Básico, WhatsApp conectado) e o que deixa de usar (com os assinantes do clube e a lista de espera de hoje); subir vale na hora; descer pede confirmação; com a cobrança automática, o Asaas recebe o valor novo também nas cobranças em aberto (`atualizarAssinatura`); fica na auditoria (`trocar_plano`). Regra em `conferirTrocaDePlano`, com teste)
- [x] **Pronto quando:** cada papel recebe só os avisos dele, e uma conta Básico não usa recurso do Pro nem pela tela nem pela API (conferido: `central-avisos.db.test.ts` e o e2e do caixa (recepção, gestor e dono recebem só os seus); `planos.e2e-spec.ts` (Básico recebe 403 `recurso_do_plano` em tudo do Pro, Pro em tudo do Premium) e o Playwright da conta `basico@demo.pentefino.dev`)

## Etapa 15.1 · Administração do sistema (pedido em 2026-11-05)

Área de quem opera o Pente Fino, separada das barbearias: acompanhar as contas, vender e ativar pessoalmente, cobrar e configurar o sistema. Vem antes do servidor porque o piloto (Etapa 22) e a venda presencial dependem dela.

**Acesso e segurança**

- [x] Papéis da plataforma, fora das contas: `admin` (tudo) e `vendedor` (cria conta, registra pagamento, vê só as contas dele). Tabela `usuario_plataforma` sem `conta_id`; nunca reaproveita o login da barbearia (feito: `usuario_plataforma` com os papéis e login próprio; `pnpm admin:criar` para o primeiro admin (e `--redefinir`); o vendedor vê, abre e cobra só as contas que vendeu (`conta.vendedor_id`), o resto é do admin)
- [x] Endereço próprio (`/admin`), login com segundo fator obrigatório (código no aplicativo autenticador), sessão curta e IP registrado (feito: `/admin` com ponte própria (`/admin-api`, cookie httpOnly `pf_admin` só desse caminho, SameSite=Strict); a ponte das barbearias recusa `admin/...`; TOTP da RFC 6238 configurado no 1º acesso pelo QR code, o mesmo código não entra duas vezes e o segredo fica cifrado (AES-256-GCM, `PLATAFORMA_CHAVE`); sessão de 2 h (`PLATAFORMA_SESSAO_EXPIRA_EM`) com IP e navegador; recusa sem dizer se errou e-mail, senha ou código)
- [x] Leitura entre contas sem furar o RLS: funções `SECURITY DEFINER` só para o que o painel precisa (contagens, plano, status, datas), com um usuário de banco próprio; o admin **não** abre comanda, cliente nem conversa de barbearia (feito: usuário de banco `DB_PLATAFORMA_USER` (papel `pente_fino_plataforma`, `infra/postgres/init/02-plataforma.sh`) só com as tabelas da plataforma e o EXECUTE de `plataforma_contas()`; as políticas `plataforma_leitura` valem só para o dono das tabelas, ou seja, só dentro das funções; o usuário da aplicação não executa a função nem lê as tabelas da plataforma (teste `plataforma.db.test.ts`))
- [x] Toda ação do admin e do vendedor fica numa auditoria da plataforma (quem, quando, conta, antes e depois) (feito: `auditoria_plataforma` imutável (mesmo gatilho da auditoria das barbearias), com IP; já registra entrar, configurar o segundo fator, recusas, sair e o que o comando do servidor faz; as próximas ações usam o mesmo `auditar`)

**Métricas do negócio**

- [x] Contas novas por dia, semana e mês; em teste, ativas, em atraso, bloqueadas e canceladas (feito: "Números do negócio" em `/admin`: novas hoje, em 7 dias e no mês, gráfico dos últimos 30 dias e contas por situação, calculada pela mesma regra da assinatura (`situacaoAssinatura`))
- [x] Receita recorrente do mês (MRR), por plano e por forma de cobrança; ticket médio; previsão do próximo mês (feito: MRR das contas que pagam (anual dividido por 12, com as unidades extras), por plano e automática × manual, ticket médio e a previsão: MRR + testes que terminam em 30 dias × conversão; `metricasDaPlataforma` em `packages/shared`, com teste)
- [x] Conversão do teste em assinatura, cancelamentos do mês (churn) e motivo informado; recorrência (contas que renovaram) (feito: conversão entre as contas cujo teste acabou; cancelamentos do mês ÷ pagantes no começo do mês, com os motivos (`conta.cancelada_em` e `motivo_cancelamento`, preenchidos pelo cancelamento da administração); contas com duas ou mais faturas pagas)
- [x] Uso por conta, para ver quem está em risco: comandas fechadas nos últimos 7 dias, último acesso, WhatsApp conectado ou não (feito: na lista de contas, com `plataforma_contas()`; o último acesso é a última renovação de sessão de alguém da conta)
- [x] Vendas por vendedor (contas criadas, ativadas e pagas) (feito: tabela em `/admin` para o admin; ativada = o dono criou a senha; paga = ao menos uma fatura paga; `vendasPorVendedor` com teste)

**Contas e cobrança**

- [x] Lista de contas com busca e filtros (plano, status, vencimento, vendedor); ficha da conta com dono, unidades, profissionais, plano, datas e histórico de cobrança (feito: busca por nome e filtros de plano, situação e vendedor (ou cadastro pelo site); a ficha traz quem paga, unidades, profissionais, plano, datas, cobranças e o histórico da administração)
- [x] Mudar plano, mensal ou anual, e a data de expiração (estender teste, dar cortesia), com motivo obrigatório; os limites do plano seguem valendo pela API (feito: na ficha, "Mudar plano" (com a cobrança automática do Asaas acompanhando o valor) e "Estender teste ou dar cortesia" (padrão 7 dias depois do fim atual), sempre com motivo; vale na hora (as travas de assinatura e de plano esquecem o que guardaram))
- [x] Criar conta pela venda presencial: dados da barbearia e do dono, plano e período; o dono recebe o convite por e-mail e WhatsApp para criar a senha e entra direto na configuração guiada (feito: "Nova venda" em `/admin` (admin e vendedor) cria a conta como o cadastro do site, com o dono sem senha, dias de teste (0 = já paga) e quem vendeu; e-mail "Sua conta está pronta" e o link do WhatsApp com a mensagem pronta para o vendedor mandar do celular; "Registrar pagamento agora" abre a ficha; ao aceitar o convite, o dono de conta ainda não configurada cai na configuração guiada (vale também para o cadastro pelo site))
- [x] Registrar pagamento manual: forma (Pix, dinheiro, cartão na maquininha, boleto, transferência), valor, data, período coberto, comprovante opcional e quem recebeu; o vencimento anda sozinho. Tabela `pagamento_assinatura` (manual ou Asaas, na mesma lista) (feito: na própria `fatura_assinatura` com `origem` manual, `recebido_por_id` e `comprovante`, na mesma lista das do Asaas; o período vai do início escolhido até um mês (ou um ano) depois (`fimDoPeriodo`) e a conta passa a ativa)
- [x] Como a conta é cobrada: Asaas automático ou manual pelo vendedor; a conta manual recebe aviso antes de vencer e entra no mesmo bloqueio suave (feito: conta sem assinatura no Asaas é manual; rotina diária às 9 h no worker cria a próxima cobrança em aberto 7 dias antes do fim do período pago (`proximaCobrancaManual`) e manda e-mail ao dono; vencida, a conta segue a mesma regra da automática (5 dias de atraso, depois só consulta); o pagamento registrado pela administração quita a cobrança em aberto)
- [x] Bloquear, desbloquear e cancelar conta (só leitura, nunca apaga dado), com motivo; exportar os dados para quem cancela (feito: bloquear = suspensa, cancelar grava quando e o motivo (entra nos cancelamentos do mês); bloqueada ou cancelada, a barbearia lê tudo e o dono exporta os dados pela própria conta, porque ler continua livre)

**Configurações do sistema**

- [x] E-mail: remetente, servidor de envio (SMTP) e um botão "mandar e-mail de teste"; a senha do SMTP fica cifrada e nunca volta para a tela (hoje vem do `.env`; o `.env` continua valendo como reserva) (feito: "E-mail (SMTP)" em Configurações; a senha vai cifrada com a PLATAFORMA_CHAVE, a tela só sabe se há senha, em branco mantém a guardada, e a auditoria registra só "trocada/mantida"; o worker lê pela função `configuracao_smtp()` (a cada minuto) e decifra com a mesma chave, que agora também precisa estar no ambiente dele; sem configuração ou sem conseguir decifrar, usa o SMTP do `.env`; "Mandar e-mail de teste" vai para quem está na administração e "Voltar ao SMTP do .env" desfaz)
- [x] Modelos de e-mail editáveis com variáveis e pré-visualização: boas-vindas e ativação da conta, convite da equipe, recuperação de senha, aviso de fim do teste, cobrança vencida, pagamento recebido (feito: "Modelos de e-mail" em Configurações, com as variáveis de cada um, pré-visualização ao vivo com dados de exemplo e "Voltar ao padrão"; a variável que o e-mail não tem é recusada; os textos padrão e a montagem ficam em `packages/shared/src/modelos-email.ts`; passaram a sair também o fim do teste (3 dias antes), a cobrança vencida (no dia seguinte) e o pagamento recebido (Asaas ou manual), além do aviso de vencimento da conta manual)
- [x] Planos e preços (Básico, Pro, Premium, mensal e anual, unidade extra) e cupons (como o do plano fundador), com vigência: mudar preço não altera quem já assinou (em parte: tabelas de preço com vigência em Configurações → "Planos e preços"; cada conta guarda a data da tabela que contratou (`conta.precos_desde`) e assinar, vender ou trocar de plano é contrato novo (tabela do dia); cobrança automática, cobrança manual, prévia da troca, métricas, site e cadastro usam a tabela certa (`tabelaVigente`).; cupons em Configurações → "Cupons" (código, desconto, prazo e vagas, ativar/desativar), aceitos no cadastro pelo site (campo ou link `?cupom=`) e na venda presencial; a conta grava o cupom e o desconto (`conta.cupom`, `conta.desconto_bp`), que vale em toda cobrança enquanto a assinatura existir; a aplicação confere o código pela função `cupom_para_cadastro()`, sem ler a lista)
- [x] Duração do teste grátis e textos do cadastro (termos, política de privacidade em vigor) (feito: `/admin` → Configurações → "Teste grátis e termos": dias de teste do cadastro pelo site e a versão dos termos cujo aceite o cadastro grava; tabela `configuracao_plataforma`, só a plataforma grava e a aplicação lê pela função `configuracao_do_sistema()`, que libera só as chaves públicas. Os textos dos termos e da política continuam nas páginas do site)
- [x] Aviso geral para todas as contas (manutenção programada, novidade), com data de início e fim (feito: "Aviso geral" em Configurações, com tipo, início e fim; faixa no topo do painel de todas as barbearias só enquanto vale (`GET /sistema/aviso`, `avisoVigente`); tirar o aviso é imediato)
- [x] Saúde do sistema: filas (e-mail, WhatsApp), conexões do WhatsApp caídas por conta, erros recentes (feito: aba "Saúde do sistema" em `/admin`: banco, as cinco filas (esperando, agendados, rodando, falhas), WhatsApp que caiu sem o dono pedir por conta e unidade (`plataforma_conexoes_caidas()`) e os trabalhos que falharam nas últimas 24 h, com o motivo; atualiza a cada 30 s)

- [x] **Pronto quando:** um vendedor cria uma conta na rua, registra o Pix na hora, o dono recebe o convite e entra; o admin vê a conta nova nas métricas, muda o plano com motivo e tudo fica na auditoria, sem nunca ver um dado de cliente da barbearia (conferido no teste e2e `pronto quando (etapa 15.1)` em `apps/api/test/admin.e2e-spec.ts`: o vendedor vende e registra o Pix, o dono recebe o convite, entra e cadastra um cliente; o admin vê a conta nas métricas e na lista, muda o plano com motivo, o histórico mostra quem fez cada ação e nenhuma resposta da administração traz o cliente da barbearia)

## Etapa 15.2 · Administração prática (pedido em 2026-11-08)

O painel da administração organizado por assunto, com o que fazer no dia e sem depender do servidor para o trabalho de rotina.

- [x] Abas por assunto (Início, Contas, Cobrança, Vendas, Equipe, Auditoria, Configurações, Saúde do sistema), com a aba no endereço (`/admin#cobranca`); vendedor vê Início, Contas e Cobrança só das contas dele; a ficha da conta e a "Nova venda" abrem de qualquer aba
- [x] Início com "Precisa de atenção": cobrança vencida (urgente com 5 dias, quando a conta já está só leitura), cobrança a vencer em 7 dias, teste acabando em até 3 dias sem pagamento, dono que não criou a senha há 2 dias, conta que entrou e não terminou a configuração, conta parada há 7 dias; cada item com a ação sugerida e "Abrir conta" (`pendenciasDaPlataforma` em `packages/shared/src/plataforma-gestao.ts`, com teste; `GET /admin/pendencias`)
- [x] Cobrança: vencido, a vencer em 7 dias e recebido no mês; lista para receber (dias de atraso, recusada) e recebidas em 60 dias, de todas as contas (`resumirCobrancas`, `GET /admin/cobrancas`)
- [x] Equipe da plataforma pela tela: dar acesso (senha temporária mostrada uma vez, com copiar; autenticador no 1º acesso), trocar papel, desativar e reativar (encerra as sessões na hora), redefinir senha e autenticador; ninguém mexe no próprio acesso; tudo na auditoria sem a senha (`/admin/equipe`). O `pnpm admin:criar` continua para o primeiro admin
- [x] Auditoria da plataforma para consulta: quem, ação, conta, motivo, IP e o que mudou (sem segredos), com filtros por pessoa, ação, conta e período (`GET /admin/auditoria`)
- [x] Contas: ordenar (mais novas, nome, teste acabando, sem acesso há mais tempo, mais comandas), contador do filtro e "Exportar planilha" (CSV que abre no Excel)
- [x] **Pronto quando:** o admin vê no Início o que cobrar e quem ligar, dá acesso a um vendedor e o desativa pela tela, e acha a ação na auditoria (conferido em `apps/web/e2e/admin.spec.ts` e em `administração prática (etapa 15.2)` de `apps/api/test/admin.e2e-spec.ts`)

## Etapa 15.3 · Automação dos avisos e bot com vários serviços (pedido em 2026-11-08)

A barbearia decide, em cada mudança, se o cliente fica sabendo; e o cliente monta o atendimento completo pela conversa.

- [x] Bot: depois de escolher um serviço, pergunta "Quer adicionar mais algum serviço?", com o que já está anotado (serviços, preço e duração somados) e os outros serviços numerados; 0 segue para o profissional e o horário; quando não sobra serviço para somar, segue direto ("1 e 3" de uma vez continua valendo) (passo `mais_servico` em `packages/db/src/agendar-bot.ts`; texto `textoMaisServico` em `packages/shared/src/agendar-bot.ts`, com teste)
- [x] Cancelar comanda com horário ainda por vir: caixa "Avisar o cliente pelo WhatsApp (com convite para marcar outro horário)", já marcada; "O cliente não veio" começa desmarcado antes do horário e marcado depois, e falta nunca avisa (`avisarCliente` em `cancelarSchema`; trabalho `horario_cancelado` na fila; o worker manda `textoHorarioCancelado` só se o horário continua cancelado e futuro, o cliente aceita mensagens, já falou com a unidade e o WhatsApp está conectado — `avisoHorarioCancelado` em `packages/db/src/mover.ts`)
- [x] Mover horário (arrastar ou "Mover"): a caixa "Avisar o cliente pelo WhatsApp do novo horário" aparece sempre, marcada quando muda o horário e desmarcada quando só troca o barbeiro; desmarcada, nada sai (a regra `deveAvisarClienteDoMovimento` já aceitava; agora a tela manda a escolha)
- [x] **Pronto quando:** um cliente marca corte + barba pelo bot escolhendo um de cada vez, e a recepção cancela um horário com "Avisar o cliente" marcado e o aviso entra na fila (conferido em `agendar-bot.db.test.ts`, `espera.e2e-spec.ts` → "avisar o cliente (etapa 15.3)", `operacao.spec.ts` e `mover.spec.ts`)

## Etapa 15.4 · Proteção do cadastro, limpeza de dados e status (pedido em 2026-11-08)

Meta fixa, antes da Etapa 24: o cadastro aberto pelo site não pode virar porta para contas de robô,
o banco não pode crescer sem limite e a página de status precisa mostrar algo útil.

**Cadastro protegido contra robôs**

- [x] Confirmação de e-mail: a conta criada pelo site entra no teste, mas só cria horários, convida a equipe e conecta o WhatsApp depois de confirmar o link enviado por e-mail (vale 48 h; dá para reenviar) (feito: `usuario.email_confirmado_em` nasce com `now()` — convite, venda e demonstração já confirmados — e o cadastro pelo site grava null; o botão do e-mail de boas-vindas é "Confirmar e-mail e começar" (`/confirmar-email?token=`, token `confirmar_email`); `EmailConfirmadoGuard` responde 403 `email_nao_confirmado` em `POST /agendamentos`, `POST /usuarios/convites` e `POST /bot/conexao/:unidadeId`; aviso no topo do painel com "Reenviar e-mail" (`POST /auth/reenviar-confirmacao`, modelo editável "Confirmação do e-mail"); aceitar convite ou redefinir a senha pelo link também confirma)
- [x] Campo isca invisível e tempo mínimo de preenchimento no cadastro (robô preenche tudo em menos de 2 s); recusa sem dizer o motivo (feito: campo `site` fora da tela e do teclado e carimbo `abertoEm`; menos de 2,5 s, mais de 24 h, sem carimbo ou isca preenchida = 400 `cadastro_recusado` com mensagem genérica; `pareceRobo` em `packages/shared/src/protecao-cadastro.ts`, com teste)
- [x] Limite de cadastros por IP (3 por hora, 10 por dia), além do limite por minuto que já existe; e-mail de domínio descartável recusado (feito: `LimiteCadastro` no Redis, 429 `muitos_cadastros`; limites e tempo mínimo em `CADASTRO_*` no `.env`, afrouxados nos testes; lista de domínios temporários em `DOMINIOS_DESCARTAVEIS`)
- [ ] Desafio anti-robô gratuito (Cloudflare Turnstile) no cadastro, ligado por variável de ambiente; sem a chave, o formulário segue com as outras proteções — **sob demanda** (2026-11-08): só se aparecerem muitas contas não confirmadas; as outras barreiras e a confirmação de e-mail bastam por ora
- [x] Conta não confirmada em 7 dias sai na rotina de limpeza (abaixo), com aviso por e-mail 2 dias antes (feito em 2026-11-08: `decidirLimpezaDaConta` em `packages/shared/src/limpeza.ts` — conta em teste, sem pagamento, com dono sem `email_confirmado_em`; aviso no 5º dia com o modelo editável "Conta sem confirmar o e-mail" e botão para entrar e reenviar o link)

**Exclusão automática de dados (90 dias)**

- [x] Política escrita na página de Privacidade e nos termos: o que sai e depois de quanto tempo (feito: seção "Por quanto tempo guardamos" em `/privacidade` com cada prazo e o que fica; termos com o teste vencido e a conta sem confirmar; versão dos termos 2026-11-08)
- [x] Conta cancelada, ou com o teste vencido sem nenhum pagamento, é apagada 90 dias depois (aviso por e-mail 15 e 3 dias antes; o dono exporta os dados até lá); a auditoria da plataforma guarda só que a conta existiu e quando saiu (feito: 90 dias depois de `cancelada_em` ou de `teste_ate`, avisos no modelo "Conta será apagada"; a conta sai inteira em cascata e `registrar_conta_apagada()` grava em `auditoria_plataforma` só o id, o nome e o motivo. **Conta com cobrança viva no Asaas fica retida** — assinatura do sistema ou do clube online ativa — e aparece na Saúde do sistema para cancelar lá antes; assim ninguém segue cobrado por uma conta que sumiu)
- [x] Em todas as contas: conversas do bot, sessões e tokens vencidos, avisos lidos e trabalhos antigos das filas saem depois de 90 dias; avaliações perdem o comentário (a nota fica para a média). Comandas, caixa e auditoria de contas ativas não saem (são histórico financeiro) (feito: `limparDadosDaConta` em `packages/db/src/limpeza.ts` — mensagens, sessões do bot paradas, tokens e links vencidos, links de horário, avisos lidos e comentários de avaliação; sessões da administração por `limpar_sessoes_plataforma()`; filas pelo `clean` do BullMQ)
- [x] Rotina diária no worker, em lotes pequenos (sem travar o banco), com o total apagado por tipo em Saúde do sistema (feito: fila `limpeza`, às 3h30 depois do backup, lotes de 500 por transação; cada execução em `execucao_limpeza` e na Saúde do sistema, com as 7 últimas lado a lado; uma conta com erro não para as outras. Teste em `packages/db/test/limpeza.db.test.ts`)
- [x] **Pronto quando:** um cadastro de robô é recusado, uma conta sem confirmar some no prazo e a Saúde do sistema mostra o que cada execução apagou (conferido nos testes e numa execução no banco local: 125 contas em 3 s)

**Status útil**

- [x] Monitores criados por script (`infra/status.sh`, na VPS, com o login do Uptime Kuma digitado na hora): site, API, painel do WhatsApp, backup do dia e disco/memória; as URLs dos monitores "push" vão sozinhas para o `.env` (feito em 2026-11-08: `infra/status.sh` roda `infra/status-kuma.mjs` num contêiner Node na rede do Compose, pela API de socket.io do Kuma; conferido contra um Kuma 1.23.16 local, com os monitores HTTP verdes contra a produção e o push respondendo. Rodado na VPS em 2026-11-09: página pública no ar com os 5 monitores verdes)
- [x] Página pública de status (`status.seudominio/status/pente-fino`) com os serviços agrupados e o histórico; o painel interno continua com login (feito: grupos Sistema e Servidor, criada pelo mesmo script)
- [x] Alerta por e-mail (o SMTP do Brevo) quando um monitor cair (feito: notificação SMTP padrão, aplicada a todos os monitores, com o e-mail informado na hora)

## Etapa 16 · Preparação da VPS

Um servidor Ubuntu 24.04 LTS seguro antes de receber qualquer dado.

- [x] Criar a VPS com a chave SSH da Etapa 0
- [ ] DNS: registros A de `app`, `api`, `wa`, `status` e `homolog` apontando para o IP da VPS
- [x] Usuário de trabalho, sem entrar como root:

```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

- [x] Em `/etc/ssh/sshd_config`: `PermitRootLogin no` e `PasswordAuthentication no`; depois `sudo systemctl restart ssh`
- [x] Atualizar e instalar proteções:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo timedatectl set-timezone America/Sao_Paulo
```

- [x] Atualizações de segurança automáticas (`sudo dpkg-reconfigure unattended-upgrades`)
- [x] Arquivo de swap de 2 GB
- [x] Docker Engine e plugin Compose; usuário `deploy` no grupo `docker`
- [x] Rotação de logs do Docker em `/etc/docker/daemon.json` (tamanho máximo por arquivo)
- [x] Atenção: o Docker ignora o UFW para portas publicadas. Banco, Redis e Evolution API **nunca** publicam porta; ficam só na rede interna do Compose
- [x] **Pronto quando:** login só por chave, root bloqueado, só portas 22, 80 e 443 abertas por fora

## Etapa 17 · Publicação com HTTPS

Tudo roda em containers na VPS, atrás do Caddy, que emite e renova o certificado HTTPS sozinho.

- [x] `infra/docker-compose.prod.yml` com: Caddy, web, api, worker, PostgreSQL, Redis e Evolution API, cada um com reinício automático e checagem de saúde
- [x] `infra/Caddyfile`: `app.` para o web, `api.` para a API, `wa.` para a Evolution API com acesso restrito (senha ou IP), cabeçalhos de segurança
- [x] `.env` de produção criado direto na VPS, com permissão `600`, senhas longas e diferentes das de desenvolvimento
- [x] Pasta `/opt/barbearia` com o compose, o Caddyfile e o `.env`
- [x] Primeira subida: `docker compose pull`, migrações do banco, `docker compose up -d`
- [ ] Conectar o WhatsApp da unidade-piloto pelo QR Code
- [x] Deploy automático: ao gerar as imagens, o GitHub Actions entra por SSH, baixa a nova tag, roda as migrações e reinicia os serviços
- [x] Rollback: voltar para a tag anterior com um comando documentado em `docs/`
- [ ] Ambiente de homologação no mesmo servidor (`homolog.`), com banco separado, para testar antes de produção
- [ ] **Pronto quando:** `https://app.seudominio` abre com cadeado, o login funciona e um merge na `main` chega ao ar sozinho

## Etapa 18 · Backup

Um backup que nunca foi restaurado não é backup. A restauração é testada antes do piloto e todo mês.

- [x] Script `infra/backup.sh`: `pg_dump` compactado do banco de produção
- [x] Envio para o armazenamento externo com rclone, criptografado (feito em 2026-11-09: `infra/backup-externo.sh` configura B2 ou R2 passo a passo, testa e liga `BACKUP_DESTINO`; o rclone roda em contêiner; envio por cópia (nunca apaga lá fora por falta local) com retenção de 35 dias para os diários e 400 para os mensais; `./restaurar.sh --teste --externo` baixa o mais recente e restaura. Ligado em produção em 2026-11-09 no Backblaze B2, bucket privado `pente-fino-backup`)
- [x] Cópia também do volume de sessões da Evolution API (evita escanear o QR de novo)
- [x] Agendado no cron da VPS todo dia de madrugada
- [x] Retenção: 30 diários e 12 mensais
- [ ] Snapshot semanal da VPS no painel do provedor
- [x] Restauração testada num banco vazio, com o passo a passo em `docs/restaurar.md`
- [x] **Pronto quando:** o banco é restaurado do zero a partir do armazenamento externo e o sistema volta a abrir (conferido em 2026-11-09: `./restaurar.sh --teste --externo` na VPS baixou o backup mais recente do B2 e restaurou num PostgreSQL descartável com contas, usuários, migrações, dono das tabelas e RLS forçado)

## Etapa 19 · Monitoramento

Saber do problema antes do cliente ligar, com ferramentas que rodam no próprio servidor.

- [ ] Uptime Kuma em `status.`: verifica `app`, `api/health` e a conexão do WhatsApp a cada minuto, avisa por e-mail ou Telegram
- [ ] Rastreamento de erros no front e na API (GlitchTip, que roda no próprio servidor, ou Sentry)
- [x] Alerta de disco acima de 80% e de memória alta
- [x] Alerta quando a sessão do WhatsApp cair (evento da Evolution API) (feito em 2026-11-08: quando o `connection.update` da Evolution — ou a consulta da tela Bot — mostra que a conexão caiu sozinha, `AlertaConexaoService` grava o aviso "WhatsApp da unidade desconectado" para dono e gestor (tipo `whatsapp_caiu`, desligável no Perfil para o celular), manda o push e o e-mail editável "WhatsApp desconectado" aos donos com o botão para a tela Bot; o mesmo `close` repetido não avisa de novo, e desconectar pelo painel não avisa. A administração já via as quedas na Saúde do sistema)
- [x] Alerta quando o backup do dia falhar
- [ ] Painel simples de uso: contas ativas, comandas por dia, erros por dia
- [ ] **Pronto quando:** derrubar a API de propósito gera um aviso em menos de 2 minutos

## Etapa 20 · E-mail transacional

Convites e recuperação de senha chegando na caixa de entrada, não no spam.

- [x] Escolher o serviço de envio e conferir o limite do plano gratuito
- [x] Domínio de envio configurado com SPF, DKIM e DMARC
- [x] Modelos de e-mail: convite, recuperar senha, boas-vindas, aviso de pagamento do plano
- [x] Em desenvolvimento, tudo cai no Mailpit
- [x] **Pronto quando:** convite enviado para Gmail e Outlook chega na caixa de entrada

## Etapa 21 · Segurança e LGPD

Dados de clientes e de dinheiro exigem cuidado desde o primeiro dia.

- [x] HTTPS em tudo; cookies seguros; CORS liberando só os domínios do sistema (feito: Caddy com HTTPS e HSTS em todos os endereços; cookies httpOnly, `Secure` atrás do HTTPS e SameSite; CORS da API só para o `APP_URL`)
- [x] Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options) no Caddy (feito: HSTS, nosniff e Referrer-Policy no Caddy; CSP do site em produção no `next.config.ts` (só recursos do próprio site, sem iframe de fora, `frame-ancestors 'none'`), X-Frame-Options DENY e Permissions-Policy)
- [x] Senhas com argon2; bloqueio temporário após tentativas erradas de login (feito: argon2id; 5 senhas erradas seguidas bloqueiam o e-mail por 15 minutos no login das barbearias e da administração (`apps/api/src/auth/bloqueio-login.ts`, no Redis), além do limite por minuto por IP + e-mail; acertar zera a contagem)
- [x] Revisão de permissões: cada rota com papel e unidade conferidos, incluindo as das Etapas 9 a 15 e o webhook do WhatsApp (feito em 2026-11-09: `apps/api/test/permissoes.e2e-spec.ts` lê todas as rotas da API — 228 — e exige que cada uma seja pública numa lista conhecida (27, cada uma com o motivo de não ter login: token, assinatura do webhook, limite), da administração com a `AdminGuard` (40) ou com `@Papeis`; as 6 que aceitam qualquer papel estão numa lista própria (dados da própria pessoa e da conta, sem cliente). Rota nova sem regra quebra o CI. Na prática, recepção, gestor e barbeiro da unidade A não abrem, fecham, cancelam nem movem comanda, agendamento e agenda da unidade B, nem veem desempenho e comissão de lá; o cliente é da conta inteira por desenho, mas a conversa da unidade B não aparece para a A. Nenhuma brecha encontrada)
- [x] Auditoria imutável de comandas fechadas, preços, comissões e despesas (feito: tabela `auditoria` com gatilho que recusa UPDATE, DELETE e TRUNCATE desde a migração `restricoes`; a da plataforma usa o mesmo gatilho)
- [x] Política de privacidade e termos de uso publicados e aceitos no cadastro (`/termos` e `/privacidade`; a versão aceita fica na auditoria da conta. Texto é rascunho: falta revisão jurídica e CNPJ)
- [x] Consentimento do cliente para receber mensagens de WhatsApp, com opção de sair (construído na Etapa 10; aqui, revisão do texto e do registro) (revisado em 2026-11-09: convite claro com RECEBER e SAIR a qualquer momento, escolha registrada com data em `cliente.consentimento_em`; automações e campanhas só para quem aceitou; apagar os dados do cliente também zera o consentimento)
- [x] Exportar e apagar os dados de um cliente quando ele pedir, incluindo mensagens do bot e comentários de avaliação (feito em 2026-11-09: na ficha do cliente, só o dono: "Baixar os dados" (`GET /clientes/:id/dados`, arquivo JSON com cadastro, anotações, horários, atendimentos, clube, avaliações e conversas de todas as unidades) e "Apagar os dados pessoais" (`POST /clientes/:id/anonimizar`, com motivo e o nome digitado para confirmar): saem nome, telefone, e-mail, aniversário, anotações, conversas, sessões do bot, lista de espera, links e comentários; comandas e caixa ficam com "Cliente removido (LGPD)"; recusa se houver horário futuro ou clube ativo; a auditoria guarda só o motivo e as contagens)
- [x] Prazo de guarda das conversas do bot e das avaliações definido na política de privacidade e aplicado por rotina (feito na Etapa 15.4: 90 dias para as conversas; avaliação perde o comentário e mantém a nota)
- [x] Telefone do cliente oculto para o barbeiro quando o dono ativar (Etapa 6.6; vale também na ficha do profissional e nas avaliações)
- [x] Contrato com a barbearia dizendo quem é responsável pelos dados (a barbearia controla, o sistema opera) (feito em 2026-11-09: seção "Dados dos clientes da barbearia" nos termos — controladora e operador, finalidade, fornecedores com acesso técnico (Hostinger, Backblaze, Brevo, Asaas), segurança, incidente comunicado em até 2 dias úteis, atendimento dos titulares pela ferramenta e fim do contrato; Privacidade cita os fornecedores. Versão dos termos 2026-11-09. Rascunho: falta a revisão jurídica)
- [x] Atualização mensal de dependências e da imagem da Evolution API (feito: Dependabot semanal para as bibliotecas, as ações do GitHub, as imagens do sistema e, desde 2026-11-09, as imagens do compose de produção — Evolution API, PostgreSQL, Redis, Caddy e Uptime Kuma; cada PR passa pelo CI)
- [ ] **Pronto quando:** a checklist acima está toda marcada e revisada por uma segunda pessoa

## Etapa 22 · Homologação e piloto

Uma barbearia real usa o sistema por um mês antes de qualquer venda.

- [ ] Rodar a suíte inteira em homologação com o seed de demonstração
- [ ] Importar a planilha da barbearia-piloto (serviços, preços, profissionais, clientes)
- [ ] Configuração guiada feita junto com o dono
- [ ] Treino de 30 minutos com a recepção e com os barbeiros; vídeo curto de cada fluxo (em parte: vídeo de apresentação de 1 minuto gravado do sistema por roteiro em `apps/web/video`, na home; falta um vídeo por fluxo para o treino, com o mesmo roteiro)
- [ ] Barbeiros instalam o PWA no celular e ligam as notificações
- [ ] WhatsApp da unidade conectado, menu do bot revisado com o dono e publicado; clientes avisados de que podem agendar pelo WhatsApp ou pelo link
- [ ] Pesquisa de avaliação ligada; o dono revisa as fichas dos barbeiros no fim de cada semana
- [ ] Primeira semana em paralelo com a planilha, conferindo o caixa todo dia
- [ ] Canal direto de suporte (grupo de WhatsApp) e registro de cada atrito
- [ ] Correções semanais publicadas em homologação e depois em produção
- [ ] **Pronto quando:** duas semanas seguidas sem divergência de caixa, 90% das comandas confirmadas pelo barbeiro e clientes agendando pelo WhatsApp e pelo site sem ajuda da recepção

## Etapa 23 · Lançamento comercial

O sistema passa a cobrar das barbearias e a receber clientes sozinho.

- [ ] Módulo de assinatura do sistema: planos Básico, Pro e Premium, mensal e anual, limites de unidades e profissionais aplicados pela API
- [ ] Teste grátis de 14 dias sem cartão; aviso 3 dias antes do fim (feito: teste sem cartão, `conta.teste_ate` e contagem em Configurações, em destaque nos 3 últimos dias; falta o e-mail de aviso e o bloqueio ao fim)
- [ ] Cobrança das barbearias pelo Asaas (assinatura recorrente), com bloqueio suave após atraso: o sistema vira só leitura, nunca apaga dados (feito na 10.1 em sandbox: assinatura, faturas, webhook, conferir e bloqueio. Falta para produção: chave e token de produção, cadastrar o webhook com o endereço público, cancelamento pela assinatura existente, e-mail de fatura e de recusa; a troca de plano saiu na Etapa 15)
- [x] Cupom do plano fundador: 30% para os 20 primeiros clientes (anunciado em `/planos`; aplicar junto com a cobrança no Asaas) (2026-11-09, depois da revisão com o dono do produto: virou **oferta de lançamento**, cupom `LANCAMENTO` — 30% para sempre (enquanto a assinatura estiver ativa) para quem assinar até 31/01/2027, com limite de 20 vagas por trás; o contador só aparece quando restam 5 ou menos (um contador cheio passava a ideia de que ninguém assinou) e o bloco some quando a oferta acaba; o `FUNDADOR` ficou desativado. Antes: o cupom `FUNDADOR` (30%, 20 vagas) nascia na migração `plano_fundador` e pode ser mudado em `/admin` → Cupons; a vaga só conta quando a conta paga (`cupom_para_cadastro()` e a lista da administração contam contas ativas), então teste que nunca paga não ocupa vaga; ao assinar, o cupom do cadastro é conferido de novo (vagas esgotadas = assina sem desconto) e quem se cadastrou sem cupom digita na tela de assinatura, que convida para o FUNDADOR enquanto houver vaga; `/planos` mostra quantas vagas restam e o botão leva o cupom para o cadastro; o desconto vale em toda cobrança do Asaas enquanto a assinatura existir)
- [x] Nota fiscal de serviço (NFS-e) das mensalidades do Pente Fino, emitida pelo Asaas (decidido em 2026-11-08: barbearia é serviço, então é NFS-e, não NF-e; com o padrão nacional da LC 214/2025 o Asaas cobre as prefeituras) (feito em 2026-11-08: `/admin` → Configurações → "Nota fiscal das mensalidades" confere os dados fiscais da conta no Asaas (`GET /fiscalInfo`), busca o serviço da prefeitura (`/fiscalInfo/services`) ou usa o código da LC 116, grava ISS, retenções e quando emitir (no pagamento ou no vencimento) na chave `nota_fiscal`; toda assinatura nova da barbearia já sai com a nota ligada (`POST /subscriptions/{id}/invoiceSettings`) e "Aplicar às assinaturas atuais" cobre as que existem, listando as que o Asaas recusar. Falta, do lado do dono do produto: preencher no painel do Asaas a inscrição municipal, o regime e o acesso à prefeitura, e conferir com o contador o código do serviço e o ISS antes de ligar)
- [ ] Página de vendas: frase "Saiba quanto sobra, não só quanto entrou", preços, comparativo, depoimento do piloto, botão de teste grátis (feito: `/` e `/planos` com preços mensal/anual, calculadora de unidades, comparativo com "em breve", perguntas, SEO e cadastro com plano escolhido; falta o depoimento real do piloto) Em 2026-11-08 a página ganhou telas reais do sistema (`apps/web/video/telas.mjs`), vídeo, calculadora de sobra por corte, comparativo e a seção de depoimentos (`componentes/site/depoimentos.tsx`), que só aparece com depoimentos reais autorizados; falta o depoimento do piloto.
- [ ] Central de ajuda com os vídeos do piloto e perguntas frequentes (conectar o WhatsApp, montar o menu do bot, ler a ficha do profissional) (em parte, 2026-11-09: tela Ajuda no menu de todos os papéis, com busca sem acento, 16 artigos passo a passo por categoria — cada papel vê os dele —, 11 perguntas frequentes e contato; conteúdo em `packages/shared/src/ajuda.ts`, com teste que confere links e telas. Tutorial "Primeiros passos" no Início para dono e gestor: 8 passos que se marcam sozinhos pelo que a barbearia fez (`GET /conta/primeiros-passos`), cada um com "Como fazer" e "Fazer agora". Falta: os vídeos curtos de cada fluxo, gravados no piloto)
- [x] Comparativo de `/planos` sem "em breve" nos recursos entregues nas Etapas 9 a 15 (feito em 2026-11-09: "Cobrança automática do clube" saiu do "em breve" e foi para o Pro, como a API já libera (clube online com cobrança pelo link, Pix e cartão); o cartão do Pro não diz mais "Clube e bot de WhatsApp (em breve)". Fica "em breve" só o Campeonato dos barbeiros, que ainda não existe)
- [ ] WhatsApp de suporte com horário definido
- [x] Termos de uso e política de privacidade com as condições dos planos e do cancelamento (rascunho para revisão jurídica)
- [ ] Exportação completa dos dados para quem cancelar
- [ ] Cancelar a conta pela administração também cancela a assinatura do sistema e as do clube online no Asaas (hoje a limpeza de dados retém a conta e avisa na Saúde do sistema até alguém cancelar no Asaas)
- [ ] **Pronto quando:** uma barbearia desconhecida se cadastra, testa, assina e paga sem falar com ninguém

## Etapa 23.1 · Crescimento e diferenciais (pedido em 2026-11-10)

Meta fixa: ser melhor que BestBarbers e Cash Barber nos quesitos que fazem a barbearia assinar e
ficar (comparativo em 2026-11-09: eles têm app próprio na loja, nota fiscal, totem e mentoria; nós
temos bot de WhatsApp, lucro real, comanda única e preço menor). Ordem de construção abaixo.

**Visão do dono**

- [x] **Painel do dia ("Hoje na barbearia")**: uma tela para o dono ver o que importa hoje sem trocar de aba — faturamento do dia e quanto falta para a meta do dia, agenda (atendidos, em atendimento, a seguir, faltas), comandas esperando confirmação ou fechamento, caixa (aberto, fechado, diferença), clientes novos e aniversariantes, avaliações baixas, WhatsApp (conectado, conversas esperando atendente), avisos e atalhos para agir; por unidade ou a rede inteira. Vira a tela inicial do dono e do gestor; o Início do mês continua para a visão do mês (feito em 2026-11-10: bloco "Hoje" no topo do Início — entrou hoje e quanto ainda vai entrar, atendidos de marcados, agenda ocupada, quanto precisa entrar por dia de trabalho para a meta do mês (`porDiaParaMeta`), "Precisa de você agora" em ordem de urgência com o link de cada tela (`pendenciasDoDia`: WhatsApp caído, cliente esperando atendente, caixa com diferença ou não aberto depois do meio-dia, notas baixas, comandas a confirmar e a fechar, faltas, clientes novos e aniversariantes) e os próximos horários; "Ver o dia completo" leva ao Resumo do dia. O mês continua logo abaixo)
- [x] **Relatório do mês, comparado mês a mês**: faturamento, lucro, atendimentos, ticket médio, clientes novos, retorno de clientes (voltaram em até 45 dias), faltas, ocupação, nota média, agendamentos por canal (WhatsApp, link, balcão) — cada um com o mês anterior, a variação em % e seta; bloco "O que melhorou" e "O que piorou" escrito em frases; gráfico dos últimos 12 meses; escolhe o mês e a unidade; exporta em PDF e planilha (em parte, 2026-11-10: tela "Relatório do mês" no menu de dono e gestor, com `GET /relatorio/mes` — faturamento, lucro, atendimentos, clientes, ticket, extras, clientes novos, retorno, faltas e nota, cada um com o mês anterior, a variação e se melhorou (a direção de cada indicador: falta menor é melhor); "O que melhorou" e "O que piorou" em frases (`frasesDoMes`); faturamento dos 12 meses com dica e tabela acessível; canais; no mês corrente, compara com os mesmos dias do mês anterior. Completado em 2026-11-11: "Agenda ocupada" (minutos marcados ÷ disponíveis da unidade ou da rede, a mesma conta da tela de ocupação, `DesempenhoService.ocupacaoDoPeriodo`) entre os indicadores comparados; `GET /relatorio/mes/arquivo?formato=pdf|csv` com o mesmo conteúdo da tela, montado uma vez em `relatorioEmArquivo` (packages/shared) — a planilha em CSV com ";" e BOM para o Excel, protegida contra fórmula, e o PDF em A4 com quebra de linha, cabeçalho repetido na quebra de página e numeração)
- [x] **Barbeiros: quanto custa e quanto dá de lucro**: por barbeiro no mês — faturamento, comissão (o custo dele) e, se houver, valor fixo/salário cadastrado; lucro que ele gera (receita − custo de produto − comissão − fixo); atendimentos, ticket, % de extras, retorno dos clientes dele, nota média, faltas; pontos fortes e fracos comparando com a média da equipe (em frases: "ticket 18% acima da média", "pouco extra"); serviços que ele mais faz (feito em 2026-11-10: no relatório, cada barbeiro com faturamento e variação, comissão, valor fixo (novo campo `profissional.custo_fixo_mensal`, editado em Equipe → "Mudar valor fixo", visível só para a gestão), quanto custa no mês, lucro que gera, atendimentos, ticket, extras, retorno, nota, faltas, serviços que mais faz e pontos fortes e fracos contra a média da equipe (`pontosDoBarbeiro`))
- [x] **Mix de serviços e produtos**: participação de cada serviço e produto no faturamento, na quantidade e no lucro (%), com a variação contra o mês anterior; serviços mais feitos e os que dão menos margem (feito em 2026-11-10: no relatório, cada serviço e produto com quantidade, % da quantidade, receita, % da receita, variação contra o mês anterior e lucro (com lucro real no plano) — `mixDoMes`)
- [ ] **Raio-X semanal no WhatsApp do dono**: toda segunda, uma mensagem curta com quanto sobrou na semana, o serviço que mais deu lucro, onde vazou (faltas, desconto, extra baixo) e o barbeiro destaque, com o link do relatório; liga e desliga no Perfil

- [x] **Sem páginas repetidas: Resultados do mês** (pedido em 2026-11-11: "não quero páginas que fazem a mesma coisa"): Métricas e metas, Relatório do mês e Painel da rede viraram uma página só, `/resultados`, em abas — Visão geral (metas com edição, projeção, o mês em números contra o anterior, o que melhorou e piorou, 12 meses, unidades lado a lado com 2+ unidades, o mês dia a dia), Barbeiros (custo, lucro, ocupação, confirmação no prazo, pontos fortes e fracos, ordenação e link para a ficha; o ranking da Equipe saiu), Serviços e produtos (uma tabela de cada, juntando o peso no faturamento com custo, comissão, lucro, margem e situação), Canais (uma tabela) e Agenda e avaliações (mapa hora a hora do mês escolhido, não mais "últimas 4 semanas"). Uma só base de comparação no sistema inteiro (`periodoAnterior`: mês corrente contra os mesmos dias do anterior; antes o Início comparava com "os 30 dias antes"). Início ficou com o dia e o resumo do mês; Resumo do dia, só o dia (`/dia?dia=`); Equipe, só cadastro; o barbeiro vê as metas no Hoje. `/metricas`, `/relatorio`, `/rede` e `/metas` redirecionam. Barbeiros no relatório e no arquivo seguem o plano (`fichaProfissional`, Pro). Corrigida a variação com base negativa (lucro de −10 mil para −13 mil aparecia "+29%")

- [ ] **Relatório do mês chegando sozinho** (sugestão aprovada em 2026-11-11): no dia 1º, o PDF do mês anterior vai para o WhatsApp do dono (e por e-mail, se ele preferir), com 3 frases do que melhorou e piorou; liga e desliga no Perfil; respeita o plano (barbeiros só no Pro)
- [ ] **Unidades lado a lado também no PDF e na planilha** (sugestão aprovada em 2026-11-11): com a rede inteira e 2+ unidades, o arquivo do relatório traz a mesma tabela da tela (faturamento, lucro, ticket, ocupação, nota e retorno por unidade, com a melhor marcada)
- [ ] **Convite de retorno na unidade do cliente** (sugestão aprovada em 2026-11-11): a mensagem "faz tempo que você não vem" sai pelo WhatsApp da unidade onde o cliente mais foi, com o link de agendamento já dessa unidade

**Vitrine e agendamento**

- [ ] **Página da barbearia** (`/b/<slug>`, "bom para pôr no Instagram"): nome, logo, endereço e horário de cada unidade, serviços com preço, equipe, clube com os planos e o botão "Agendar"; com mais de uma unidade, o cliente escolhe a unidade e cai no agendamento dela; QR code para imprimir no balcão; prévia bonita no WhatsApp e no Instagram
- [x] **Trocar a unidade no agendamento** (pedido em 2026-11-11): no link de agendamento (`/agendar?u=<slug>`), quando a barbearia tem mais de uma unidade ativa com agendamento online ligado, aparece "Unidade: X · Trocar" no topo com nome, endereço e horário de cada uma; ao trocar, mantém o que o cliente já escolheu quando existe na outra unidade (serviço com o mesmo nome, barbeiro que atende nas duas) e avisa o que caiu ou mudou de preço; os horários e preços passam a ser os da unidade nova. Com uma unidade só, nada muda na tela. A API lista as unidades irmãs pelo slug sem expor `conta_id`, e o agendamento grava na unidade escolhida (feito em 2026-11-11: `outrasUnidades` em `GET /publico/agendamento/:slug` — só slug, nome e endereço das unidades ativas com link ligado; "Unidade: X · Trocar" no topo do link; a unidade nova é carregada antes de mudar o endereço, então o formulário não some; `trocarDeUnidade` mantém os serviços que ela faz e `avisoDaTroca` diz o que saiu, o preço que mudou e que o barbeiro é outro; nome e telefone continuam, inclusive os que vieram do link do bot, cujo código vale só na unidade de origem) Ajuste do dono em 2026-11-11: unidades costumam ficar em cidades diferentes e o cliente não deve ter de decidir — quem chega pela conversa do WhatsApp da unidade (link com código do bot) não vê a troca; para os demais, é só um link discreto "Agendar em outra unidade" abaixo do endereço
- [ ] **Personalizar a página da barbearia** (Configurações → "Página da barbearia", só o dono): logo, cor principal e de destaque (com conferência de contraste para continuar legível), tema claro ou escuro, foto de capa, texto de apresentação, redes sociais (Instagram, WhatsApp), quais seções aparecem (equipe, preços, clube) e a ordem dos serviços; prévia ao vivo antes de publicar; o link de agendamento e o "app da barbearia" usam o mesmo visual
  - **Seção 7 do a-fazer (13/11):** três rodadas de modelos no canvas "Página da barbearia: modelos"; o dono aprovou o site com quatro páginas (Início, Serviços, Equipe, Contato) no tema Tradicional, montado por blocos num painel parecido com o da Nuvemshop. O agendamento fica só nos botões; a página já nasce montada com textos sugeridos; os temas Clube, Letreiro e Estúdio vêm depois, um por PR, com os mesmos blocos e dados
  - [x] **Lote 7a** (13/11) site no tema Tradicional:
    - regras em `packages/shared/src/site-barbearia.ts`, com teste: `siteBarbeariaSchema` (tema, cor de uma lista fechada com contraste conferido, fonte, botões, slogan, Instagram, blocos de cada página e o texto de cada barbeiro), `siteInicial` (página sugerida, sem número inventado: nota, preço e horário vêm do sistema, depoimentos começam escondidos), `horarioDaUnidade` ("Terça a sexta, 9h às 20h", pelo expediente da equipe), `notaDoSite` (só com 5 avaliações ou mais) e os links do mapa e do WhatsApp;
    - `unidade.site_rascunho`, `site_publicado` e `site_publicado_em` (migração `site_barbearia`);
    - API: `GET/PUT /unidades/:id/site` (rascunho), `GET /unidades/:id/site/previa`, `POST /unidades/:id/site/publicar` (exige o link de agendamento ligado), `DELETE /unidades/:id/site/publicado` (tira do ar, o rascunho fica), dono e gestor; público `GET /publico/site/:slug` (404 sem site publicado);
    - web: `/b/<slug>` mostra o Início quando há site publicado e a página de agendamento quando não há (o link que já está no Instagram não muda); `/b/<slug>/servicos`, `/equipe` e `/contato`; o agendamento também em `/b/<slug>/agendar`; o link do bot (`?c=`) sempre abre o agendamento. Componentes em `componentes/site-barbearia` (sem estado, servem à prévia do painel), fontes por `next/font` (o navegador baixa só a usada), uma animação de entrada só, que respeita "reduzir movimento"; menu do celular sem JavaScript (`details`). Cache do site de um minuto com a etiqueta `site-<slug>`;
    - sem fotos até o lote 7c: o banner usa o monograma da barbearia e a equipe, a inicial de cada barbeiro;
    - testes: `site-barbearia.e2e-spec.ts` (API) e `e2e/site-barbearia.spec.ts` (navegador)
    - correção achada na bateria: `GET /publico/agendamento/:slug` buscava o preço próprio barbeiro a barbeiro e serviço a serviço; com muitos barbeiros passava dos 5 s da transação e dava 500 quando várias visitas chegavam juntas. Agora `precosPropriosVigentes` traz todos numa consulta (de 1,5 s para 0,33 s no banco de teste)
  - [x] **Lote 7b** (13/11) painel "Minha página" (`/pagina`, menu Cadastros, dono e gestor):
    - operações no shared, com teste: `moverBloco`, `editarBloco`, `removerBloco`, `blocosParaAdicionar` e `adicionarBloco` (volta com o texto sugerido, antes da faixa de agendar; um bloco de cada tipo por página);
    - tela `componentes/telas/minha-pagina.tsx`: escolhe a página, abas Blocos (setas para subir e descer, olho para esconder, campos de título, texto, itens de depoimentos e perguntas, especialidade e apresentação de cada barbeiro, "Tirar bloco da página" e "Pôr de volta") e Tema (cor, fonte, botões, frase do rodapé, Instagram); prévia com o mesmo componente do site público, no computador e numa moldura de celular (o tema passou a usar consultas de contêiner, `@container`, no lugar dos pontos de quebra da tela); links da prévia trocam a página editada;
    - rascunho salvo sozinho 0,9 s depois da última mudança, validado pelo mesmo esquema da API; "Publicar" salva, publica e chama a ação de servidor `renovarSite` (`updateTag('site-<slug>')`), então o cliente vê na hora; "Tirar do ar" com confirmação;
    - sem o link de agendamento ligado, a tela monta a página e explica onde ligar para publicar;
    - teste `e2e/minha-pagina.spec.ts`
  - [x] **Lote 7c** (13/11) fotos:
    - shared: `fotoIdSchema`, `foto` opcional no bloco (banner e sobre), no item (galeria) e no barbeiro, `logo` opcional (o rascunho antigo continua valendo), bloco novo `galeria` (começa escondido e vazio), `fotosDoSite`, `urlDaFoto`, `NOME_ARQUIVO_FOTO`, `envioFotoSchema` (base64, até 700 KB), com teste;
    - tabela `foto_site` (conta, unidade, medidas e bytes; RLS) e migração `foto_site`;
    - API: `POST /unidades/:id/site/fotos` refaz a imagem com `sharp` (gira pela orientação, sem metadados, WebP de 640 e 1600 px) e grava em `FOTOS_DIR`; até 300 fotos por unidade; o `PUT` do site só aceita foto da própria conta; a prévia e o site público trazem as medidas (`fotos`); `GET /publico/fotos/:arquivo` com cache de um ano; corpo JSON até 1 MB (antes, 100 KB);
    - web: `/f/<arquivo>` entrega a foto; o tema usa `srcset`, largura e altura; véu escuro no banner para a leitura; `CampoFoto` no painel reduz a imagem no navegador (até 1600 px, WebP ou JPEG) antes de enviar;
    - produção: volume `fotos_site` em `/dados/fotos`, pasta com dono `node` na imagem da API, `backup.sh` e `restaurar.sh` com o volume (docs/producao.md e docs/restaurar.md);
    - falta depois: apagar do disco as fotos que saíram do site
  - [x] **Lote 7d** (13/11) site e agendamento em endereços separados (bug achado pelo dono: trocar o link mudava o site e o "Início" caía em "página de agendamento não encontrada"):
    - `unidade.site_slug` (único, mesmo formato do link) e política `publico_por_site_slug` (só com o site publicado); `GET /publico/site/:slug` procura pelo endereço do site e traz `slugAgendamento` para os botões;
    - tabela `endereco_antigo` (agendamento ou site, isolada por conta, com política pública por "tipo:slug"): ao trocar o link (`PATCH /unidades/:id`) ou o endereço do site (`PUT /unidades/:id/site/endereco`, 409 se for de outra barbearia, conferido por `site_slug_em_uso()`), o antigo fica guardado e `GET /publico/endereco-antigo/:tipo/:slug` devolve o atual; voltar a um endereço antigo o tira da lista;
    - publicar sem endereço de site usa a sugestão (o do link ou o nome da barbearia), com `-2`, `-3`... se já existir;
    - web: site em `/s/<endereço>` e `/s/<endereço>/servicos|equipe|contato`; `/b/<link>` é sempre o agendamento; endereço antigo leva ao novo com 308, mantendo a query (o `?c=` do bot); `/b/<link>/agendar` leva ao `/b/<link>`;
    - painel: bloco "Endereços" com o do site (editável, com sugestão) e o do link (só leitura, com o caminho para Configurações), botões de copiar; o link é lido sempre da consulta, então trocar em Configurações aparece na hora;
    - testes: cenário do bug em `site-barbearia.e2e-spec.ts` e `e2e/site-barbearia.spec.ts`
  - [x] **Lote 7e** (13/11) domínio próprio:
    - shared: `normalizarDominio` (tira protocolo, caminho, porta e "www."), `dominioSchema`, `DominioPublico`, campos `dominio`, `dominioVerificado` e `dominioIps` no `SitePainel`, com teste;
    - banco: `unidade.dominio` (único, minúsculo, sem www) e `dominio_verificado_em`; política `publico_por_dominio` (só conferido e com site publicado); `dominio_em_uso()`;
    - API: `PUT/DELETE /unidades/:id/site/dominio` e `POST /unidades/:id/site/dominio/verificar` (DNS: o A do domínio ou do www bate com os IPs de `DOMINIO_ALVO`, ou o www é CNAME para ele; recusa o domínio do próprio Pente Fino e o de outra barbearia); públicas `GET /publico/dominio/:host` (os dois endereços da unidade) e `GET /publico/dominio-liberado?domain=` (pergunta do Caddy); `DOMINIO_VERIFICACAO=falso` nos testes (só ".teste");
    - web: `lib/dominio-proprio.ts` (`ehHostDoPenteFino`, `rotaNoDominio`, com teste); o proxy reescreve os pedidos do domínio (raiz e páginas para `/s/<endereço>`, `/agendar` para `/b/<link>`, arquivos e `/api` passam, o resto vai ao endereço principal), com cache de um minuto por domínio; no domínio, os links do site ficam limpos;
    - painel: bloco "Domínio próprio" com o passo a passo do DNS (registro A e CNAME do www), "Conferir agora" e "Tirar domínio";
    - Caddy: `on_demand_tls` com `ask` na API e blocos `https://` e `http://` para os domínios das barbearias (docs/producao.md);
    - fica para depois: domínio só no Premium ou como extra pago, se o dono quiser
  - [x] **Lote 7f** (13/11) site mais moderno e com movimento (pedido do dono: "está muito padrão"): classes `site-*` em `globals.css`, só CSS: `site-entrada` (banner e título da página em etapas, o título revelado por máscara), `site-zoom` (foto do banner), `site-parallax` e `site-revelar` (linha do tempo da rolagem, `animation-timeline: view()`, com `@supports`), `site-cabecalho` (cabeçalho fixo que fica translúcido com desfoque, `scroll(nearest)`, então funciona também na prévia do painel), `site-cartao`, `site-foto-cor`, `site-foto-zoom` e `site-botao` (brilho); faixa de serviços e preços correndo embaixo do banner (`FaixaServicos`), com pausa no mouse, no foco e num botão "Pausar" (WCAG 2.2.2); "reduzir movimento" desliga tudo
  - [x] **Editar os dados do cliente** (13/11, pedido do dono: o cliente do bot não tinha como receber o aniversário): `EditarCliente` na ficha (`telas/clientes.tsx`), com o `PATCH /clientes/:id` que já existia; telefone oculto para o barbeiro não aparece nem é enviado; teste `e2e/cliente-editar.spec.ts`
  - [x] **Site sem o link de agendamento** (13/11, pedido do dono: a barbearia pode não querer agendamento pelo site nem o link no WhatsApp): `POST /unidades/:id/site/publicar` não exige mais o link ligado; `slugAgendamento` (site e domínio) vem vazio com o link desligado; no tema, `AcaoPrincipal` mostra "Agendar horário" ou, sem link, "Falar no WhatsApp" (ou nada sem telefone), e os "Agendar" de serviço e barbeiro somem; no domínio próprio, `/agendar` só existe com o link ligado; o painel explica em vez de bloquear
  - [x] **Horário de funcionamento da unidade** (13/11, pedido do dono):
    - shared `horario-funcionamento.ts`, com teste: `horarioFuncionamentoSchema` (até dois turnos por dia, sem sobrepor), `lerFuncionamento`, `diasQueAbre`, `limitarAoFuncionamento` (expediente do barbeiro dentro do horário da unidade), `linhasDoFuncionamento` ("9h às 12h e 13h às 20h") e `fechamentoDoDia` (para os avisos de resumo do item 9);
    - `unidade.horario_funcionamento` (JSON, vazio = sem limite); `expedienteDoProfissional` aplica o limite, então valem o link, o bot e o balcão;
    - API `GET/PUT /unidades/:id/funcionamento` (dono e gestor; gravar também acerta os dias de trabalho); o site usa o horário da unidade quando há;
    - tela `componentes/horario-funcionamento.tsx` em Configurações, Unidades;
    - testes `funcionamento.e2e-spec.ts` e `e2e/horario-funcionamento.spec.ts`
  - **Pedido do dono em 2026-11-11:** a página tem de ser bonita e atrativa, no nível de uma landing page profissional (montada com uma skill de design de páginas). O barbeiro edita tudo pelo painel, sem ajuda: textos, fotos, seções e a ordem delas, cores, fonte e o estilo (modelos prontos para escolher e ajustar), com a prévia ao vivo antes de publicar. A página do Pente Fino (`/b/<slug>`), o link de agendamento e o "app da barbearia" seguem esse mesmo visual
- [ ] **Domínio próprio** (ex.: `agendar.barbeariadojoao.com.br`): o dono informa o domínio, o sistema mostra o registro CNAME para apontar para o Pente Fino e confere sozinho; o Caddy emite o certificado na hora (on-demand TLS, liberado só para domínios cadastrados e conferidos); vale para a página, o agendamento e o app; Premium, ou extra nos outros planos
- [ ] **"App da barbearia" sem loja**: a página da barbearia instala no celular do cliente com o nome e a logo da barbearia (não do Pente Fino) e abre direto em "Agendar" e "Meus horários" — a resposta ao "app próprio" dos concorrentes, sem esperar loja nem pagar mais
- [ ] **Agendar pelo Google**: passo a passo para pôr o link de agendamento no perfil do Google (botão "Agendar" no Maps); integração oficial "Reserve with Google" só depois (exige parceria com o Google)

**Retenção e receita**

- [ ] **Clube que não perde assinante**: aviso ao cliente e à barbearia quando o cartão é recusado, nova tentativa e link de pagamento pelo WhatsApp; previsão de receita do clube no mês; lista de assinantes em risco (não vem há muito tempo, cobrança atrasada); planos semanais e quinzenais
- [ ] **Migração assistida**: importar clientes, serviços e equipe exportados de outros sistemas (planilhas do BestBarbers, Cash Barber, Trinks, AppBarber) com o mapeamento de colunas automático e a conferência antes de gravar
- [ ] **Pronto quando:** o dono abre o sistema e entende o dia numa tela, compara o mês com o anterior sem calcular nada, sabe quanto cada barbeiro custa e rende, e a barbearia tem uma página própria que o cliente usa para agendar pelo Instagram

## Etapa 23.2 · Site que vende (briefing de 2026-11-10)

Fonte: [pente-fino-melhorias.md](pente-fino-melhorias.md), parte 3 (auditoria do site em 10/11/2026,
com comparação com AppBarber, Trinks, Booksy, ZapCorte e EiBarber). Itens [DECISÃO DO DONO] usam a
opção padrão do briefing, numa constante fácil de trocar.

**1ª e 2ª prioridade (feito em 2026-11-11)**

- [x] **B1** 404 de verdade: só as telas do sistema (`lib/rotas.ts`, conferida contra as pastas por teste) mandam para o login; o resto responde 404 com `app/not-found.tsx` (noindex do próprio Next)
- [x] **B2** /planos não diz mais que o bot está "em construção"
- [x] **B3** cupom do link conferido ao abrir o cadastro: preço cheio riscado, preço com desconto e "30% de desconto para sempre aplicado (LANCAMENTO)"; cupom inválido avisa; a oferta vencida some em silêncio
- [x] **B4** JSON-LD com `AggregateOffer` (R$ 66,90 a R$ 249,90) e cada plano com mensal e anual, da mesma tabela da página (`ofertasJsonLd`)
- [x] **B5** vídeo: já havia MP4 (H.264, faststart) de reserva; o WebM declara `codecs="vp9"` para o Safari antigo ir direto ao MP4
- [x] **B6** "economize até R$ 504/ano" calculado (`textoEconomiaAnual`) no lugar de "2 meses grátis"
- [x] **B7** "Planos" no topo também no celular (a marca mostra só o ícone em tela estreita)
- [x] **B8** WhatsApp opcional no cadastro, com máscara, gravado no usuário dono (`usuario.telefone`, sem migração); política de privacidade atualizada (versão 2026-11-11)
- [x] **P1** `SeloPlano` ("Pro e Premium" / "Premium") em cada promessa parcial da home e do cadastro, lido de `RECURSOS` — a mesma regra que libera o recurso na API
- [x] **P2** [DECISÃO DO DONO] `LUCRO_POR_SERVICO_NO_PRO = false` (opção B: lucro por serviço só no Premium e a home diz isso). Trocar para `true` libera no Pro o produto, a tabela de /planos e os selos de uma vez
- [x] **C1** faixa da oferta no topo do site (fechável), oferta repetida acima dos preços da home e botões levando o cupom; tudo some depois de 31/01/2027 ou sem vagas
- [x] **C2/C3** estrutura do WhatsApp flutuante e do rodapé com razão social, CNPJ, cidade e redes em `lib/contato.ts`; nada aparece enquanto vazio. **Falta o dono passar os dados reais**
- [x] **C4** depoimentos só com 2 ou mais reais (`DEPOIMENTOS`); **falta o dono trazer depoimentos autorizados**
- [x] **C5** "Configuração guiada · atende no mesmo dia · importamos sua planilha" perto dos botões; `DIAS_TESTE` continua a fonte única
- [x] **C6** "Ver em 1 minuto" rola até o vídeo e dá o play; chamada de teste no fim dos recursos e da calculadora
- [x] **C7** calculadora aceita "1.234,56" e leva ao cadastro com `origem=calculadora`
- [x] **D3** ✓/✗ da tabela comparativa com texto para leitor de tela e legenda "em parte" com o ícone
- [x] **D5** cadastro com campos obrigatórios marcados (`aria-required`), erros ligados ao campo e "Mostrar senha"
- [x] **D6** "Ver em 1 minuto" e "14 dias grátis, sem cartão" padronizados; bot sempre "Pro e Premium"

**3ª e 4ª prioridade (próximos PRs)**

- [ ] **P3** [DECISÃO DO DONO] Básico mais competitivo (preço menor ou bot no Básico)
- [x] **S1** sitemap com as páginas públicas e as das barbearias que ligaram "Aparecer no Google" (painel P4). As páginas novas da seção N entram quando existirem
- [x] **S2** título, descrição e canonical em todas as páginas do site e do cadastro; Open Graph pela imagem do site e, na página da barbearia, pela imagem dela (P1)
- [x] **S3** BreadcrumbList em Planos, Termos e Privacidade (`TrilhaGoogle`, `trilhaJsonLd`); FAQPage e ofertas já existiam; Article fica para o blog (N4)
- [ ] **S4** links internos no rodapé: entram com as páginas da seção N
- [x] **S5** `www` e `app.` → raiz com 301 no Caddy (desde 2026-11-07); `http` → `https` pelo próprio Caddy
- [x] **S6** robots só com `Allow: /` e os `Disallow` (app, API, convite, redefinir senha, `/agendar` que redireciona e o link pessoal `/horario`); `/b/` decide pela própria página
- [x] **T1** conversão só no sucesso do cadastro, com `value` (o preço por mês do plano com o cupom) e `currency` BRL, em `cadastro_concluido` (o que o GTM já usa) e em `sign_up`. **Dono:** conferir no Tag Assistant e marcar o valor na conversão do Google Ads
- [x] **T2** gclid, gbraid, wbraid e utm_* (e o domínio de origem) guardados ao chegar: com o aceite, cookie próprio `pf_origem` por 90 dias; sem, só na visita (`lib/origem.ts`, `origemDaVisita`); enviados no cadastro e gravados em `conta.origem` (só os campos conhecidos, `origemCadastroSchema`). A ficha da administração mostra a origem (admin F2, em parte: Contas, Vendas e Início ficam com U2 e U5). Política de privacidade atualizada
- [x] **T3** eventos do funil: `view_planos`, `toggle_ciclo`, `click_cta` (com a posição: topo, rodapé ou a seção; um ouvinte só para toda chamada ao cadastro), `begin_sign_up`; `play_video`, `use_calculadora` e `click_whatsapp` já existiam. **T4** consentimento já existia (Consent Mode v2)
- [x] **N1** páginas por intenção de busca (feito em 2026-11-12):
  - sete rotas em `app/(site)/<termo>/page.tsx`, com o texto em `src/conteudo/paginas-busca.ts`, desenhadas por `componentes/site/pagina-busca.tsx`;
  - cada página tem H1 com o termo, resposta direta, telas, "Quanto custa" com o preço de `precoPorMes`, perguntas com `FAQPage`, trilha, canonical, OG e "Veja também";
  - o selo do plano sai de `RECURSOS`;
  - as páginas entram no sitemap e no rodapé "Recursos";
  - teste N1 em `apps/web/e2e/site.spec.ts`.
- [x] **N2** comparativos (feito em 2026-11-12):
  - rotas `/comparativo/appbarber`, `/comparativo/trinks`, `/comparativo/booksy` e `/melhor-sistema-para-barbearia`;
  - dados em `src/conteudo/comparativos.ts`, com `CONFERIDO_EM` e o link oficial de cada um;
  - o Trinks fica sem preço porque a página dele não diz qual coluna é o mensal e mostra uma promoção;
  - os preços do Pente Fino saem de `precoPorMes` e `LIMITES_PLANO`;
  - páginas desenhadas por `componentes/site/pagina-comparativo.tsx`;
  - teste N2 em `apps/web/e2e/site.spec.ts`.
- [x] **N3** calculadoras em URL própria (feito em 2026-11-12):
  - contas em `packages/shared/src/calculadoras.ts` (`sobraDoCorte`, `comissaoDoBarbeiro`, `precoMinimoDoCorte`), com teste;
  - a calculadora da home passou a usar `sobraDoCorte`;
  - rotas `/calculadora/lucro-por-corte`, `/calculadora/comissao-de-barbeiro` e `/calculadora/preco-do-corte`, desenhadas por `componentes/site/pagina-calculadora.tsx`;
  - entram no sitemap e no rodapé;
  - teste N3 em `apps/web/e2e/site.spec.ts`.
- [x] **N4** blog (feito em 2026-11-12):
  - posts em `src/conteudo/blog.ts`; post sem `publicadoEm` é rascunho;
  - cada post publicado tem a própria pasta em `app/(site)/blog/<slug>/`, para que um endereço inexistente responda 404;
  - lista e post desenhados por `componentes/site/pagina-blog.tsx`, com `Article` e trilha no JSON-LD, tempo de leitura e chamada no meio e no fim;
  - um post publicado e cinco rascunhos;
  - sitemap e rodapé;
  - teste N4 em `apps/web/e2e/site.spec.ts`.
- [ ] **N5** Sobre/Contato
- [x] **D1, D2, D4** (feito em 2026-11-12):
  - **D1:** as fotos das telas ganharam a versão com metade da largura (`video/variantes.mjs`, chamado também no fim do `telas.mjs`); `Janela` e `Celular` usam `srcset` e `sizes`, sem o otimizador do Next;
  - **D2:** o `gtag/js` do Google Ads saiu, porque o contêiner do GTM já traz a tag `AW-18558704295`; ficou só o GTM, com `afterInteractive`;
  - **D4:** regra geral de `:focus-visible` na camada base do `globals.css`; as áreas com rolagem lateral recebem foco (`tabIndex`, `role="region"`);
  - `acessibilidade.spec.ts` audita 9 páginas do site (axe, WCAG AA) e confere o foco visível.

## Etapa 23.3 · Painel sem furos (briefing de 2026-11-10)

Fonte: [pente-fino-melhorias.md](pente-fino-melhorias.md), parte 1 (auditoria com um
agendamento de teste real). Cada item crítico tem teste que reproduz o erro.

**Grupo A — dinheiro e dados**

- [x] **A1** dinheiro pela data do **recebimento**: o caixa do dia soma o que foi recebido no dia (`fechadaEm`), não o que estava agendado para ele; "a receber" continua sendo os atendimentos do dia em aberto. O caixa **nunca abre sozinho** (antes, fechar abria o caixa do dia do atendimento). Reabrir comanda confere o caixa do dia em que ela foi recebida. Início, Caixa, Clientes, Resultados e Financeiro passam a usar a mesma data para o dinheiro
- [ ] **A1 (competência)** [DECISÃO DO DONO] faturamento, lucro e "última visita" pela data do **atendimento**. Hoje usam a data do fechamento em todas as telas (concordam entre si); com o A2, só diverge quando a comanda é fechada em outro dia. Mudar exige guardar a data do atendimento na comanda (migração) e recalcula meses já passados — aguarda a decisão
- [x] **A2** não recebe atendimento de outro dia, nem de hoje que ainda não começou (cliente adiantado que o barbeiro já começou recebe normalmente); o servidor recusa (`atendimento_futuro`) e a tela explica. Caixa de hoje não aberto: o servidor recusa (`caixa_nao_aberto`) e a tela oferece "abrir o caixa com o troco e receber"
- [x] **A3** comanda reaberta volta a ter as ações de uma aberta: começar, confirmar, cancelar (com motivo), marcar falta e mover horário. **Limpeza em produção (dono):** cancelar a comanda reaberta de teste (`01a1c85f-…`) e fechar o caixa de 11/11 aberto indevidamente
- [x] **A4** comanda sem itens não fecha: botão desativado com "Sem itens. Lance um serviço ou cancele/marque falta." e o servidor recusa (`sem_itens`); item do clube com valor zero continua fechando
- [x] **A5** bot escolhe a palavra-chave mais específica (frase com mais palavras, depois mais letras; empate pela ordem dos grupos): "qual o horário de funcionamento?" vai para Endereço e horário. Palavras de fábrica novas (Agendar sem "horário" solto; Endereço com horário de funcionamento, que horas abre/fecha, abre hoje/domingo, funciona), aplicadas por migração só nas contas que não mexeram nesses grupos. O editor avisa palavra de um grupo contida na frase de outro (`conflitosPalavrasChave`), sem impedir publicar
- [x] **A6** cada conversa traz a conexão da unidade dela (`conectado`); desconectado, o selo é "Bot parado: WhatsApp desconectado" (vermelho) com "Conectar"
- [x] **A7** o link só liga com serviço com preço e profissional com horário (`faltaParaLigarLink`; 422 `link_incompleto` com o que falta e os atalhos); página pública sem serviço ou barbeiro mostra "Agendamento online indisponível" com WhatsApp, telefone e mapa; o editor do bot avisa as unidades com o link desligado
- [x] **A8** `/servicos` e `/produtos` passavam da largura no celular: o "Ações" só para leitor de tela (absoluto) escapava da rolagem da tabela. `relative` nos contêineres de tabela e teste de tela com todas as rotas do painel em 375 px (`e2e/largura.spec.ts`)
- [x] **M1** card de meta do Início com as metas de serviço quando não há de faturamento (`resumoDasMetas`)
- [x] **M2** 12 meses a partir do mês de criação da conta ou do primeiro atendimento fechado, o que vier antes, para não esconder histórico importado (`mesesDoHistorico`) e "sem dados ainda" com os dois meses zerados (`textoDaVariacao`, agora único para tela, PDF e planilha). "Só dias de trabalho" já filtrava as folgas
- [x] **M4** coluna de Serviços "Conta como" (peso nos atendimentos), com a explicação; a contagem do mês segue em Resultados → Serviços e produtos
- [x] **M5** "Custos operacionais" com comissão e despesas separadas (`percentualComissoes`)
- [x] **M8** imprimir comandas desativado sem comanda no dia
- [x] **M3** Serviços com preço, comissão média e sobra por atendimento (`linhaDoCatalogo`, com `comissaoItem` da comanda e a regra vigente de cada barbeiro ativo), ordenação, "Premium" fora do lucro real e nada de margem para o barbeiro
- [x] **M6** [DECISÃO DO DONO] depois de agendar, fica na Agenda com o aviso e "Abrir comanda" (`DEPOIS_DE_AGENDAR = 'ficar_na_agenda'`; `'abrir_comanda'` volta ao jeito antigo)
- [x] **M7** remover item da comanda com 5 s para desfazer; sair da tela ou "Receber e fechar" removem na hora, para nada ser cobrado do item tirado
- [x] **M9** bloco da agenda com menos de 72 px numa linha só ("10:00 Vitor M. · Corte", `nomeCurto`), com o texto inteiro no `title` e no rótulo acessível
- [x] **M10** assinatura com a próxima cobrança (`proximaCobrancaSemFatura`: data, valor e forma; ou os dias de teste) e "Falar com o suporte" no menu, levando à Ajuda → contato (atalho tirado do rodapé do menu em 2026-11-13, a pedido do dono: repetia o item "Ajuda" e apertava a linha do nome; o contato continua na Ajuda). **Falta o dono:** WhatsApp e horário do suporte em `apps/web/src/lib/contato.ts` (`SUPORTE`), cobrindo o sábado
- [x] **X1** caixas de serviço do Novo agendamento com nome (o teste confere cada uma e o diálogo aberto passa pelo axe)
- [x] **X2** "Como fazer", "Fazer agora" e "Ver como reconectar" com 44 px de toque; a auditoria inclui `target-size` (WCAG 2.2)
- [x] **X3** contraste AA do token `--tinta-fraca` nos dois temas (escuro `#92928a`, claro `#60615a`, 4,5:1 ou mais em todos os fundos)
- [x] **X4** `e2e/acessibilidade.spec.ts`: axe (WCAG 2 A/AA, 2.1 e 2.2 AA) em todas as rotas do painel, no computador e no celular, e nos diálogos; nada "serious" ou "critical". O gráfico de 12 meses virou `role="group"` (as barras seguem alcançáveis)
- [x] **P1** prévia por unidade (`metadadosDaPagina`): "Agende na {barbearia} · {unidade}", serviços e preço inicial; imagem própria (`/b/[slug]/opengraph-image`). A logo entra quando o envio de logo existir (página personalizável)
- [ ] **P2** endereço com mapa, WhatsApp e horário já aparecem; fotos e nota média ficam com a página personalizável da barbearia
- [x] **P3** `/b/<slug>` com 301 de `/agendar?u=<slug>` (`next.config`, leva a query e o código do bot); `linkDeAgendamento` é o único lugar que monta o link (bot, convite de retorno, atraso, Configurações). Trocar de unidade não recria a tela
- [x] **P4** [DECISÃO DO DONO] "Aparecer no Google" por unidade (`unidade.aparecer_no_google`, padrão desligado): ligado, `index` e JSON-LD `HairSalon` (`jsonLdDaBarbearia`) e a página no sitemap (`paginas_de_barbearia_no_google()`); desligado, `noindex`. A prévia fica em cache por alguns minutos
- [ ] **P5** barbeiros por serviço, com foto: o sistema não guarda quem faz cada serviço nem foto do barbeiro; entra na página personalizável (cadastro "quem faz o quê" e envio de foto)
- [x] **P6** confirmação com "Adicionar ao calendário" (`arquivoCalendario`, .ics com lembrete 1 h antes); remarcar ou cancelar e o aviso do WhatsApp já existiam

## Etapa 23.4 · Administração sem furos (briefing de 2026-11-10)

Fonte: [pente-fino-melhorias.md](pente-fino-melhorias.md), parte 2 (auditoria do `/admin` em
10/11/2026, só leitura). O admin continua sem ver dados das barbearias; toda ação sensível pede
motivo e vai para a auditoria.

- [x] **R1** cupom LANCAMENTO sem limite de vagas (decisão do dono em 2026-11-11; migração `lancamento_sem_limite` com registro na auditoria da plataforma, `OFERTA_LANCAMENTO.vagas = null`) e mensagem clara de esgotado ("Este cupom esgotou: as vagas acabaram."). O aviso aos admins quando um cupom com vagas estiver perto de esgotar fica com o F3 (alertas para a equipe)
- [x] **R2** nota fiscal só liga com os dados fiscais conferidos no Asaas (feito em 2026-11-11: `pendenciasNotaFiscal` recusa sem dados fiscais, com inscrição de exemplo (vazia, curta, repetida ou sequência como 123456) e sem o acesso à prefeitura, dizendo qual acesso a prefeitura exige pelas opções do município (`fiscalInfo/municipalOptions`); ligar e "Aplicar às assinaturas" respondem 422 `nota_fiscal_pendente`; desligada, salva sempre. O webhook grava os eventos `INVOICE_*` em `nota_fiscal_mensalidade` (RLS por conta) sem voltar atrás com aviso atrasado (`aceitaStatusNota`); a barbearia vê e baixa a nota na fatura; a Saúde do sistema mostra a última emitida, as a caminho e as que não saíram, com o motivo. Conferido no sandbox do Asaas: conta sem dados fiscais (404) aparece como "faltam a inscrição, o regime e o certificado digital". **A nota de teste não foi feita, de propósito:** em produção seria uma nota de verdade, e no sandbox a emissão depende da prefeitura, então não prova nada; a primeira nota real aparece na Saúde do sistema. **Falta o dono:** cadastrar no Asaas a inscrição municipal, o regime e o certificado digital; conferir o código do serviço e o ISS com o contador; marcar os eventos de nota fiscal no webhook do Asaas)
- [x] **R3** máquina de estados da conta (feito em 2026-11-11: `transicaoDaConta` em `situacao-conta.ts`, com teste de cada transição; bloquear guarda `status_anterior` e desbloquear volta exatamente a ele; cancelar cancela a cobrança automática no Asaas antes de gravar (sem resposta do Asaas, nada muda) e a conta passa à cobrança manual; reativar só de cancelada, sempre com o próximo passo: teste até a data, cobrança a partir da data ou cortesia; a regra antiga `plataforma_mudar_situacao`, que mandava "desbloquear" para ativa até de cancelada, saiu). **Corrigir no `/admin` (dono):** a conta "Teste", cancelada e desbloqueada sem cobrança, recebe "Cortesia" (conta interna) ou "Começar a cobrar"
- [x] **R4** cobrança prevista também para conta manual que nunca pagou: vence na data marcada pela administração (reativação, fim da cortesia ou "Começar a cobrar") ou no dia seguinte ao último período pago, o que vier depois, e nunca dentro da cortesia (`proximaCobrancaManual`)
- [x] **R5** indicadores (feito em 2026-11-11: `situacaoNaPlataforma`: "em dia" só com pagamento, "ativa sem cobrança", "cortesia" à parte e fora do MRR; `conta.interna` com "Marcar como conta interna" na ficha (motivo na auditoria), fora de MRR, contas, novas, conversão, cancelamentos, renovações, "Precisa de atenção" e cobrança manual; "Precisa de atenção" ganhou "Ativa sem cobrança" (urgente) e "Teste longo" (mais de 60 dias). **Dono:** as contas "Teste" e "Implantação" são internas (decisão de 2026-11-11): marcar as duas em `/admin` → ficha → "Conta interna")
- [x] **R6** teste com limite (feito em 2026-11-11: `LIMITE_TESTE_DIAS = 60` a partir de hoje em "Estender teste" e no reativar, como já era na Nova venda; acima disso, cortesia com motivo e fim, até um ano por vez). **Conta "Implantação" (teste até 29/04/2028):** o dono decide entre cortesia e um teste de até 60 dias
- [x] **R7** e-mails que não saíram (feito em 2026-11-11: Saúde do sistema → "E-mails que não saíram", com quando, destinatário mascarado (`mascararEmail`), modelo, motivo do SMTP e tentativas; "Reenviar" (volta à fila com as tentativas zeradas) e "Descartar" (com motivo), os dois na auditoria; falha das últimas 24 h vira pendência do sistema em "Precisa de atenção", urgente se for de boas-vindas ou confirmação (`EMAILS_CRITICOS`); o e-mail passa a guardar o modelo que o gerou)
- [x] **R8** WhatsApp caído há mais de 2 h em "Precisa de atenção", urgente (`HORAS_WHATSAPP_CAIDO`). O e-mail "WhatsApp desconectado" para a barbearia já existia
- [x] **R9** IP real (feito em 2026-11-11: `normalizarIp` no login e em toda a auditoria; a Saúde do sistema conta os acessos dos últimos 7 dias com IP interno (`ipInterno`). Causa provável do `172.18.0.1`: acesso por IPv6 com a rede do Docker só em IPv4, que perde o IP antes do Caddy. **Dono:** correção em `docs/producao.md` → "IP real na auditoria" (a rápida é tirar o registro AAAA do DNS))
- [x] **R10** abas do `/admin` seguem o endereço (`hashchange`): link, endereço digitado e voltar do navegador
- [x] **U2** lista de contas: colunas Ativação (`ativacao` em `plataforma_contas()`, os mesmos passos do tutorial, `TOTAL_PASSOS_ATIVACAO = PASSOS_INICIAIS.length`) e Origem, primeira coluna fixa, ordem "Menos configuradas" e as duas colunas no CSV (o filtro "Conta interna" já existia)
- [x] **U3** ficha: próxima cobrança, dias de teste e ativação (`proximaCobrancaDaConta`, `diasRestantesDoTeste` em `ficha-admin.ts`), "Chamar no WhatsApp" (`whatsappDoDono`) e notas internas (`nota_interna_conta`, só a administração lê; `POST /admin/contas/:id/notas` só admin, na auditoria sem o texto). A origem já estava (F2) e "Reativar" de cancelada já veio com o R3
- [x] **U4** nova venda: `type="tel"` com máscara (`mascararTelefone`), CPF/CNPJ opcional e conferido (`mascararDocumento`, `documentoValido`, gravado em `conta.documento`), erro por campo pelo mesmo `venderContaSchema` do servidor, dias de teste numéricos de 0 a 60 e resumo antes de criar
- [x] **U5** vendas por origem: cadastros, em teste, pagantes, conversão (só de quem saiu do teste) e receita paga (`vendasPorOrigem`, `GET /admin/vendas/origens`, só admin)
- [x] **U1** Início da administração (feito em 2026-11-12: período nos números do negócio (mês atual, últimos 30 dias, mês anterior: novas, cancelamentos, motivos e o gráfico; `intervaloDoPeriodo`, `GET /admin/metricas?periodo=`); estados vazios com orientação ("Nenhuma conta paga ainda · contas em teste: N", "Nenhum teste terminou ainda"); números e "Contas por situação" levam à lista filtrada (`#contas?situacao=`); "Para resolver" rola até as pendências. Testes em `metricas-plataforma.test.ts`, `admin.e2e-spec.ts` e `apps/web/e2e/admin.spec.ts`)
- [x] **U6** papéis Suporte e Financeiro (feito em 2026-11-12: `papel_plataforma` com `suporte` e `financeiro`; `ABAS_DO_PAPEL` e `veTodasAsContas` em `packages/shared/src/plataforma.ts`; na API, cada rota lista os papéis (os novos só entram onde aparecem): suporte lê contas, ficha, pendências e a saúde do sistema (com os e-mails que falharam); financeiro vê cobranças, registra pagamento e cuida da nota fiscal (`GET /admin/configuracoes/nota-fiscal` e a aba Cobrança); nenhum dos dois vê equipe, configurações gerais, auditoria, métricas nem faz venda; "última troca de senha" na Equipe (`senha_trocada_em`, na criação e na redefinição); desativar exige motivo, que vai para a auditoria; o papel muda numa lista na própria linha. Testes em `admin.e2e-spec.ts` (rota a rota, 200 e 403) e `apps/web/e2e/admin.spec.ts`)
- [x] **U7** auditoria legível (feito em 2026-11-12: `resumoDaMudanca` com rótulos em português, valores em reais, porcentagem, datas no horário de Brasília e sim/não, sem campos internos nem segredos; filtro de datas pelo dia de Brasília; "Carregar mais" além de 300 (`antesDe` + `antesDeId`, sem perder registros do mesmo milissegundo); "Exportar CSV" com até 2000 do filtro (`csvDaAuditoria`). Testes em `plataforma-gestao.test.ts`, `admin.e2e-spec.ts` e `apps/web/e2e/admin.spec.ts`)
- [x] **U8** configurações (feito em 2026-11-12: campos de data e hora do aviso geral com "Horário de Brasília"; prévia do aviso com a mesma faixa que a barbearia vê (`FaixaAvisoGeral`, separada da casca); "Mandar teste para mim" em cada modelo de e-mail, com o texto salvo e dados de exemplo (`emailDeTeste`, `POST /admin/configuracoes/modelos-email/:chave/teste`, HTML no envio); últimas mudanças de preços e cupons com "Ver o histórico na auditoria", que abre a auditoria filtrada (`#auditoria?acao=`). Testes em `modelos-email.test.ts`, `admin.e2e-spec.ts` e `apps/web/e2e/admin.spec.ts`)
- [x] **U9** Saúde do sistema (feito em 2026-11-12: bloco "Servidor" com a versão em produção e desde quando a API está no ar (`APP_VERSAO` no compose, `process.uptime()`), o último backup (o `backup.sh` grava `estado_backup` em `configuracao_plataforma`, também quando falha; "atrasado" depois de 26 h), disco, memória e validade do certificado (o `vigia.sh` grava `estado_servidor` a cada 5 min; alerta com menos de 14 dias) e o último aviso do Asaas aceito (Redis); na limpeza, o texto explica que conta paga e cortesia nunca saem e a lista das que saem nos próximos 7 dias (`dataDeApagarConta`, gravada pela rotina em `execucao_limpeza.proximas`). Testes em `limpeza.test.ts`, `limpeza.db.test.ts`, `saude-admin.e2e-spec.ts` e `apps/web/e2e/admin.spec.ts`)
- [x] **Comissões no Básico** (feito em 2026-11-12, decisão do estudo de planos: o recurso `comissoes` vale desde o Básico em `RECURSOS`; selos e tabela de /planos saem da mesma fonte; cartões dos planos, documentação do produto, `planos.test.ts`, `planos.e2e-spec.ts` e `apps/web/e2e/resultados.spec.ts` atualizados)
- [ ] **U1, U6–U9** usabilidade das outras abas
- [x] **F1** funil de ativação (feito em 2026-11-12):
  - migração `funil_ativacao` com `plataforma_funil()` (SECURITY DEFINER), que diz por conta se há serviço com preço, barbeiro ativo, agendamento, comanda fechada, WhatsApp conectado e fatura paga;
  - regra em `packages/shared/src/funil.ts` (`resumirFunil`, `etapaAtualDoFunil`), com teste;
  - `GET /admin/funil?periodo=todos|90dias|30dias`, só para o admin;
  - `etapaFunil` na ficha da conta e o bloco "Funil de ativação" em `metricas-admin.tsx`;
  - testes em `admin.e2e-spec.ts` e `apps/web/e2e/admin.spec.ts`.
- [x] **F1b–F1c** (aprovadas em 2026-11-12, feitas em 2026-11-13):
  - **F1b:** a Equipe esconde os desativados, com a caixa "Mostrar desativados (N)";
  - **F1c:** `etapaFunil` em `ContaNaPlataforma` (de `plataforma_funil()`) e o filtro "Parou em" na lista de Contas;
  - testes em `admin.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F1d** e-mail para a conta parada há 3 dias na mesma etapa (feito em 2026-11-12, aprovada no mesmo dia):
  - regra em `packages/shared/src/etapa-parada.ts` (`decidirEtapaParada`, `emailDoPasso`), com teste;
  - modelo `etapa_parada`;
  - migração `funil_etapa_conta` (etapa, desde quando e o aviso, só a administração acessa);
  - `executarAvisosDeEtapa` na rotina de hora em hora da F3, com e-mail só das 9 h às 20 h;
  - teste em `plataforma.db.test.ts`.
- [x] **F2** origem do cadastro (feito em 2026-11-12):
  - a gravação e a ficha vieram com o T2, e as Contas e Vendas com o U2 e o U5;
  - agora `novas.porOrigem` em `metricasDaPlataforma` (contas novas do período por origem, com o resumo de `resumoDaOrigem`) aparece nos números do negócio;
  - testes em `metricas-plataforma.test.ts`, `admin.e2e-spec.ts` e `admin.spec.ts`;
  - a exportação de conversões offline não será feita (decisão do dono em 2026-11-13).
- [x] **F3** alertas para a equipe (feito em 2026-11-12):
  - regra em `packages/shared/src/alertas-equipe.ts` (`detectarAlertasEquipe`, `emailDeAlertasEquipe`), com teste;
  - migração `alertas_equipe`: `usuario_plataforma.alertas` (os admins começam com todos), `alerta_equipe_enviado` (tipo + chave, uma vez só) e `plataforma_whatsapp_caido()`;
  - `AlertasProcessor` no worker roda de hora em hora (aos 5 min), com a conexão da administração (`DATABASE_PLATAFORMA_URL`; sem ela, desligado);
  - `GET` e `PUT /admin/eu/alertas` para todos os papéis, e a seção "Meus alertas por e-mail" no Início;
  - testes em `alertas-equipe.test.ts`, `plataforma.db.test.ts`, `admin.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F4** nota de saúde da conta (feito em 2026-11-13):
  - regra em `packages/shared/src/saude-conta.ts` (`saudeDaConta`, `faixaDaSaude`, `PESOS_SAUDE`: acesso 30, comandas 30, tutorial 15, cobrança 15, WhatsApp 10), com teste;
  - `saude` em `ContaNaPlataforma`, calculada na lista de contas da API (fatura aberta ou recusada vencida conta como cobrança vencida);
  - coluna "Saúde", ordem "Risco de cancelamento" e CSV;
  - testes em `admin.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F5** acesso de suporte com consentimento (feito em 2026-11-13):
  - migração `acesso_suporte`: `conta.suporte_liberado_ate` e `plataforma_suporte_liberado()`;
  - `GET`/`PUT /conta/suporte`, só o dono, auditado;
  - `POST /admin/contas/:id/suporte` (admin e suporte) emite o token com `TokensAcesso.emitirSuporte`: papel dono, marca `sup`, até `fimDaSessaoSuporte` (1 h, nunca depois da liberação);
  - a `AutenticacaoGuard` recusa gravação e as conversas;
  - `OcultarContatoInterceptor` troca telefone e WhatsApp das respostas;
  - `auth/eu` devolve `modoSuporte`;
  - na web: a ponte grava a sessão sem renovação (`/api/suporte/entrar`), a página `/suporte`, a faixa na casca, o bloco na ficha e a aba do dono;
  - testes em `acesso-suporte.test.ts`, `ocultar-contato.spec.ts`, `suporte.e2e-spec.ts` e `apps/web/e2e/suporte.spec.ts`.
- [x] **F6, entrega 1** chat do site (feito em 2026-11-13):
  - regra e formatos em `packages/shared/src/chat-suporte.ts` (horário, `avisoDoChat`, esquemas), com teste;
  - migração `chat_suporte` (`conversa_suporte` e `mensagem_suporte`, só a administração acessa; o visitante usa o segredo da conversa, guardado como hash);
  - `ChatService`, rotas públicas `/chat/conversas` (com limite por IP) e `/admin/chat` (admin, vendedor e suporte);
  - alerta `chat_novo` na hora;
  - `ChatSite` no lugar do botão do WhatsApp e `ChatAdmin` na aba Chat;
  - testes em `chat-suporte.test.ts`, `chat.e2e-spec.ts`, `site.spec.ts` e `admin.spec.ts`.
- [x] **Chat: melhorias** (feito em 2026-11-13):
  - `respostasProntasDoChat` e `resumirChat` no shared, com teste;
  - `chat` no cadastro liga a conversa à conta (`ChatService.vincularConta`) e mostra `virouConta`;
  - `GET /admin/chat/resumo`;
  - `useAvisosDoChat`: bipe, `Notification` e o número no título e na aba;
  - título "(n) Nova mensagem" no `ChatSite`;
  - chat da Ajuda: migração `chat_painel` (`origem`, `usuario_painel_id`), `GET /chat/minha` e `POST /chat/minha/mensagens` para qualquer papel, `ChatAjuda` no bloco "Falar com o suporte";
  - testes em `chat-suporte.test.ts`, `chat.e2e-spec.ts` e `suporte.spec.ts`.
- [x] **Chat: contexto, avaliação e respostas editáveis** (feito em 2026-11-13):
  - `contexto` em `ConversaDaEquipe` (plano, situação e `saudeDaConta`) com "Abrir ficha";
  - migração `chat_avaliacao` (`conversa_suporte.avaliacao`), `POST /chat/conversas/:id/avaliacao` e `/chat/minha/avaliacao` (só encerrada) e `avaliadas`/`uteis` em `resumirChat`;
  - `RESPOSTAS_PADRAO`, marcadores e `respostasChatSchema`;
  - `GET`/`PUT /admin/configuracoes/respostas-chat` (vazio = de fábrica) e `GET /admin/chat/respostas`;
  - testes em `chat-suporte.test.ts`, `chat.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F6, entrega 2: push da equipe** (feito em 2026-11-13):
  - migração `push_equipe` (`inscricao_push_plataforma`, só a administração acessa);
  - `GET`/`POST /admin/chat/push` e `/push/desligar`;
  - `FILA_PUSH_EQUIPE`, enfileirada pelo `ChatService` a cada conversa ou mensagem nova (etiqueta por conversa);
  - `enviarPushEquipe` no `AlertasProcessor` (admin, vendedor e suporte ativos; tira 404 e 410);
  - botão "Avisar no celular" na aba Chat;
  - testes em `plataforma.db.test.ts` e `chat.e2e-spec.ts`.
- [x] **F7** métricas de SaaS (feito em 2026-11-13):
  - regra em `packages/shared/src/metricas-saas.ts` (`metricasSaas`): MRR por conta e mês das faturas pagas (a anual vale 1/12 por 12 meses), novo, upgrade, downgrade, perdido, churn, ARPA, LTV, MRR por plano e coortes; só meses fechados, sem as internas; com teste;
  - `GET /admin/metricas/saas`, só o admin;
  - `metricas-saas-admin.tsx`;
  - testes em `admin.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F8** aviso geral segmentado (feito em 2026-11-13):
  - `publico` em `avisoGeralSchema` (planos, situações e contas), com `contaNoPublico` e `descreverPublico` no shared, com teste;
  - `/sistema/aviso` filtra pela conta e não envia o público;
  - `PublicoDoAviso` no formulário, com quantas contas veem;
  - testes em `configuracao-sistema.test.ts`, `admin.e2e-spec.ts` e `admin.spec.ts`.
- [x] **F9** gestão de cupons (feito em 2026-11-13):
  - `relatorioCupons` no shared (contas, pagantes, receita das faturas pagas, desconto concedido = valor × bp ÷ (10000 − bp) e uso por mês), com teste;
  - `GET /admin/configuracoes/cupons/relatorio`;
  - `ResultadoCupons` e o aviso de vagas na lista;
  - teste em `admin.e2e-spec.ts`.

## Etapa 23.5 · Webhooks seguros e worker vigiado (pedido em 2026-11-11)

Fonte: [a-fazer.md](a-fazer.md), seção 2, e os achados V2 a V4 da
[verificação final](verificacao-final.md).

- [x] **W1** webhook do Asaas não acredita no corpo (feito em 2026-11-11: do corpo só o evento e o id; `ProvedorCobranca.pagamento()` e `nota()` buscam no Asaas (`GET /payments/{id}` e `GET /invoices/{id}`, 404 = ignorado); a situação da nota vem do status atual (`SYNCHRONIZED` passou a ser "enviada"); a mensalidade do clube exige também o status pago no Asaas (`STATUS_PAGO`). Testes com o token certo e corpo inventado em `cobranca`, `clube-online` e `nota-fiscal.e2e-spec.ts`; nos testes, `noAsaas()` registra no provedor falso o que o teste manda)
- [x] **W2** `/webhooks/whatsapp` fechado no Caddy (404 em `api.{$DOMINIO}`); a Evolution chama por dentro
- [x] **W3** recusas registradas (`WebhooksRecusados`: contagem por dia e as 20 últimas com IP no Redis, log) e mostradas na Saúde do sistema; IP com 20 erros em 10 min leva 429 por 10 min, antes de conferir o segredo
- [x] **W4** segredo de webhook com menos de 32 caracteres vira aviso na Saúde do sistema (sem derrubar a API, para não parar a produção com um segredo antigo); como trocar em `docs/producao.md`
- [x] **W5** teste do webhook no Codespaces documentado em `docs/producao.md` (porta pública só durante o teste, token do sandbox)
- [x] **V2** novas tentativas (`TENTATIVAS_REPETIVEIS`: 4, espera exponencial) na mensagem do cliente e nos lembretes, que já eram seguros de repetir
- [x] **V3** batimento do worker a cada 30 s (Redis e arquivo) e última execução de cada rotina (`ROTINAS_WORKER`); Saúde do sistema mostra worker parado e rotina atrasada; healthcheck do worker no `docker-compose.prod.yml` e o `vigia.sh` reinicia contêiner `unhealthy` e avisa o Kuma
- [x] **V4** lembrete que não entrou na fila: o erro vai para o log e a rotina de 15 min põe de novo os lembretes das próximas 48 h (`lembretesPerdidos`, id fixo, nada duplica; teste em `agendar-bot.db.test.ts`)

## Etapa 23.6 · Escolhas da planilha (respostas do dono em 2026-11-11)

Fonte: [a-fazer.md](a-fazer.md), seção 3 (comparação com a planilha da barbearia).

- [x] **Preço livre na comanda** (feito em 2026-11-12: `servico.preco_livre`, `preco_minimo` e `preco_maximo` (faixa conferida no banco e na API) e `conta.preco_livre_barbeiro`; regra em `packages/shared/src/preco-livre.ts` (`conferirPrecoLivre`, `podeDigitarPrecoLivre`, com teste); a comanda lança com o preço da tabela ou o valor digitado (`valor` no lançamento, `precoUnitario` na edição), recusa fora da faixa e serviço de preço fixo (`preco_fixo`), e audita `preco_livre` quando sai da tabela; a comissão sai do valor digitado. Telas: Serviços (marcar preço livre e a faixa, etiqueta no catálogo e "o barbeiro também digita", só o dono) e a comanda ("Valor" no item, com a faixa). Testes em `apps/api/test/preco-livre.e2e-spec.ts` e `apps/web/e2e/cadastros.spec.ts`)
- [x] **Despesas fixas no mês seguinte** (feito em 2026-11-12: `despesa.repetir` e `despesa.origem_id` (única: uma cópia por despesa); "Copiar fixas do mês anterior" no Financeiro com prévia editável (`GET /despesas/fixas-para-copiar`, `POST /despesas/copiar-fixas`; a que já tem igual lançada à mão vem desmarcada; já copiada = 409); "Repetir todo mês" no formulário, com a rotina diária das 6 h no worker (`repetirDespesasDoMes`, na fila da limpeza, registrada na Saúde do sistema). Testes em `despesas-fixas.db.test.ts`, `apps/api/test/despesas-fixas.e2e-spec.ts` e `apps/web/e2e/resultados.spec.ts`)
- [x] **Catálogo por unidade** (pedido do dono em 2026-11-12; feito: `servico.unidade_ids` e `produto.unidade_ids` (GIN), preenchidos com as unidades de cada conta na migração; "Disponível em" nos formulários de Serviços e Produtos; catálogo, tabela de preços, comanda, agenda, lista de espera, planos do clube, bot e link de agendamento filtram pela unidade; a API recusa o que não está na unidade (`fora_da_unidade`); gravar preço numa unidade põe o serviço nela; unidade nova começa vazia com "Copiar catálogo de outra unidade" (`POST /unidades/:id/copiar-catalogo`, serviços com os preços de hoje e produtos). Testes em `apps/api/test/catalogo-unidade.e2e-spec.ts` e `apps/web/e2e/cadastros.spec.ts`)
- [x] **Preço por barbeiro** (detalhe do dono em 2026-11-12; feito: `preco_profissional` com vigência (valor nulo = volta ao da unidade) e a função `preco_do_profissional()`; Perfil → "Meus preços" (`GET/PUT /me/precos`, só o próprio barbeiro, só serviços da unidade dele); comanda, agenda e o resumo do bot usam o preço do profissional; o link de agendamento recebe os preços próprios de cada barbeiro e mostra o do escolhido; a comissão do clube segue o preço da unidade. Testes em `regras.db.test.ts`, `apps/api/test/preco-profissional.e2e-spec.ts` e `apps/web/e2e/assistente.spec.ts`)
- [x] **Receber adiantado (sinal), painel A2** (feito em 2026-11-12: `pagamento.sinal` e `pagamento.devolvido_em`; `POST /comandas/:id/sinal` (balcão, caixa de hoje aberto, até o que falta receber) e `POST /comandas/:id/sinal/:pagamentoId/devolver` (com motivo); cancelar com `devolverSinal`; o fechamento cobra o total menos o sinal (`sinal_maior` quando passa) e fecha sem pagamento quando o sinal cobre tudo; reabrir mantém o sinal; o caixa soma os sinais no dia em que entram e tira os devolvidos no dia em que saem (`entradasDoCaixa` em `packages/shared/src/sinal.ts`, com teste); o arquivo do contador não leva sinal devolvido. Telas: "Receber sinal", "Devolver", fechamento com o sinal descontado, cancelamento com "devolver agora" e o caixa com os sinais. Testes em `apps/api/test/sinal.e2e-spec.ts` e `apps/web/e2e/operacao.spec.ts`)

## Etapa 24 · Premium completo

Depois do lançamento, o que o Premium anuncia como "em breve".

- [ ] Campeonato dos barbeiros: ranking mensal por % da meta, % de extras e nota média, sem valores em reais; o dono define a premiação
- [ ] ~~TV da unidade (`/tv`)~~ — **descartada em 2026-11-08** (decisão do dono do produto): o campeonato fica no app e no painel, sem tela de TV
- [ ] Automações do bot: campanhas só para quem aceitou mensagens (clientes sumidos, aniversariantes do mês, horários vagos de amanhã), com limite diário e relatório de resultado
- [x] Cobrança automática do clube pelo Asaas (Pix e cartão): assinatura recorrente, baixa automática pelo webhook, aviso ao cliente quando a cobrança falhar (feito em 2026-11-08, falta o aviso ao cliente quando a cobrança falha: **subconta do Asaas por barbearia com split** — o Pente Fino nunca segura o dinheiro. Clube → "Receber online" (dono): dados da conta (CPF ou CNPJ, endereço, faturamento) criam a subconta (`POST /accounts`), a chave dela fica cifrada (`recebimento_online`), a situação é consultada no Asaas e o botão "Enviar documentos no Asaas" abre a página deles; saldo e lista dos recebidos pelo link com taxa do Asaas, taxa do Pente Fino, repasse e data prevista de crédito. Cada plano tem "Copiar link" e "Mandar pelo WhatsApp" com a mensagem pronta (`textoConviteClube`); a opção "Clube" do bot também manda o link. Página pública `/assinar?u=slug&p=plano`: o cliente escolhe o plano, informa nome, WhatsApp e CPF e vai para o pagamento do Asaas (Pix, cartão ou boleto); a assinatura mensal leva o split para a carteira da barbearia (`assinatura_clube_online`). O webhook do Asaas cria a adesão no primeiro pagamento, anda o vencimento a cada mensalidade, registra o pagamento com taxas e repasse (`pagamento_clube.origem = online`) e avisa dono e gestor na central de avisos; repetido não conta duas vezes. Cancelar a adesão no balcão cancela a cobrança no Asaas. Taxa da plataforma em `/admin` → Configurações → "Clube online" (padrão 1%, de 0 a 20%), gravada em cada assinatura no momento em que o cliente assina. "Criar planos sugeridos" com a lista vazia monta Corte, Corte + Barba e Corte à vontade a partir dos preços. **Exige a conta do Pente Fino no Asaas como pessoa jurídica (CNPJ)**: o Asaas recusa subcontas criadas por conta de CPF. Conferido no sandbox com conta CNPJ: subconta criada e aprovada, assinatura com split, pagamento com cartão de teste confirmado e 99% do líquido (R$ 96,54 de R$ 97,52) indo para a carteira da barbearia; o repasse usa o valor que o Asaas informa e arredonda como ele)
- [ ] Nota fiscal da barbearia para o cliente (NFS-e, item 6.01 da LC 116), como recurso do Premium, depois do piloto e só se as barbearias pedirem: começar pelas mensalidades do clube online (já passam pelo Asaas, na subconta da barbearia); antes, conferir no sandbox se a subconta emite nota pela API e quanto custa cada nota. A barbearia informa inscrição municipal, regime e ISS no Pente Fino; a nota sai no pagamento e o PDF vai pelo WhatsApp. Nota da comanda do balcão só numa segunda fase. Estimativa: 2 a 4 semanas pelo Asaas (ou por um emissor como Focus NFe ou NFE.io); integrar direto com a API nacional (4 a 8 semanas e manutenção) não compensa
- [ ] **Pronto quando:** uma rede Premium acompanha o campeonato no painel, recupera clientes por campanha e recebe o clube sem baixa manual

## Etapa 25 · Operação contínua e próximas versões

O trabalho depois do lançamento, para o sistema seguir estável e crescer.

**Toda semana**

- [ ] Revisar erros do rastreador e alertas do monitoramento
- [ ] Ler os pedidos de suporte e transformar os repetidos em melhoria
- [ ] Publicar correções em homologação, testar e levar para produção

**Todo mês**

- [ ] Testar a restauração do backup
- [ ] Atualizar dependências, imagem da Evolution API e pacotes do Ubuntu
- [ ] Uptime Kuma 1.23 → 2.x (o Dependabot não sugere a versão maior; proposta em #129): backup do volume `status_dados`, testar o `status.sh` contra a 2.x num Kuma local (a API de socket mudou), subir e conferir a página pública
- [ ] Acompanhar receita recorrente, cancelamentos, clientes por plano e uso de disco e memória da VPS
- [ ] Quando a VPS passar de 70% de memória ou CPU com frequência, subir de plano ou separar o banco

**Próximas versões**

- [ ] Estoque completo: baixa do produto gasto no serviço, estoque mínimo, fornecedores e compras
- [ ] Fidelidade: pontos ou cashback por visita, resgate na comanda
- [ ] Sinal por Pix no agendamento pelo link e pelo bot, para horários disputados — **para o futuro** (2026-11-08: sem necessidade agora)
- [ ] Google Agenda: espelhar a agenda do profissional
- [ ] Importação do histórico da planilha (comandas antigas), com conferência — antes, definir com o dono o modelo da planilha (colunas e formato)
- [ ] Revisar os preços a cada 6 meses com a tabela de mercado do documento principal

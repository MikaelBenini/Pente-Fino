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
- [ ] Desafio anti-robô gratuito (Cloudflare Turnstile) no cadastro, ligado por variável de ambiente; sem a chave, o formulário segue com as outras proteções
- [ ] Conta não confirmada em 7 dias sai na rotina de limpeza (abaixo), com aviso por e-mail 2 dias antes

**Exclusão automática de dados (90 dias)**

- [ ] Política escrita na página de Privacidade e nos termos: o que sai e depois de quanto tempo
- [ ] Conta cancelada, ou com o teste vencido sem nenhum pagamento, é apagada 90 dias depois (aviso por e-mail 15 e 3 dias antes; o dono exporta os dados até lá); a auditoria da plataforma guarda só que a conta existiu e quando saiu
- [ ] Em todas as contas: conversas do bot, sessões e tokens vencidos, avisos lidos e trabalhos antigos das filas saem depois de 90 dias; avaliações perdem o comentário (a nota fica para a média). Comandas, caixa e auditoria de contas ativas não saem (são histórico financeiro)
- [ ] Rotina diária no worker, em lotes pequenos (sem travar o banco), com o total apagado por tipo em Saúde do sistema
- [ ] **Pronto quando:** um cadastro de robô é recusado, uma conta sem confirmar some no prazo e a Saúde do sistema mostra o que cada execução apagou

**Status útil**

- [ ] Monitores criados por script (`infra/status.sh`, na VPS, com o login do Uptime Kuma digitado na hora): site, API, painel do WhatsApp, backup do dia e disco/memória; as URLs dos monitores "push" vão sozinhas para o `.env`
- [ ] Página pública de status (`status.seudominio/status/pente-fino`) com os serviços agrupados e o histórico; o painel interno continua com login
- [ ] Alerta por e-mail (o SMTP do Brevo) quando um monitor cair

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
- [ ] Envio para o armazenamento externo com rclone, criptografado
- [x] Cópia também do volume de sessões da Evolution API (evita escanear o QR de novo)
- [x] Agendado no cron da VPS todo dia de madrugada
- [x] Retenção: 30 diários e 12 mensais
- [ ] Snapshot semanal da VPS no painel do provedor
- [x] Restauração testada num banco vazio, com o passo a passo em `docs/restaurar.md`
- [ ] **Pronto quando:** o banco é restaurado do zero a partir do armazenamento externo e o sistema volta a abrir

## Etapa 19 · Monitoramento

Saber do problema antes do cliente ligar, com ferramentas que rodam no próprio servidor.

- [ ] Uptime Kuma em `status.`: verifica `app`, `api/health` e a conexão do WhatsApp a cada minuto, avisa por e-mail ou Telegram
- [ ] Rastreamento de erros no front e na API (GlitchTip, que roda no próprio servidor, ou Sentry)
- [x] Alerta de disco acima de 80% e de memória alta
- [ ] Alerta quando a sessão do WhatsApp cair (evento da Evolution API)
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
- [ ] Revisão de permissões: cada rota com papel e unidade conferidos, incluindo as das Etapas 9 a 15 e o webhook do WhatsApp
- [x] Auditoria imutável de comandas fechadas, preços, comissões e despesas (feito: tabela `auditoria` com gatilho que recusa UPDATE, DELETE e TRUNCATE desde a migração `restricoes`; a da plataforma usa o mesmo gatilho)
- [x] Política de privacidade e termos de uso publicados e aceitos no cadastro (`/termos` e `/privacidade`; a versão aceita fica na auditoria da conta. Texto é rascunho: falta revisão jurídica e CNPJ)
- [ ] Consentimento do cliente para receber mensagens de WhatsApp, com opção de sair (construído na Etapa 10; aqui, revisão do texto e do registro)
- [ ] Exportar e apagar os dados de um cliente quando ele pedir, incluindo mensagens do bot e comentários de avaliação
- [ ] Prazo de guarda das conversas do bot e das avaliações definido na política de privacidade e aplicado por rotina
- [x] Telefone do cliente oculto para o barbeiro quando o dono ativar (Etapa 6.6; vale também na ficha do profissional e nas avaliações)
- [ ] Contrato com a barbearia dizendo quem é responsável pelos dados (a barbearia controla, o sistema opera)
- [ ] Atualização mensal de dependências e da imagem da Evolution API
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
- [ ] Cupom do plano fundador: 30% para os 20 primeiros clientes (anunciado em `/planos`; aplicar junto com a cobrança no Asaas)
- [ ] Página de vendas: frase "Saiba quanto sobra, não só quanto entrou", preços, comparativo, depoimento do piloto, botão de teste grátis (feito: `/` e `/planos` com preços mensal/anual, calculadora de unidades, comparativo com "em breve", perguntas, SEO e cadastro com plano escolhido; falta o depoimento real do piloto)
- [ ] Central de ajuda com os vídeos do piloto e perguntas frequentes (conectar o WhatsApp, montar o menu do bot, ler a ficha do profissional)
- [ ] Comparativo de `/planos` sem "em breve" nos recursos entregues nas Etapas 9 a 15
- [ ] WhatsApp de suporte com horário definido
- [x] Termos de uso e política de privacidade com as condições dos planos e do cancelamento (rascunho para revisão jurídica)
- [ ] Exportação completa dos dados para quem cancelar
- [ ] **Pronto quando:** uma barbearia desconhecida se cadastra, testa, assina e paga sem falar com ninguém

## Etapa 24 · Premium completo

Depois do lançamento, o que o Premium anuncia como "em breve".

- [ ] Campeonato dos barbeiros: ranking mensal por % da meta, % de extras e nota média, sem valores em reais; o dono define a premiação
- [ ] ~~TV da unidade (`/tv`)~~ — **descartada em 2026-11-08** (decisão do dono do produto): o campeonato fica no app e no painel, sem tela de TV
- [ ] Automações do bot: campanhas só para quem aceitou mensagens (clientes sumidos, aniversariantes do mês, horários vagos de amanhã), com limite diário e relatório de resultado
- [ ] Cobrança automática do clube pelo Asaas (Pix e cartão): assinatura recorrente, baixa automática pelo webhook, aviso ao cliente quando a cobrança falhar
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
- [ ] Acompanhar receita recorrente, cancelamentos, clientes por plano e uso de disco e memória da VPS
- [ ] Quando a VPS passar de 70% de memória ou CPU com frequência, subir de plano ou separar o banco

**Próximas versões**

- [ ] Estoque completo: baixa do produto gasto no serviço, estoque mínimo, fornecedores e compras
- [ ] Fidelidade: pontos ou cashback por visita, resgate na comanda
- [ ] Sinal por Pix no agendamento pelo link e pelo bot, para horários disputados — **para o futuro** (2026-11-08: sem necessidade agora)
- [ ] Google Agenda: espelhar a agenda do profissional
- [ ] Importação do histórico da planilha (comandas antigas), com conferência — antes, definir com o dono o modelo da planilha (colunas e formato)
- [ ] Revisar os preços a cada 6 meses com a tabela de mercado do documento principal

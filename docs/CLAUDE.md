# Pente Fino — sistema de gestão para barbearias

> Nome provisório. Troque aqui se escolher outro.

SaaS multiempresa para barbearias: painel web, app do barbeiro (PWA) e bot de WhatsApp **sem IA** (respostas programadas pelo operador).
Proposta de valor: **"Saiba quanto sobra, não só quanto entrou."** Lucro real por serviço, por barbeiro e por unidade, a partir de uma comanda lançada uma vez só.

Documentação completa (PRD, TRD, fluxos, UI/UX, esquema, plano, preços e linha de desenvolvimento) em `docs/`. Leia `docs/` antes de decisões de produto.

## Stack

- Monorepo pnpm + Turborepo, TypeScript `strict`
- `apps/web`: Next.js (App Router) + Tailwind, PWA — site, painel, app do barbeiro e link público de agendamento
- `apps/api`: NestJS — regras, permissões, auditoria
- `apps/worker`: NestJS sem HTTP — bot do WhatsApp e rotinas agendadas (BullMQ)
- `packages/db`: Prisma + PostgreSQL com Row Level Security
- `packages/shared`: tipos, esquemas zod e **regras de cálculo** (fonte única, usada por API e front)
- `packages/ui`: componentes e tema
- `infra/`: docker-compose (dev e prod), Caddyfile, backup, deploy
- WhatsApp: Evolution API self-hosted, conexão por QR Code (sem API oficial)
- Produção: uma VPS Ubuntu 24.04 com Docker Compose atrás do Caddy (HTTPS automático)

## Comandos

- `pnpm dev` — sobe tudo (precisa do Docker rodando: `infra/docker-compose.dev.yml`)
- `pnpm db:migrate` (cria/aplica migrações em dev) / `pnpm db:deploy` (só aplica) / `pnpm db:seed` (modelos + conta de demonstração)
- `pnpm test:db` — testes contra o PostgreSQL (isolamento por conta, restrições)
- `pnpm test:e2e` — API de ponta a ponta contra PostgreSQL e Redis (login, convite, senha)
- `pnpm --filter @pente-fino/web test:e2e` — telas no navegador (Playwright); ao lado do `pnpm dev`, use `E2E_PORTA_WEB=3100 E2E_PORTA_API=3101` após `pnpm build`
- Telas: antes de criar ou mudar tela, carregar a skill de design; tokens de cor em `apps/web/src/app/globals.css`, componentes em `packages/ui`
- Usuários da demonstração: `dono@demo.pentefino.dev` (e os demais `@demo.pentefino.dev`), senha `pentefino123`; documentação da API em `http://localhost:3001/docs`
- `pnpm whatsapp:qr` — conecta o WhatsApp de teste à Evolution API local
- `pnpm admin:criar --email x --nome "Y"` — cria o primeiro admin (`/admin`, segundo fator no 1º acesso); `--redefinir` para senha e autenticador novos. Os próximos acessos (vendedor, admin) se dão em `/admin` → Equipe. Banco que já existia: rode `pnpm infra:plataforma` uma vez (cria o usuário de banco da administração)
- `pnpm test` / `pnpm lint` / `pnpm typecheck`

## Regras de negócio que não podem quebrar

- **Multiempresa:** toda tabela de negócio tem `conta_id`; RLS no PostgreSQL via `app.conta_id`. Nunca confiar em `conta_id` vindo do cliente. Usuário do banco da aplicação não é superusuário. Consultas de negócio sempre dentro de `naConta()` (`@pente-fino/db`); o banco preenche `conta_id` sozinho. Tabela nova com `conta_id` chama `habilitar_isolamento_conta('tabela')` na migração.
- **Dinheiro em centavos (inteiro)**, nunca float. Datas em UTC no banco, exibição em `America/Sao_Paulo`.
- **Lançamento único:** agendamento cria comanda prevista → barbeiro lança extras e confirma → recepção fecha. Só comanda **fechada** entra em faturamento, comissão e indicadores.
- Estados da comanda: prevista, em_atendimento, confirmada, pendente, fechada, cancelada, reaberta. Reabrir exige permissão (dono/gestor), motivo e auditoria.
- **Cliente** = comanda fechada com ao menos um serviço. Mesma regra todo mês.
- **Atendimentos** = soma do `peso_atendimento` dos serviços. Padrão: principal 1, extra 0, combo/convênio = soma dos inclusos.
- **Receita** tem tipo: serviço, produto ou não operacional (este fica fora do faturamento). A **mensalidade do clube** entra no faturamento no dia em que é paga (o que chega na conta: repasse no online), numa linha própria; o assinante conta como cliente e atendimento, mas o **ticket médio** = (serviços + produtos) ÷ clientes avulsos. O desempenho por barbeiro não leva a mensalidade.
- **Preço e regra de comissão têm vigência**; o item da comanda grava preço e comissão do momento. Mudar preço nunca altera o passado. Serviço com **preço livre** (desligado por padrão, faixa opcional): o valor é digitado na comanda (balcão; barbeiro só com a liberação do dono), a comissão sai dele e o valor fora da tabela vai para a auditoria; preço fixo não aceita outro valor (cobrar menos é desconto).
- **Comissão do clube:** sobre o preço de tabela da unidade na data (dono pode trocar por valor fixo).
- **Despesas:** fixa, variável, manutenção, investimento, retirada do dono, cartão e resgates. Investimento, retirada e cartão ficam fora do % de despesas operacionais. "Repetir todo mês" e "Copiar fixas do mês anterior" lançam no mês seguinte uma cópia por despesa, no máximo (`despesa.origem_id` única).
- **Projeção** = faturamento até hoje ÷ dias trabalhados até hoje × dias de trabalho do mês (calendário da unidade).
- **Lucro do serviço** = receita − (custo de produto + comissão).
- Barbeiro vê só os próprios dados; telefone do cliente pode ser oculto para ele.

## Papéis

dono, gestor, recepcao, barbeiro. Ver a matriz de permissões em `docs/`.

## Planos (limites aplicados pela API)

- Básico R$ 79,90/mês (anual R$ 66,90/mês): 1 unidade, até 3 profissionais
- Pro R$ 149,90/mês (anual R$ 124,90/mês): 1 unidade, até 10 profissionais
- Premium R$ 249,90/mês + R$ 99,90 por unidade extra (anual R$ 207,90 + R$ 82,90): profissionais ilimitados

## Convenções

- Código e nomes de domínio em português (`comanda`, `item_comanda`, `unidade`); textos da interface em pt-BR.
- Conventional Commits (`feat:`, `fix:`, `chore:`), uma branch por tarefa, PR com CI verde.
- Toda mudança que quem usa ou opera percebe entra no `CHANGELOG.md` (seção "Não publicado"), e a etapa correspondente da linha de desenvolvimento é marcada com o que foi feito.
- Validação com zod compartilhado entre API e front.
- Toda regra de cálculo nova vai para `packages/shared` com teste unitário antes da tela.
- Nunca publicar porta de PostgreSQL, Redis ou Evolution API na VPS (o Docker ignora o UFW).
- Nada de IA no produto: o bot é uma árvore de menus e palavras-chave.
- Sem páginas repetidas: cada número ou função fica num lugar só (Início = o dia e o resumo do mês; Resultados do mês = o detalhe do mês; Financeiro = o contábil; Equipe = o cadastro). Antes de criar tela ou bloco, conferir se o dado já existe e estender a tela dona.
- Ao desenvolver, aprender com o código e com os concorrentes (BestBarbers, Cash Barber, Trinks, AppBarber, Avec) e sugerir melhorias e funções extras para sair na frente: toda entrega termina com 2 a 5 sugestões concretas, ligadas ao que foi feito. Só implementar sugestão aprovada; as aprovadas entram na linha de desenvolvimento.

## Ordem de construção

Seguir `docs/linha-de-desenvolvimento.md`, etapa por etapa, marcando os checkboxes.

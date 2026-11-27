# Plano multissegmento (pedido do dono em 27/11/2026)

Documento de melhoria das fases 0 a 5: levar o Pente Fino de sistema de barbearia a sistema para
negócios de serviço com agenda (barbearia, salão, estética, academia, estúdio), com interface mais
simples, mentoria financeira, IA opcional e um site que mostre tudo isso.

**Regras desta rodada** (do pedido):

- Cada fase só começa com a aprovação do dono, depois do plano e das respostas.
- Nada quebra para quem já usa: migrações reversíveis, feature flags por conta, testes verdes.
- Cada fase termina com código, testes, docs, CHANGELOG e um resumo do que mudou.

**Esforço** em semanas de uma pessoa desenvolvendo com IA, incluindo testes e docs: P (até 1),
M (1 a 2), G (2 a 4), GG (4 ou mais). São estimativas para decidir a ordem, não prazos.

## Status

| Fase | Assunto | Esforço | Status |
| --- | --- | --- | --- |
| 0 | Documentação para IA e automação | M | feita em 27/11/2026 |
| 1 | Multissegmento | GG (dividida em 1a a 1d) | respostas recebidas em 27/11; aguardando o ok para começar a 1a |
| 2 | Interface mais simples | G a GG | aguardando aprovação |
| 3 | Mentoria financeira | G | aguardando aprovação |
| 4 | IA opcional | GG | aguardando aprovação (muda a [ADR 0007](decisoes/0007-bot-sem-ia.md)) |
| 5 | Landing page e marca | G | por último |

**Ordem (com as respostas de 27/11):** 0 → 1a → 1b → 1d (estética) → 3 → 2 → 1c (academia e
personal) → 4 → 5. A 1a (vocabulário e segmento) destrava tudo; a estética vem antes por escolha do
dono; a mentoria financeira (3) é o maior diferencial com o menor risco; a interface (2) fica
melhor depois de saber quais funções cada segmento terá.

## Respostas do dono (27/11/2026)

| Pergunta | Resposta | O que muda no plano |
| --- | --- | --- |
| 1. Segmentos | estúdio = tatuagem, unhas e afins; também personal trainer | Segmentos: barbearia, salão de beleza, estética, unhas e sobrancelhas, tatuagem e piercing, academia e estúdio (pilates, funcional), personal trainer, outro. |
| 2. Papel `barbeiro` | renomear | `barbeiro` vira `profissional` no banco e no código (S4), numa PR própria, antes do resto. |
| 3. Mais de um segmento por conta | o dono deixou a decisão comigo | **Um segmento por conta**, com funções de outros segmentos ligáveis por conta (S5): ver a [ADR 0014](decisoes/0014-um-segmento-por-conta.md). |
| 4. Comanda por baixo do contador | não ficou clara | Reformulada abaixo, em linguagem simples. |
| 5. Academia ou estética | estética | 1d antes da 1c. |
| 6. Modo da IA | a nossa IA primeiro (para testar e para faturar com o uso); chave própria depois, para quem quiser | IA2 começa pelo modo "nossa IA" com **créditos pré-pagos** e margem; a chave própria vem depois. Como pagamos o provedor antes, o saldo é sempre pré-pago e o limite é rígido: nunca consumo pós-pago. |
| 7. Merge | pode mesclar com o CI verde | As PRs são mescladas quando o CI fica verde. |

**Pergunta 4, reformulada:** hoje cada atendimento vira uma *comanda* (a ficha do cliente naquele
dia: quem atendeu, o que fez, quanto pagou). É dela que saem a comissão, o clube, o histórico do
cliente e a pesquisa de satisfação. No protótipo, a tela "Lançar atendimentos" tem botões **+**
para contar os serviços do dia, sem abrir comanda. A dúvida é: quando alguém aperta **+**, o
sistema (A) cria a comanda sozinho, por trás, e tudo continua funcionando igual (comissão, clube,
relatórios), só que mais rápido para quem lança; ou (B) deixa de ter comanda, e aí comissão por
profissional, clube e histórico do cliente precisariam ser refeitos de outro jeito. **Recomendo a
(A).**

---

## Fase 0 · Documentação para IA e automação (feita)

- `CLAUDE.md` (importa `docs/CLAUDE.md`) e `AGENTS.md` na raiz.
- Mapa em [README.md](README.md); documentos novos: [arquitetura.md](arquitetura.md) (Mermaid),
  [regras-de-negocio.md](regras-de-negocio.md) (exemplos conferidos por teste),
  [fluxos.md](fluxos.md), [papeis-e-permissoes.md](papeis-e-permissoes.md),
  [glossario.md](glossario.md) e o registro de decisões em [decisoes/](decisoes/README.md).
- **Gerado do código** (`pnpm docs:gerar`, conferido no CI): as **66 entidades e 29 enums** com
  campos e relações, as **330 rotas** da API, as **74 páginas**, planos e menu por papel.
- Auditoria: a documentação do produto estava desatualizada (sem o plano Agenda e as Automações;
  recursos por plano diferentes do código; entidades que não existem, como `bot_no`; ticket médio
  descrito como faturamento ÷ clientes, quando o código usa (serviços + produtos) ÷ clientes
  avulsos). Corrigido na versão nova; a original foi para `docs/historico/`.
- Duplicidade: a lista de 11/11 (230 itens feitos, 7 abertos), os briefings de 10/11 e a
  verificação de 15/11 foram para `docs/historico/`; o [a-fazer.md](a-fazer.md) novo tem só o
  que está aberto.

---

## Fase 1 · Multissegmento

### O que o código mostra hoje

- "barbeiro/barbearia" aparece **2.431 vezes em 431 arquivos** (o pedido estimava 1.360 em 232):
  880 em testes, 570 nas telas, 386 no `shared` (bot, textos, regras), 249 na API, 185 no banco
  (schema, migrações, seed) e 172 no site de vendas.
- O papel `barbeiro` é um valor do enum `Papel` no banco e aparece em 94 pontos do código
  (permissões, menu, JWT, testes).
- Já existem peças reaproveitáveis: o **clube** (planos, adesão, uso por ciclo, cobrança pelo
  Asaas com split), o catálogo de serviços com modelos, a **cifra** AES-256-GCM
  (`packages/db/src/cifra.ts`, hoje só com a chave da plataforma) e a auditoria com antes e depois
  (sem auditoria de leitura).

### 1a · Segmento e vocabulário (G)

| ID | Item |
| --- | --- |
| S1 | `conta.segmento` (enum: barbearia, salão de beleza, estética, unhas e sobrancelhas, tatuagem e piercing, academia e estúdio, personal trainer, outro), padrão `barbearia`. Migração reversível: contas existentes viram `barbearia`, sem nenhuma mudança visível. |
| S2 | `packages/shared/src/vocabulario.ts`: termos por segmento com singular, plural e gênero, organizados por idioma (pt-BR agora; a estrutura já aceita espanhol depois, sugestão aprovada em 27/11) (profissional/barbeiro/instrutor/esteticista; estabelecimento/barbearia/salão/academia/clínica; cliente/aluno/paciente; atendimento/aula/sessão). Teste para cada segmento. |
| S3 | Telas, e-mails, PDFs e mensagens do bot leem o vocabulário da conta (`useVocabulario()` no front; `vocabularioDaConta()` na API e no worker). As mensagens do bot ganham `{estabelecimento}` e `{profissional}`; `{barbearia}` continua aceita (as barbearias já personalizaram textos com ela). |
| S4 | Papel `barbeiro` → `profissional` (proposta abaixo). |
| S5 | Feature flags por conta: `conta.funcoes` (lista do que está ligado: check-in, turmas, anamnese, pacotes, fotos, IA...), com o padrão vindo do segmento e o dono ligando ou desligando. A API confere como hoje confere o plano. |
| S6 | Inventário automatizado: um teste que falha se aparecer "barbeiro" ou "barbearia" fixo em texto visível fora do vocabulário (lista de exceções para o site de barbearia e o vídeo). |

**Proposta para o papel `barbeiro`:** renomear para `profissional` **no banco e no código**
(`ALTER TYPE papel RENAME VALUE`, reversível), com um período em que a API aceita os dois nomes
nos tokens e nas entradas. É o que deixa o código, a API e os documentos neutros para outra IA e
para automações; só na exibição, o código continuaria dizendo "barbeiro" para uma esteticista.
Custo: 94 pontos de código e os testes; feito numa PR mecânica, isolada, antes do resto.

### 1b · Configuração inicial por segmento (M)

| ID | Item |
| --- | --- |
| S7 | A configuração guiada começa pela escolha do segmento. |
| S8 | Modelos por segmento (ampliando `catalogo-servicos` e o seed): serviços com duração e preço sugerido, categorias, categorias de despesa e menu e mensagens do bot prontos. |
| S9 | O segmento liga as funções certas (S5): academia já vem com check-in e turmas; estética com anamnese, pacotes e fotos. |

### 1c · Academia e personal trainer (G a GG)

O personal usa a mesma base da academia (aluno, plano recorrente, frequência), sem turmas por
padrão e com agenda por aluno.

| ID | Item |
| --- | --- |
| A1 | Plano recorrente (mensalidade), reaproveitando o clube: adesão, ciclo, cobrança manual ou pelo Asaas com split. Diferença: o plano dá acesso (check-in, turmas), não serviços cobertos na comanda. |
| A2 | Check-in: pela recepção (busca do aluno) e pelo próprio aluno (QR na recepção ou link). Conferido contra o plano ativo. |
| A3 | Frequência por aluno e por turma; aluno sumido entra no "clientes em risco" (Fase 2). |
| A4 | Turmas com horário, instrutor, vagas e lista de presença; agendamento de vaga pelo link e pelo bot. |
| A5 | Inadimplência: mensalidade vencida bloqueia check-in (configurável), avisa o aluno pelo WhatsApp e entra na central de avisos. |

### 1d · Estética (G a GG)

| ID | Item |
| --- | --- |
| E1 | Ficha e anamnese: formulário configurável por serviço, preenchido pelo cliente (link) ou na recepção. |
| E2 | Pacotes de sessões com saldo e validade (próximo do combo do clube, mas com saldo que desconta a cada sessão). |
| E3 | Fotos antes e depois, em armazenamento **privado** (hoje as fotos são do site, públicas em `/f/`). |
| E4 | Termo de consentimento por serviço: texto versionado, aceite com data, hora e o hash do texto. |
| E5 | **LGPD (dado de saúde é sensível):** acesso restrito por papel (uma permissão "ver ficha clínica", fora do papel por padrão), **auditoria de leitura** (tabela nova: quem abriu qual ficha e quando), **cifra** dos campos sensíveis com chave por conta derivada da chave da plataforma, retenção e exclusão a pedido. |

### Riscos da Fase 1

- **Volume:** 2.431 ocorrências; o risco maior é texto esquecido. Mitigação: S6 (teste que falha)
  e uma varredura por tela no navegador.
- **Testes de navegador procuram textos:** muitos vão mudar junto (são parte do esforço).
- **Textos que as barbearias já editaram** (menu e mensagens do bot no banco) dizem "barbearia":
  ficam como estão; só os padrões mudam.
- **Site e SEO de barbearia:** as páginas atuais continuam (barbearia segue sendo um segmento); as
  dos outros segmentos vêm na Fase 5.
- **Dados de saúde (estética):** exigem texto jurídico (termo e política de privacidade) que não é
  código; sem ele, a 1d não deve ir ao ar.

---

## Fase 2 · Interface mais simples

### O que o protótipo propõe

O protótipo "Pente Fino simples" (canvas com dono no celular e no computador, barbeiro e o mapa)
troca o menu de 16 itens por **bolinhas**, com no máximo 2 toques até qualquer coisa:

| Para quem | Bolinhas | O que entra em cada uma |
| --- | --- | --- |
| Dono | Lançar o dia · Atendimento · Financeiro · Relatórios · Configurações | Lançar o dia: agenda, lançar atendimentos, fechar o caixa. Atendimento: conversas, configurar o agente, follow-up e lembretes, página de agendamento. Financeiro: custos, entradas, comissões, lucro de verdade, fluxo de caixa. Relatórios: do período, por barbeiro, produtos, clientes. Configurações: serviços, equipe, produtos, clube, metas, unidades, WhatsApp, acessos. |
| Barbeiro | Meu dia · Minha comissão · Minha meta | Hoje, a receber, extrato; meta com barra e campeonato sem valores. |
| Recepção | Lançar o dia · Atendimento | O resto nem aparece. |

Também propõe: título do Início "Sobrou de verdade" (lucro) com "entrou" e a previsão do mês;
custos em duas abas (fixo, que se repete, e variável, com **parcelado em X vezes**); fechar o caixa
digitando dinheiro, Pix e cartão e vendo se bateu; e **fluxo de caixa dos próximos 3 meses** com a
sugestão de guardar 1 mês de custo fixo.

### Pontos do protótipo que mudam regras (precisam da sua decisão)

1. **"Lançar atendimentos com contador (+)" substituindo Comandas.** Hoje a comanda é o coração
   (cliente, profissional, comissão por item, clube, pesquisa, histórico do cliente,
   [ADR 0004](decisoes/0004-lancamento-unico.md)). **Proposta:** manter a comanda por baixo e
   criar o **lançamento rápido** como um jeito novo de lançar: cada "+" vira uma comanda fechada
   (com cliente opcional), no modo geral (só caixa) ou por profissional (comissão). Assim nenhum
   número, comissão ou relatório quebra. Substituir de verdade apagaria clientes, clube na comanda
   e pesquisa.
2. **"Sai da tela: comandas abertas, lista de espera, canais e avaliações."** Três desses são
   recursos vendidos no plano Pro. **Proposta:** saem do menu, mas continuam: lista de espera
   dentro da Agenda, canais e avaliações dentro de Relatórios, comandas abertas dentro de "Lançar
   o dia" para quem usa.
3. **Custos parcelados e fluxo de caixa** são funções novas (não existem hoje): entram nesta fase.

### Itens

| ID | Item | Esforço |
| --- | --- | --- |
| I1 | Navegação por bolinhas por papel (o `menu.ts` vira a fonte das bolinhas; endereços antigos redirecionam). | M |
| I2 | Uma ação principal por tela, linguagem simples, estados vazios que ensinam, mobile first (revisão tela a tela, com a skill de design e os tokens e componentes atuais). | G |
| I3 | Lançamento rápido com contador (+), geral ou por profissional (ponto 1). | M |
| I4 | Fechar o caixa conferindo dinheiro, Pix e cartão (o caixa do dia já calcula a divergência; muda a tela). | P |
| I5 | Despesa parcelada em X vezes (lança nos próximos meses; regra e teste no `shared`). | M |
| I6 | Fluxo de caixa de 3 meses e a reserva sugerida (usa projeção, fixas, parcelas e % de comissão). | M |
| I7 | Cartão de métrica padrão: valor, comparação com o período anterior, "o que significa" e "o que fazer". | M |
| I8 | Métricas novas no `shared`, com teste: taxa de retorno, faltas (no-show), ocupação (já existe), clientes em risco de sumir, receita recorrente e cancelamentos do clube ou dos planos, desempenho por profissional (já existe; ganha o cartão padrão). | G |
| I9 | Checklist de primeiros passos revisto por segmento (já existe para barbearia). | P |

**Riscos:** quem já usa se acostumou com o menu atual (mitigação: endereços antigos continuam e
um aviso "o menu mudou" na primeira vez); muitos testes de navegador navegam pelo menu e mudam
junto; a regra "sem páginas repetidas" vale para as bolinhas (cada número continua num lugar só).

---

## Fase 3 · Mentoria financeira

### Itens

| ID | Item | Esforço |
| --- | --- | --- |
| F1 | **Custo da hora:** despesas fixas do mês ÷ horas trabalhadas (expediente dos profissionais e calendário da unidade). | M |
| F2 | **Custo real do serviço** = tempo × custo da hora + comissão + produto → preço mínimo (empata) e sugerido (com a margem alvo). Evolui `precoMinimoDoCorte` e `sobraDoCorte` para qualquer serviço de qualquer segmento. | M |
| F3 | **Simulador de clube ou plano:** preço × uso médio × assinantes contra o custo real por atendimento → ponto de equilíbrio, lucro ou prejuízo e risco (seguro, atenção, arriscado), com a explicação. Usa o uso real (já existe "valor por atendimento do clube"). | M |
| F4 | **Simulador "e se":** aumentar preço, contratar, mudar comissão, dar desconto → efeito no lucro do mês, mostrando a conta. | M |
| F5 | **Alertas** na central de avisos: serviço com margem negativa, clube no prejuízo, despesa subindo três meses seguidos. | P |
| F6 | Tela de mentoria (uma por pergunta: "quanto cobrar?", "meu clube dá lucro?", "e se eu...?"), sempre com a conta aberta e o aviso de que são estimativas. | M |

Tudo determinístico, no `shared`, com teste; funciona sem IA. Com a IA ligada (Fase 4), ela só
explica a conta em palavras.

**Riscos:** a qualidade depende dos dados (sem as despesas lançadas, o custo da hora sai baixo).
Mitigação: cada resultado mostra a "confiança" (quantos meses de despesas, quantos atendimentos) e
o que falta lançar.

---

## Fase 4 · IA opcional

Muda a regra "Nada de IA no produto": quando aprovada, uma ADR nova substitui a
[0007](decisoes/0007-bot-sem-ia.md) e o `docs/CLAUDE.md` muda junto. Princípios: **desligada por
padrão**, o menu continua sendo o caminho principal e **nós nunca pagamos o consumo do cliente**.

### Itens

| ID | Item | Esforço |
| --- | --- | --- |
| IA1 | `packages/ia`: camada única de provedor (OpenAI, Anthropic, Google), com medição de tokens por conta e por função, limite rígido mensal, alertas de 50, 80 e 100% e volta automática ao menu quando acaba. | G |
| IA2 | Modos por conta: sem IA; chave própria do cliente (guardada cifrada, ele paga ao provedor); nossa IA com créditos pré-pagos ou franquia mais excedente, com margem, ligada aos planos (`planos.ts`, `temRecurso`). | G |
| IA3 | Antes de ligar, o dono vê a **estimativa de gasto**: média de mensagens por mês da própria conta × tokens por mensagem × preço do modelo escolhido. Pode escolher "IA só quando o menu não entender" ou "IA primeiro, ciente do custo". | P |
| IA4 | **Bot do WhatsApp com IA:** entra quando a mensagem não casa com o menu e o pedido em frase. Ferramentas limitadas e conferidas no servidor: ver horários, agendar, remarcar e cancelar **só os agendamentos daquele telefone**. Sem dados financeiros nem de outros clientes; resistente a "ignore as instruções" (o limite está nas ferramentas, não no texto); passa para humano pelos estados existentes (`origemDaConversa`); respeita o silêncio da madrugada; modelo barato, respostas curtas, histórico resumido, ritmo limitado e nada de envio em massa. | G |
| IA5 | **Assistente do painel** (separado do chat de suporte): responde com os dados que o usuário logado vê (mesmo papel e RLS), explica mudanças lendo a auditoria e altera dados pelos mesmos serviços da API, nunca SQL. Toda alteração mostra antes → depois e só executa depois de confirmar; financeira ou em massa pede confirmação reforçada. Fica na auditoria com origem = assistente (coluna nova). Desfazer e refazer a partir do antes e depois. | GG |

**Custo:** os preços dos modelos mudam; a estimativa (IA3) usa a tabela de preços vigente do
provedor no momento de implementar, não um número fixo neste documento.

**Riscos:**
- **Bloqueio do número** (Baileys não é oficial): a IA aumenta o volume de respostas. Mitigação:
  ritmo limitado, IA só responde a quem escreveu e nunca inicia conversa.
- **LGPD:** mandar mensagens de clientes para um provedor de IA exige o termo atualizado e o
  aviso ao cliente final; com a chave própria, o provedor é escolha da barbearia.
- **Custo descontrolado:** limite rígido e volta ao menu.
- **Resposta errada:** a IA nunca grava nada por conta própria; tudo passa pelas ferramentas com
  as mesmas regras da API e, no painel, pela confirmação.

---

## Fase 5 · Landing page e marca

| ID | Item | Esforço |
| --- | --- | --- |
| L1 | Opções de nome (abaixo) antes de qualquer página. | P |
| L2 | Home mostrando os segmentos; uma página por segmento com SEO próprio (título, descrição, dados estruturados, sitemap). | G |
| L3 | Planos atualizados (com as funções por segmento e a IA opcional) e a mentoria financeira como diferencial. | M |

**Opções de nome:**

1. **Manter "Pente Fino" para tudo.** Sem custo de troca; o nome é forte para barbearia e fraco
   para estética e academia ("pente" puxa para cabelo).
2. **Marca-mãe nova e neutra, com "Pente Fino" como a linha de barbearia.** Preserva o que já foi
   construído (domínio, SEO, clientes) e abre os outros segmentos com um nome que serve a todos.
   **Recomendada.**
3. **Submarcas por segmento sob a marca-mãe** (uma para salão, uma para estética, uma para
   academia). Mais forte em cada nicho, mas multiplica site, SEO e marketing.

Em qualquer opção: checar domínio, redes sociais e o INPI antes de decidir.

---

## Perguntas para o dono

Responda embaixo de cada uma (ou na conversa). As respostas mudam o plano.

**Fase 1**

1. **Segmentos:** além de barbearia, salão, estética e academia, o que é "estúdio" para você
   (tatuagem, pilates, unhas, sobrancelha)? Entra algum outro?
2. **Papel `barbeiro`:** aprova renomear para `profissional` no banco e no código (proposta), ou
   prefere mudar só o que aparece na tela?
3. **Uma conta, um segmento?** Ou um negócio misto (barbearia com estética) precisa de mais de um
   segmento na mesma conta (por unidade)?
4. **Academia:** o check-in é pela recepção, pelo aluno com QR ou os dois? Mensalidade vencida
   bloqueia o check-in?
5. **Estética:** a ficha e as fotos ficam visíveis para quem: só o dono e o profissional que
   atendeu? Tem advogado ou modelo de termo de consentimento e política de privacidade?
6. **Ordem:** academia ou estética primeiro?

**Fase 2**

7. **Comandas:** aprova manter a comanda por baixo e criar o lançamento rápido (proposta), em vez
   de substituir?
8. **Lista de espera, canais e avaliações:** podem sair do menu e ficar dentro de Agenda e
   Relatórios (proposta)?
9. **Quem é o Vitor** citado no protótipo ("versão 2, com os ajustes do Vitor") e ele deve validar
   as telas?

**Fase 3**

10. **Margem alvo padrão** para o preço sugerido (por exemplo, 20%), ou o dono informa?

**Fase 4**

11. **Modos de cobrança:** começar só com a chave própria (mais simples e sem risco de custo para
    nós) e deixar os créditos pré-pagos para depois?
12. **Provedores:** precisa dos três (OpenAI, Anthropic, Google) desde o início?
13. **Em quais planos** a IA pode ser ligada?

**Fase 5**

14. **Nome:** qual das três opções? Já tem algum nome em mente para a marca-mãe?

**Geral**

15. **Merge:** posso mesclar cada PR quando o CI ficar verde, como nas últimas, ou o merge fica
    com você?

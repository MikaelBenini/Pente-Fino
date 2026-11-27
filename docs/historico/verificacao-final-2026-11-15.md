# Verificação final do ecossistema (criado em 11/11/2026)

> **Histórico (arquivado em 27/11/2026).** Rodada de trabalho concluída, guardada só para consulta. O que falta fazer está em [`docs/a-fazer.md`](../a-fazer.md); o que foi feito, na [linha de desenvolvimento](../linha-de-desenvolvimento.md).

Conferência de ponta a ponta do sistema inteiro: o que roda sozinho, as integrações, o dia a dia
do barbeiro e se os números batem entre as telas. **Fica para o final**: só começa quando as
etapas do [a-fazer.md](a-fazer-2026-11.md) estiverem concluídas, para que nada desenvolvido depois fique
de fora. Documento temporário, como o a-fazer: no fim, o dono decide se fica ou é apagado.

Meta do dono: tudo rodando 100%, pensando no tempo do barbeiro.

## Como fazer

1. Antes de começar, atualizar as listas abaixo com o que entrou depois de 11/11 (rotinas, filas,
   integrações e telas novas). Conferir no código, não só aqui.
2. Para cada item: conferir no código, nos testes e, quando der, rodando de verdade (local ou
   sandbox). Marcar `[x]` com o que foi visto, ou abrir um item de correção.
3. Cada falha encontrada vira um item de correção na seção "Correções" (com o porquê), e depois
   um PR, como nas outras etapas.
4. No fim, um resumo para o dono: o que está 100%, o que foi corrigido e o que depende dele.

## Achados já vistos (11/11/2026, antes da verificação)

Anotados para não se perderem. Conferir de novo na verificação, porque o código pode ter mudado.
V2, V3 e V4 foram corrigidos em 11/11 no lote dos webhooks (linha de desenvolvimento, Etapa
23.5); na verificação, conferir que continuam valendo. O V1 continua aberto.

- [x] **V1 Bot e rotinas na mesma fila, uma coisa por vez.** Corrigido na verificação (C1): as três rotinas foram para a fila `whatsapp-rotinas`; as mensagens seguem em ordem na de entrada. A fila `whatsapp-entrada` roda com
  concorrência 1 para todas as barbearias e também executa as rotinas que passam por todas as
  contas: avisos a cada 15 min, automações às 10 h e avisos da assinatura às 9 h. Com muitas
  contas, o cliente que manda mensagem espera a rotina acabar, e uma mensagem lenta segura as
  outras barbearias. Ideia: rotinas numa fila própria e mensagens em paralelo, mantendo a ordem só
  por número.
- [x] **V2 Mensagem do cliente sem nova tentativa.** A fila de entrada não tem `attempts`: se o
  banco piscar, a mensagem do cliente, o lembrete ou a automação somem sem resposta. O atendimento
  já ignora mensagem repetida (`atenderMensagem` confere `idExterno` na transação), então tentar
  de novo é seguro.
- [x] **V3 Ninguém percebe se o worker parar.** O worker não tem healthcheck no
  `docker-compose.prod.yml` nem batimento. O `/health` confere só banco e Redis, e a Saúde do
  sistema mostra filas e falhas, mas não a última execução de cada rotina (só a da limpeza). Se o
  worker travar, os lembretes e o bot param em silêncio.
- [x] **V4 Lembrete perdido em silêncio.** `AgendaService.agendarLembretes` descarta o erro da fila
  (`.catch(() => undefined)`), sem log, e nenhuma rotina recria o que faltou. Lembrete que não sai
  vira falta e cadeira vazia. Ideia: registrar o erro e incluir na rotina de 15 min uma varredura
  dos horários das próximas 48 h (o `jobId` fixo já evita duplicar).

## 1. Rotinas automáticas (o que roda sozinho)

- [x] Inventário atualizado (15/11, lido do código): limpeza 3h30 e despesas fixas 6h (fila
  `limpeza`); avisos da assinatura 9h, automações 10h e central de avisos a cada 15 min (fila
  `whatsapp-rotinas`, antes na de entrada); alertas da equipe de hora em hora (fila
  `alertas-equipe`); os avulsos (lembretes, pesquisa, nota baixa, próximo cliente, atraso,
  horário mudou, vaga...) na fila de entrada. Despesas fixas e alertas entraram depois de 11/11.
  - automações do pós-atendimento (retorno e aniversário), 10 h
  - central de avisos (comandas pendentes, resumo do dia), a cada 15 min no expediente
  - avisos da assinatura (fim do teste, vencimento, cobrança vencida), 9 h
  - limpeza de dados (contas apagadas em 90 dias), 3h30
  - lembretes do horário (24 h e 2 h antes), pesquisa depois do atendimento, nota baixa,
    próximo cliente, agenda do dia da equipe, atendente sem resposta, atraso, horário mudou ou
    cancelado, vaga para a lista de espera
  - o que entrar depois de 11/11
- [x] Cada rotina roda uma vez só, mesmo com o worker reiniciando (agendador com id fixo): todas por `upsertJobScheduler` com id fixo; a troca de fila tira os agendamentos antigos
- [x] Uma conta com erro não para as outras: `try/catch` por conta nas três rotinas; o erro ia só para o log (C3: agora vai no resultado da rotina, na Saúde)
- [x] Horários no fuso de São Paulo e respeitando o expediente e o calendário de cada unidade: fuso e expediente ok (com teste); o calendário era ignorado pela central de avisos (C4)
- [x] Falha de rotina aparece na Saúde do sistema (não só no log): cinco rotinas apareciam; os alertas de hora em hora e as filas de alertas e de limpeza não (C2)
- [x] Depois de reiniciar o worker e o Redis, nada se perde (`appendonly` ligado; trabalhos
  atrasados continuam): `--appendonly yes` com volume próprio e healthcheck no worker

## 2. Integrações

- [x] **WhatsApp (Evolution):** no código e em 12 testes de ponta a ponta (provedor falso); a conexão por QR com um número de verdade é do **dono**. conectar por QR, receber, responder, intervalo entre envios
  (proteção contra bloqueio), queda avisada à barbearia e ao admin, reconexão, envio que falha
  marcado na conversa
- [x] **Asaas, cobrança do sistema:** 8 + 5 testes de ponta a ponta; webhook recusa segredo errado em produção (401). assinar, pagar, recusar, estornar, "Já paguei, conferir",
  troca de plano e conta bloqueada por falta de pagamento
- [x] **Asaas, clube online:** 4 testes de ponta a ponta; o site só oferece o link com o cadastro aprovado (#223). subconta, link do plano, primeira mensalidade criando a adesão,
  renovação, cancelamento no balcão cancelando no Asaas e repasse batendo com o extrato
- [x] **Asaas, nota fiscal:** 5 testes de ponta a ponta; dados fiscais conferidos pelo dono (a-fazer). eventos `INVOICE_*` e trava sem os dados fiscais
- [x] **E-mail:** fila com 3 tentativas; falha aparece na Saúde (trabalhos falhos da fila `emails`). cada modelo sai e os críticos que falham aparecem na Saúde do sistema
- [x] **Notificações no celular (push):** teste do processador; aparelho que saiu (404/410) é removido. inscrição, envio e aparelho sem permissão
- [x] **Google (Ads e GTM):** teste no navegador (`sign_up` com valor e BRL); **dono:** conferir no Tag Assistant. conversão com valor só no sucesso, consentimento de cookies

## 3. O dia do barbeiro (tempo e toques)

Rodar como cada papel, no celular, cronometrando.

- [x] Barbeiro: ver a agenda do dia, abrir a comanda, lançar um extra e confirmar em até 3 toques (abrir, extra, confirmar: "Começar atendimento" é opcional; `operacao.spec.ts`)
- [x] Barbeiro sem internet (PWA): lança e sincroniza quando volta (`offline.spec.ts`)
- [x] Recepção: agendar, receber e fechar; caixa do dia abrindo e fechando certo (`operacao.spec.ts`, `modo-recepcao.spec.ts`)
- [x] Cliente pelo bot e pelo site: agenda sozinho, recebe os lembretes, remarca e cancela sem
  ligar para a barbearia
- [x] Dono: Início e Resultados do mês respondem "quanto sobra" sem planilha (lucro do mês nas duas telas, números abaixo)
- [x] Nada de passo repetido nem tela que pede o mesmo dado duas vezes (regra "sem páginas repetidas" do CLAUDE.md; nada novo achado)

## 4. Os números batem

- [x] (15/11, banco de desenvolvimento, outubro: R$ 53.114,00 no Início, Resultados/Financeiro, Relatório e na soma do desempenho por barbeiro; lucro R$ 10.815,45 igual) Faturamento igual no Início, em Resultados do mês, no Financeiro, no Resumo do dia, no
  painel da rede e no arquivo do contador (com e sem filtro de unidade)
- [x] Caixa do dia igual à soma das comandas fechadas e dos sinais (3 dias de outubro: caixa = resumo do dia = indicadores; sinal com teste em `sinal.e2e-spec.ts`)
- [x] Comissões: o que o barbeiro vê é igual ao que o dono paga (Rafael, outubro: R$ 4.858,40 no celular dele, na lista do dono e no extrato; total R$ 21.560,65 = Início)
- [x] Clube: mensalidades no faturamento iguais às do relatório do clube (`clube.e2e-spec.ts`)
- [x] Desempenho por barbeiro somando o total da unidade (fora o clube, de propósito)
- [x] Fuso: comanda fechada às 23h50 cai no dia certo (`varreduras.e2e-spec.ts`)

## 5. Segurança

- [x] Webhooks (W1 a W5 do a-fazer) conferidos em produção (15/11: Asaas sem segredo e com segredo errado, 401; WhatsApp só da rede interna; portas 5432, 6379 e 8080 fechadas)
- [x] Isolamento por conta (RLS): `pnpm test:db` e uma tentativa manual entre duas contas (`isolamento.db.test.ts` na bateria; a de outra conta não acha, como em `passkey.e2e-spec.ts`)
- [x] Matriz de permissões por papel conferida rota a rota (`permissoes.e2e-spec.ts` falha se uma rota nova não declarar quem acessa)
- [x] Nenhum segredo no repositório nem nos logs (varredura de chaves do Asaas, chaves privadas e tokens: nada; logs só dizem que o segredo está errado ou faltando)

## 6. Produção

- [ ] Backup diário e externo funcionando, e restauração testada (`docs/restaurar.md`): **o diário não estava agendado** (C5; o Kuma só recebia os backups feitos à mão). Depois do deploy da correção, **dono:** conferir no Kuma que chega todo dia e testar uma restauração
- [x] Deploy e volta para a versão anterior (deploy automático a cada merge, sem falha nos últimos; `./atualizar.sh anterior` documentado em `producao.md`)
- [x] Certificado TLS, espaço em disco e monitoramento (Uptime Kuma) com alerta chegando (TLS até 05/02/2027, renova sozinho; Kuma: site 99,86%, API 99,93%, Evolution, disco e memória sem queda nas últimas 50 checagens)
- [x] Produção no mesmo código do `main` e CHANGELOG publicado (deploy de cada merge conferido no Actions; a #223 no ar)

## 6b. Plano Agenda

- [x] Assinar o plano Agenda, usar a agenda, o link, o site e os avisos no WhatsApp, contratar as
  Automações por mais R$ 10 e conferir o valor da fatura; cada convite de subir de plano aparece
  na hora certa (3º barbeiro, 2ª unidade, cadeado, resumo de 30 dias, faltas)
- [x] O que fica fora do plano aparece com cadeado no menu e não responde na API, e o convite para subir
  de plano leva ao plano certo
- [x] O plano aparece no site: página de vendas, `/planos`, comparativo e a página de busca
  "agenda para barbeiro"

## 7. A documentação bate com o sistema

- [x] `docs/CLAUDE.md` (regras e comandos) igual ao código (comandos todos existem; os planos não tinham o Agenda nem as Automações: C6)
- [x] Documentação do produto, linha de desenvolvimento e CHANGELOG cobrindo tudo o que foi feito (as 177 referências do a-fazer existem no código)
- [ ] `docs/producao.md` e `docs/restaurar.md` funcionando passo a passo: faltava o agendamento do backup (C5, agora no deploy); a restauração passo a passo só dá para testar no servidor (**dono**)

## Correções

Itens encontrados na verificação, cada um com o porquê e o PR.

Verificação feita em 15/11/2026. Corrigido no PR "fix: verificação final".

- [x] **C1 Rotinas e mensagens na mesma fila (V1).** As três rotinas de todas as contas foram para
  `whatsapp-rotinas`, com worker próprio; as mensagens seguem uma por vez, em ordem, sem esperar
  rotina. Os agendamentos antigos saem da fila de entrada na subida do worker.
- [x] **C2 Rotina e filas fora da Saúde do sistema.** Os alertas de hora em hora não registravam a
  execução, e as filas de alertas e de limpeza não eram lidas: falha nelas passava em silêncio.
- [x] **C3 Erro de uma conta só no log.** O resultado da rotina diz quantas contas falharam e o
  primeiro motivo (`FalhasPorConta`), e a Saúde mostra.
- [x] **C4 Calendário ignorado pela central de avisos.** Em dia fechado (feriado), saía resumo do
  dia e aviso de caixa aberto como se a unidade tivesse aberto.
- [x] **C5 Backup diário não agendado.** Nenhum documento ensinava a pôr o backup no cron, e o
  Uptime Kuma só recebia os backups feitos à mão (horários soltos, falhas a cada ~26 h). O
  `implantar.sh` passa a garantir, a cada deploy, o backup às 3h de Brasília e o vigia a cada
  5 min (troca as linhas antigas, para não rodar em dobro).
- [x] **C6 Planos do CLAUDE.md.** Faltavam o plano Agenda e as Automações à parte.

## Resumo para o dono

- **100%:** os números batem entre todas as telas (faturamento, lucro, caixa, comissões), a
  segurança (webhooks, portas, isolamento, permissões, segredos), o certificado, o monitoramento,
  o deploy, o plano Agenda e o caminho do barbeiro em 3 toques.
- **Corrigido:** C1 a C6 acima.
- **Depende de você:** depois do deploy, ver no Uptime Kuma o "Backup do dia" chegando de
  madrugada por dois dias; testar uma restauração (`docs/restaurar.md`); conferir no Tag Assistant
  a conversão do Google Ads.

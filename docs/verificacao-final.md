# Verificação final do ecossistema (criado em 11/11/2026)

Conferência de ponta a ponta do sistema inteiro: o que roda sozinho, as integrações, o dia a dia
do barbeiro e se os números batem entre as telas. **Fica para o final**: só começa quando as
etapas do [a-fazer.md](a-fazer.md) estiverem concluídas, para que nada desenvolvido depois fique
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

- [ ] **V1 Bot e rotinas na mesma fila, uma coisa por vez.** A fila `whatsapp-entrada` roda com
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

- [ ] Inventário atualizado: cada rotina com o horário, a fila, o que faz e o que acontece se
  falhar
  - automações do pós-atendimento (retorno e aniversário), 10 h
  - central de avisos (comandas pendentes, resumo do dia), a cada 15 min no expediente
  - avisos da assinatura (fim do teste, vencimento, cobrança vencida), 9 h
  - limpeza de dados (contas apagadas em 90 dias), 3h30
  - lembretes do horário (24 h e 2 h antes), pesquisa depois do atendimento, nota baixa,
    próximo cliente, agenda do dia da equipe, atendente sem resposta, atraso, horário mudou ou
    cancelado, vaga para a lista de espera
  - o que entrar depois de 11/11
- [ ] Cada rotina roda uma vez só, mesmo com o worker reiniciando (agendador com id fixo)
- [ ] Uma conta com erro não para as outras
- [ ] Horários no fuso de São Paulo e respeitando o expediente e o calendário de cada unidade
- [ ] Falha de rotina aparece na Saúde do sistema (não só no log)
- [ ] Depois de reiniciar o worker e o Redis, nada se perde (`appendonly` ligado; trabalhos
  atrasados continuam)

## 2. Integrações

- [ ] **WhatsApp (Evolution):** conectar por QR, receber, responder, intervalo entre envios
  (proteção contra bloqueio), queda avisada à barbearia e ao admin, reconexão, envio que falha
  marcado na conversa
- [ ] **Asaas, cobrança do sistema:** assinar, pagar, recusar, estornar, "Já paguei, conferir",
  troca de plano e conta bloqueada por falta de pagamento
- [ ] **Asaas, clube online:** subconta, link do plano, primeira mensalidade criando a adesão,
  renovação, cancelamento no balcão cancelando no Asaas e repasse batendo com o extrato
- [ ] **Asaas, nota fiscal:** eventos `INVOICE_*` e trava sem os dados fiscais
- [ ] **E-mail:** cada modelo sai e os críticos que falham aparecem na Saúde do sistema
- [ ] **Notificações no celular (push):** inscrição, envio e aparelho sem permissão
- [ ] **Google (Ads e GTM):** conversão com valor só no sucesso, consentimento de cookies

## 3. O dia do barbeiro (tempo e toques)

Rodar como cada papel, no celular, cronometrando.

- [ ] Barbeiro: ver a agenda do dia, abrir a comanda, lançar um extra e confirmar em até 3 toques
- [ ] Barbeiro sem internet (PWA): lança e sincroniza quando volta
- [ ] Recepção: agendar, receber e fechar; caixa do dia abrindo e fechando certo
- [ ] Cliente pelo bot e pelo site: agenda sozinho, recebe os lembretes, remarca e cancela sem
  ligar para a barbearia
- [ ] Dono: Início e Resultados do mês respondem "quanto sobra" sem planilha
- [ ] Nada de passo repetido nem tela que pede o mesmo dado duas vezes

## 4. Os números batem

- [ ] Faturamento igual no Início, em Resultados do mês, no Financeiro, no Resumo do dia, no
  painel da rede e no arquivo do contador (com e sem filtro de unidade)
- [ ] Caixa do dia igual à soma das comandas fechadas e dos sinais (quando o A2 existir)
- [ ] Comissões: o que o barbeiro vê é igual ao que o dono paga
- [ ] Clube: mensalidades no faturamento iguais às do relatório do clube
- [ ] Desempenho por barbeiro somando o total da unidade (fora o clube, de propósito)
- [ ] Fuso: comanda fechada às 23h50 cai no dia certo

## 5. Segurança

- [ ] Webhooks (W1 a W5 do a-fazer) conferidos em produção
- [ ] Isolamento por conta (RLS): `pnpm test:db` e uma tentativa manual entre duas contas
- [ ] Matriz de permissões por papel conferida rota a rota
- [ ] Nenhum segredo no repositório nem nos logs

## 6. Produção

- [ ] Backup diário e externo funcionando, e restauração testada (`docs/restaurar.md`)
- [ ] Deploy e volta para a versão anterior
- [ ] Certificado TLS, espaço em disco e monitoramento (Uptime Kuma) com alerta chegando
- [ ] Produção no mesmo código do `main` e CHANGELOG publicado

## 7. A documentação bate com o sistema

- [ ] `docs/CLAUDE.md` (regras e comandos) igual ao código
- [ ] Documentação do produto, linha de desenvolvimento e CHANGELOG cobrindo tudo o que foi feito
- [ ] `docs/producao.md` e `docs/restaurar.md` funcionando passo a passo

## Correções

Itens encontrados na verificação, cada um com o porquê e o PR.

- (vazio até a verificação começar)

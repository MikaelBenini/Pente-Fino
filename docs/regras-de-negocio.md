# Regras de negócio

As regras que fazem os números do Pente Fino baterem, com exemplos. Cada exemplo marcado com
**(E1)**, **(E2)**... roda de verdade em `packages/shared/src/exemplos-das-regras.test.ts`: se a
regra mudar no código, o teste quebra e este documento tem de mudar junto. Valores em reais; no
código, tudo é centavo (inteiro).

As regras que **não podem quebrar** estão resumidas em [CLAUDE.md](CLAUDE.md); aqui fica o
porquê e a conta.

## 1. Lançamento único

O atendimento é lançado uma vez: o **agendamento cria a comanda prevista**, o barbeiro lança
extras e confirma, a recepção recebe e fecha. Caixa, comissão e indicadores saem da comanda
fechada; ninguém digita de novo.

| Estado | Como entra | Quem age |
| --- | --- | --- |
| prevista | Agendamento criado | ninguém ainda |
| em_atendimento | Barbeiro inicia ou recepção abre na hora | barbeiro |
| confirmada | Barbeiro confirma | recepção |
| pendente | Horário terminou sem confirmação | recepção ou gestor |
| fechada | Recepção recebe e fecha | dono ou gestor, se precisar alterar |
| cancelada | Cliente não veio ou desistiu (conta como falta) | ninguém |
| reaberta | Alteração depois de fechar: só dono ou gestor, com motivo e auditoria | dono ou gestor |

**Só comanda fechada** entra em faturamento, comissão e indicadores. Funções:
`statusEfetivo`, `podeAgirNaComanda`, `totaisComanda` (`comanda.ts`).

## 2. Preço e comissão gravados no item

- **Vigência.** O preço vale a partir de uma data (`preco_servico.vigencia_inicio`); a comanda grava
  o preço do momento. Mudar o preço nunca altera o passado. O mesmo vale para a regra de comissão.
- **Comissão do item** = valor do item × percentual da regra vigente, ou valor fixo × quantidade
  (`comissaoItem`, `dinheiro.ts`). **(E1)** Corte de R$ 50,00 com regra de 40%: comissão de
  R$ 20,00. Regra fixa de R$ 15,00 em 2 unidades: R$ 30,00.
- **Preço por barbeiro.** O barbeiro pode ter o próprio preço de um serviço
  (`preco_profissional`, com vigência); vale na comanda dele e quando marcam com ele. Sem preço
  próprio, vale o da unidade.
- **Preço livre** (química e afins, desligado por padrão): o valor é digitado na comanda, dentro
  da faixa opcional; a comissão sai do valor digitado e o valor fora da tabela vai para a
  auditoria. Preço fixo não aceita outro valor: cobrar menos é desconto.
- **Desconto da comanda** é rateado entre os itens (`ratearDesconto`).

## 3. Indicadores do período

Tudo sai de comandas **fechadas** do período e da unidade filtrada (`calcularIndicadores`,
`indicadores.ts`).

| Indicador | Conta |
| --- | --- |
| Faturamento | serviços + produtos − descontos + mensalidades do clube recebidas no período. Receita não operacional fica fora. |
| Clientes | comandas fechadas com ao menos um serviço (o assinante conta: ocupou a cadeira) |
| Clientes avulsos | clientes que pagaram algum serviço na hora |
| Ticket médio | (serviços + produtos) ÷ clientes avulsos: o assinante não puxa a média para baixo |
| Atendimentos | soma do peso de cada serviço (principal 1, extra 0, combo ou convênio = soma dos inclusos) |
| % de extras | quantidade de itens extra ÷ clientes |
| Despesas operacionais | fixas + variáveis + manutenção + comissões. Investimento, retirada do dono e cartão/resgates ficam de fora. |
| % de despesas | despesas operacionais ÷ faturamento |
| Lucro | faturamento − despesas operacionais |

**(E2)** Um período com três comandas e o clube:

| Comanda | Itens | Valor | Comissão | Peso |
| --- | --- | --- | --- | --- |
| Ana | Corte · Sobrancelha (extra) | R$ 50,00 · R$ 15,00 | R$ 20,00 · R$ 6,00 | 1 · 0 |
| Bruno | Combo corte + barba · Pomada (produto) | R$ 80,00 · R$ 40,00 | R$ 32,00 · R$ 4,00 | 2 · 0 |
| Caio (assinante) | Corte coberto pelo clube | R$ 0,00 | R$ 20,00 (sobre a tabela) | 1 |

Mensalidades recebidas: R$ 99,00. Despesas: fixas R$ 80,00, variáveis R$ 20,00, investimento
R$ 300,00.

- Serviços R$ 145,00 + produtos R$ 40,00 + clube R$ 99,00 = **faturamento R$ 284,00**.
- Clientes 3 (Ana, Bruno, Caio); avulsos 2. **Ticket médio** = R$ 185,00 ÷ 2 = **R$ 92,50**.
- Atendimentos = 1 + 0 + 2 + 1 = **4** (1 do clube; cada atendimento do clube vale R$ 99,00).
- Extras: 1 item, R$ 15,00; **% de extras** = 1 ÷ 3.
- Comissões = 20 + 6 + 32 + 4 + 20 = **R$ 82,00**.
- Despesas operacionais = 80 + 20 + 82 = **R$ 182,00** (o investimento de R$ 300,00 fica fora).
- **Lucro** = 284 − 182 = **R$ 102,00**; **% de despesas** = 182 ÷ 284 ≈ 64%.

O custo de produto dos itens (R$ 28,00 no exemplo) aparece na lucratividade por serviço e
produto, não no lucro do mês (que usa as despesas lançadas).

**Lucro do serviço** = receita − (custo de produto + comissão) (`lucratividadePorServico`).

## 4. Projeção e calendário

Projeção = faturamento até hoje ÷ dias trabalhados até hoje × dias de trabalho do mês, pelo
calendário da unidade (dias da semana + folgas e feriados) (`diasDeTrabalho`, `projetar`).

**(E3)** Novembro de 2026, segunda a sábado, feriado em 02/11: 24 dias de trabalho. Em 13/11,
com 10 dias trabalhados e R$ 12.000,00 faturados: projeção = 12.000 ÷ 10 × 24 = **R$ 28.800,00**.

## 5. Clube

- O que o plano cobre entra na comanda com valor zero e conta no uso do ciclo; o resto (ou acima
  do limite) entra com preço normal (`coberturaDoServico`, `restantesDoCiclo`).
- A **mensalidade entra no faturamento no dia em que é paga** (no online, o repasse que chega na
  conta), na linha "Clube (mensalidades)". O desempenho por barbeiro não leva a mensalidade.
- **Comissão do atendimento do clube** = regra do profissional sobre o **preço de tabela da
  unidade**, ou um valor fixo definido pelo dono (`comissaoDoClube`). **(E5)** Corte de tabela
  R$ 50,00, regra 40%: R$ 20,00. Com valor fixo de R$ 15,00: R$ 15,00.

## 5b. Pacotes de sessões (Fase 1d)

Decisão do dono em 28/11/2026: **igual ao clube** (ADR 0016). Função "Pacotes" da conta (padrão na
estética e em unhas; qualquer conta liga em Configurações → Funções).

- O pacote é de **um serviço**, com número de sessões, validade em dias e valor (`pacoteSchema`).
  A venda grava sessões, valor e serviço do momento: mudar o pacote depois não muda o que o
  cliente comprou.
- O **valor entra no faturamento no dia em que é pago**, na linha "Pacotes" (`receitaPacotes`).
  Cancelar depois não tira o que já entrou; devolução de dinheiro é despesa.
- Na comanda, o serviço do cliente usa primeiro o clube, depois o **pacote que vence primeiro**
  (`partesDoServico`): a sessão entra com **valor zero** e desconta do saldo. Saldo = sessões −
  itens nas comandas não canceladas (`saldoDoPacote`); cancelar a comanda devolve a sessão.
  Vencido, esgotado ou cancelado, o serviço volta ao preço normal (`situacaoDoPacote`).
- A sessão conta como **cliente e atendimento**, fica **fora do ticket médio** e paga **comissão
  sobre o preço de tabela da unidade** na data (`comissaoDoClube`, sem valor fixo).
  **(E9)** Pacote de 3 drenagens por R$ 240,00 vendido hoje; uma sessão usada (tabela R$ 100,00,
  regra 40%) e uma limpeza de pele avulsa de R$ 150,00: faturamento R$ 390,00 (R$ 240,00 de
  pacotes + R$ 150,00 de serviços), 1 cliente, 2 atendimentos, ticket médio R$ 150,00 e comissão
  da sessão R$ 40,00.

## 6. Sinal (receber adiantado)

Pagamento com `sinal = true` na comanda aberta (só o balcão, com o caixa de hoje aberto, até o que
falta receber). Entra no caixa do dia em que foi recebido e abate do total no fechamento
(`restanteAposSinal`, `entradasDoCaixa`). **(E4)** Comanda de R$ 80,00 com sinal de R$ 30,00:
faltam **R$ 50,00** no fechamento. Devolvido, sai do caixa no dia da devolução; sem devolver,
fica retido.

## 7. Despesas fixas e salários

"Repetir todo mês" e "Copiar fixas do mês anterior" lançam uma cópia por despesa no mês seguinte,
no máximo (`despesa.origem_id` única). O salário (valor fixo em Equipe) de cada barbeiro entra
sozinho como despesa fixa do mês: um por barbeiro e mês (`garantirSalariosDoMes`).

## 8. Calculadoras do site

(`calculadoras.ts`) **(E6)**

- **Sobra do corte**: corte de R$ 50,00, comissão 40%, produto R$ 3,00 → comissão R$ 20,00,
  produto R$ 3,00, **sobra R$ 27,00**.
- **Preço mínimo** = (produto + custos fixos ÷ cortes do mês) ÷ (1 − comissão − margem). Custos
  fixos de R$ 6.000,00, 400 cortes no mês, comissão 40%, produto R$ 3,00, margem 20%: fixo por
  corte R$ 15,00 e **preço mínimo R$ 45,00** (comissão R$ 18,00, margem R$ 9,00).

## 9. Clientes e WhatsApp

- **Um telefone, um cliente.** O celular é guardado sempre com o nono dígito (gatilho
  `cliente_telefone_canonico` no banco, igual a `telefoneCanonico`); a restrição (conta, telefone)
  é única. **(E7)** "(44) 9976-4653" vira `5544999764653`.
- **Proteção do número.** O bot só manda mensagem para quem já escreveu para a unidade e não
  respondeu SAIR.
- **Nada automático de madrugada.** Mensagem automática que não responde a quem acabou de
  escrever não sai entre 22h e 7h (`emHorarioDeSilencio`); o lembrete que cairia nesse horário
  sai às 21h59 da véspera; a pesquisa da noite vai às 9h. **(E8)** Um aviso gerado às 23h30 sai
  às **7h** do dia seguinte.
- **Estado da conversa**: bot respondendo, aguardando atendente (bot pausado) ou em atendimento
  humano (bot pausado). Toda mudança fica em `bot_sessao_evento`, com a origem.
- **Trava contra loop**: muitas mensagens dos dois lados em 2 minutos, contando desde a última
  devolução, param o bot e passam a conversa para a equipe (`pareceLoop`).

## 10. Planos

Limites e recursos por plano, conferidos pela API (`temRecurso`, `verificarLimite`): tabela
gerada do código em [gerado/planos.md](gerado/planos.md).

## 11. Isolamento e privacidade

- Nenhuma conta vê dados de outra (RLS por `conta_id`).
- O barbeiro vê só os próprios dados; o telefone do cliente pode ficar oculto para ele.
- Alterações sensíveis (comanda fechada, preço, comissão, despesa) vão para a auditoria, com
  antes e depois.

## Proteção dos números de WhatsApp

Fonte: `packages/shared/src/protecao-whatsapp.ts` (regras puras, com teste), aplicadas em
`prepararEnvio` (`packages/db/src/bot.ts`) e no worker. A conexão é por QR Code, não pela API
oficial: o WhatsApp restringe o número que manda muita mensagem sem resposta, rápido demais,
repetida ou para quem não quer receber. Valem só para a mensagem **automática** (sem autor da
equipe); a mensagem digitada pela equipe sai como sempre.

- **Proativa** = automática para quem não escreveu nas últimas 24 horas (lembrete, retorno,
  aniversário, pesquisa, aviso). É gravada com `mensagem.proativa = true`.
- **Aquecimento:** limite de proativas por dia pelo tempo desde que o número atual foi conectado
  (`bot_conexao.conectado_em`): até o 3º dia, 20; até o 7º, 50; até o 14º, 100; depois, 200.
  Passou do limite: sai no dia seguinte às 9 h, ou é descartada se até lá passar de 12 horas.
- **Ritmo humano:** entre duas proativas do mesmo número, 25 s mais até 20 s ao acaso (vaga
  reservada no Redis, sem duas mensagens na mesma vaga). Toda automática mostra "digitando..."
  antes: 1 s mais 35 ms por letra, entre 1,2 s e 6 s.
- **Nada repetido:** o mesmo texto para o mesmo número em menos de 10 minutos é descartado.
- **Pausa por risco:** 5 falhas de envio em 30 minutos pausam as proativas por 6 horas; 5 ou mais
  SAIR em 24 horas (e pelo menos 3% das proativas do período) pausam por 24 horas. Dono e gestor
  recebem o aviso "Mensagens automáticas pausadas"; a resposta a quem escreve continua.
- **Prioridade no limite do dia:** retorno, aniversário, aviso do clube e pesquisa usam só 70% do
  limite (`limiteDaMensagem`); lembrete do horário, vaga da lista de espera e horário mudado usam o
  limite todo. Num número com limite 20, o 15º retorno do dia espera; o lembrete das 15 h sai.
- **Abertura variada:** na proativa, "Oi, Ana!" do começo sai como "Oi, Ana!", "Olá, Ana!" ou
  "Oi, Ana, tudo bem?" (`variarAbertura`, escolhida pelo id da mensagem); o histórico guarda o que
  saiu.
- **Retomar agora:** dono ou gestor encerram a pausa em Bot → Conexão, com o que foi resolvido
  (auditado); os sinais de risco passam a contar a partir daí (`bot_conexao.retomado_em`).
- **Semana do número por e-mail:** segunda às 9 h, para dono e gestor (desliga em Perfil → Avisos),
  com as automáticas, os SAIR e as pausas dos últimos 7 dias e um conselho.
- **Hora do cliente:** retorno, aniversário e aviso do clube saem na hora em que o cliente
  costuma escrever (a mais comum das últimas 30 mensagens dele, com pelo menos 3), entre a rotina
  das 10 h e as 20 h, com até 30 minutos ao acaso (`horaDoCliente`, `horarioDoEnvio`). Sem
  histórico, saem na rotina.
- Número novo conectado na unidade recomeça o aquecimento e sai da pausa do anterior.
- A administração vê em **Saúde do sistema → WhatsApp** os números pausados ou com 3 ou mais SAIR
  ou falhas em 24 horas (`plataforma_numeros_em_risco()`, só contagens).
- Já existiam: só para quem já escreveu para a unidade, nunca para número ligado ao sistema,
  nada automático de madrugada, no máximo 20 automações por dia e a trava contra loop.

Exemplo: número conectado ontem, 20 lembretes já saíram hoje. O 21º, criado às 12 h, ficaria para
amanhã às 9 h (21 horas depois): é descartado. A resposta "Escolha o serviço" para quem acabou de
escrever sai na hora.

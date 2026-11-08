# Sistema Barbearia — Documentação do Produto

Nov 3, 2026 · @Mikael

## Visão geral

O Sistema Barbearia substitui três ferramentas que hoje não conversam: a comanda de papel, a planilha por unidade e o app de agenda. Ele tem três partes: um painel web, um app do barbeiro e um bot de WhatsApp. O bot trabalha com respostas programadas pelo operador e não usa IA, por causa do custo.

O coração do produto é o **lançamento único**. O agendamento cria a comanda, o barbeiro completa no app e a recepção fecha. Caixa, comissão e indicadores atualizam sozinhos.

Este documento reúne seis partes:

| Parte | Responde a |
| --- | --- |
| PRD | O que construir e por quê |
| TRD | Como construir: arquitetura, regras de cálculo, segurança |
| Fluxo do app | O caminho de cada pessoa e os estados da comanda |
| UI/UX | Telas, navegação e linguagem visual |
| Esquema backend | Entidades, campos, endpoints e rotinas |
| Plano de implementação | Fases, entregas, riscos e decisões tomadas |

As fontes são o mapa do sistema e o briefing da planilha (VHG Studio, 03/11/2026). Onde o documento propõe algo que essas fontes não definem, o texto marca como proposta.

## 1. PRD · Requisitos do produto

O produto existe para que cada atendimento seja lançado uma vez só e para que o dono veja lucro real, por unidade e por barbeiro, sem montar planilha.

### Problema

- **Lançamento triplo.** O barbeiro marca na comanda de papel, a recepção digita na planilha e a agenda fica em outro app.
- **Regras que mudam entre meses.** Cliente e atendimento são contados de um jeito em janeiro e de outro em março e outubro. Isso distorce o ticket médio e a projeção.
- **Receita que some.** "Outros" entra no total do dia e fica fora do faturamento do mês.
- **Comissões vazias.** O bloco de comissões está sem valor, então o % de despesas sai menor do que é.
- **Estrutura rígida.** Barbeiro novo exige coluna nova e fórmula editada. Mudar o preço no meio do mês recalcula os dias anteriores.
- **Sem visão de rede e de lucro.** Há um arquivo por unidade e só o % de despesas, sem margem por serviço.
- **IA cara.** O atendimento por IA no WhatsApp foi descartado por custo.

### Objetivos

1. Acabar com a comanda de papel e a digitação depois do atendimento.
2. Ter uma regra única, igual todo mês, para cliente, atendimento, faturamento e comissão.
3. Mostrar lucro do mês e margem por serviço, por unidade e na rede.
4. Dar ao barbeiro a própria agenda, comandas, comissão e meta, sem acesso ao resto.
5. Atender e agendar pelo WhatsApp com menu programado, sem custo de IA.

### Personas

| Persona | Quem é | O que precisa |
| --- | --- | --- |
| Dono | Tem uma ou mais unidades | Lucro, metas, comparação entre unidades, preços por unidade |
| Gestor | Cuida de uma unidade | Agenda, equipe, caixa e indicadores da unidade |
| Recepção | Atende no balcão | Agenda de todos, abrir e fechar comandas, receber |
| Barbeiro | Profissional comissionado | Própria agenda, lançar extras, ver comissão e meta |
| Cliente final | Cliente da barbearia | Agendar e tirar dúvidas pelo WhatsApp, usar o clube |

### Escopo por módulo

| Módulo | O que faz | Plano |
| --- | --- | --- |
| Acesso e papéis | Login, convite, papéis dono, gestor, recepção e barbeiro | Básico |
| Unidades | Cadastro com dias de trabalho e capacidade | Básico: 1 · Premium: várias |
| Agenda | Calendário por profissional, agendamento, lista de espera, ocupação | Básico (lista de espera: Pro) |
| Comandas | Comanda automática, casos especiais, comanda impressa | Básico |
| Serviços e preços | Catálogo com custo, extra e peso; preço por unidade com vigência | Básico (preço por unidade: Premium) |
| Clube da barbearia | Assinatura, combos, convênios | Pro |
| Produtos e estoque | Catálogo, venda, estoque, fornecedores | Básico a Premium |
| Clientes | Perfil, leads, fidelidade, recorrência | Básico a Premium |
| Equipe e comissões | Profissional com data de entrada, regra de comissão com vigência, ficha de desempenho do profissional | Básico (comissões: Pro) |
| Financeiro | Caixa, receitas separadas, despesas por categoria, lucro real | Básico (lucro real: Premium) |
| Métricas e metas | Indicadores, ritmo, projeção, metas, lucratividade | Pro (lucratividade: Premium) |
| App do barbeiro | Agenda, comandas, clientes, desempenho, comissão, metas | Básico a Premium |
| Bot WhatsApp | Menu, respostas prontas, agendamento pela conversa ou pelo site (o cliente escolhe), lembretes, avaliação depois do atendimento, mensagens de retorno | Pro (automações: Premium) |
| Campeonato dos barbeiros | Ranking por % da meta, % de extras e nota, sem valores, no app e no painel (a TV da unidade foi descartada em 2026-11-08) | Premium |

### Requisitos funcionais

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-01 | Cadastrar conta, unidades, usuários e papéis; convite por e-mail ou WhatsApp | MVP |
| RF-02 | Cadastrar serviços com duração, custo de produto, flag de extra e peso em atendimentos | MVP |
| RF-03 | Tabela de preço com uma coluna por unidade e data de início de vigência | MVP |
| RF-04 | Cadastrar profissional com data de entrada, horários e regra de comissão com vigência | MVP |
| RF-05 | Agenda por profissional em dia, semana e mês; novo, remarcar e cancelar | MVP |
| RF-06 | Todo agendamento cria uma comanda prevista com cliente, barbeiro e serviços | MVP |
| RF-07 | Abrir comanda na hora para cliente sem agendamento | MVP |
| RF-08 | Barbeiro lança extras e produtos, ajusta serviço trocado e confirma no app | MVP |
| RF-09 | Recepção vê comandas pendentes, recebe com várias formas de pagamento e fecha | MVP |
| RF-10 | Cliente que não veio: comanda cancelada, fora do faturamento, conta como falta | MVP |
| RF-11 | Alterar comanda fechada só com permissão; registrar quem, quando e o quê | MVP |
| RF-12 | Cada item da comanda grava o preço e a regra de comissão do momento | MVP |
| RF-13 | Despesas por categoria: fixa, variável, manutenção, investimento, retirada do dono, cartão e resgates | MVP |
| RF-14 | Indicadores: faturamento, clientes, ticket médio, atendimentos, % de extras, % de despesas | MVP |
| RF-15 | App do barbeiro com agenda, comandas, comissão (previsto, a receber, pago) | MVP |
| RF-16 | Comanda impressa em PDF A4, 4 ou 6 por folha, com QR code | MVP |
| RF-17 | Metas por unidade e mês para faturamento e qualquer serviço; atual e % automáticos | V2 |
| RF-18 | Ritmo do mês e projeção recalculada todo dia pelo calendário da unidade | V2 |
| RF-19 | Ocupação calculada pela agenda e pela capacidade | V2 |
| RF-20 | Clube: planos de assinatura, combos e convênios com valor por unidade | V2 |
| RF-21 | Comanda reconhece o cliente do clube; o coberto não é cobrado, o resto entra como extra | V2 |
| RF-22 | Lucro do mês e margem por serviço (custo = produto + comissão) | V2 |
| RF-23 | Painel da rede com filtro por unidade e comparativo | V2 |
| RF-24 | Bot: conexão por QR Code, menu numerado, respostas por palavra-chave, horário do bot | V2 |
| RF-25 | Bot: agendamento pelo menu (serviço, profissional, horário livre) | V2 |
| RF-26 | Lembrete e confirmação por modelo de mensagem | V2 |
| RF-27 | Bot: transferir para atendente e devolver ao bot | V2 |
| RF-28 | Campeonato dos barbeiros sem valores (TV da unidade descartada) | V3 |
| RF-29 | Cobrança recorrente online do clube (Pix e cartão) | V3 |
| RF-30 | Estoque com baixa do produto gasto no serviço, fornecedores e compras | V3 |
| RF-31 | Fidelidade (pontos e cashback) e mensagens de retorno | V3 |
| RF-32 | Importar o histórico da planilha atual (CSV) | V3 |
| RF-33 | Ficha do profissional: faturamento, atendimentos, serviços, tempo real x previsto, comandas atendidas, clientes recorrentes, confirmação no prazo, avaliações e evolução mensal | V2 |
| RF-34 | O cliente escolhe agendar pela conversa do WhatsApp ou pelo site; a preferência fica guardada | V2 |
| RF-35 | O cliente vê, remarca e cancela os próprios horários pelo bot ou por link, dentro do prazo da unidade | V2 |
| RF-36 | Avaliação de 1 a 5 pelo WhatsApp depois do fechamento da comanda, ligada ao profissional; nota baixa avisa o dono | V2 |
| RF-37 | Lista de espera: horário que vaga é oferecido pelo bot a quem espera, em ordem | V2 |
| RF-38 | Avisos por papel (pendências, divergência de caixa, resumo do dia) no app e por notificação no celular | V2 |

### Regras de negócio

- **RN-01 Cliente.** Um cliente atendido = uma comanda fechada com ao menos um serviço. A regra vale para todos os meses.
- **RN-02 Atendimento.** Atendimentos = soma do peso de cada serviço da comanda. O peso é cadastrado no serviço; convênio de corte e barba, por exemplo, pode pesar 2.
- **RN-03 Receita.** Toda receita tem tipo: serviço, produto ou não operacional. Não operacional não entra no faturamento.
- **RN-04 Preço.** O preço vale a partir da data de vigência. Vendas passadas não mudam.
- **RN-05 Comissão.** A comissão é calculada em cada item, pela regra vigente na data do item.
- **RN-06 Extra.** Serviço marcado como extra conta em quantidade e em reais nos indicadores de extras.
- **RN-07 Clube.** O que o plano cobre não é cobrado; o uso é contado no limite do mês.
- **RN-08 Isolamento.** Nenhuma conta vê dados de outra. Barbeiro vê só os próprios dados.

### Métricas de sucesso (proposta)

| Métrica | Alvo |
| --- | --- |
| Comandas fechadas sem papel | 100% após 30 dias de uso |
| Comandas confirmadas pelo barbeiro antes do fechamento | 90% ou mais |
| Diferença entre caixa do sistema e caixa físico | Zero no fechamento do dia |
| Barbeiros que abrem o app pelo menos uma vez por dia | 80% ou mais |
| Agendamentos feitos pelo bot | Acompanhar a partir da V2 |

### Fora de escopo

- Atendimento por IA.
- App nativo nas lojas: o app do barbeiro começa como PWA.
- Emissão de nota fiscal (NFS-e) e contabilidade: o sistema só exporta o relatório do mês para o contador.

## 2. TRD · Requisitos técnicos

A proposta é um monólito modular em TypeScript sobre PostgreSQL, com isolamento por conta no banco e filas para tudo que roda fora do clique. É o caminho mais curto para um time pequeno e aguenta várias redes de barbearia sem reescrita.

### Arquitetura

O painel web e o app do barbeiro são o mesmo front-end, com telas diferentes por papel. A API concentra as regras. O bot e as rotinas agendadas rodam como workers separados, ligados por fila.

&#91;embedded content: arquitetura · 4 entradas, 1 API, 4 serviços de apoio\]

O bot consulta a mesma API da agenda para mostrar horários livres; fotos e PDFs ficam num armazenamento de arquivos à parte.

### Stack proposta

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Front-end | Next.js (React) + TypeScript, PWA | Um código para painel e app do barbeiro; instala no celular sem loja |
| UI | Tailwind + biblioteca de componentes própria | Tema escuro e cores dos planos já definidos no mapa |
| API | NestJS (Node) + TypeScript | Módulos por domínio, injeção de dependência, validação |
| Banco | PostgreSQL com Row Level Security | Isolamento por conta garantido pelo banco |
| ORM | Prisma ou Drizzle | Migrações versionadas e tipos gerados |
| Filas e cache | Redis + BullMQ | Lembretes, mensagens do bot, recálculos e cobranças |
| Arquivos | Armazenamento compatível com S3 | Fotos, logos e PDFs de comanda |
| PDF | Geração no servidor (HTML para PDF) | Comanda A4 com QR code |
| Hospedagem | Um servidor VPS com Docker Compose | Custo fixo baixo, tudo em um lugar; cresce para nuvem gerenciada depois |
| Observabilidade | Logs estruturados, rastreio de erros, métricas | Achar falha de fechamento de caixa rápido |

### Multiempresa

- Toda tabela de negócio tem `conta_id`. Tabelas de operação também têm `unidade_id`.
- O PostgreSQL aplica RLS: a sessão define `app.conta_id` e as políticas filtram cada consulta.
- O token do usuário carrega conta, papel e unidades permitidas. A API nunca confia em `conta_id` vindo do cliente.
- Testes automáticos tentam ler dados de outra conta em todos os endpoints.

### Permissões por papel

| Recurso | Dono | Gestor | Recepção | Barbeiro |
| --- | --- | --- | --- | --- |
| Agenda | Todas as unidades | Sua unidade | Sua unidade | Só a própria |
| Comandas | Tudo | Sua unidade | Abrir, receber, fechar | Lançar e confirmar as próprias |
| Alterar comanda fechada | Sim | Sim, com registro | Não | Não |
| Clientes | Todos | Sua unidade | Sua unidade | Só os que atendeu; telefone oculto se configurado |
| Preços e custos | Editar | Ver | Ver preço | Ver preço |
| Financeiro e lucro | Tudo | Sua unidade | Caixa do dia | Não |
| Comissões | Todas | Sua unidade | Não | Só a própria |
| Metas | Definir | Ver | Ver | Ver a própria |
| Bot e configurações | Sim | Bot da unidade | Conversas | Não |
| Exportar dados | Sim | Sua unidade | Não | Não |

### Regras de cálculo

Todas as regras rodam sobre itens de comanda fechada do período e da unidade filtrada. Nada é digitado.

Faturamento do período (serviços e produtos, menos descontos; não operacional fica fora):

```latex
\text{Faturamento} = \sum \text{serviços} + \sum \text{produtos} - \sum \text{descontos}
```

Clientes, ticket médio e atendimentos:

```latex
\text{Clientes} = \#\,\text{comandas fechadas com serviço} \qquad \text{Ticket} = \frac{\text{Faturamento}}{\text{Clientes}} \qquad \text{Atendimentos} = \sum \text{peso do serviço}
```

Extras e despesas:

```latex
\%\,\text{extras} = \frac{\text{qtde de itens extra}}{\text{Clientes}} \qquad \%\,\text{despesas} = \frac{\text{fixas} + \text{comissões} + \text{manutenção} + \text{variáveis}}{\text{Faturamento}}
```

Investimento, retirada do dono e cartão e resgates aparecem em separado e não entram no % de despesas operacionais.

Projeção do mês, recalculada todo dia pelo calendário da unidade:

```latex
\text{Projeção} = \frac{\text{Faturamento até hoje}}{\text{dias trabalhados até hoje}} \times \text{dias de trabalho no mês}
```

Lucratividade por serviço e lucro do mês:

```latex
\text{Lucro do serviço} = \text{receita} - (\text{custo de produto} + \text{comissão}) \qquad \text{Lucro do mês} = \text{Faturamento} - \text{despesas operacionais}
```

Comissão de um item = valor do item × percentual da regra vigente na data do item (ou valor fixo, se a regra for fixa).

Ocupação = minutos agendados ÷ minutos disponíveis dos profissionais no período, usando a capacidade da unidade.

### Bot WhatsApp sem IA

- **Motor de fluxo.** O menu é uma árvore de nós: mensagem, opções numeradas, palavra-chave, pergunta com resposta, ação (agendar, ver preço, falar com atendente).
- **Sessão por número.** Guarda o nó atual e os dados coletados; expira após um tempo sem resposta (proposta: 30 minutos) e volta ao menu.
- **Agendamento pelo menu.** O bot lista serviços, profissionais e horários livres consultando a mesma API da agenda. Depois de cada serviço escolhido, pergunta se o cliente quer adicionar outro (mostra o total anotado; 0 segue para o horário).
- **Transferência.** A opção "falar com atendente" pausa o bot naquele número até a recepção devolver.
- **Fora do horário.** Mensagem configurada, com opção de agendar mesmo assim.
- **Provedor: Evolution API por QR Code.** Software livre instalado no próprio servidor e conectado como WhatsApp Web: sem custo por mensagem e sem aprovação da Meta. Não é a API oficial; com demanda baixa o risco de restrição é pequeno, e o bot usa número dedicado, espaça os envios e só manda lembrete a quem agendou. A camada do bot deve ficar atrás de uma interface para trocar de provedor sem reescrever o fluxo.

### Rotinas agendadas

| Rotina | Quando | O que faz |
| --- | --- | --- |
| Lembrete de horário | Proposta: 24 h e 2 h antes | Envia modelo pelo bot e registra confirmação |
| Comandas pendentes | A cada 15 min no expediente | Avisa a recepção de comandas sem confirmação do barbeiro |
| Fechamento do dia | Fim do expediente | Consolida indicadores do dia e gera alerta de divergência de caixa |
| Projeção e ritmo | Diário | Recalcula projeção, ritmo e % de metas |
| Clube | Diário | Vence assinaturas, zera usos no ciclo, dispara cobrança |
| Recorrência | Diário | Lista clientes sem voltar no prazo e envia mensagem de retorno |
| Avaliação | Após cada fechamento (proposta: 1 h) | Envia a pesquisa a quem aceitou mensagens; expira em 48 h |
| Lista de espera | Ao cancelar um horário | Oferece a vaga em ordem; o primeiro que confirmar leva |

### Integrações

| Integração | Uso | Fase |
| --- | --- | --- |
| WhatsApp via Evolution API | Bot, lembretes e mensagens | V2 |
| Pix estático da barbearia | QR de cobrança do clube, baixa pela recepção | V2 |
| Asaas | Cobrança automática do clube (Pix e cartão) | V3 |
| Google Agenda | Espelhar a agenda do profissional | V3 |
| Importação de planilha (CSV) | Cadastros no piloto; histórico depois | Piloto e V3 |

### Requisitos não funcionais

- **LGPD.** Base legal registrada, consentimento para mensagens, exportação e exclusão de dados do cliente, telefone mascarado para barbeiro quando configurado.
- **Auditoria.** Toda alteração em comanda fechada, preço, comissão e despesa gera registro imutável com usuário, data e antes/depois.
- **Desempenho.** Telas de agenda e comanda abrem em menos de 1 segundo em 4G; indicadores do mês em menos de 2 segundos (proposta).
- **Disponibilidade e backup.** Backup diário com retenção de 30 dias e teste de restauração mensal (proposta).
- **Conexão ruim.** O app do barbeiro guarda lançamentos se cair a internet e envia quando voltar.
- **Dinheiro.** Valores em centavos (inteiro), nunca em ponto flutuante. Fuso America/Sao\_Paulo para dias de trabalho.

## 3. Fluxo do app

Todo caminho termina no mesmo lugar: uma comanda fechada, que alimenta caixa, comissão e indicadores. As jornadas abaixo mostram quem faz o quê até lá.

### Primeiro acesso do dono

1. Cria a conta e escolhe o plano.
2. Cadastra a primeira unidade: endereço, dias de trabalho e capacidade.
3. Cadastra serviços com duração, custo de produto, extra e peso.
4. Preenche a tabela de preços da unidade.
5. Cadastra profissionais com data de entrada, horários e regra de comissão.
6. Convida gestor, recepção e barbeiros.
7. Opcional: conecta o WhatsApp e monta o menu do bot a partir de um modelo pronto.
8. Opcional: define metas do mês.

### Dia da recepção

1. Abre a agenda do dia com todas as comandas previstas.
2. Cliente sem horário chega: abre comanda na hora e escolhe o barbeiro.
3. Cliente não aparece: marca falta; a comanda é cancelada.
4. Barbeiro confirma a comanda: ela aparece como pronta para receber.
5. Recebe, escolhe a forma de pagamento e fecha.
6. Comanda sem confirmação aparece como pendente; a recepção cobra o barbeiro ou fecha com o gestor.
7. No fim do dia, confere o caixa do sistema com o caixa físico.

### Dia do barbeiro (app)

1. Abre o app e vê a agenda do dia e a meta do mês.
2. Começa o atendimento: a comanda já tem cliente e serviços.
3. Lança extras e produtos; ajusta o serviço se o cliente trocou na cadeira.
4. Confirma a comanda ao terminar.
5. Vê a comissão do dia atualizar quando a recepção fecha.

### Rotina do dono

1. Abre o Início: ritmo do mês, faturamento x meta e projeção.
2. Filtra por unidade ou vê a rede inteira.
3. Confere despesas, lucro e margem por serviço.
4. Ajusta preços com data de vigência ou metas do próximo mês.
5. Fecha comissões a pagar por barbeiro.

### Cliente no WhatsApp (bot sem IA)

1. Manda qualquer mensagem; recebe a boas-vindas e o menu numerado.
2. Escolhe 1 Agendar: o bot lista serviços; a cada serviço escolhido pergunta "quer adicionar mais algum?" (corte + barba, por exemplo) e, com 0, segue para profissionais e horários livres.
3. Confirma: o agendamento entra na agenda e já cria a comanda prevista.
4. Recebe lembrete antes do horário e responde para confirmar ou remarcar.
5. Se a barbearia mudar ou cancelar o horário, recebe o aviso pelo WhatsApp quando a recepção deixa marcada a opção "Avisar o cliente" (no cancelamento, com o convite para marcar outro).
6. Outras opções: preços da unidade, endereço e horário, clube, falar com atendente.
7. Palavra-chave reconhecida em qualquer ponto (ex.: "preço", "endereço") leva direto à resposta pronta.

### Estados da comanda

&#91;embedded content: estados da comanda · 7 estados\]

Só a comanda fechada entra em faturamento, comissão e indicadores; a tabela diz quem age em cada estado.

| Estado | Como entra | Quem age |
| --- | --- | --- |
| Prevista | Agendamento criado | Ninguém ainda |
| Em atendimento | Barbeiro inicia, ou recepção abre na hora | Barbeiro |
| Confirmada | Barbeiro confirma no app | Recepção |
| Pendente | Fim do horário sem confirmação | Recepção ou gestor |
| Fechada | Recepção recebe e fecha | Dono ou gestor, se precisar alterar |
| Cancelada | Cliente não veio ou desistiu | Ninguém |
| Reaberta | Alteração depois de fechar, com permissão | Dono ou gestor, com registro |

### Clube na comanda

1. Ao abrir a comanda, o sistema procura adesão ativa do cliente.
2. Itens cobertos pelo plano entram com valor zero para o cliente e contam no uso do mês.
3. Itens fora do plano, ou acima do limite, entram com preço normal como extra.
4. A receita do clube vem da mensalidade, não do item: o relatório separa as duas coisas.

## 4. UI/UX design

A interface é pensada para uso em pé e com pressa: recepção no balcão e barbeiro entre um cliente e outro. Cada tela responde a uma pergunta e a ação principal fica sempre ao alcance do polegar.

### Princípios

1. **Uma tela por pergunta.** "Quem é o próximo?", "Quanto falta receber?", "Bati a meta?".
2. **Lançar em até 3 toques.** Adicionar um extra na comanda: abrir comanda, tocar no serviço, confirmar.
3. **Número sempre com contexto.** Faturamento ao lado da meta; ticket ao lado do mês anterior.
4. **Mostrar só o que o papel pode ver.** O menu é montado pelo papel; nada aparece bloqueado com cadeado.
5. **Erros que não deixam perder dinheiro.** Fechar comanda pede confirmação do total; alterar comanda fechada pede motivo.

### Navegação por papel

| Papel | Dispositivo principal | Menu |
| --- | --- | --- |
| Dono | Computador e celular | **Dia a dia:** Início · Resumo do dia · Agenda · Comandas · Caixa do dia · Clientes · **Gestão:** Financeiro · Métricas e metas · Equipe · **Cadastros:** Serviços · Produtos · Clube · **WhatsApp:** Bot · Conversas do bot · **Conta:** Configurações |
| Gestor | Computador | Igual ao dono, limitado à unidade, sem Planos |
| Recepção | Tablet ou computador no balcão | Agenda · Comandas · Caixa do dia · Clientes · Conversas do bot (tudo o que a recepção vê, dono e gestor também veem) |
| Barbeiro | Celular (PWA) | Hoje · Comandas · Clientes · Desempenho · Comissões · Metas · Perfil |

### Telas principais

| Tela | Para quem | O que mostra | Ação principal |
| --- | --- | --- | --- |
| Início do dono | Dono, gestor | Faturamento x meta, ritmo, projeção, lucro, ticket, ocupação, extras | Filtrar unidade |
| Agenda | Recepção, gestor | Colunas por profissional, blocos por horário, cor por estado da comanda | Novo agendamento |
| Comanda | Recepção, barbeiro | Cliente, plano do clube, itens, total, estado | Confirmar ou fechar |
| Fechamento | Recepção | Total, descontos, formas de pagamento divididas | Receber e fechar |
| Caixa do dia | Recepção, dono e gestor | Entradas por forma, comandas pendentes, divergência | Fechar o dia |
| Hoje (barbeiro) | Barbeiro | Próximos clientes, meta do mês com barra, comissão do dia | Abrir comanda |
| Comissões (barbeiro) | Barbeiro | Extrato por item, previsto, a receber e pago | Filtrar período |
| Preços | Dono | Tabela serviço x unidade, vigência | Novo preço a partir de uma data |
| Metas | Dono | Objetivo por unidade, mês e serviço; atual e % | Definir meta |
| Lucratividade | Dono | Serviço, quantidade, receita, custo, lucro, margem | Ordenar por margem |
| Despesas | Dono, gestor | Lançamentos por categoria, % sobre faturamento | Nova despesa |
| Ficha do profissional | Dono, gestor; barbeiro vê a própria | Resumo do período, serviços, comandas atendidas, clientes recorrentes, rotina, avaliações, evolução | Exportar PDF |
| Construtor do bot | Dono, gestor | Árvore do menu, respostas, palavras-chave, prévia de conversa | Publicar menu |
| Conversas | Recepção, dono e gestor | Caixa de entrada, quem espera atendente primeiro, aviso no menu | Responder (assume) ou devolver ao bot |

### Componentes

- **Cartão de indicador.** Valor, rótulo, comparação (meta ou mês anterior) e de onde vem o número ao tocar.
- **Barra de meta.** Atual sobre objetivo, com marca de onde deveria estar hoje pelo ritmo.
- **Bloco de agenda.** Cliente, serviço, duração; cor pelo estado da comanda.
- **Linha de item da comanda.** Serviço ou produto, barbeiro, preço gravado, selo "clube" ou "extra".
- **Etiqueta de estado.** Prevista, em atendimento, confirmada, pendente, fechada, cancelada.
- **Tabela editável.** Usada em preços, metas e despesas; aceita colar da planilha.
- **Prévia de conversa.** Simula o menu do bot como o cliente vê no WhatsApp.

### Identidade visual

A proposta segue o mapa do sistema.

| Elemento | Valor |
| --- | --- |
| Fundo do app | Escuro (#0B0B0B), com tema claro opcional para a recepção |
| Destaque de módulo | Amarelo (#F5D33B) |
| Ação e sucesso | Verde (#A5E34B) |
| Plano Básico · Pro · Premium | Azul (#9ED8F5) · Lilás (#BBAAF2) · Laranja (#F7AE72) |
| Tipografia | Barlow para títulos, Barlow Condensed para tabelas e listas densas |
| Ícones | Traço simples, nunca emoji |

### Acessibilidade e uso real

- Alvos de toque com 44 px ou mais; texto com contraste mínimo de 4,5:1.
- Estado da comanda nunca só pela cor: sempre com texto.
- Tela do barbeiro funciona com uma mão e com tela bloqueada pouco tempo depois.
- Números grandes na TV, legíveis a 3 metros.

## 5. Esquema backend

O modelo gira em torno de `comanda` e `item_comanda`: todo indicador, comissão e caixa é uma consulta sobre itens de comandas fechadas. Preço e regra de comissão ficam gravados no item, por isso mudanças futuras não reescrevem o passado.

Todas as tabelas abaixo têm `id` (UUID), `conta_id`, `criado_em` e `atualizado_em`, omitidos para encurtar. Dinheiro em centavos (inteiro).

### Entidades

| Entidade | Campos principais | Observação |
| --- | --- | --- |
| conta | nome, logo\_url, plano, status | Raiz do isolamento multiempresa |
| unidade | nome, endereço, telefone, dias\_trabalho (dias da semana), capacidade, fuso | Capacidade alimenta a ocupação |
| calendario\_unidade | unidade\_id, data, trabalha (sim/não) | Feriados e folgas; base da projeção |
| usuario | nome, email, telefone, senha\_hash | Pode ter papel em várias unidades |
| papel\_usuario | usuario\_id, papel (dono, gestor, recepcao, barbeiro), unidade\_id | Unidade vazia = todas |
| profissional | usuario\_id, unidade\_id, data\_entrada, data\_saida, ativo | Barbeiro é cadastro, não coluna |
| horario\_profissional | profissional\_id, dia\_semana, inicio, fim | Bloqueios em tabela própria |
| bloqueio\_agenda | profissional\_id, inicio, fim, motivo | Almoço, folga |
| regra\_comissao | profissional\_id, tipo\_item (servico, produto), percentual, valor\_fixo, vigencia\_inicio | Vigência evita recálculo do passado |
| servico | nome, categoria, duracao\_min, custo\_produto, eh\_extra, peso\_atendimento, ativo | Peso define atendimentos |
| preco\_servico | servico\_id, unidade\_id, valor, vigencia\_inicio | Uma linha por mudança |
| produto | nome, categoria, foto\_url, preco\_venda, custo, ativo |  |
| estoque | produto\_id, unidade\_id, quantidade, minimo |  |
| movimento\_estoque | produto\_id, unidade\_id, tipo (entrada, saida, ajuste, reserva), quantidade, origem | Origem pode ser item de comanda |
| fornecedor e pedido\_compra | dados do fornecedor; itens, custo, status | V3 |
| cliente | nome, telefone, email, aniversario, unidade\_origem\_id, origem\_lead, etapa\_lead, consentimento\_msg, canal\_preferido (whatsapp, site) | Telefone único por conta |
| nota\_cliente | cliente\_id, profissional\_id, texto | Anotações do atendimento |
| item\_clube | tipo (assinatura, combo, convenio), nome, valor, unidade\_id, limite\_uso\_mes, ativo | Valor por unidade |
| item\_clube\_servico | item\_clube\_id, servico\_id, quantidade | Serviços inclusos |
| adesao\_clube | cliente\_id, item\_clube\_id, status, inicio, vencimento, usos\_no\_ciclo |  |
| cobranca\_clube | adesao\_id, valor, vencimento, status, gateway\_id | V3 |
| agendamento | unidade\_id, profissional\_id, cliente\_id, inicio, fim, status, origem (balcao, bot, app) | Cria a comanda |
| comanda | unidade\_id, cliente\_id, profissional\_id, agendamento\_id, status, total\_bruto, desconto, total\_liquido, confirmada\_em, fechada\_em, fechada\_por | Ver estados no Fluxo do app |
| item\_comanda | comanda\_id, tipo (servico, produto, nao\_operacional), servico\_id ou produto\_id, profissional\_id, quantidade, preco\_unitario, desconto, coberto\_clube, adesao\_id, eh\_extra, peso\_atendimento, comissao\_percentual, comissao\_valor | Valores gravados no momento |
| pagamento | comanda\_id, forma (dinheiro, pix, debito, credito, clube), valor | Várias por comanda |
| caixa\_dia | unidade\_id, data, aberto\_por, fechado\_por, total\_sistema, total\_informado, divergencia |  |
| despesa | unidade\_id, categoria (fixa, variavel, manutencao, investimento, retirada\_dono, cartao\_resgate), descricao, valor, competencia, pago | Investimento e retirada fora do % operacional |
| pagamento\_comissao | profissional\_id, periodo, valor, pago\_em | Comissão paga |
| meta | unidade\_id, mes, tipo (faturamento, servico), servico\_id, objetivo | Atual é calculado, não guardado |
| auditoria | usuario\_id, entidade, entidade\_id, acao, antes, depois, motivo | Imutável |
| bot\_conexao | unidade\_id, provedor, numero, status | Um número por unidade |
| bot\_no | unidade\_id, pai\_id, tipo (mensagem, menu, palavra\_chave, acao), texto, opcao\_numero, acao | Árvore do menu |
| bot\_sessao | unidade\_id, telefone, no\_atual\_id, dados, com\_atendente, expira\_em |  |
| mensagem | unidade\_id, cliente\_id, direcao, texto, enviada\_em, status | Histórico de conversa |
| modelo\_mensagem | unidade\_id, tipo (lembrete, confirmacao, retorno, aniversario, avaliacao, boas\_vindas, fora\_horario), texto com variáveis |  |
| avaliacao | comanda\_id, profissional\_id, cliente\_id, nota (1 a 5), comentario, enviada\_em, respondida\_em, tratada\_em | Uma por comanda |
| lista\_espera | unidade\_id, cliente\_id, profissional\_id, data, faixa\_inicio, faixa\_fim, status | Oferecida em ordem quando vaga um horário |
| aviso | usuario\_id, tipo, texto, link, lido\_em | Central de avisos e notificações |

### Relacionamentos-chave

- conta 1:N unidade, usuario, servico, produto, cliente.
- unidade 1:N profissional, agendamento, comanda, despesa, meta, caixa\_dia.
- agendamento 1:1 comanda (comanda pode existir sem agendamento).
- comanda 1:N item\_comanda e pagamento.
- item\_comanda N:1 servico ou produto; N:1 profissional; N:1 adesao\_clube (opcional).
- item\_clube N:N servico via item\_clube\_servico.

### Índices e restrições

- `preco_servico (conta_id, servico_id, unidade_id, vigencia_inicio)` único; consulta pega a maior vigência até a data.
- `regra_comissao (profissional_id, tipo_item, vigencia_inicio)` único.
- `comanda (unidade_id, status, fechada_em)` para indicadores e caixa.
- `item_comanda (comanda_id)` e `(profissional_id, criado_em)` para o app do barbeiro.
- `agendamento (profissional_id, inicio)` com restrição contra sobreposição de horário.
- `cliente (conta_id, telefone)` único.

### Endpoints principais (REST)

| Método e rota | Faz | Papéis |
| --- | --- | --- |
| POST /auth/login · POST /auth/convite | Entrar; aceitar convite | Todos |
| GET/POST /unidades | Listar e criar unidades | Dono |
| GET/POST /servicos · POST /servicos/:id/precos | Catálogo e novo preço com vigência | Dono |
| GET/POST /profissionais · POST /profissionais/:id/regras-comissao | Equipe e comissão | Dono, gestor |
| GET /agenda?unidade&data · POST /agendamentos | Ver agenda; agendar (cria comanda) | Recepção, gestor, bot |
| GET /agenda/horarios-livres | Horários livres por serviço e profissional | Recepção, bot |
| POST /comandas | Abrir comanda na hora | Recepção |
| POST /comandas/:id/itens · PATCH /comandas/:id/itens/:item | Lançar e ajustar itens | Barbeiro (próprias), recepção |
| POST /comandas/:id/confirmar | Barbeiro confirma | Barbeiro |
| POST /comandas/:id/fechar | Recebe pagamentos e fecha | Recepção |
| POST /comandas/:id/cancelar · POST /comandas/:id/reabrir | Falta ou reabertura com motivo | Recepção; dono e gestor |
| GET /comandas/impressao?data | PDF A4 com QR code | Recepção |
| GET/POST /despesas | Lançar despesas | Dono, gestor |
| GET /indicadores?unidade&periodo | Faturamento, clientes, ticket, atendimentos, extras, despesas, projeção | Dono, gestor |
| GET /lucratividade?unidade&periodo | Margem por serviço | Dono |
| GET/PUT /metas | Definir e ver metas | Dono |
| GET /me/comissoes · GET /me/desempenho · GET /me/agenda | Área do barbeiro | Barbeiro |
| GET /profissionais/:id/desempenho?periodo | Ficha do profissional | Dono, gestor (sua unidade) |
| GET /avaliacoes?profissional&periodo | Notas e comentários | Dono, gestor; barbeiro só as próprias |
| GET/POST /clube/itens · POST /clube/adesoes | Clube | Dono, recepção |
| GET/PUT /bot/menu · POST /bot/publicar · GET /bot/conversas | Construtor e conversas | Dono, gestor, recepção |
| POST /webhooks/whatsapp · POST /webhooks/pagamentos | Entrada do provedor | Sistema |

### Eventos de domínio

A API publica eventos na fila; os workers reagem.

| Evento | Quem reage |
| --- | --- |
| agendamento.criado | Cria comanda prevista; agenda lembrete |
| comanda.confirmada | Avisa recepção |
| comanda.fechada | Calcula comissão, baixa estoque, conta uso do clube, atualiza indicadores, agenda a pesquisa de avaliação |
| comanda.reaberta | Grava auditoria; recalcula comissão e indicadores |
| mensagem.recebida | Motor do bot avança a sessão |
| agendamento.cancelado | Oferece o horário à lista de espera; avisa o barbeiro |
| avaliacao.recebida | Atualiza a ficha do profissional; nota 1 ou 2 avisa dono e gestor |
| adesao.vencida | Cobrança e aviso ao cliente |

## 6. Plano de implementação

O plano entrega primeiro o que tira a planilha e a comanda de papel do dia a dia (MVP), depois metas, clube e bot (V2), e por fim rede, cobrança e estoque completo (V3). As durações são estimativas para 2 desenvolvedores full-stack e 1 designer em meio período; somam cerca de 26 semanas.

&#91;embedded content: roadmap · 5 fases, 3 portões\]

Cada losango é um portão: a fase seguinte só começa quando o critério de aceite da anterior é cumprido.

### Fase 0 · Fundação (2 semanas)

- Repositório, ambientes (dev, homologação, produção), CI com testes e deploy.
- Banco com RLS, autenticação, papéis e convite.
- Biblioteca de componentes com o tema do mapa.
- **Aceite:** um usuário de uma conta não consegue ler nada de outra conta em nenhum endpoint (teste automático).

### Fase 1 · MVP, lançamento único (10 semanas)

- Unidades, serviços com custo, extra e peso, preços com vigência, profissionais e regras de comissão.
- Agenda por profissional; agendamento cria comanda.
- Comanda completa: abrir na hora, lançar itens, confirmar, fechar, cancelar, reabrir com auditoria.
- Caixa do dia com formas de pagamento e divergência.
- Despesas por categoria.
- Indicadores com as regras únicas (RN-01 a RN-06).
- App do barbeiro (PWA): hoje, comandas, comissões.
- Comanda impressa em PDF com QR code.
- **Aceite:** a barbearia-piloto opera um mês inteiro sem papel e sem planilha, e os indicadores batem com a conferência manual de uma amostra de dias.

### Fase 2 · Piloto em uma unidade (3 semanas, em paralelo ao início da V2)

- Importar preços, clientes e profissionais da planilha atual.
- Treinar recepção e barbeiros; acompanhar o fechamento de caixa diariamente.
- Corrigir atritos de uso antes de abrir para outras unidades.
- **Aceite:** 90% das comandas confirmadas pelo barbeiro e caixa sem divergência por duas semanas seguidas.

### Fase 3 · V2, metas, clube e bot (8 semanas)

- Metas por unidade e mês, ritmo, projeção pelo calendário, ocupação pela agenda.
- Clube: assinatura, combos, convênios, reconhecimento na comanda.
- Lucro real e lucratividade por serviço.
- Bot WhatsApp: conexão, construtor do menu, respostas prontas, agendamento pela conversa ou pelo site (escolha do cliente), transferência, lembretes.
- Ficha do profissional e avaliação depois do atendimento; lista de espera; avisos por papel.
- Painel da rede com filtro por unidade.
- **Aceite:** clientes agendam pelo bot sem ajuda e o agendamento aparece na agenda com comanda prevista.

### Fase 4 · V3, rede e automação (6 semanas)

- Cobrança automática do clube pelo Asaas (Pix e cartão).
- Campeonato dos barbeiros (a TV da unidade foi descartada).
- Estoque completo, fornecedores e compras.
- Fidelidade, recorrência e mensagens de retorno.
- Google Agenda e importação do histórico da planilha.
- **Aceite:** uma rede com 2 ou mais unidades fecha o mês só pelo sistema, com comissões pagas a partir do relatório.

### Riscos

| Risco | Impacto | Como reduzir |
| --- | --- | --- |
| Barbeiro não confirma a comanda no app | Recepção volta a digitar; dados atrasam | Estado pendente visível, lembrete automático, comissão só aparece depois de confirmar |
| Bloqueio do número com gateway não oficial do WhatsApp | Bot para de funcionar | Número dedicado por unidade, envios espaçados, lembrete só para quem agendou; provedor atrás de interface trocável |
| Regras de cálculo divergem do que o dono espera | Perda de confiança nos números | Validar RN-01 a RN-06 com o dono antes da Fase 1; cada indicador mostra de onde vem |
| Internet ruim no salão | Lançamentos perdidos | PWA com fila local e reenvio |
| Importação da planilha com dados inconsistentes | Histórico errado | Importar só cadastros no início; histórico em etapa separada com conferência |
| Escopo cresce durante o MVP | Atraso | Tudo que não está no MVP vai para V2 ou V3 pelo quadro de requisitos |

### Decisões tomadas

Todas as escolhas abaixo mantêm o custo de implementação perto de zero: só software livre, sem licença e sem taxa fixa de terceiros.

| Tema | Decisão | Por quê |
| --- | --- | --- |
| WhatsApp | Gateway por QR Code com Evolution API, instalada no próprio servidor. Um número dedicado por unidade. | Sem custo por mensagem e sem aprovação da Meta. Com demanda baixa, o risco de restrição é pequeno. |
| AppBarber | Sem integração. Agenda própria desde o MVP; só a planilha atual é importada. | Sistema independente, sem depender de terceiros. |
| Peso em atendimentos | Serviço principal = 1, extra = 0, combo ou convênio = soma dos serviços inclusos (corte e barba = 2). Editável por serviço. | Reproduz a regra da planilha (convênio conta 2, extras fora) sem exceção por mês. |
| Comissão no clube | Sobre o preço de tabela da unidade na data do atendimento. O dono pode trocar por valor fixo por serviço do clube. O painel compara comissões do clube com mensalidades. | O barbeiro não perde por atender assinante e a regra é fácil de explicar. O dono vê se o clube dá lucro. |
| Pagamento do clube | Começa sem gateway: o sistema gera o QR Pix da chave da barbearia e a recepção dá baixa. Cobrança automática entra na V3 com Asaas. | Pix estático não tem custo de integração. O Asaas não cobra mensalidade, só cobra quando o cliente paga ([taxas do Asaas](https://blog.asaas.com/taxas-asaas/)). |
| Nota fiscal | Fora do produto. O sistema exporta o relatório do mês (CSV e PDF) para o contador. | Emitir NFS-e depende de cada prefeitura e de serviço pago por nota. |
| Hospedagem | Um servidor VPS com Docker Compose: API, banco, fila e Evolution API juntos; backup diário em armazenamento externo. | Custo mensal fixo e baixo, sem cobrança por uso. Migra para nuvem gerenciada quando crescer. |
| Facilidade de uso | Configuração guiada com modelos prontos: serviços comuns, categorias de despesa, menu do bot e mensagens. Importação da planilha por CSV. | A barbearia começa a usar no primeiro dia sem montar nada do zero. |

Ainda em aberto:

- [x] Preço de cada plano: definido na seção 7, Análise de mercado e preços.

## 7. Análise de mercado e preços

A proposta é cobrar **R$ 79,90 no Básico, R$ 149,90 no Pro e R$ 249,90 no Premium** no plano mensal, com o anual saindo por 10 mensalidades. Não há cobrança por profissional. O grande diferencial é mostrar ao dono quanto sobra, e não só quanto entrou: lucro por serviço, por barbeiro e por unidade, a partir de uma comanda lançada uma vez só.

### O que o mercado cobra

Preços de tabela no plano mensal, levantados em novembro de 2026. Vários concorrentes não publicam valores acima do plano inicial.

| Sistema | Plano inicial | Planos maiores | Como cobra | Observação |
| --- | --- | --- | --- | --- |
| [AppBarber](https://genda.work/melhor-sistema-para-barbearia) | R$ 79,90 (1 profissional) | R$ 164,50 (2 a 5) · R$ 219,90 (6 ou mais) | Faixa de profissionais | App com a marca da barbearia; WhatsApp depende do plano |
| [Booksy](https://genda.work/melhor-sistema-para-barbearia) | R$ 99,90 (1 profissional) | + R$ 20 por profissional | Fixo + por profissional | Forte em marketplace; WhatsApp não é o canal principal |
| [Trinks](https://www.barbeiro.app/blog/melhor-sistema-para-barbearia-2026) | R$ 110 (1 a 2 profissionais) | Sob consulta | Faixa de profissionais | WhatsApp, lembretes e fidelidade são pagos à parte |
| [Avec](https://negocios.avec.app/avec-planos) | R$ 88,90 (1 a 2 profissionais) | Sob consulta | Faixa de profissionais | Várias unidades e IA como adicionais |
| [BarberCode](https://barbercode.com.br/planos/) | R$ 79,90 (1 profissional) | R$ 99,90 (até 5) · R$ 139,90 (até 12) | Faixa de profissionais | Comissão e várias unidades só nos planos maiores |
| [Modo Gestor](https://modogestor.com.br/sistema-para-barbearia/) | R$ 109,90 (plano único) | R$ 87,90 no anual | Fixo, profissionais ilimitados | App com a marca é + R$ 99 por mês |
| [GENDA](https://genda.work/melhor-sistema-para-barbearia) | Grátis (1 profissional, 50 mensagens) | R$ 39,90 · R$ 79,90 (até 3) · R$ 129,90 (ilimitado) | Faixa de equipe | Página escrita pela própria GENDA |
| [BarbeiroApp](https://www.barbeiro.app/blog/melhor-sistema-para-barbearia-2026) | Grátis | R$ 39,90 · R$ 119,90 | Faixa + R$ 20 por profissional extra | Tem clube de assinatura |
| [Cash Barber](https://sistemacashbarber.com.br/) | A partir de R$ 300 | Não publica | Pacote com consultoria | Posicionamento premium |

### O que isso mostra

- **Três faixas de preço.** Entrada entre R$ 40 e R$ 110 para 1 ou 2 profissionais; meio entre R$ 100 e R$ 165 para equipes de até 12; topo de R$ 140 a R$ 220, com pacotes de consultoria a partir de R$ 300.
- **Cobrar por profissional irrita.** Booksy e BarbeiroApp cobram R$ 20 por barbeiro extra; Modo Gestor vende "profissionais ilimitados" como argumento.
- **WhatsApp costuma ser extra.** Trinks cobra à parte e outros limitam por plano. Como o bot roda na Evolution API, no seu próprio servidor, ele não custa por mensagem e pode vir incluído.
- **Quase ninguém mostra lucro.** Os concorrentes mostram faturamento e comissão. Lucro real, margem por serviço e metas por unidade são o diferencial para o dono de rede.

### Preços propostos

| Plano | Mensal | Anual por mês | Anual total | Economia no anual | Limites |
| --- | --- | --- | --- | --- | --- |
| Básico | R$ 79,90 | R$ 66,90 | R$ 802,80 | R$ 156 | 1 unidade, até 3 profissionais |
| Pro | R$ 149,90 | R$ 124,90 | R$ 1.498,80 | R$ 300 | 1 unidade, até 10 profissionais |
| Premium | R$ 249,90 | R$ 207,90 | R$ 2.494,80 | R$ 504 | Profissionais ilimitados, 1 unidade incluída |
| Unidade extra (Premium) | R$ 99,90 | R$ 82,90 | R$ 994,80 | R$ 204 | Por unidade |

O que cada plano destrava:

- **Básico:** agenda, comanda automática, caixa, despesas, indicadores, app do barbeiro e comanda impressa.
- **Pro:** tudo do Básico, mais comissões, clube, metas, ritmo e projeção, lista de espera e bot de WhatsApp.
- **Premium:** tudo do Pro, mais várias unidades, painel da rede, preço por unidade, lucro real e margem, campeonato dos barbeiros, automações do bot e cobrança automática do clube.

### Por que esses valores

- **Básico vale pelos 3 profissionais.** A R$ 79,90 sai a R$ 26,63 por barbeiro: o mesmo preço que AppBarber e BarberCode cobram por 1 profissional só, e menos que a Avec (R$ 88,90 por até 2). No anual, a partir de R$ 66,90.
- **Pro é onde está o lucro.** Fica R$ 14,60 abaixo do AppBarber para 2 a 5 profissionais e cobre até 10, com bot e clube que outros cobram à parte. O salto de R$ 70 sobre o Básico é pago por comissão automática e clube.
- **Premium cobra pela rede.** Uma rede de 4 unidades paga R$ 549,60 por mês, ou R$ 456,60 no anual, e recebe o painel de lucro que nenhuma planilha entrega.
- **Anual com 2 meses grátis.** Desconto de cerca de 17%, no padrão do mercado (Trinks e Modo Gestor dão desconto no anual). Recebe adiantado e reduz cancelamento.
- **Sem cobrança por profissional.** O limite muda por plano, não por cabeça.
- **O custo não cresce com o uso.** Servidor de custo fixo e WhatsApp sem custo por mensagem: cada cliente novo vira margem quase inteira.

### Onde o projeto se destaca

A maioria dos concorrentes vende agenda e lembrete. Este sistema vende **controle do resultado**: o dono sabe o lucro do mês, a margem de cada serviço e o desempenho de cada barbeiro e unidade, sem digitar nada além da comanda.

| Diferencial | O que os concorrentes consultados mostram | Este sistema |
| --- | --- | --- |
| Lucro real e margem por serviço | Faturamento, comissão e relatórios; nenhum dos comparativos cita margem por serviço | Lucro do mês e margem de cada serviço (produto + comissão), por unidade |
| Lançamento único | Avec tem comanda digital integrada ao caixa; os demais falam em agenda e caixa separados | Agendamento cria a comanda, o barbeiro completa e confirma, a recepção fecha; caixa, comissão e indicadores atualizam juntos |
| Metas e campeonato | Não aparece nos comparativos | Metas por unidade e serviço no app do barbeiro; ranking no app e no painel, sem valores |
| WhatsApp incluído | Trinks cobra à parte; outros limitam por plano ou por mensagem | Bot incluso no Pro, sem custo por mensagem |
| App do barbeiro com comissão | Comissão calculada para o dono | O barbeiro vê previsto, a receber e pago, e só os próprios dados |
| Regras que não mudam | Não é tema dos concorrentes | Cliente, atendimento e comissão com a mesma regra todo mês; preço e comissão com vigência |
| Rede de barbearias | Várias unidades como adicional (Avec) ou no plano maior (BarberCode) | Painel da rede com lucro e comparativo, preço por unidade |

A frase de venda que resume isso: **"Saiba quanto sobra, não só quanto entrou."**

### Onde ainda perde

Os concorrentes têm recursos que este projeto ainda não prevê. Os três primeiros custam pouco para incluir e fecham as brechas mais visíveis.

- **Página de agendamento online.** Quase todos oferecem um link para o cliente agendar sozinho. Recomendação: incluir no MVP, usando a mesma API de horários livres do bot.
- **Sinal por Pix no agendamento.** O Modo Gestor cobra Pix e cartão no agendamento. Recomendação: QR Pix estático no link de agendamento na V2, com custo zero.
- **Teste grátis sem cartão.** Já previsto em "Como vender".
- **App com a marca da barbearia nas lojas.** AppBarber e Modo Gestor vendem isso, o segundo por + R$ 99 por mês. Fica fora: o PWA instala no celular sem loja.
- **Marketplace de clientes novos.** Força do Booksy e do Trinks. Fica fora: exige escala de público que um sistema novo não tem.

### Como vender

- **Teste de 14 dias sem cartão.** O mercado vai de 5 dias (Trinks) a 30 dias (Modo Gestor); 14 dias sem cartão tira a barreira de entrada.
- **Migração da planilha grátis.** A importação por CSV já está no plano e vira argumento de venda.
- **Plano fundador para os primeiros 20 clientes.** 30% de desconto enquanto a assinatura estiver ativa, em troca de depoimento e retorno de uso. Ajuda a ganhar as primeiras barbearias e a provar o produto.
- **Destaque no Pro.** Na página de preços, o Pro aparece como "mais escolhido" e o Premium mostra o preço por unidade ao lado.

### Para acompanhar depois do lançamento

- Se mais da metade dos clientes ficar no Básico, o Pro está caro ou o Básico entrega demais: rever o que destrava o Pro.
- Se clientes do Pro baterem o limite de 10 profissionais, criar uma faixa intermediária antes do Premium.
- Rever os preços a cada 6 meses comparando com esta tabela.

Passo a passo de desenvolvimento, da pasta à VPS: [Linha de desenvolvimento](linha-de-desenvolvimento.md)

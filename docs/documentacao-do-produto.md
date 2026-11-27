# Pente Fino · Documentação do produto

O que é o produto, para quem e por quê. É o ponto de partida de produto; o técnico está em
[arquitetura.md](arquitetura.md), as contas em [regras-de-negocio.md](regras-de-negocio.md), os
caminhos de cada pessoa em [fluxos.md](fluxos.md) e o mapa completo em [README.md](README.md).
A versão original de 03/11/2026 (PRD, TRD, esquema e plano de implementação) está em
[historico/documentacao-do-produto-2026-11-03.md](historico/documentacao-do-produto-2026-11-03.md).

## Visão geral

O Pente Fino é um SaaS multiempresa para barbearias: painel web, app do barbeiro (PWA), link e
site de agendamento e bot de WhatsApp por menu (sem IA, sem custo por mensagem). Ele substitui a
comanda de papel, a planilha por unidade e o app de agenda, que não conversavam.

A proposta de valor: **"Saiba quanto sobra, não só quanto entrou."** Lucro real por serviço, por
barbeiro e por unidade, a partir de uma comanda lançada uma vez só (o **lançamento único**:
o agendamento cria a comanda, o barbeiro completa e confirma, a recepção fecha; caixa, comissão e
indicadores atualizam sozinhos).

Hoje o produto atende **barbearias**. O [plano multissegmento](plano-multissegmento.md) leva o
sistema a salões, clínicas de estética, academias e estúdios.

## Problema que resolve

- **Lançamento triplo:** comanda de papel, planilha e app de agenda.
- **Regras que mudam entre meses:** cliente e atendimento contados de jeitos diferentes, o que
  distorce ticket médio e projeção.
- **Receita que some e comissões vazias:** "outros" fora do faturamento; % de despesas menor do
  que é.
- **Estrutura rígida:** barbeiro novo exige coluna nova; mudar preço recalcula o passado.
- **Sem visão de lucro e de rede:** um arquivo por unidade, sem margem por serviço.

## Para quem

| Persona | Quem é | O que precisa |
| --- | --- | --- |
| Dono | Tem uma ou mais unidades | Lucro, metas, comparação entre unidades, preços por unidade |
| Gestor | Cuida de uma unidade | Agenda, equipe, caixa e indicadores da unidade |
| Recepção | Atende no balcão | Agenda de todos, comandas, receber, conversas do WhatsApp |
| Barbeiro | Profissional comissionado | Própria agenda, lançar extras, ver comissão e meta |
| Cliente final | Cliente da barbearia | Agendar e tirar dúvidas pelo WhatsApp ou pelo link, usar o clube |

## Módulos

| Módulo | O que faz | Onde no código |
| --- | --- | --- |
| Acesso e papéis | Login (senha e passkey), convite, papéis por unidade | `apps/api/src/auth`, `usuarios`; [papeis-e-permissoes.md](papeis-e-permissoes.md) |
| Unidades | Dias e horário de funcionamento, capacidade, calendário, regras de agendamento | `unidades` |
| Agenda | Por profissional, encaixe, bloqueios, lista de espera, ocupação | `agenda` |
| Comandas e caixa | Comanda automática, sinal, preço livre, caixa do dia, comanda impressa | `comandas`, `caixa`, `pdf` |
| Serviços, produtos e preços | Catálogo por unidade, preço com vigência, preço por barbeiro | `servicos`, `produtos` |
| Equipe e comissões | Profissional, regras de comissão com vigência, salário, ficha de desempenho | `profissionais`, `comissoes`, `desempenho` |
| Financeiro | Despesas (fixas que se repetem, salários), resultado, comissões a pagar, arquivo do contador | `despesas`, `resultados`, `exportacao` |
| Resultados do mês | Todos os números do mês: metas, projeção, barbeiros, serviços, canais, agenda, avaliações | `resultados`, `resumo` |
| Clientes | Cadastro único por telefone, histórico, consentimento, importação | `clientes`, `importacao` |
| Clube | Assinatura, combos, convênios; clube online pelo Asaas com split | `clube` |
| WhatsApp | Bot por menu e palavras-chave, agendamento pela conversa, lembretes, pesquisa, anúncios, conversas com a equipe, assistente da equipe | `bot`, `conversas`, `whatsapp`, `packages/db/src/bot.ts` |
| Página e link | Link público de agendamento, site da barbearia em blocos, domínio próprio | `publico`, `site` |
| Avisos | Central de avisos e push no celular | `avisos`, `me` |
| Assinatura do sistema | Planos, teste grátis, cobrança pelo Asaas, nota fiscal, indicação | `assinatura`, `cobranca`, `indicacao` |
| Administração | Contas, vendas, cobrança, chat, saúde do sistema, configurações | `admin`, `chat`, `saude`, `suporte` |

Lista completa de rotas: [gerado/api.md](gerado/api.md). Telas: [gerado/telas.md](gerado/telas.md).

## O que fica fora (hoje)

- Atendimento por IA (proposta de IA opcional na Fase 4 do plano multissegmento).
- App nativo nas lojas (o PWA instala sem loja).
- Emissão de nota fiscal da barbearia para o cliente e contabilidade (o sistema exporta o
  arquivo do mês para o contador; a nota da mensalidade do Pente Fino sai pelo Asaas).

## Métricas de sucesso

| Métrica | Alvo |
| --- | --- |
| Comandas fechadas sem papel | 100% após 30 dias de uso |
| Comandas confirmadas pelo barbeiro antes do fechamento | 90% ou mais |
| Diferença entre caixa do sistema e caixa físico | zero no fechamento do dia |
| Barbeiros que abrem o app ao menos uma vez por dia | 80% ou mais |
| Agendamentos feitos pelo bot e pelo link | acompanhar em Resultados → Canais |

## Mercado e preços

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

### Preços praticados

A tabela vigente sai do código: [gerado/planos.md](gerado/planos.md). Em resumo:

| Plano | Mensal | Anual por mês | Limites |
| --- | --- | --- | --- |
| Agenda | R$ 10,00 | R$ 8,25 | 1 unidade, até 2 profissionais (revenda de entrada) |
| Básico | R$ 79,90 | R$ 66,90 | 1 unidade, até 3 profissionais |
| Pro | R$ 149,90 | R$ 124,90 | 1 unidade, até 10 profissionais |
| Premium | R$ 249,90 | R$ 207,90 | profissionais ilimitados, 1 unidade incluída |
| Unidade extra (Premium) | R$ 99,90 | R$ 82,90 | por unidade |
| Automações (Agenda e Básico) | R$ 10,00 | R$ 8,25 | bot que marca pela conversa, lista de espera, pesquisa, retorno e aniversário |

O que cada plano destrava (conferido pela API com `temRecurso`):

- **Agenda:** agenda, link de agendamento, site da barbearia e avisos do horário no WhatsApp.
- **Básico:** tudo do Agenda, mais comanda, caixa do dia, despesas, resultados do mês e comissão
  automática com o extrato do barbeiro.
- **Pro:** tudo do Básico, mais metas, clube, bot do WhatsApp, lista de espera, ficha e ranking dos
  barbeiros, pesquisa depois do atendimento, canais e automações do bot.
- **Premium:** tudo do Pro, mais várias unidades com painel da rede e lucro real com margem por
  serviço e produto.

### Por que esses valores

- **Básico vale pelos 3 profissionais.** A R$ 79,90 sai a R$ 26,63 por barbeiro: o mesmo preço que AppBarber e BarberCode cobram por 1 profissional só, e menos que a Avec (R$ 88,90 por até 2). No anual, a partir de R$ 66,90.
- **Pro é onde está o lucro.** Fica R$ 14,60 abaixo do AppBarber para 2 a 5 profissionais e cobre até 10, com bot e clube que outros cobram à parte. O salto de R$ 70 sobre o Básico é pago por metas, clube, bot e ficha dos barbeiros (a comissão automática vem desde o Básico, decisão de 12/11/2026).
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

- **Um segmento só.** Os concorrentes maiores (Trinks, Avec) atendem salão, estética e
  barbearia; hoje o Pente Fino fala só com barbearia. É a Fase 1 do
  [plano multissegmento](plano-multissegmento.md).
- **App com a marca da barbearia nas lojas.** AppBarber e Modo Gestor vendem; fica fora (o PWA
  instala sem loja).
- **Marketplace de clientes novos.** Força do Booksy e do Trinks; fica fora, exige escala de
  público.
- **IA no atendimento.** Avec vende como adicional; aqui o bot é por menu, sem custo por mensagem.
  A IA opcional, paga pelo próprio cliente, é a Fase 4 do plano.

(Página de agendamento online, sinal adiantado e teste grátis sem cartão, que apareciam aqui em
03/11, já estão no produto.)

### Como vender

- **Teste de 14 dias sem cartão.** O mercado vai de 5 dias (Trinks) a 30 dias (Modo Gestor); 14 dias sem cartão tira a barreira de entrada.
- **Migração da planilha grátis.** A importação por CSV já está no plano e vira argumento de venda.
- **Plano fundador para os primeiros 20 clientes.** 30% de desconto enquanto a assinatura estiver ativa, em troca de depoimento e retorno de uso. Ajuda a ganhar as primeiras barbearias e a provar o produto.
- **Destaque no Pro.** Na página de preços, o Pro aparece como "mais escolhido" e o Premium mostra o preço por unidade ao lado.

### Para acompanhar depois do lançamento

- Se mais da metade dos clientes ficar no Básico, o Pro está caro ou o Básico entrega demais: rever o que destrava o Pro.
- Se clientes do Pro baterem o limite de 10 profissionais, criar uma faixa intermediária antes do Premium.
- Rever os preços a cada 6 meses comparando com esta tabela.


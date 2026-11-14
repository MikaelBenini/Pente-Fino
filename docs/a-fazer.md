# A fazer (lista de trabalho, criada em 11/11/2026)

Lista única do que falta fazer, no formato da linha de desenvolvimento. Documento **temporário**:
quando tudo estiver marcado, o dono decide se ele fica (como histórico) ou é apagado.

## Como usar esta lista

1. Trabalhar de cima para baixo, um lote por PR (as regras ficam em [retomada.md](retomada.md)).
2. Ao concluir um item:
   - registrar nos documentos definitivos o que mudou para quem usa ou opera:
     - [CHANGELOG.md](../CHANGELOG.md) ("Não publicado");
     - a etapa da [linha de desenvolvimento](linha-de-desenvolvimento.md), marcada e com o "feito: …";
     - a [documentação do produto](documentacao-do-produto.md) e o [CLAUDE.md](CLAUDE.md), se mudar
       uma regra;
     - a tabela de status do [plano de melhorias](pente-fino-melhorias.md), se o item vier de lá;
   - marcar o item aqui com `[x]`, a data, o PR e onde ficou documentado.
3. Item novo (pedido do dono ou sugestão aprovada) entra aqui no lugar certo da ordem.
4. Nada que só o dono decide é feito antes da decisão: fica em "Aguardando o dono".

Detalhe de cada ID (U1, F3, N2…) está no [plano de melhorias](pente-fino-melhorias.md).

## 1. Mensalidade do clube no resultado do mês (branch `feat/clube-no-faturamento`)

Aprovado pelo dono em 11/11/2026 (decisões b e d da comparação com a planilha).

- [x] Regra em `packages/shared` com testes: faturamento com as mensalidades, ticket do avulso,
  bloco "Clube" (11/11, documentado na linha de desenvolvimento, Etapa 13)
- [x] API: indicadores, projeção, meta, relatório e 12 meses, resumo do dia e do mês, rede por
  unidade e exportação CSV e PDF; o desempenho por barbeiro fica de fora (11/11)
- [x] Telas: cartão "Clube", linha "Clube (mensalidades)" no Financeiro e textos do faturamento,
  do ticket e da projeção (11/11)
- [x] Teste de ponta a ponta na API (`apps/api/test/clube.e2e-spec.ts`, "mensalidade no resultado
  do mês") (11/11)
- [x] Regra nos documentos: CLAUDE.md, documentação do produto, comentário do `PagamentoClube`,
  CHANGELOG, linha de desenvolvimento e anexo da planilha no plano de melhorias (11/11)
- [x] Testes de navegador conferidos: nenhum procura os textos que mudaram (11/11)
- [x] Bateria completa verde, commit (sem o `.env.example`), PR #162 aberto e CI verde (11/11)
- [x] Merge pelo dono (#162, 11/11)

## 2. Segurança dos webhooks e worker vigiado (pedido do dono em 11/11/2026)

Rotas públicas: `POST /webhooks/asaas` (cobrança do sistema, clube online e nota fiscal) e
`POST /webhooks/whatsapp` (Evolution API). Teste: alguém chamando com o Postman.

- [x] Verificação (11/11): sem o segredo, os dois recusam com 401 e não gravam nada (comparação
  em tempo constante; sem o token configurado, o do Asaas recusa tudo); a ponte `/api` do site
  não repassa o cabeçalho do token nem aceita pedido sem a origem do site; corpo limitado a
  100 KB; testes de 401 em `cobranca.e2e-spec.ts` e `whatsapp.e2e-spec.ts`
- [x] **W1** Asaas: não acreditar no corpo. Com o token certo (vazado, por exemplo), hoje dá para
  marcar a assinatura do sistema como paga e criar mensalidade do clube com valor e repasse
  inventados. Buscar a cobrança no Asaas pelo id (`GET /payments/{id}`) e usar só o que vier de
  lá; teste com corpo falso e token certo
- [x] **W2** WhatsApp: fechar `/webhooks/whatsapp` no Caddy (`api.{$DOMINIO}` responde 404). Em
  produção a Evolution chama por dentro (`http://api:3001`); a assinatura é fixa por instância e
  não cobre o corpo, então quem a obtiver pode mandar mensagem falsa ao bot em nome de qualquer
  telefone
- [x] **W3** Registrar as tentativas recusadas (401) com IP e horário, e mostrar a contagem na
  Saúde do sistema; limite de tentativas só para as recusadas (o Asaas e a Evolution continuam
  sem limite)
- [x] **W4** Segredos: exigir 32 caracteres ou mais (hoje 16) em `ASAAS_WEBHOOK_TOKEN` e
  `WHATSAPP_WEBHOOK_SEGREDO` (o token de produção já é separado: só existe no servidor; os do
  Codespaces são de teste)
- [x] **W5** Teste no Codespaces: a porta 3001 pública abre a API de desenvolvimento inteira
  (inclusive `/docs`), não só o webhook. Só dados e tokens de teste, mas deixar pública só durante
  o teste e voltar para privada
- [x] **V2, V3 e V4** da [verificação final](verificacao-final.md), aprovados para este lote:
  novas tentativas na mensagem e no lembrete, worker vigiado (batimento, rotinas na Saúde,
  healthcheck e reinício pelo vigia) e lembretes perdidos repostos pela rotina de 15 min
- [x] Documentado (11/11): CHANGELOG, linha de desenvolvimento (Etapa 23.5) e `docs/producao.md`
  ("Segurança dos webhooks" e o worker em "Monitoramento")
- [x] Bateria completa verde (11/11); PR aberto, CI a acompanhar
- [x] Merge pelo dono (12/11)

## 3. Escolhas da planilha aprovadas (respostas do dono em 11/11/2026)

- [x] **Preço livre na comanda (química)** (12/11, linha de desenvolvimento Etapa 23.6; a liberação do barbeiro ficou na tela de Serviços, junto do serviço, e não em Configurações), por serviço e desligado por padrão:
  - o dono liga "preço livre" no cadastro do serviço;
  - em Configurações, o dono escolhe quem digita o valor (padrão: dono, gestor e recepção; o
    barbeiro só se o dono liberar);
  - faixa opcional por serviço (mínimo e máximo), conferida na API;
  - a comissão sai do valor digitado, pela regra do barbeiro;
  - valor fora da tabela fica na auditoria da comanda.
  Assim a opção existe sem virar desconto escondido.
- [x] **Despesas fixas no mês seguinte** (12/11, Etapa 23.6; a que já tem igual lançada à mão vem desmarcada na prévia): botão "Copiar fixas do mês anterior" com prévia editável
  (valor, incluir ou tirar cada uma) antes de gravar; em cada despesa fixa, a opção "Repetir todo
  mês", que lança sozinha no 1º dia (dá para parar quando quiser); nunca duplica o que já existe
  no mês.
- [x] Lote 3a (preço livre e despesas fixas): bateria verde, PR #164 e CI verde (12/11)
- [x] Merge pelo dono (lote 3a, #164, 12/11)
- [x] **Catálogo por unidade** (pedido do dono em 12/11, "Escolher as unidades"; feito antes do
  preço por barbeiro, que depende dele): "Disponível em" em serviços e produtos; unidade nova
  vazia com "Copiar catálogo de outra unidade" (Etapa 23.6 da linha de desenvolvimento)
- [x] Catálogo por unidade: bateria verde, PR #165 e CI verde (12/11)
- [x] Merge pelo dono (catálogo por unidade, #165, 12/11)
- [x] **Preço por barbeiro** (12/11, Etapa 23.6; Perfil → "Meus preços") (detalhe do dono em 12/11): os serviços e a tabela continuam sendo
  da unidade. O barbeiro muda o próprio preço de um serviço **no perfil dele**; esse preço vale
  quando marcam horário com ele (agenda, bot, site) e na comanda dele. Sem preço próprio, vale o
  da unidade, como hoje. Com vigência, como a tabela (mudar não altera o passado); a comissão do
  clube continua sobre o preço da unidade.
- [x] Preço por barbeiro: bateria verde, PR #166 e CI verde (12/11)
- [x] Merge pelo dono (preço por barbeiro, #166, 12/11)
- [x] **Receber adiantado (sinal)** (painel A2; 12/11, Etapa 23.6; sem devolver na hora, o sinal fica retido e a comanda cancelada mostra "Devolver"): registra o pagamento na comanda aberta, entra no
  caixa do dia em que foi recebido e abate do total ao fechar; cancelar a comanda pede o que
  fazer com o sinal (devolver ou reter, com motivo).
- [x] Sinal: bateria verde, PR #167 e CI verde (12/11)
- [x] Merge pelo dono (sinal, #167, 12/11)
- [x] **Competência (painel A1)**: decidido em 11/11, o faturamento continua pela data do
  **fechamento** da comanda. Motivos: o dinheiro só fica certo no fechamento; o dia já fechado
  não muda depois; bate com o caixa e com o extrato; a trava do A1 já impede fechar antes do
  atendimento. A comanda guarda as duas datas, para um relatório por data do atendimento no
  futuro, se alguém pedir.
- Depois do piloto (não agora): importar os meses passados da planilha e o lançamento rápido
  por quantidade.

## 4. Administração: usabilidade (U)

U2 a U5 já feitos (#161).

- [x] **U1** Início (12/11, Etapa 23.4): estados vazios com orientação, cartões clicáveis para a lista filtrada e
  período selecionável
- [x] Lote 4a (U1 e U7): bateria verde, PR #168 (12/11)
- [x] Merge pelo dono (lote 4a, #168, 12/11)
- [x] Lote 4b (U6): bateria verde, PR #169 e CI verde (12/11)
- [x] Merge pelo dono (lote 4b, #169, 12/11)
- [x] Lote 4c (U8): bateria verde, PR #170 (12/11)
- [x] Merge pelo dono (lote 4c)
- [x] Lote 4d (U9): bateria verde, PR #171 (12/11)
- [x] Merge pelo dono (lote 4d)
- [x] **U6** Equipe (12/11, Etapa 23.4): papéis Suporte e Financeiro, última troca de senha e motivo para desativar
- [x] **U7** Auditoria (12/11, Etapa 23.4): detalhes legíveis, horário local, paginação além de 300 e CSV
- [x] **U8** Configurações (12/11, Etapa 23.4): fuso escrito nos campos, prévia do aviso geral, e-mail de teste por
  modelo e histórico de mudanças
- [x] **U9** Saúde do sistema (12/11, Etapa 23.4): último backup, versão e data do deploy, último evento do webhook
  do Asaas, validade do TLS e espaço em disco

## 5. Site: conteúdo novo e ajustes finos

- [x] **Planos (site P2 e P3)** (12/11): estudo dos concorrentes no anexo "Estudo de planos" do
  [plano de melhorias](pente-fino-melhorias.md). O dono aprovou só **comissões no Básico**; ficam
  como estão os preços, os lembretes do WhatsApp (Pro), o lucro por serviço (Premium) e o teste
  de 14 dias
- [x] **Comissões no Básico** (12/11): `comissoes` desde o Básico em `RECURSOS` (`planos.ts`);
  cartões de /planos, documentação do produto e testes de plano atualizados (CHANGELOG)
- [x] Lote 4e (comissões no Básico): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 4e)
- [x] **N1** Páginas por intenção de busca (12/11):
  - sete páginas (sistema, agenda, financeiro, comissão, comanda, WhatsApp e aplicativo);
  - entram no sitemap e no rodapé "Recursos";
  - registro no CHANGELOG.
- [x] Lote 5a (N1): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 5a)
- [x] **N2** Páginas de comparação (12/11):
  - AppBarber, Trinks, Booksy e "Melhor sistema para barbearia";
  - fontes oficiais conferidas em 12/11; ao mudar um preço, conferir de novo e trocar `CONFERIDO_EM`;
  - registro no CHANGELOG.
- [x] Lote 5b (N2): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 5b)
- [x] **N3** Ferramentas grátis em URL própria (12/11):
  - calculadoras de lucro por corte, comissão de barbeiro e preço do corte;
  - contas em `packages/shared`, com teste;
  - registro no CHANGELOG.
- [x] Lote 5c (N3): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 5c)
- [x] **N4** Blog (12/11):
  - estrutura pronta e o post "Faturamento não é lucro" publicado;
  - cinco rascunhos com título e tópicos em `src/conteudo/blog.ts`;
  - para publicar um rascunho, escrever o texto, pôr a data e criar a pasta do post;
  - registro no CHANGELOG.
- [x] Lote 5d (N4): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 5d)
- [ ] **P4** Coerência com os anúncios do Google já publicados
- [x] **D1** Imagens do hero no tamanho certo para o celular (12/11: versão com metade da largura e `srcset`)
- [x] **D2** Scripts de terceiros carregados depois da página, sem gtag duplicado (12/11: só o GTM; **dono:** conferir no Tag Assistant que a conversão continua chegando)
- [x] **D4** Contraste AA e foco visível no site (12/11: foco geral, tabelas roláveis pelo teclado e auditoria axe no site)
- [x] Lote 5e (D1, D2, D4): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 5e)
- [ ] **Contato e rodapé**: sem CNPJ por enquanto (o dono é MEI); falta o que está na pergunta
  P13

## 6. Administração: recursos novos (F)

- [x] **F1** Funil de ativação por conta (12/11):
  - bloco "Funil de ativação" nos números do negócio, com as 7 etapas e o filtro de período;
  - a próxima etapa aparece na ficha da conta;
  - registro no CHANGELOG.
- [x] Lote 6a (F1): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 6a)
- [x] **F2** Origem do cadastro (12/11):
  - já gravada e mostrada na ficha, nas Contas e em Vendas (#160 e #161);
  - faltava "contas novas por origem" no Início, que foi feito;
  - a exportação de conversões offline para o Google Ads, opcional, não será feita (decisão do
    dono em 13/11);
  - registro no CHANGELOG.
- [x] Lote 6b (F2 e anotação das sugestões F1b a F1d): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 6b)
- [x] **F3** Alertas para a equipe (12/11):
  - e-mail de hora em hora, pela rotina do worker, com os sete tipos do plano;
  - cada pessoa escolhe os seus em "Meus alertas por e-mail", no Início;
  - cada alerta sai uma vez só;
  - registro no CHANGELOG.
- [x] Lote 6c (F3): bateria verde e PR aberto (12/11)
- [x] Merge pelo dono (lote 6c)
- [x] **F1d** E-mail automático para a conta parada há 3 dias na mesma etapa do funil (12/11):
  - sugestão aprovada; modelo "Ajuda com o próximo passo", editável, com o link do passo;
  - uma vez por etapa, das 9 h às 20 h, na rotina da F3;
  - registro no CHANGELOG.
- [x] Lote 6d (F1d): bateria verde e PR aberto (12/11, PR #181)
- [x] Merge pelo dono (lote 6d)
- [x] **F4** Nota de saúde da conta (0 a 100) e ordem por risco de cancelamento (13/11):
  - coluna "Saúde" nas Contas, com o motivo principal, e a ordem "Risco de cancelamento";
  - registro no CHANGELOG.
- [x] Lote 6f (F4): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6f)
- [x] **F5** Acesso de suporte com consentimento do dono, só leitura e auditado (13/11):
  - o dono libera por 24 h em Configurações → Acesso do suporte;
  - o admin ou o suporte abre o painel pela ficha, por até 1 h, só leitura;
  - telefones e conversas escondidos; registro nas duas auditorias;
  - registro no CHANGELOG.
- [x] Lote 6g (F5): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6g)
- [x] **F6, entrega 1** (13/11, prioridade do dono para reter interessados): chat do visitante no
  site com fila, aba Chat na administração (assumir, responder, encerrar, histórico) e alerta na hora
  de conversa nova; fora do horário a mensagem fica guardada; registro no CHANGELOG
- [x] Lote 6h (F6, entrega 1): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6h)
- [x] **Chat: sugestões aprovadas e pedidos do dono em 13/11**:
  - respostas prontas, "virou cadastro" (a conversa vai junto no cadastro) e o resumo de 30 dias;
  - avisos na administração (bipe, notificação do navegador, número no título e na aba);
  - aviso no título para o visitante;
  - chat na Ajuda do painel para quem já é cliente;
  - registro no CHANGELOG.
- [x] Lote 6i (chat: Ajuda, respostas prontas, conversão e avisos): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6i)
- [x] **Chat: sugestões aprovadas em 13/11**:
  - contexto do cliente da Ajuda (plano, situação, saúde e "Abrir ficha");
  - "Foi útil?" ao encerrar, com a média no resumo;
  - respostas prontas editáveis em Configurações, com marcadores;
  - registro no CHANGELOG.
- [x] Lote 6j (chat: contexto, avaliação e respostas editáveis): bateria verde e PR aberto
  (PR em seguida ao #186)
- [x] Merge pelo dono (lote 6j)
- [x] **F6, entrega 2 (o que faltava)**: notificação no celular da equipe com o navegador fechado
  (13/11):
  - botão "Avisar no celular" na aba Chat;
  - conversa e mensagem nova chegam por push a quem atende o chat;
  - registro no CHANGELOG.
- [x] Lote 6k (push do chat): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6k)
- [ ] **F6** Suporte por chat (pedido do dono em 11/11, detalhado em 12/11):
  - **Quem chama:** ícone flutuante no canto da tela, no site (visitante, que informa nome e
    contato) e no painel da barbearia (já logado: a conversa fica ligada à conta).
  - **Fila de espera:** ao abrir, a conversa entra na fila e o cliente vê que está aguardando
    (com a posição ou o tempo estimado).
  - **No `/admin`:** uma aba de chat com a fila; o atendente da equipe **assume** a conversa (as
    outras pessoas da equipe veem quem assumiu), conversa em tempo real, encerra e o histórico
    fica guardado (com a conta, quando houver).
  - **No celular:** notificação de conversa nova e de mensagem nova para a equipe (push do PWA no
    `/admin` instalado), para atender sem estar no computador.
  - Substitui o WhatsApp de suporte no site e na Ajuda.
- [x] **F7** Métricas de SaaS (churn, MRR por tipo, LTV, coortes) (13/11):
  - bloco "Métricas de SaaS" nos números do negócio;
  - registro no CHANGELOG.
- [x] Lote 6l (F7): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6l)
- [x] **F1b** Equipe da administração: membros desativados escondidos por padrão, com a caixa
  "Mostrar desativados" (13/11)
- [x] **F1c** Lista de Contas com o filtro "Parou em", pela etapa do funil (13/11)
- [x] Lote 6e (F1b e F1c): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6e)
- [x] **F8** Aviso geral segmentado (13/11):
  - público por plano, situação e contas escolhidas, filtrado no servidor;
  - o formulário mostra quem vê e quantas contas;
  - registro no CHANGELOG.
- [x] Lote 6m (F8): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6m, PR #190, 13/11)
- [x] **F9** Gestão de cupons (13/11):
  - "Resultado dos cupons": contas, pagantes, receita, desconto concedido e uso por mês;
  - aviso de vagas na lista;
  - o alerta por e-mail já vinha da F3;
  - registro no CHANGELOG.
- [x] Lote 6n (F9): bateria verde e PR aberto (13/11)
- [x] Merge pelo dono (lote 6n, PR #191, 13/11)

## 7. Painel: página da barbearia editável e melhorias de produto

**Ordem de trabalho** (pedido do dono em 13/11: "organize tudo e siga a ordem"). Cada item é um
PR, mergeado quando o CI passar (autorização do dono para os próximos):

1. [x] Aniversário do cliente que veio pelo bot: editar os dados na ficha do cliente
2. Merge do PR #198 (site sem o link de agendamento)
3. Lote 7n: cabeçalho e rodapé editáveis, junto com o 7m (botões com link e CSS personalizado)
4. Horário de funcionamento da unidade (base do agendamento e dos avisos de resumo)
5. Lote 7l: editar o visual da página de agendamento no mesmo painel
6. Lote 7g: quem faz cada serviço, com foto (site e agendamento)
7. Lote 7h: páginas extras Galeria e Clube de assinatura
8. Lotes 7i, 7j e 7k: temas Clube, Letreiro e Estúdio
9. Resto da seção 7: saúde da conta no Início, resumo do fechamento de caixa, histórico por
   comanda, busca global (Ctrl+K) e modo recepção
10. Saber o que o visitante faz na página de vendas (painel no /admin)
11. Seção 8: plano Agenda (com a regra do cupom), página "Sobre" (N5), página de vendas
    atualizada e vídeo novo
12. Revisão dos campos de entrada e das validações (CPF, máscaras, avisos das caixas de marcar)
13. Seção 9: verificação final

- [ ] **Página da barbearia editável** (painel P2 e P5), aprovada em 11/11:
  - instalar a skill `frontend-design`;
  - desenhar mais de um modelo, bem diferentes entre si, para o dono aprovar antes de
    desenvolver;
  - o dono edita textos, fotos, seções, cores e estilo, e escolhe "quem faz cada serviço", com
    foto;
  - transições bonitas, sem deixar a página lenta.
  - [x] skill `frontend-design` instalada e três rodadas de modelos no canvas "Página da
    barbearia: modelos" (13/11). O dono aprovou a terceira: site com quatro páginas (Início,
    Serviços, Equipe, Contato) no estilo Tradicional, montado por blocos num painel parecido com
    o da Nuvemshop, mais as sugestões abaixo;
  - decisões do dono (13/11):
    - o agendamento fica só nos botões, nunca na frente da página;
    - a página já nasce montada, com textos sugeridos, e o dono só ajusta;
    - os temas Clube, Letreiro e Estúdio usam os mesmos blocos e dados, e trocar de tema não
      apaga nada;
    - páginas extras opcionais (Galeria, Clube de assinatura) que o dono liga no painel;
    - começar pelo tema Tradicional e pelo painel; os outros temas entram depois, um por PR;
  - decisão técnica: enquanto o dono não publica o site, `/b/<slug>` continua sendo a página de
    agendamento de hoje, para não mudar o link que já está no Instagram de ninguém;
  - [x] **Lote 7a** site da barbearia no tema Tradicional (13/11, documentado na linha de
    desenvolvimento): páginas Início, Serviços, Equipe e
    Contato em `/b/<slug>`, o agendamento em `/b/<slug>/agendar`, conteúdo inicial sugerido,
    rascunho e publicado guardados na unidade, dados vivos (serviços, preços, equipe, nota,
    horário);
  - [x] Lote 7a: bateria verde e PR aberto (13/11)
  - [x] Merge do lote 7a (PR #192, 13/11)
  - [x] **Lote 7b** (13/11, documentado na linha de desenvolvimento) painel "Minha página": escolher a página, ligar, desligar, reordenar e editar
    os blocos, tema (cor, fonte, botões), prévia no computador e no celular, publicar;
  - [x] Lote 7b: bateria verde e PR aberto (13/11)
  - [ ] Merge do lote 7b
  - [x] **Lote 7c** (13/11, documentado na linha de desenvolvimento) fotos: envio, redução de
    tamanho e guarda no servidor, com backup; banner, sobre a casa, barbeiros, galeria e
    logotipo (foto de serviço fica para depois);
  - [x] Merge do lote 7b (PR #193, pelo dono, 13/11)
  - [x] Merge do lote 7c (PR #194, pelo dono, 13/11)
  - [x] Merge do lote 7d (PR #195, 13/11)
  - [x] Merge do lote 7e (PR #196, 13/11)
  - [x] Merge do lote 7f (PR #197, 13/11)
  - pedido do dono em 13/11, depois do 7c: "o site é uma coisa e o link de agendamento é outra";
    o barbeiro pode pôr o domínio dele; o site precisa de animações e de um visual mais moderno,
    menos "padrão". Decisão: o link de agendamento continua em `/b/<slug>` (é o que já está no
    Instagram, impresso e no bot) e só agenda; o site ganha endereço próprio, `/s/<slug>`, e o
    domínio da barbearia;
  - [x] **Lote 7d** (13/11, documentado na linha de desenvolvimento; corrige o bug de trocar
    o link e o site ir junto) site e agendamento em endereços separados: o site em `/s/<slug>` (com
    `/servicos`, `/equipe` e `/contato`), o `/b/<slug>` volta a ser só o agendamento, os botões
    do site levam a ele; o painel mostra os dois endereços para copiar;
  - [x] **Lote 7e** (13/11, documentado na linha de desenvolvimento) domínio próprio: o dono informa o domínio, o painel mostra o registro de DNS
    para apontar, o sistema confere sozinho; o certificado HTTPS sai na hora (Caddy sob demanda,
    só para domínio cadastrado e conferido); no domínio, a raiz é o site e `/agendar` é o
    agendamento;
  - [x] **Lote 7f** (13/11, documentado na linha de desenvolvimento) site mais moderno e com
    movimento: entrada do banner em etapas, fotos que
    surgem ao rolar, cabeçalho que muda ao rolar, detalhes que respondem ao toque; tudo leve
    (CSS, sem biblioteca) e desligado com "reduzir movimento";
  - [x] **Site sem o link de agendamento** (13/11, documentado na linha de desenvolvimento) (pedido do dono em 13/11): o site publica e funciona
    com o link de agendamento desligado (a barbearia pode não querer agendamento pelo site nem
    o link no WhatsApp); sem link, os botões "Agendar" dão lugar a "Falar no WhatsApp" (com o
    telefone da unidade) ou somem; ligar o link depois faz os botões voltarem sozinhos;
  - [ ] **Aniversário do cliente que veio pelo bot** (pedido do dono em 13/11): quando o cliente
    chega pelo WhatsApp, não dá para informar a data de aniversário; corrigir no cadastro e,
    se fizer sentido, o bot perguntar (opcional);
  - [ ] **Horário de funcionamento da unidade** (pedido do dono em 13/11, logo depois do 7f):
    - o dono define, por dia da semana, a hora em que a unidade abre e fecha (com intervalo
      opcional, como o almoço), em Configurações, Unidades;
    - o agendamento pelo link, pelo bot e pelo balcão só oferece horário dentro dele, mesmo
      que o barbeiro tenha expediente maior (o expediente do barbeiro continua valendo dentro
      do horário da unidade);
    - é a base dos avisos de resumo (resumo do dia, fechamento de caixa, alertas da equipe):
      saem na hora certa de cada unidade;
    - o site e a página de agendamento mostram esse horário (hoje sai do expediente da
      equipe); sem horário cadastrado, continua como hoje;
  - [ ] **Lote 7g** quem faz cada serviço (P5): o dono marca os serviços de cada barbeiro, com
    foto; vale no site e no agendamento;
  - [ ] **Lote 7h** páginas extras Galeria e Clube de assinatura;
  - [ ] **Lotes 7i, 7j e 7k** temas Clube, Letreiro e Estúdio, um por PR.
  - pedidos do dono em 13/11 (depois dos endereços separados):
    - [ ] **Lote 7l** editar a página de agendamento (`/b/<link>`) no mesmo painel: cor,
      logotipo, foto de capa e textos, no mesmo visual do site;
    - [ ] **Lote 7n** **Cabeçalho e rodapé editáveis** (pergunta do dono em 13/11; hoje só o logotipo, a
      frase do rodapé e o Instagram mudam): no cabeçalho, nome, só logotipo ou os dois, menu
      (renomear, esconder, reordenar) e o texto do botão principal; no rodapé, ligar e desligar
      cada coluna, texto livre (CNPJ, "aceitamos Pix"), links próprios e redes além do Instagram
      (Facebook, TikTok, YouTube, WhatsApp); decisão do dono (13/11): o cliente edita tudo, e a
      linha "Site e agenda pelo Pente Fino" é opcional (ligada por padrão, o dono desliga);
      junta com o lote 7m;
    - [ ] **Lote 7m** botões com link no site: o dono põe botões próprios (texto e endereço, por
      exemplo cardápio de produtos ou Instagram) e, para quem quiser ir além, um CSS
      personalizado, aplicado só no site dele e filtrado (sem `@import`, sem `url()` de fora,
      sem `expression`), com um limite de tamanho;
- [ ] **Saber o que o visitante faz na página de vendas** (pedido do dono em 13/11,
  `seupentefino.com.br`): se um visitante novo entrou, até onde rolou a página, em quais botões
  clicou (planos, cadastro, WhatsApp, vídeo, chat) e de onde veio; painel no `/admin` com o
  funil do dia e da semana. Feito por nós, sem cookie de terceiros (só um id anônimo da visita),
  respeitando o aviso de cookies e o "não rastrear" do navegador;
- [ ] Saúde da conta no Início (WhatsApp, link, caixa de ontem, comandas paradas)
- [ ] Resumo do fechamento de caixa enviado ao dono
- [ ] Histórico visível por comanda
- [ ] Busca global (Ctrl+K)
- [ ] Modo recepção (tela grande)

## 8. Perto do fim

- [ ] **Plano Agenda** (pedido do dono em 13/11; respostas P14 a P16 em 13/11): plano de entrada,
  barato, para trazer barbearia nova pelo preço e pela busca do Google ("agenda para barbeiro",
  "agenda online para barbearia"). Decisões (o dono pediu "pense por mim" nos detalhes):
  - **Agenda, R$ 10 por mês** (anual R$ 99 por ano, sai R$ 8,25 por mês), com o mesmo teste
    grátis dos outros planos; 1 unidade e até 2 barbeiros;
  - entra: agenda de cada barbeiro, bloqueios e folgas, cadastro de clientes, o link de
    agendamento e o **site completo** da barbearia (as quatro páginas da seção 7), e o
    WhatsApp da própria barbearia conectado por QR para os avisos do agendamento
    (confirmação, lembrete e o link de remarcar ou cancelar). O WhatsApp faz parte do
    agendamento: não se cobra por ele;
  - **Automações, mais R$ 10 por mês** (cobra-se pelas automações, decisão do dono): o bot que
    responde e marca pela conversa, o convite de retorno de quem sumiu, a avaliação depois do
    atendimento, a mensagem de aniversário e o aviso da lista de espera;
  - fica nos planos de cima: comanda, caixa, financeiro, comissões, resultados e o clube;
  - **cupom de desconto** (decisão do dono em 13/11): no plano Agenda, só vale com as
    Automações juntas (R$ 20); no Agenda sozinho (R$ 10) não aceita cupom, porque com 10% a 30%
    de desconto cairia para uns R$ 7, barato demais;
  - **revenda conforme a necessidade** (o convite aparece na hora em que a barbearia precisa,
    nunca como propaganda solta):
    - o 3º barbeiro: "No Básico cabem até 3 barbeiros, e você passa a ver quanto sobra";
    - a 2ª unidade: Premium;
    - os itens de comanda, caixa e financeiro aparecem no menu com um cadeado e uma tela que
      mostra o que eles fazem, com o botão "Experimentar 7 dias";
    - depois de 30 dias, um resumo no Início com os números da própria agenda ("Você atendeu
      84 horários este mês. No Básico você vê quanto isso deu de faturamento e de lucro");
    - muitas faltas no mês: sugere as Automações (lembrete com confirmação e lista de espera);
    - quem assina as Automações e passa de R$ 20 por mês vê a conta: o Básico custa R$ 79,90
      e traz tudo;
  - divulgar no site: página de vendas, `/planos`, comparativo e uma página de busca própria
    para "agenda para barbeiro";
  - entra na verificação final (seção 9).

- [ ] **N5** Página "Sobre": perguntar ao dono quem faz o Pente Fino, por que existe e de qual
  cidade, e escrever junto com ele
- [ ] **Atualizar a página de vendas** (pedido do dono em 12/11, por último): textos e telas da
  página inicial, de `/planos` e do comparativo com tudo o que foi feito (clube no resultado,
  preço livre, despesas fixas, catálogo por unidade, preço por barbeiro, sinal, comissões no
  Básico, chat de suporte), com capturas de tela novas das telas atuais
- [ ] **Vídeo novo com todas as funções** (pedido do dono em 12/11, depois da página de vendas):
  - **antes de gerar o vídeo** (pedido do dono em 12/11): percorrer o sistema inteiro, tela por
    tela e papel por papel (dono, gestor, recepção e barbeiro, no computador e no celular), e
    listar tudo o que ele faz pelo olhar do barbeiro: o que ele bate o olho e pensa "isso faria
    diferença". Cada item vira uma dor, a cena que resolve, a frase de venda e o plano;
  - o roteiro só sai desse levantamento, aprovado pelo dono;
  - ferramenta: Remotion (vídeo feito com código React), avaliado e viável;
  - o vídeo junta as gravações reais do sistema (`apps/web/video`) com legendas, números e
    transições feitas em código, com as cores do site;
  - formatos: 16:9 para o site e 9:16 para Reels e Status, a partir do mesmo projeto;
  - skills prontas em `.claude/skills` (12/11): `video-pente-fino`, com o padrão profissional da
    marca, o roteiro com todas as funções e o checklist, e sete skills oficiais da Remotion
    (`remotion-create`, `-markup`, `-captions`, `-studio`, `-render`, `-docs` e `-license`);
  - o Higgsfield, que gera vídeo por IA, fica só como opção para aberturas e anúncios curtos sem
    telas do sistema, porque pode inventar telas;
  - licença grátis enquanto a empresa tiver até 3 pessoas;
  - o projeto fica numa pasta própria, fora do build do site.

- [ ] **Revisão dos campos de entrada e das validações** (pedido do dono em 13/11, antes da
  verificação final): percorrer todos os formulários (cadastro da conta, assinatura, clube,
  clientes, equipe, unidades, despesas, admin) e conferir:
  - validação e máscara de CPF e CNPJ (com dígito verificador), telefone, CEP, e-mail, datas e
    valores em reais; hoje o cadastro da conta não valida nem formata o CPF;
  - mensagem de erro clara junto do campo, no mesmo texto na tela e na API (zod compartilhado);
  - caixas de marcar (checkbox) que pedem uma ação ou têm consequência mostram o aviso na hora
    (o que acontece, o que falta fazer);
  - o resultado vira uma lista de achados e as correções entram em lotes antes da seção 9;

## 9. Por último: verificação final do ecossistema

- [ ] Rodar a [verificação final](verificacao-final.md) (pedido do dono em 11/11/2026): rotinas
  automáticas, integrações, o dia do barbeiro, números que batem, segurança, produção e
  documentação. Só depois de todas as etapas acima, para nada ficar de fora. Lá já estão os
  achados V1 a V4 vistos em 11/11

## Perguntas para o dono

Responda embaixo de cada pergunta, no espaço depois de "Resposta:". Quando eu ler a resposta,
levo para a lista e apago a pergunta daqui.
**Não escreva senhas, tokens nem chaves aqui:** este arquivo vai para o git.

**P13. Rodapé e Contato:** sem o CNPJ, combinado. Faltam o nome que aparece (o nome da empresa
MEI ou só "Pente Fino"), a cidade e as redes sociais (Instagram e outras, se houver).

Resposta:



## Pendências do dono (dados e produção)

- [ ] Marcar as contas "Teste" e "Implantação" como internas no `/admin`
- [ ] Dados fiscais no Asaas e os eventos `INVOICE_*` no webhook
- [ ] Depoimentos reais (pelo menos dois, autorizados)
- [ ] DNS AAAA / IPv6, se a Saúde do sistema avisar
- [ ] Tag Assistant e o valor da conversão no Google Ads
- [ ] Ligar "Aparecer no Google" em cada unidade
- [ ] Limpar a comanda de teste e o caixa de 11/11 em produção
- [ ] Webhook do Asaas em teste: porta 3001 do Codespaces em `/webhooks/asaas`, pública só
  durante o teste

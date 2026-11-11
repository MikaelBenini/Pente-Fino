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
- [ ] Bateria completa verde, commit (sem o `.env.example`), PR aberto e CI verde
- [ ] Merge pelo dono

## 2. Segurança dos webhooks (pedido do dono em 11/11/2026; correções aprovadas, PR próprio)

Rotas públicas: `POST /webhooks/asaas` (cobrança do sistema, clube online e nota fiscal) e
`POST /webhooks/whatsapp` (Evolution API). Teste: alguém chamando com o Postman.

- [x] Verificação (11/11): sem o segredo, os dois recusam com 401 e não gravam nada (comparação
  em tempo constante; sem o token configurado, o do Asaas recusa tudo); a ponte `/api` do site
  não repassa o cabeçalho do token nem aceita pedido sem a origem do site; corpo limitado a
  100 KB; testes de 401 em `cobranca.e2e-spec.ts` e `whatsapp.e2e-spec.ts`
- [ ] **W1** Asaas: não acreditar no corpo. Com o token certo (vazado, por exemplo), hoje dá para
  marcar a assinatura do sistema como paga e criar mensalidade do clube com valor e repasse
  inventados. Buscar a cobrança no Asaas pelo id (`GET /payments/{id}`) e usar só o que vier de
  lá; teste com corpo falso e token certo
- [ ] **W2** WhatsApp: fechar `/webhooks/whatsapp` no Caddy (`api.{$DOMINIO}` responde 404). Em
  produção a Evolution chama por dentro (`http://api:3001`); a assinatura é fixa por instância e
  não cobre o corpo, então quem a obtiver pode mandar mensagem falsa ao bot em nome de qualquer
  telefone
- [ ] **W3** Registrar as tentativas recusadas (401) com IP e horário, e mostrar a contagem na
  Saúde do sistema; limite de tentativas só para as recusadas (o Asaas e a Evolution continuam
  sem limite)
- [ ] **W4** Segredos: exigir 32 caracteres ou mais (hoje 16) em `ASAAS_WEBHOOK_TOKEN` e
  `WHATSAPP_WEBHOOK_SEGREDO` (o token de produção já é separado: só existe no servidor; os do
  Codespaces são de teste)
- [ ] **W5** Teste no Codespaces: a porta 3001 pública abre a API de desenvolvimento inteira
  (inclusive `/docs`), não só o webhook. Só dados e tokens de teste, mas deixar pública só durante
  o teste e voltar para privada

## 3. Escolhas da planilha aprovadas (respostas do dono em 11/11/2026)

- [ ] **Preço livre na comanda (química)**, por serviço e desligado por padrão:
  - o dono liga "preço livre" no cadastro do serviço;
  - em Configurações, o dono escolhe quem digita o valor (padrão: dono, gestor e recepção; o
    barbeiro só se o dono liberar);
  - faixa opcional por serviço (mínimo e máximo), conferida na API;
  - a comissão sai do valor digitado, pela regra do barbeiro;
  - valor fora da tabela fica na auditoria da comanda.
  Assim a opção existe sem virar desconto escondido.
- [ ] **Despesas fixas no mês seguinte**: botão "Copiar fixas do mês anterior" com prévia editável
  (valor, incluir ou tirar cada uma) antes de gravar; em cada despesa fixa, a opção "Repetir todo
  mês", que lança sozinha no 1º dia (dá para parar quando quiser); nunca duplica o que já existe
  no mês.
- [ ] **Preço por barbeiro**: cada barbeiro pode ter preço próprio para um serviço, com vigência
  como a tabela; sem preço próprio, vale o da unidade; a comanda grava o preço do momento; o
  agendamento pelo site mostra o preço do barbeiro escolhido.
- [ ] **Receber adiantado (sinal)** (painel A2): registra o pagamento na comanda aberta, entra no
  caixa do dia em que foi recebido e abate do total ao fechar; cancelar a comanda pede o que
  fazer com o sinal (devolver ou reter, com motivo).
- [x] **Competência (painel A1)**: decidido em 11/11, o faturamento continua pela data do
  **fechamento** da comanda. Motivos: o dinheiro só fica certo no fechamento; o dia já fechado
  não muda depois; bate com o caixa e com o extrato; a trava do A1 já impede fechar antes do
  atendimento. A comanda guarda as duas datas, para um relatório por data do atendimento no
  futuro, se alguém pedir.
- Depois do piloto (não agora): importar os meses passados da planilha e o lançamento rápido
  por quantidade.

## 4. Administração: usabilidade (U)

U2 a U5 já feitos (#161).

- [ ] **U1** Início: estados vazios com orientação, cartões clicáveis para a lista filtrada e
  período selecionável
- [ ] **U6** Equipe: papéis Suporte e Financeiro, última troca de senha e motivo para desativar
- [ ] **U7** Auditoria: detalhes legíveis, horário local, paginação além de 300 e CSV
- [ ] **U8** Configurações: fuso escrito nos campos, prévia do aviso geral, e-mail de teste por
  modelo e histórico de mudanças
- [ ] **U9** Saúde do sistema: último backup, versão e data do deploy, último evento do webhook
  do Asaas, validade do TLS e espaço em disco

## 5. Site: conteúdo novo e ajustes finos

- [ ] **Planos (site P2 e P3)**: estudar os planos dos concorrentes (BestBarbers, Cash Barber,
  Trinks, AppBarber, Avec, Booksy) e propor uma tabela para o dono aprovar. Regra do dono: o
  Básico atende uma barbearia de verdade (inclusive a que está começando); quem sobe de plano
  sobe pelas funções a mais, não porque "tem que mudar"
- [ ] **N1** Páginas por intenção de busca (uma por termo dos anúncios)
- [ ] **N2** Páginas de comparação
- [ ] **N3** Ferramentas grátis em URL própria
- [ ] **N4** Blog
- [ ] **P4** Coerência com os anúncios do Google já publicados
- [ ] **D1** Imagens do hero no tamanho certo para o celular
- [ ] **D2** Scripts de terceiros carregados depois da página, sem gtag duplicado
- [ ] **D4** Contraste AA e foco visível no site
- [ ] **Contato e rodapé**: sem CNPJ por enquanto (o dono é MEI); falta o que está na pergunta
  P13

## 6. Administração: recursos novos (F)

- [ ] **F1** Funil de ativação por conta
- [ ] **F2** Origem do cadastro: conferir o que falta (a origem já é gravada e aparece na ficha e
  em Vendas, #160 e #161)
- [ ] **F3** Alertas para a equipe (cadastro novo, teste acabando, cobrança vencida, falhas)
- [ ] **F4** Nota de saúde da conta (0 a 100) e ordem por risco de cancelamento
- [ ] **F5** Acesso de suporte com consentimento do dono, só leitura e auditado
- [ ] **F6** Suporte por chat (pedido do dono em 11/11): "Falar com o suporte" no painel da
  barbearia abre uma conversa ligada à conta; a equipe responde pelo `/admin` (fila de conversas,
  em aberto e respondidas, aviso de mensagem nova), com histórico e situação. Substitui o
  WhatsApp de suporte no site e na Ajuda
- [ ] **F7** Métricas de SaaS (churn, MRR por tipo, LTV, coortes)
- [ ] **F8** Aviso geral segmentado
- [ ] **F9** Gestão de cupons

## 7. Painel: página da barbearia editável e melhorias de produto

- [ ] **Página da barbearia editável** (painel P2 e P5), aprovada em 11/11:
  - instalar a skill `frontend-design`;
  - desenhar mais de um modelo, bem diferentes entre si, para o dono aprovar antes de
    desenvolver;
  - o dono edita textos, fotos, seções, cores e estilo, e escolhe "quem faz cada serviço", com
    foto;
  - transições bonitas, sem deixar a página lenta.
- [ ] Saúde da conta no Início (WhatsApp, link, caixa de ontem, comandas paradas)
- [ ] Resumo do fechamento de caixa enviado ao dono
- [ ] Histórico visível por comanda
- [ ] Busca global (Ctrl+K)
- [ ] Modo recepção (tela grande)

## 8. Perto do fim

- [ ] **N5** Página "Sobre": perguntar ao dono quem faz o Pente Fino, por que existe e de qual
  cidade, e escrever junto com ele

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

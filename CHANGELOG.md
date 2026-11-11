# Changelog

O que muda no Pente Fino, do ponto de vista de quem usa e de quem opera. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as datas são as da publicação em
produção (`https://seupentefino.com.br`). Detalhes técnicos e o porquê de cada item ficam na
[linha de desenvolvimento](docs/linha-de-desenvolvimento.md) e nos pull requests citados.

## [Não publicado]

### Alterado (clube no resultado do mês)

- A mensalidade do clube entra no faturamento no dia em que é paga (o valor que chega na conta),
  na linha "Clube (mensalidades)": Início, Resultados do mês, meta, projeção, Resumo do dia,
  Financeiro, painel da rede e arquivo do contador (CSV e PDF). Antes, o assinante aparecia como
  cliente sem receita e puxava o ticket para baixo.
- Ticket médio agora conta só o cliente avulso (serviços + produtos ÷ clientes que pagaram na
  hora). Novo cartão "Clube" com mensalidades, atendimentos cobertos e valor por atendimento.

### Corrigido (serviços e administração)

- Serviços: editar o serviço pelo próprio nome (com o lápis), na primeira coluna. Antes o botão
  "Editar" ficava no fim da tabela, fora da tela no notebook, e parecia que não dava para editar.
  Preços e durações não quebram mais em duas linhas.
- Administração → Estender teste: a data sugerida nunca passa do limite de 60 dias.

### Adicionado (medição dos anúncios)

- Conversão do cadastro com o valor do plano (com o cupom) e a moeda, só no sucesso: o Google Ads
  passa a poder dar lance por valor. Sai também com o nome padrão `sign_up`.
- De onde veio cada cadastro: quem chega por anúncio ou campanha (gclid, utm) tem a origem guardada
  (com o aceite de cookies, por 90 dias) e enviada no cadastro. A ficha da conta na
  administração mostra "Veio de: Google Ads · campanha" (ou o site de origem).
- Eventos do funil para os anúncios: planos vistos, troca entre mensal e anual, clique nas chamadas
  para o cadastro (com a posição na página) e começo do preenchimento.

### Alterado (SEO)

- Trilha de navegação para o Google em Planos, Termos e Privacidade.
- `robots.txt` sem regras repetidas; links pessoais de horário fora dos buscadores.
- Política de privacidade explica a origem do cadastro guardada.

### Adicionado (página de agendamento)

- Endereço curto da página da unidade: `/b/<endereço>` (bom para o Instagram). O antigo
  `/agendar?u=<endereço>` redireciona sozinho (301), então link já divulgado continua valendo,
  inclusive o do bot.
- Link compartilhado no WhatsApp e no Instagram mostra a barbearia: "Agende na {barbearia} ·
  {unidade}", os serviços, o preço inicial e uma imagem com o nome.
- Configurações → Link de agendamento → "Aparecer no Google": ligado, a página entra nas buscas
  com os dados da barbearia; desligado (padrão), fica fora do Google.
- Confirmação do agendamento com "Adicionar ao calendário" (arquivo do celular, com lembrete 1 h
  antes).

### Corrigido (acessibilidade)

- Textos secundários (horários da grade da agenda, títulos do menu, metas) com contraste AA nos
  dois temas; antes ficavam abaixo do mínimo no fundo escuro.
- Gráfico de 12 meses: cada barra é alcançável pelo leitor de tela, com o mês e o valor.
- "Como fazer", "Fazer agora" e "Ver como reconectar" com área de toque de 44 px no celular.
- Auditoria automática (axe, WCAG 2.2 AA) em todas as telas do painel, no computador e no
  celular, e nos diálogos abertos.

### Adicionado (painel no dia a dia)

- Serviços: preço de cada serviço (a faixa, quando muda entre unidades), comissão média dos
  barbeiros e quanto sobra por atendimento, com a mesma conta da comanda; ordenar por nome, preço
  ou sobra. Comissão e sobra são do lucro real (Premium) e não aparecem para o barbeiro.
- Agenda: depois de agendar no balcão, a tela fica na Agenda com "Agendado para … · Abrir
  comanda" (antes ia direto para a comanda).
- Comanda: tirar um item tem 5 segundos para "Desfazer".
- Agenda: horário curto (30 min) aparece numa linha só, "10:00 Vitor M. · Corte", com o texto
  inteiro ao passar o mouse; antes o nome do cliente era cortado.
- Assinatura: "Próxima cobrança" diz a data, o valor e a forma de pagamento (ou quantos dias de
  teste faltam), no lugar de "Nada em aberto".
- Ajuda: "Falar com o suporte" no rodapé do menu, levando ao contato da Ajuda, que mostra o
  WhatsApp e o horário do suporte assim que forem cadastrados.

### Corrigido (informação no painel)

- Início: sem meta de faturamento, o card mostra as metas de serviço que existem ("Corte · 0 de 12
  · abaixo do ritmo", ou "2 de 3 no ritmo"); antes dizia "Defina a meta do mês" mesmo com meta.
- Resultados do mês: os 12 meses começam no mês em que a conta foi criada (ou no primeiro mês com
  atendimento, quando o histórico foi importado), sem meses vazios antes, e, com os dois meses
  zerados, a variação diz "sem dados ainda" no lugar de "0% (estável)", também no PDF e na
  planilha.
- Serviços: a coluna "Atendimentos" virou "Conta como" (1 atendimento, 2 atendimentos, 0 extra),
  com a explicação embaixo: é quanto cada serviço soma, não quantas vezes foi feito.
- Financeiro e Início: "Custos operacionais" mostra a comissão e as despesas separadas
  ("comissões 40% · despesas 0%"); antes, "Despesas operacionais: 40%" com as despesas zeradas.
- Comandas: "Imprimir" fica desativado, com o aviso, quando não há comanda no dia.

### Corrigido (falhas invisíveis na administração)

- E-mails que não saíram aparecem na Saúde do sistema: quando, para quem (endereço mascarado),
  qual e-mail, o motivo do servidor de e-mail e as tentativas, com "Reenviar" e "Descartar" (com
  motivo, na auditoria). Falha nas últimas 24 h entra no "Precisa de atenção"; se for de
  boas-vindas ou confirmação de cadastro, como urgente.
- WhatsApp caído há mais de 2 horas entra no "Precisa de atenção" como urgente. Antes, a Saúde
  mostrava a queda e o Início dizia "Tudo em dia por aqui".
- As abas da administração seguem o endereço: abrir um link com `#contas`, digitar o endereço ou
  voltar no navegador troca a aba (antes só valia ao recarregar).
- IP de quem acessa a administração: um jeito só de ler, sem o prefixo `::ffff:`. A Saúde do
  sistema avisa quando os acessos chegam com IP interno (em geral, IPv6 com a rede do Docker só em
  IPv4); o passo a passo para corrigir está em `docs/producao.md`.

### Operação

- CI: a instalação do navegador dos testes tenta de novo quando o espelho do Ubuntu não responde.

### Corrigido (números da administração)

- "Em dia" só para conta que já pagou e não está atrasada. Conta ativa que nunca pagou aparece
  como "Ativa sem cobrança" e entra no "Precisa de atenção" como urgente; cortesia é contada à
  parte e fica fora do MRR. Antes, o Início mostrava ao mesmo tempo MRR R$ 0, "0 pagantes" e
  "Em dia 1".
- Teste que vai além de 60 dias aparece em "Precisa de atenção".

### Adicionado (conta interna)

- Ficha da conta → "Conta interna" (com motivo): contas da própria equipe (testes,
  demonstração, implantação) saem do MRR, dos números, dos gráficos, do "Precisa de atenção" e
  da cobrança manual. A lista de contas mostra o selo, filtra por "Conta interna" e a planilha
  traz a coluna. A barbearia não vê diferença.

### Corrigido (situação da conta na administração)

- Cancelar uma conta agora também cancela a cobrança automática no Asaas. Antes, a barbearia
  cancelada continuava sendo cobrada. Se o Asaas não responder, a conta não é cancelada pela
  metade e a tela pede para tentar de novo.
- "Desbloquear" volta a conta exatamente ao que ela era (o teste mantém a data de fim). Conta
  cancelada não "desbloqueia" mais para ativa sem cobrança: ela é reativada com o próximo passo
  (voltar ao teste até uma data, cobrar a partir de uma data ou cortesia até uma data).
- Teste com limite de 60 dias a partir de hoje. Para mais tempo sem pagar existe a cortesia,
  com motivo e data de fim (no máximo um ano por vez).
- Cobrança manual: a cobrança prevista nasce também para a conta ativa que nunca pagou, a partir
  da data marcada pela administração, e nunca dentro da cortesia.

### Adicionado (cortesia)

- Durante a cortesia, a barbearia vê "Cortesia do Pente Fino até dd/mm/aaaa". No dia seguinte ao
  fim, a cobrança começa sozinha.

### Alterado (oferta de lançamento)

- O cupom `LANCAMENTO` não tem mais limite de vagas: vale para toda barbearia que assinar até
  31/01/2027, como o site e os anúncios prometem. Desconto, prazo e quem já usa continuam iguais.
- Cupom que esgota (os criados com vagas na administração) diz "Este cupom esgotou: as vagas
  acabaram." no cadastro e na assinatura.

### Alterado (nota fiscal das mensalidades)

- A emissão da nota fiscal só liga com os dados fiscais da empresa conferidos no Asaas: sem
  dados fiscais, com inscrição municipal de exemplo (como 123456) ou sem o acesso à prefeitura,
  a tela diz exatamente o que falta (inclusive qual acesso a prefeitura exige, por exemplo o
  certificado digital) e a emissão continua desligada. Dá para deixar tudo preenchido e salvo
  com a emissão desligada; enquanto isso, as mensalidades seguem cobradas como sempre.
- Barbearia: com a emissão ligada, a nota de cada mensalidade aparece na fatura (Configurações
  → Assinatura), com "Baixar" quando emitida.
- Administração: Saúde do sistema mostra se a emissão está ligada, a última nota emitida, as
  que estão a caminho da prefeitura e as que não saíram, com o motivo.

### Corrigido (bot do WhatsApp)

- "Qual o horário de funcionamento?" responde com o endereço e o horário; antes, o bot começava
  um agendamento. Quando a mensagem cita palavras de dois grupos, vale a frase mais longa
  ("horário de funcionamento" ganha de "horário"). As palavras de fábrica de Agendar e Endereço
  mudaram, inclusive nas contas que não tinham mexido nelas.
- O editor do bot avisa quando uma palavra de um grupo está dentro da frase de outro grupo.
- Conversas: com o WhatsApp da unidade desconectado, a conversa mostra "Bot parado: WhatsApp
  desconectado" (vermelho) e o link "Conectar", em vez de "Bot respondendo".

### Corrigido (caixa e comanda)

- O dinheiro entra no caixa do dia em que foi recebido. Antes, receber hoje uma comanda marcada
  para amanhã jogava o valor no caixa de amanhã e abria esse caixa sozinho.
- O caixa não abre mais sozinho: sem caixa aberto, a comanda não é recebida, e a tela oferece
  abrir o caixa com o troco na hora.
- Atendimento de outro dia (ou de hoje que ainda não começou) não pode ser recebido antes de
  acontecer.
- Comanda reaberta pode ser cancelada (com motivo), marcada como falta, remarcada, começada e
  confirmada de novo; antes ficava presa.
- Comanda sem itens não fecha mais com R$ 0,00.

### Corrigido (celular)

- Serviços e Produtos não passam mais da largura do celular: a barra de baixo ficava larga demais
  e saía da tela. Todas as telas do painel são conferidas em 375 px.

### Corrigido (link de agendamento)

- O link de agendamento só liga com pelo menos um serviço com preço e um profissional com
  horário na unidade; a tela diz o que falta, com o atalho para cadastrar.
- Página de agendamento sem serviço disponível: em vez do formulário que não agenda, "Agendamento
  online indisponível" com o WhatsApp, o telefone e o mapa da barbearia.
- O editor do bot avisa quando o link está desligado numa unidade ("Agendar" passaria para um
  atendente quando o bot não consegue marcar pela conversa).

### Adicionado (agendamento)

- Link de agendamento com mais de uma unidade: "Agendar em outra unidade", discreto, abaixo do
  endereço (quem veio pela conversa do WhatsApp da unidade nem vê). O cliente troca sem perder o
  que já escolheu (serviços que a outra unidade faz, nome e WhatsApp) e é avisado do que mudou:
  serviço que lá não tem, preço diferente e barbeiro a escolher de novo.

### Alterado (site)

- Oferta de lançamento visível em todo o site (faixa no topo, fechável) e nos botões de teste;
  some sozinha depois de 31/01/2027 ou quando as vagas acabam.
- Cadastro com o cupom do link já aplicado: preço cheio riscado e preço com desconto; cupom
  inválido avisa. Campo de WhatsApp opcional, "Mostrar senha" e campos obrigatórios marcados.
- Cada promessa que não vem em todos os planos mostra o selo "Pro e Premium" ou "Premium".
- "Economize até R$ 504/ano" (calculado) no lugar de "2 meses grátis", que não batia com a conta.
- "Planos" no topo também no celular; "Ver em 1 minuto" já dá o play no vídeo; a calculadora
  aceita "1.234,56" e leva ao teste.
- Endereço que não existe mostra "Página não encontrada" (404) em vez da tela de login.

### Corrigido (site)

- /planos dizia que o bot de WhatsApp estava "em construção": ele já funciona no Pro e no
  Premium.
- Preços para o Google (dados estruturados) batem com os da página.

### Alterado (resultados do mês)

- **Resultados do mês** no lugar de Métricas e metas, Relatório do mês e Painel da rede: cada
  número do mês num lugar só, em abas (Visão geral, Barbeiros, Serviços e produtos, Canais,
  Agenda e avaliações). Os endereços antigos levam para a página nova.
- O mês sempre comparado do mesmo jeito: no mês corrente, com os mesmos dias do mês anterior
  (o Início comparava com "os 30 dias antes" e mostrava números diferentes do relatório).
- Início mais curto: o dia, as metas e o resumo do mês, com "Ver resultados do mês".
- Resumo do dia só com o dia; a tabela do mês dia a dia está em Resultados do mês e abre o dia.
- Equipe só com profissionais e acessos; o desempenho de cada barbeiro está em Resultados do
  mês → Barbeiros, com a agenda ocupada, a confirmação no prazo e o link para a ficha.
- Barbeiro: as metas ficam em "Hoje" (o item "Metas" saiu do menu).
- Mapa da agenda hora a hora acompanha o mês escolhido (antes, sempre as últimas 4 semanas).

### Corrigido (resultados do mês)

- Lucro negativo que piorou aparecia como alta (de −R$ 10.648 para −R$ 13.732 mostrava
  "+29%" em verde).

### Adicionado (relatório do mês)

- "Relatório do mês" (dono e gestor): o mês contra o anterior em números e em frases (o que
  melhorou, o que piorou), faturamento dos últimos 12 meses, por onde os clientes chegaram,
  quanto cada barbeiro custa e quanto rende (com pontos fortes e fracos) e quanto cada serviço e
  produto pesa no faturamento. No mês corrente, compara com os mesmos dias do mês anterior.
- Relatório do mês: "Agenda ocupada" entre os números comparados com o mês anterior, e "Baixar
  este relatório" em PDF (para imprimir ou mandar ao sócio) e em planilha (CSV, abre no Excel),
  com o mesmo conteúdo da tela.
- Equipe: "Mudar valor fixo" para cadastrar salário ou ajuda de custo além da comissão.

### Adicionado (painel do dia)

- Início com o bloco "Hoje": quanto entrou e quanto ainda vai entrar, atendidos, agenda ocupada,
  quanto precisa entrar por dia para bater a meta, "Precisa de você agora" (cada item leva à tela
  de resolver) e os próximos horários — o dono vê o dia sem trocar de aba.

### Alterado (oferta)

- Plano fundador virou **oferta de lançamento**: cupom `LANCAMENTO`, 30% para sempre para quem
  assinar até 31/01/2027. O contador de vagas só aparece quando restam 5 ou menos, e o bloco some
  quando a oferta acaba. O cupom `FUNDADOR` foi desativado.

### Corrigido (planos)

- `/planos`: clube com cobrança automática pelo link aparece como disponível no Pro (estava "em
  breve" no Premium), e o cartão do Pro não diz mais que clube e bot estão "em breve".

### Adicionado (ajuda)

- Central de ajuda (menu "Ajuda"): busca, artigos passo a passo (WhatsApp, bot, agenda, comanda,
  caixa, lucro, comissões, clube, assinatura, LGPD) e perguntas frequentes.
- Tutorial "Primeiros passos" no Início: 8 passos que se marcam sozinhos conforme a barbearia
  usa o sistema, cada um com "Como fazer" e "Fazer agora".

### Adicionado (LGPD)

- Ficha do cliente (dono): "Baixar os dados" entrega tudo o que o sistema guarda do cliente, e
  "Apagar os dados pessoais" atende o pedido de eliminação (atendimentos e caixa ficam, sem o
  nome).
- Termos com a seção "Dados dos clientes da barbearia" (quem controla, quem opera, fornecedores,
  incidentes); Privacidade cita os fornecedores (versão 2026-11-09).

### Segurança

- Teste que confere a regra de acesso de todas as rotas da API e a separação entre unidades;
  rota nova sem regra não passa no CI.
- Dependabot também para as imagens do servidor (Evolution API, PostgreSQL, Redis, Caddy).

### Operação

- Backup diário também no Backblaze B2 (criptografado), com restauração a partir de lá testada.
- Página pública de status no ar: `https://status.seupentefino.com.br/status/pente-fino`.

### Corrigido (deploy)

- Deploy automático quebrava quando o próprio `implantar.sh` mudava (#125); pasta `status.css`
  criada pelo Docker travava o `status.sh` (#124).

### Adicionado (operação)

- Página pública de status com o visual do Pente Fino (cores, fonte e logo), aplicado pelo
  `status.sh`.
- `infra/backup-externo.sh`: liga a cópia do backup no Backblaze B2 ou no Cloudflare R2 passo a
  passo; `restaurar.sh --externo` restaura direto de lá. O envio passou a ser por cópia com
  retenção por idade (um servidor novo nunca apaga o backup guardado lá fora).

### Adicionado (alerta do WhatsApp)

- WhatsApp da unidade que cai sozinho avisa na hora: aviso na central para dono e gestor,
  notificação no celular e e-mail para os donos com o botão "Reconectar o WhatsApp" (modelo
  editável na administração).

### Adicionado (status)

- `infra/status.sh`: configura o Uptime Kuma de uma vez — monitores do site, API, painel do
  WhatsApp, backup e disco/memória, alerta por e-mail e página pública
  `status.seudominio/status/pente-fino`; grava as URLs push no `.env`.

### Adicionado (limpeza de dados)

- Limpeza automática de dados, todo dia às 3h30: conversas do bot, logins e links vencidos, avisos
  lidos e trabalhos das filas com mais de 90 dias saem; avaliações perdem o comentário (a nota
  fica). Conta criada pelo site sem confirmar o e-mail sai em 7 dias (aviso 2 dias antes); conta
  cancelada ou com o teste vencido sem pagamento sai 90 dias depois (avisos 15 e 3 dias antes).
  Conta com cobrança ativa no Asaas fica retida. Saúde do sistema mostra o que cada execução
  apagou.
- Privacidade e termos com os prazos de guarda (versão 2026-11-08).

### Adicionado (nota fiscal)

- Nota fiscal de serviço (NFS-e) das mensalidades do Pente Fino, emitida pelo Asaas: configuração
  em `/admin` → Configurações (serviço da prefeitura ou código, ISS, retenções, emitir no pagamento
  ou no vencimento), conferência dos dados fiscais no Asaas e "Aplicar às assinaturas atuais". As
  assinaturas novas já saem com a nota ligada.

### Adicionado (clube online)

- Clube online: a barbearia ativa em Clube → "Receber online" uma conta no Asaas; cada plano ganha
  "Copiar link" e "Mandar pelo WhatsApp"; o cliente assina pela página `/assinar` no Pix ou no
  cartão e a mensalidade é cobrada todo mês, caindo direto na conta da barbearia (split). A
  adesão nasce e renova sozinha a cada pagamento; repasses, taxas e saldo na mesma aba; aviso de
  novo assinante na central. "Criar planos sugeridos" monta os planos a partir dos preços.
- Administração: taxa da plataforma sobre o clube online, ajustável em Configurações.

### Segurança

- Cadastro pelo site protegido contra robôs: campo isca invisível, tempo mínimo de preenchimento,
  limite de 3 contas por hora e 10 por dia por conexão e recusa de e-mail descartável.
- Confirmação de e-mail no cadastro pelo site: até clicar no link do e-mail de boas-vindas, a conta
  não agenda, não convida a equipe nem conecta o WhatsApp; aviso no painel com "Reenviar e-mail".

### Alterado

- Página inicial nova: telas reais do sistema no topo (computador e celular), "Faturamento não é
  lucro", vídeo, recursos em mosaico com as telas, calculadora "Quanto sobra de cada corte?",
  comparação com app de agenda comum e planilha, perguntas frequentes atualizadas. Seção de
  depoimentos pronta para quando houver depoimentos reais autorizados.

### Adicionado

- Site público: Google Tag Manager e tag do Google Ads com aviso de cookies e Consent Mode —
  sem "Aceitar", nada de cookie de anúncio; evento `cadastro_concluido` para medir conversão.
  Privacidade atualizada.
- Home: vídeo de 1 minuto do sistema funcionando (agenda, comanda no celular, fechamento, lucro do
  mês e agendamento pelo WhatsApp), gravado da conta de demonstração por roteiro (`apps/web/video`).
- Bot do WhatsApp: depois de escolher um serviço, o cliente pode adicionar outro (corte + barba)
  antes de ir para o horário; o bot mostra o total anotado (Etapa 15.3).
- Cancelar comanda: caixa "Avisar o cliente pelo WhatsApp", que manda o cancelamento com o
  convite para marcar outro horário (Etapa 15.3).
- Mover horário: caixa "Avisar o cliente" também quando muda o horário (antes o aviso saía
  sempre); desmarcada, o cliente não recebe nada (Etapa 15.3).
- Sino de avisos: o primeiro toque pede a permissão do navegador e liga as notificações no
  aparelho; a tela de Avisos mostra o convite enquanto não estiverem ligadas (#109).
- Segurança: 5 senhas erradas seguidas bloqueiam o login daquele e-mail por 15 minutos
  (barbearias e administração); política de conteúdo (CSP) no site (#108, Etapa 21).

### Corrigido

- Arquivos de `/video` eram tratados como página com login e redirecionavam para `/entrar`.
- Teste da administração prática que quebrava o CI do `main` (#108).

## 2026-11-08

### Adicionado

- Administração por abas: Início com "Precisa de atenção" (cobrança vencida, teste acabando,
  dono que não ativou, conta parada), Cobrança de todas as contas, Equipe (dar e tirar acesso
  sem o servidor), Auditoria com filtros, contas com ordenação e planilha (#107, Etapa 15.2).
- Backup diário criptografado do banco e das sessões do WhatsApp, com restauração testada;
  monitoramento (Uptime Kuma em `status.`) e vigia de disco e memória; deploy automático a cada
  merge, com chave restrita (#106, Etapas 17 a 19).
- E-mails com a marca (cabeçalho com a logo, botão amarelo, rodapé com o site), textos novos em
  todos os modelos, e-mail de boas-vindas no cadastro pelo site e aviso de senha alterada
  editável (#105).

## 2026-11-07

### Adicionado

- Sistema no ar em `https://seupentefino.com.br` (o site e o painel no domínio principal; `www`
  e `app.` redirecionam), com HTTPS automático (#100, #103).
- E-mail: botão "Testar conexão" do SMTP e e-mail de teste que mostra a resposta do servidor
  (#101, #103).
- Ícone da aba e do app instalado iguais à logo (#101).

### Corrigido

- Sitemap, robots e prévia de link saíam com `localhost` (#104).
- Imagens Docker de volta ao Node 24 LTS: o Node 25 não traz o `corepack` (#94).

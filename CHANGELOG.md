# Changelog

O que muda no Pente Fino, do ponto de vista de quem usa e de quem opera. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as datas são as da publicação em
produção (`https://seupentefino.com.br`). Detalhes técnicos e o porquê de cada item ficam na
[linha de desenvolvimento](docs/linha-de-desenvolvimento.md) e nos pull requests citados.

## [Não publicado]

### Adicionado (horário de funcionamento da unidade)

- Em Configurações, Unidades, o botão "Horário de funcionamento" (dono e gestor): para cada dia, a hora em que a unidade abre e fecha, com intervalo para o almoço, se quiser. Há o atalho "Usar este horário nos outros dias abertos".
- O cliente só consegue marcar dentro desse horário, pelo link, pelo WhatsApp ou no balcão, mesmo que o barbeiro tenha expediente maior. Os dias de trabalho da unidade passam a seguir o horário.
- O site da barbearia mostra esse horário, por exemplo "Terça a sexta, 9h às 12h e 13h às 20h".
- Sem horário cadastrado, tudo continua como antes: vale o expediente da equipe.

### Adicionado (página de agendamento com a cara da barbearia)

- Em "Minha página", o bloco "Página de agendamento": o dono liga o visual da barbearia no link de agendamento, com a cor dos botões, o logotipo, uma foto de capa, um título e um recado, e o link "Ver o site da barbearia" quando o site está publicado.
- Fica separado do site: vale assim que salva, sem precisar publicar. Desligado, a página fica como sempre.

### Adicionado (cabeçalho e rodapé editáveis, botões com link e CSS no site)

- "Minha página" ganhou a aba "Cabeçalho e rodapé":
  - no cabeçalho: mostrar logotipo e nome, só o logotipo ou só o nome; renomear, esconder e mudar a ordem dos itens do menu; o texto do botão principal (por exemplo, "Marcar agora"); até 3 links próprios no menu;
  - no rodapé: ligar e desligar endereço, horário e contatos; um texto livre (CNPJ, formas de pagamento); Facebook, TikTok e YouTube além do Instagram; até 6 links próprios; e a linha "Site e agenda pelo Pente Fino", que o dono pode tirar.
- Bloco novo "Botões com link", em qualquer página: botões para o cardápio, a loja, o Instagram ou o que o dono quiser.
- Na aba Tema, em "Avançado", um CSS personalizado para quem quer ir além do tema. Ele vale só no site da barbearia e não aceita buscar nada de fora.

### Corrigido (ficha do cliente)

- A ficha do cliente ganhou "Editar dados" (dono, gestor e recepção): nome, WhatsApp, e-mail e aniversário. Quem chega pelo bot vem só com nome e WhatsApp, e o aniversário, que dispara a mensagem de aniversário, ficava sem como pôr.

### Alterado (site sem o link de agendamento)

- O site da barbearia pode ser publicado e funciona mesmo com o link de agendamento desligado. Nesse caso, no lugar de "Agendar horário" aparece "Falar no WhatsApp", com o telefone da unidade; os "Agendar" de cada serviço e barbeiro somem. Ligando o link depois, os botões voltam sozinhos.

### Alterado (site da barbearia mais moderno, com movimento)

- O banner entra em etapas (título, texto e botões), com um zoom lento na foto. Embaixo, uma faixa com os serviços e preços corre devagar e para no toque, no mouse ou no botão "Pausar".
- As faixas da página surgem conforme o cliente rola. O cabeçalho fica fixo e ganha um fundo translúcido ao rolar.
- Os cartões de serviço e os depoimentos sobem de leve ao passar o mouse. As fotos dos barbeiros ganham cor, as da galeria aproximam, e os botões têm um brilho que passa.
- Tudo feito só com CSS, sem deixar a página mais pesada, e desligado quando o aparelho pede "reduzir movimento".

### Adicionado (domínio próprio no site da barbearia)

- Em "Minha página", o dono liga o domínio da barbearia (por exemplo, barbeariadocarlos.com.br). O painel mostra o registro que ele cria no DNS, onde comprou o domínio, e confere sozinho quando está apontado.
- Conferido, o site abre no domínio com o cadeado de site seguro, emitido na hora. No domínio, `/servicos`, `/equipe` e `/contato` são as páginas, e `/agendar` é o agendamento.
- O site continua também no endereço do Pente Fino (`/s/<endereço>`).

### Corrigido (site e link de agendamento em endereços separados)

- O site da barbearia ganhou endereço próprio, `/s/<endereço>`, separado do link de agendamento (`/b/<link>`). Trocar o link em Configurações não muda mais o site, e os botões "Agendar" do site sempre levam ao link atual.
- O dono escolhe o endereço do site em "Minha página", que agora mostra os dois endereços para copiar.
- Endereço trocado não quebra mais: quem chega pelo link de agendamento antigo, ou pelo endereço antigo do site, é levado ao novo, inclusive pelo link do bot e pelo que já está impresso ou no Instagram.
- O `/b/<link>` volta a ser sempre a página de agendamento.

### Adicionado (fotos no site da barbearia)

- Em "Minha página", o dono põe fotos no site: o logotipo no topo, a foto do banner, a de "Sobre a casa", a de cada barbeiro e uma galeria nova com os trabalhos, com legenda.
- A foto é reduzida no próprio celular antes de enviar (sobe rápido no 4G) e sai sem os dados da câmera, como a localização.
- No site, as fotos carregam no tamanho certo para a tela e não fazem a página pular. O texto do banner fica legível sobre qualquer foto.

### Adicionado (site da barbearia e "Minha página")

- Cada barbearia ganha um site próprio no endereço do link (`/b/<endereço>`), com quatro páginas: Início, Serviços, Equipe e Contato. O cliente vê a barbearia, os preços, os barbeiros, o endereço com mapa, o horário e as perguntas frequentes; o "Agendar horário" leva ao agendamento de sempre.
- A página já nasce montada, com textos sugeridos. Preços, equipe, horário e nota dos clientes vêm do próprio sistema; a nota só aparece com 5 avaliações ou mais.
- No menu, em Cadastros, a nova tela "Minha página" (dono e gestor) monta o site com blocos:
  - muda a ordem, esconde, tira e põe de volta cada faixa da página, e edita os textos;
  - escreve a especialidade e a apresentação de cada barbeiro, os depoimentos e as perguntas frequentes;
  - escolhe a cor de destaque, a fonte dos títulos, o formato dos botões, a frase do rodapé e o Instagram;
  - vê a prévia ao vivo, no computador e no celular;
  - o rascunho salva sozinho e o cliente só vê a mudança em "Publicar"; "Tirar do ar" volta o link a abrir só o agendamento.
- Enquanto a página não é publicada, o link da barbearia continua abrindo a página de agendamento, como hoje.

### Alterado (menu do painel)

- O atalho "Falar com o suporte" saiu do rodapé do menu (ao lado do nome) e da gaveta do celular. O suporte continua no item Ajuda, que já estava no menu.

### Corrigido (página de agendamento)

- A página de agendamento de barbearia com muitos barbeiros abre bem mais rápido e não falha mais quando vários clientes entram ao mesmo tempo. O preço de cada barbeiro agora sai de uma consulta só.

### Adicionado (administração: resultado dos cupons)

- Em Configurações → Cupons, a nova tabela "Resultado dos cupons" mostra para cada cupom:
  - quantas contas se cadastraram com ele e quantas pagam;
  - a receita das faturas pagas dessas contas;
  - o desconto concedido nelas;
  - o uso por mês nos últimos 6 meses, em barras.
- O cupom com vagas aparece como "Perto de esgotar" ao usar 80% delas e como "Esgotou" no fim. O alerta por e-mail para a equipe continua valendo.

### Adicionado (administração: aviso geral segmentado)

- O aviso geral pode ir só para parte das barbearias: por plano (Básico, Pro, Premium), por situação (em teste ou pagantes) e para contas escolhidas. Os filtros se combinam, por exemplo "Pro e Premium em teste".
- O formulário mostra para quem vai e quantas contas veem hoje. Sem marcar nada, vai para todas.
- A barbearia fora do público não recebe o aviso nem o texto dele.

### Adicionado (administração: métricas de SaaS)

- Os números do negócio ganharam o bloco "Métricas de SaaS", calculado das faturas pagas e só com meses fechados:
  - MRR do último mês, ARPA (média por conta pagante), churn mensal (média de 6 meses) e LTV;
  - tabela do MRR mês a mês, com o que entrou (novo, upgrade) e o que saiu (downgrade, perdido), os pagantes e o churn;
  - MRR e ticket por plano;
  - coortes por mês de cadastro: a fatia das contas que estava pagando em cada mês seguinte.

### Adicionado (chat: aviso no celular da equipe)

- Na aba Chat da administração, o botão "Avisar no celular" liga a notificação no aparelho. Conversa nova e mensagem nova de visitante ou de cliente chegam no celular de quem atende, mesmo com o navegador fechado, uma notificação por conversa.
- Tocar na notificação abre a aba Chat.
- Recebe quem atende o chat (admin, vendedor e suporte). No iPhone, é preciso ter o Pente Fino instalado na tela de início.

### Adicionado (chat: contexto do cliente, avaliação e respostas editáveis)

- Na conversa de um cliente que veio pela Ajuda, quem atende vê o plano, a situação e a nota de saúde da conta, com o botão "Abrir ficha da conta".
- Ao fim da conversa, o visitante ou o cliente responde "Foi útil?". O resumo da aba Chat mostra a porcentagem dos que acharam útil, e cada conversa mostra a avaliação.
- As respostas prontas do chat podem ser editadas em Configurações → Respostas prontas do chat. É possível criar, mudar e tirar respostas, ou voltar às de fábrica. Os marcadores {basico}, {pro}, {premium} e {dias} viram o preço e os dias de teste atuais.

### Adicionado (chat: Ajuda, respostas prontas, conversão e avisos)

- O chat com o suporte agora também fica na Ajuda do painel, para quem já é cliente. Não pede nome nem contato, e a conversa fica ligada à conta. Na administração, essas conversas aparecem com a etiqueta "Cliente".
- Respostas prontas na conversa da administração: preço dos planos, como funciona o teste, importar planilha, comissão, bot e encerrar. Um clique põe o texto na caixa, para ajustar antes de mandar. Os preços vêm da mesma tabela do site.
- Quem conversa no chat do site e depois se cadastra aparece como "Virou cadastro", com o nome da barbearia.
- A aba Chat mostra os últimos 30 dias:
  - conversas;
  - quantas viraram cadastro, em número e porcentagem;
  - o tempo médio da primeira resposta, só das conversas começadas no horário de atendimento;
  - quantas ainda estão sem resposta.
- Avisos do chat em qualquer aba da administração:
  - um bipe e, se o navegador permitir, uma notificação quando chega conversa nova ou mensagem nova de visitante;
  - o número de conversas esperando no título da aba do navegador e na aba Chat;
  - o botão "Ativar avisos do navegador".
- O visitante vê "(1) Nova mensagem" no título da aba do site quando a equipe responde com o chat fechado.

### Adicionado (chat do site com a equipe)

- O site ganhou o chat "Fale com a gente", no lugar do botão do WhatsApp. O visitante deixa o nome e o WhatsApp ou e-mail, escreve a dúvida e entra na fila.
- O visitante vê a posição na fila, quem está atendendo e as respostas, que chegam a cada poucos segundos. A conversa fica guardada no navegador dele.
- Fora do horário (segunda a sexta das 9h às 18h, sábado das 9h às 13h), a mensagem fica guardada, e a equipe responde pelo contato deixado.
- Na administração, a aba "Chat" mostra a fila e as conversas em atendimento. Quem atende assume, responde, encerra e consulta as encerradas. O botão "Chamar no WhatsApp" aparece quando o contato é um telefone.
- O novo alerta "Conversa nova no chat" chega por e-mail na hora para quem marcar em Meus alertas.

### Adicionado (acesso de suporte com a permissão do dono)

- Em Configurações → Acesso do suporte, o dono libera a equipe do Pente Fino a ver o painel por 24 horas, sem passar a senha, e pode cancelar antes.
- Na administração, o admin ou o suporte abre o painel pela ficha da conta ("Abrir painel em modo suporte"), em outra aba.
- No modo suporte:
  - a sessão dura até 1 hora e nunca passa do fim da liberação;
  - é só leitura, e a API recusa qualquer gravação;
  - os telefones e WhatsApp dos clientes ficam escondidos, e as conversas do bot ficam fechadas;
  - uma faixa no topo avisa quem está vendo e até quando.
- Cada liberação e cada entrada ficam na auditoria da barbearia e na da administração.

### Adicionado (administração: nota de saúde da conta)

- Cada conta da lista tem uma nota de saúde de 0 a 100: verde a partir de 70, amarela de 40 a 69 e vermelha abaixo de 40. Embaixo da nota aparece o que mais tira pontos.
- A nota pesa:
  - acessos nos últimos 7 dias;
  - comandas fechadas na semana;
  - primeiros passos da configuração;
  - cobrança em dia;
  - WhatsApp conectado.
- A lista pode ser ordenada por "Risco de cancelamento", com a menor nota primeiro. A planilha exportada leva a nota e os motivos.

### Alterado (administração: listas de Contas e Equipe)

- A lista de Contas ganhou o filtro "Parou em", para achar as barbearias paradas numa etapa do funil (por exemplo, no 1º agendamento) e ligar para elas.
- Na Equipe, quem foi desativado sai da lista. A caixa "Mostrar desativados" mostra de novo e diz quantos são.

### Adicionado (ajuda para a barbearia que parou na configuração)

- Quando a barbearia fica 3 dias parada na mesma etapa da configuração, o dono recebe o e-mail "Ajuda com o próximo passo". Ele tem o título e o porquê do passo e um botão direto para a tela certa.
- As etapas que contam são: serviços com preço, barbeiros, 1º agendamento, 1ª comanda fechada e WhatsApp. O WhatsApp só conta nos planos com o bot.
- O e-mail sai uma vez por etapa, das 9 h às 20 h, e só para contas em teste ou ativas.
- O texto pode ser editado na administração, em Configurações → Modelos de e-mail.

### Adicionado (administração: alertas para a equipe)

- Alertas por e-mail para a equipe da plataforma, conferidos de hora em hora:
  - cadastro novo;
  - teste acabando em até 3 dias sem nenhuma comanda fechada;
  - cobrança vencida;
  - WhatsApp de uma barbearia caído há mais de 2 horas;
  - e-mail que não saiu;
  - nota fiscal recusada;
  - cupom perto de esgotar (80% das vagas) ou esgotado.
- Cada alerta chega uma vez só, e cada pessoa recebe um e-mail só com os tipos que marcou.
- Cada pessoa escolhe os seus em "Meus alertas por e-mail", no fim do Início da administração. Os admins começam recebendo todos.
- Contas internas não geram alerta.

### Adicionado (administração: origem das contas novas)

- Os números do negócio mostram as contas novas do período por origem do cadastro (Google Ads com a campanha, Instagram, direto…), da que mais trouxe para a que menos trouxe. As contas internas ficam de fora.

### Adicionado (administração: funil de ativação)

- Nos números do negócio, o novo bloco "Funil de ativação" mostra quantas contas já fizeram cada etapa e a porcentagem dos cadastros. As etapas são: cadastro, serviços com preço, barbeiros, 1º agendamento, 1ª comanda fechada, WhatsApp conectado e 1º pagamento.
- O funil filtra por período (desde o início ou cadastros dos últimos 30 e 90 dias) e deixa de fora as contas internas.
- Na ficha de cada conta aparece a próxima etapa do funil, para saber onde ajudar.

### Adicionado (site: blog)

- Blog no site (`/blog`). O primeiro post é "Faturamento não é lucro: como saber quanto sobra na barbearia", com as contas de um mês de barbearia.
- Cada post tem data, tempo de leitura, chamada para o teste grátis no meio e no fim e "Leia também".
- Mais cinco posts ficaram como rascunho (título e tópicos), sem ir ao ar.
- O blog entra no sitemap e no rodapé.

### Adicionado (site: calculadoras)

- Três calculadoras grátis, cada uma no seu endereço:
  - lucro por corte;
  - comissão de barbeiro (sobre o preço cheio ou descontando o produto);
  - quanto cobrar pelo corte (preço mínimo com custos fixos, comissão, produto e margem).
- Cada uma explica a conta e mostra um exemplo.
- A home continua com a calculadora de lucro e agora tem link para as outras duas.
- As páginas entram no sitemap e no rodapé.

### Adicionado (site: comparações)

- Novas páginas de comparação: "Pente Fino ou AppBarber?", "Pente Fino ou Trinks?" e "Pente Fino ou Booksy?".
- Cada página mostra:
  - quanto custa para 1, 3 e 5 barbeiros;
  - teste grátis, WhatsApp, comissão, lucro por serviço, nota fiscal e app nas lojas;
  - onde o outro sistema é melhor.
- Todo dado tem a fonte oficial e a data da conferência.
- Nova página "Melhor sistema para barbearia", com cinco perguntas para escolher e a tabela com os quatro sistemas.
- As páginas entram no sitemap e no rodapé.

### Adicionado (site)

- Sete páginas novas no site, uma por assunto que o barbeiro procura no Google:
  - sistema para barbearia;
  - agenda online;
  - controle financeiro;
  - comissão de barbeiro;
  - comanda digital;
  - WhatsApp;
  - aplicativo.
- Cada página tem:
  - uma resposta direta;
  - as telas do sistema;
  - quanto custa (lido da tabela de preços);
  - dúvidas frequentes;
  - o botão para o teste grátis.
- As páginas entram no sitemap e no rodapé ("Recursos").

### Alterado (planos)

- Comissão automática por item e extrato do barbeiro agora fazem parte de todos os planos, inclusive o Básico. Quem já assina o Básico ganha na hora, sem mudar de plano. A página de planos, os selos do site e a comparação de planos foram atualizados.

### Adicionado (saúde do sistema)

- Saúde do sistema → "Servidor": versão em produção e desde quando está no ar, último backup (com
  tamanho, cópia externa e o erro quando falha; fica em destaque se passar de um dia sem backup),
  uso de disco e memória, validade do certificado HTTPS e o último aviso de cobrança que chegou do
  Asaas.
- Limpeza de dados: deixa claro que conta que paga e conta em cortesia nunca são apagadas, e mostra
  quais contas saem nos próximos 7 dias.

### Alterado (configurações da administração)

- Aviso geral: os campos de data e hora dizem que são no horário de Brasília, e uma prévia mostra o
  aviso exatamente como a barbearia vai ver no topo do painel.
- Modelos de e-mail: "Mandar teste para mim" envia o modelo salvo, com dados de exemplo, para o seu
  e-mail, para conferir como chega.
- Planos e preços e Cupons mostram as últimas mudanças, com o link para o histórico completo na
  auditoria (já filtrado).

### Adicionado (equipe da administração)

- Dois papéis novos na Equipe: **Suporte** (lê as contas e a saúde do sistema, sem cobrança nem
  configurações) e **Financeiro** (cobranças, pagamentos e nota fiscal de todas as contas, sem
  equipe nem configurações). Cada um vê só as abas e os botões do seu papel.
- A Equipe mostra quando cada pessoa trocou a senha pela última vez, e desativar alguém pede o
  motivo (fica na auditoria). O papel muda direto na lista.

### Alterado (administração mais legível)

- Auditoria em português: o detalhe de cada ação mostra nomes, valores em reais, datas no horário
  de Brasília e "sim/não", no lugar do código. Dá para carregar mais do que 300 ações e exportar
  em CSV (até 2000, com o mesmo filtro).
- Início da administração: escolha do período nos números (mês atual, últimos 30 dias, mês
  anterior), textos que explicam quando ainda não há dados ("Nenhuma conta paga ainda · contas em
  teste: 3") e números que levam direto para a lista de contas já filtrada.

### Adicionado (sinal)

- "Receber sinal (adiantado)" na comanda: a recepção registra um pagamento antes do atendimento.
  Ele entra no caixa do dia em que foi recebido e é descontado na hora de fechar (se cobrir tudo,
  fecha sem receber mais nada). Ao cancelar, dá para devolver o sinal na hora ou deixar retido; a
  comanda cancelada mostra "Devolver" para depois. O caixa do dia mostra os sinais recebidos e os
  devolvidos.

### Adicionado (preço por barbeiro)

- Perfil → "Meus preços": o barbeiro que cobra diferente da tabela escreve o próprio preço de cada
  serviço. Vale de hoje em diante na comanda dele e quando marcam com ele, pela agenda, pelo
  WhatsApp e pelo link de agendamento (que mostra o preço do barbeiro escolhido). Vazio volta
  para o preço da unidade.

### Alterado (catálogo por unidade)

- Serviços e produtos agora são de cada unidade: no cadastro, "Disponível em" escolhe as unidades.
  Ao trocar a unidade no topo, Serviços, Produtos, a tabela de preços, a comanda, a agenda, o bot
  e o link de agendamento mostram só o que está nela. Unidade nova começa vazia, com o botão
  "Copiar catálogo de outra unidade" (traz os serviços com os preços de hoje e os produtos). O que
  já estava cadastrado continua em todas as unidades de antes.

### Adicionado (escolhas da planilha)

- Preço livre para serviços como química: em Serviços, marque "Preço livre" e, se quiser, o valor
  mínimo e o máximo. Na comanda, o item ganha o botão "Valor" para digitar o que foi cobrado. A
  recepção, o gestor e o dono digitam; o barbeiro só se o dono liberar. A comissão sai do valor
  digitado, e cada valor diferente da tabela fica registrado na comanda.
- Despesas fixas no mês novo: "Copiar fixas do mês anterior" (Financeiro → Despesas) mostra as
  fixas do mês passado para conferir e ajustar o valor antes de copiar; a que já foi lançada à mão
  vem desmarcada. E "Repetir todo mês" na despesa faz ela entrar sozinha no mês seguinte, a pagar.
  Nada é lançado duas vezes.

### Segurança e confiabilidade

- Pagamentos e notas fiscais avisados pelo Asaas são conferidos no próprio Asaas antes de valer:
  um aviso falso, mesmo com o token certo, não marca pagamento nem cria mensalidade do clube.
- O endereço do bot do WhatsApp não fica mais aberto na internet (só a Evolution, por dentro, chama).
- Saúde do sistema: tentativas com o segredo errado (com o IP), worker parado, a última execução de
  cada rotina automática (com "Atrasada") e aviso de segredo curto. Quem erra demais é bloqueado
  por 10 minutos.
- Mensagem do cliente e lembrete do horário não se perdem mais num tropeço do banco: o sistema
  tenta de novo. Lembrete que não entrou na fila volta na rotina de 15 minutos.
- O worker travado é reiniciado sozinho pelo vigia do servidor, com aviso no monitoramento.

### Alterado (clube no resultado do mês)

- A mensalidade do clube entra no faturamento no dia em que é paga (o valor que chega na conta),
  na linha "Clube (mensalidades)": Início, Resultados do mês, meta, projeção, Resumo do dia,
  Financeiro, painel da rede e arquivo do contador (CSV e PDF). Antes, o assinante aparecia como
  cliente sem receita e puxava o ticket para baixo.
- Ticket médio agora conta só o cliente avulso (serviços + produtos ÷ clientes que pagaram na
  hora). Novo cartão "Clube" com mensalidades, atendimentos cobertos e valor por atendimento.

### Adicionado (administração mais prática)

- Ficha da conta: no topo, a próxima cobrança (valor, data e cupom, ou a fatura em aberto), os
  dias que faltam do teste e a ativação ("5 de 8 primeiros passos"). Botão "Chamar no WhatsApp"
  ao lado do telefone do dono, com saudação pronta.
- Notas da equipe em cada conta (o que foi combinado, ligações), com autor e data. A barbearia não
  vê; só o admin escreve, e o vendedor da conta lê.
- Lista de contas com as colunas Ativação e Origem (também na planilha exportada), o nome da
  barbearia preso à esquerda ao rolar para o lado e a ordem "Menos configuradas".
- Vendas por origem: cadastros, quantos ainda estão em teste, pagantes, conversão do teste em
  pagante e receita paga de cada origem (anúncio, campanha, site). Contas internas ficam fora.
- Nova venda: WhatsApp e CPF/CNPJ com máscara, CPF/CNPJ conferido (opcional, o Asaas pede antes da
  cobrança automática), erro em cada campo, dias de teste de 0 a 60 e um resumo do que vai ser
  criado (plano, valor e quando começa a cobrança).

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

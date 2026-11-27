# Changelog

O que muda no Pente Fino, do ponto de vista de quem usa e de quem opera. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as datas são as da publicação em
produção (`https://seupentefino.com.br`). Detalhes técnicos e o porquê de cada item ficam na
[linha de desenvolvimento](docs/linha-de-desenvolvimento.md) e nos pull requests citados.

## [Não publicado]

### Adicionado (proteção dos números de WhatsApp)

- **O sistema protege o número contra restrição do WhatsApp:** número recém-conectado manda poucas mensagens automáticas por dia e o limite sobe aos poucos (20, 50, 100 e 200); entre duas automáticas do mesmo número há de 25 a 45 segundos; toda automática mostra "digitando..." antes; o mesmo texto para o mesmo número em menos de 10 minutos não sai de novo.
- **Pausa automática por sinal de risco:** se os envios começam a falhar ou muitos clientes respondem SAIR, lembretes, retorno e aniversário param por algumas horas e o dono recebe o aviso "Mensagens automáticas pausadas". O bot continua respondendo quem escreve.
- **Bot → WhatsApp** mostra quantas mensagens automáticas saíram hoje, o limite do dia e até quando o número novo está em aquecimento. Ao conectar, a tela explica que número novo começa devagar e sobe em duas semanas.
- **O lembrete do horário marcado tem prioridade:** retorno, aniversário, aviso do clube e pesquisa usam só 70% do limite do dia; o resto fica para lembretes, vaga da lista de espera e horário mudado.
- **Mensagens automáticas com abertura variada** ("Oi, Ana!", "Olá, Ana!", "Oi, Ana, tudo bem?"), para não saírem idênticas em massa.
- **"Retomar agora"** em Bot → Conexão: depois de resolver a causa (chip novo, celular com internet), dono ou gestor encerram a pausa contando o que foi resolvido.
- **A semana do número por e-mail**, às segundas de manhã, para dono e gestor: automáticas enviadas, SAIR, pausas e um conselho. Desliga em Perfil → Avisos.
- **Retorno, aniversário e aviso do clube na hora do cliente:** saem perto da hora em que cada cliente costuma escrever no WhatsApp (entre 10 h e 20 h), em vez de todos às 10 h.
- **"Testar meu número"** em Bot → Conexão: manda uma mensagem do número da unidade para o seu WhatsApp e mostra se saiu. Se não sair, a tela explica o que conferir.
- **Administração → Saúde do sistema → WhatsApp: "SAIR por semana"**, somando todas as contas: automáticas, SAIR, a parte que virou pedido de parar e as pausas das últimas 8 semanas.
- **Administração → Saúde do sistema → WhatsApp:** "Números em risco" lista as contas com as automáticas pausadas ou com muitos SAIR ou falhas nas últimas 24 horas, para o suporte agir antes de o WhatsApp restringir o número.

### Adicionado (licenças)

- **Pente Fino passa a vender licenças por tipo de negócio:** Barbearia, Beleza (salão, unhas e sobrancelhas), Estética, Tatuagem e Atendimento (só o bot de WhatsApp, R$ 49,90 por número, para qualquer negócio). Cada licença tem os seus planos e preços; o link de cadastro já traz a licença da página de vendas (`/cadastro?licenca=estetica`) e a venda presencial escolhe na administração. Quem já usa continua na Licença Barbearia, com os mesmos preços.
- **Configurações mostra a licença e o tipo de negócio**, sem o seletor: para trocar, o suporte muda pela administração (Ficha da conta → Mudar licença), com motivo e o novo preço no Asaas.

### Adicionado (tipo de negócio)

- **Configurações → Tipo de negócio** (só o dono): barbearia, salão de beleza, clínica de estética, unhas e sobrancelhas, tatuagem e piercing, academia e estúdio, personal trainer ou outro. O sistema passa a chamar quem atende pelo nome do negócio (barbeiro, esteticista, tatuador, instrutor...) em Configurações, Equipe, Perfil, Resultados e Resumo do dia; as demais telas vêm na sequência. Quem já usa continua como barbearia, sem nenhuma mudança.
- **O tipo de negócio vale no sistema todo:** o menu e as mensagens prontas do bot, a Ajuda, os primeiros passos, a busca, o site e a página de agendamento, o relatório do mês e a comanda impressa falam "esteticista", "clínica", "tatuador"... conforme o negócio. Para a barbearia o texto do bot, da Ajuda e do relatório continua o mesmo. A página de agendamento avisa o Google do tipo certo (salão de beleza, estética, estúdio de tatuagem, academia).
- **Textos neutros onde não precisa do nome do negócio:** avisos e erros para o cliente dizem "fale com a equipe", "esta unidade" e "quem atendeu" em vez de "a barbearia" e "o barbeiro"; os planos falam em "profissionais" e "equipe".

### Mudado (por baixo, sem mudança na tela)

- **Papel "barbeiro" passa a se chamar "profissional" no sistema**, primeiro passo para atender outros segmentos (salão, estética, tatuagem, academia). Na tela continua "Barbeiro". Quem estiver logado no deploy não é desconectado: o nome antigo ainda é aceito.

### Documentação

- **Documentação para IA e automação:** mapa em `docs/README.md`, arquitetura com diagrama, regras de negócio com exemplos conferidos por teste, fluxos, permissões, glossário e registro de decisões. Modelo de dados, rotas da API, telas, planos e menu agora saem do código (`pnpm docs:gerar`) e o CI confere. `CLAUDE.md` e `AGENTS.md` na raiz para outras ferramentas de IA. Plano das próximas fases em `docs/plano-multissegmento.md`.

### Corrigido (cópia externa do backup)

- **A cópia externa do backup voltou a ser conferida todo dia:** de 13/11 a 24/11 o backup local rodou às 3h, mas a cópia para o armazenamento externo falhou todos os dias. A configuração do rclone tinha sido criada com `sudo` e o backup automático, que roda como `deploy`, não conseguia ler. A falha ainda passava em silêncio: a Saúde do sistema continuava mostrando o último sucesso. Agora o erro aparece na Saúde com o comando para corrigir, `backup-externo.sh` e `backup.sh` rodados com `sudo` usam o dono da pasta, e o `diagnostico-backup.sh` aponta esse caso.
- **Backup rodado como root não trava mais a cópia externa:** a pasta `backups/baixados`, criada pelo `restaurar.sh` como root, fazia o rclone falhar (`permission denied`). Ela deixou de ser enviada para fora, e o `restaurar.sh` com `sudo` também passa a rodar como o dono da pasta.

### Corrigido (ligar as notificações no aparelho)

- **"Ligar notificações" diz o que deu errado:** antes, qualquer falha virava "Não foi possível ligar neste aparelho". Agora aparece o motivo e o que fazer: notificações bloqueadas no cadeado, o Brave com o push do Google desligado, aba anônima, iPhone fora do app instalado, ou o app ainda instalando. Vale no Perfil, em Avisos e na administração.
- **Aparelho com inscrição antiga se refaz sozinho:** se as chaves do servidor mudaram, ligar de novo troca a inscrição em vez de falhar.
- **"Mandar um teste" fala a verdade:** diz para quantos aparelhos mandou, ou que nenhum está ligado, em vez de "Teste enviado" mesmo quando nada saía.
- **Deploy sem falso erro no fim:** o job "Implantar na VPS" acusava `syntax error near unexpected token 'do'` depois de já ter implantado tudo, porque o script de deploy se trocava pela versão nova enquanto rodava. Agora ele entra como arquivo novo e termina sem ler o resto.

### Corrigido (testes de 19/11 no WhatsApp)

- **O bot volta a atender de verdade depois de "Devolver ao bot":** o cliente manda AGENDAR, escolhe o serviço e o horário até o fim, mesmo que mande logo depois da devolução ou depois de a mensagem de encerramento chegar. A causa era a trava contra loop, que contava as respostas de antes da devolução e, num teste longo, pausava a conversa sem avisar. Agora ela só pega loop de verdade (muitas mensagens dos dois lados em 2 minutos) e conta a partir da devolução.
- **Os botões de WhatsApp levam todos ao mesmo número:** "Prefere marcar pelo WhatsApp?", "Confirmar pelo WhatsApp" depois de reservar, "Falar com a barbearia" na gestão da reserva (inclusive depois de cancelar) e o WhatsApp do site usam o número conectado ao bot da unidade da reserva; sem bot conectado, o telefone da unidade.
- **Conversas diz por que o bot parou:** "Aguardando atendente · bot pausado", "Em atendimento humano · bot pausado" ou "Bot respondendo", com o motivo ("O cliente pediu atendente", "Assumiu pelo painel", "A equipe respondeu pelo WhatsApp do celular", "Trava contra loop"...). "Histórico do estado" mostra cada mudança com horário, de onde para onde, a origem e quem fez. Depois de "Devolver ao bot", a tela mostra o estado que ficou gravado.
- **O cliente sabe que o bot pausou:** ao pedir atendente, recebe o aviso de que as respostas automáticas ficam pausadas e de que pode mandar MENU para voltar antes de alguém responder. Já em atendimento com a equipe, MENU não tira a conversa dela.
- **Mapa na cidade certa:** a unidade ganhou Cidade, UF e "Link do Google Maps". O link que o bot, a página de agendamento e o site mandam leva o endereço completo (ou o link escolhido), e o cadastro avisa quando faltam dados.
- **Nada automático de madrugada:** lembretes, pesquisa, avisos e o "ninguém respondeu" não saem entre 22h e 7h. O lembrete que cairia de madrugada sai às 21h59 da véspera; a pesquisa de quem fechou à noite vai às 9h; o que perderia o sentido até a manhã é descartado. Resposta a quem acabou de escrever sai na hora.

### Corrigido (cadastro, Asaas e backup)

- **Um telefone, um cliente:** o mesmo celular com ou sem o nono dígito não vira mais dois cadastros (balcão, site, bot, lista de espera, clube e planilha). Os cadastros que já existiam passam para a forma com o 9; os pares repetidos que já existem ficam para a recepção juntar.
- **Webhook do Asaas:** a Saúde do sistema mostra por que cada aviso foi recusado (sem token, token diferente, servidor sem token) e qual evento era. Os avisos da chave de API (o "Webhook para chaves de API" do Asaas) são aceitos quando chegam com o token.
- **Backup diário mais garantido:** o agendamento é reposto em todo deploy, mesmo quando a atualização falha, e o vigia de 5 minutos roda o backup se não houver um das últimas 26 horas. Novo `infra/diagnostico-backup.sh` mostra na VPS o que impede o backup automático.

### Adicionado (painel e Minha página)

- **Procurar acha opções e ajuda:** além de telas, clientes e comandas, a busca (Ctrl+K) acha opções dentro das telas (Instagram, cidade da unidade, feriados, lembretes, domínio, QR Code...) e artigos da Ajuda.
- **"Link e agendamento" numa aba só** em Configurações: o link de cada unidade, como a página aparece e as regras do agendamento.
- **Instagram junto das outras redes,** em Minha página → Cabeçalho e rodapé.
- **Prévia do link nas redes:** em Minha página → Página de agendamento, a barbearia escolhe o título, o texto e o fundo (cor ou foto de capa) do cartão que aparece quando o link é enviado no WhatsApp, no Instagram e no Facebook, com o logotipo dela. Vale para o link de agendamento e para o site, com simulação na tela.
- **Administração troca o WhatsApp do dono** na ficha da conta, com motivo e auditoria.
- **Minha página sem CSS:** banner com a foto atrás, à direita ou à esquerda do texto, e o recorte (o ponto que fica sempre à vista); galeria em cartões numerados rolando para o lado; bloco "Colunas" (foto, título, texto e botão, até 4); paleta própria (destaque, cor escura e fundo) com 6 paletas prontas, salva só se tudo continuar legível.
- **Caixas de marcação com o visual do sistema** em todas as telas.

### Corrigido (respostas que o bot dava e não devia)

- **Reação (👍), mensagem apagada ou editada** não são mais tratadas como mensagem do cliente: o bot não responde nada (antes, "Não entendi" com as opções).
- **Figurinha ou foto sem texto** no meio da conversa: o bot fica quieto. **Áudio:** avisa uma vez que só lê texto e oferece falar com a equipe.
- **"Obrigado", "valeu":** "Por nada! Qualquer coisa, é só chamar." uma vez por conversa; **"ok", "beleza", "tchau"**: o bot não responde.
- **"Oi" duas vezes seguidas:** o menu vai uma vez só.
- **"Sim", "confirmo", "ok"** confirmam o horário na conversa e o lembrete; **"não", "cancela"** desistem (antes, só os números).

### Corrigido (mensagem de anúncio indo para quem não veio de anúncio)

- **O fluxo do anúncio só vai para quem veio de anúncio:** vale a marca que o próprio WhatsApp manda no anúncio de verdade (o cartão marcado como anúncio, o clique no anúncio ou a origem "FB_Ads"/"ctwa"). Cartão de link, publicação compartilhada e outras origens não contam mais.
- **A frase pronta vem vazia** (antes, "Olá! Quero saber mais.", que é também a frase do botão do WhatsApp no Instagram e no Facebook) e, quando usada, só vale para número que nunca escreveu para a barbearia, com a frase inteira (3 palavras ou mais). Frase curta salva antes sai sozinha; o resto da configuração continua.
- **Uma vez por número:** quem passou pelo fluxo do anúncio não recebe de novo por 30 dias.
- **O bot não responde número conectado ao sistema:** se o número de uma unidade (sua ou de outra barbearia que usa o sistema) escreve para outra, a mensagem fica em Conversas e o bot não responde, para os dois bots não ficarem se respondendo. Nada automático (lembrete, automação) sai para esses números; a resposta escrita pela equipe continua saindo.
- **Trava contra conversa em loop:** muitas mensagens dos dois lados em poucos minutos (sinal de outro robô do outro lado) param o bot, e a conversa vai para a fila da equipe em Conversas (refeita nos testes de 19/11, acima).

### Corrigido (aviso na unidade certa e reserva com o serviço escolhido)

- **Aviso abre a unidade e o dia certos:** o link de cada aviso leva a unidade dele, e o painel passa para ela ao abrir (só se a pessoa tiver acesso). O resumo do dia abre o Resumo daquele dia, não o Início de hoje. Vale também para os avisos antigos e para a notificação do celular.
- **Agendar pelo site com o serviço já marcado:** "Agendar corte infantil" (e os outros serviços) abre a reserva com aquele serviço escolhido, e os horários já saem pela duração dele; "Agendar com <barbeiro>" abre com o barbeiro escolhido.

### Adicionado (central de avisos mais útil)

- **Avisos novos:** cliente esperando resposta no WhatsApp há mais de 10 minutos (para a recepção; sem recepção, o gestor; sem ele, o dono; só no expediente), contato novo que veio de anúncio (recepção, gestor e dono) e avaliação baixa (nota 1 ou 2, para dono e gestor, com o comentário). Os três vão também para o celular, e cada um pode ser desligado no Perfil.
- **Tela de Avisos:** filtro "Só os não lidos" e por assunto (Caixa, WhatsApp, Anúncio, Avaliação…), avisos agrupados por dia (Hoje, Ontem…) e a etiqueta do assunto em cada um.

### Corrigido e reorganizado (anúncio, tela do Bot e Saúde do sistema)

- **Cliente comum não cai mais no fluxo de anúncio:** o que separa os dois é a marca que o próprio WhatsApp manda quando a pessoa toca no anúncio; sem ela, só a frase pronta do anúncio como **primeira** mensagem de uma conversa nova (antes, a frase em qualquer ponto de qualquer mensagem, a qualquer momento, contava).
- **Testar:** "Chegou por anúncio" só aparece com as mensagens de anúncio ligadas para a unidade; desligadas, a tela diz onde ligar.
- **Tela do Bot em 4 abas, na ordem de uso:** 1. Conexão · 2. Respostas (menu e palavras-chave, mensagens prontas, horário do bot) · 3. Automáticas (quem vem de anúncio; retorno, aniversário e clube) · 4. Testar.
- **Saúde do sistema (administração):** no alto, "Tudo certo" ou a lista do que pede atenção, cada item levando à aba certa; embaixo, as abas Servidor · WhatsApp e rotinas · Erros e e-mails · Integrações.

### Mudado (salário como despesa fixa)

- **O salário do barbeiro já aparece nas despesas fixas do mês**, a pagar, sem precisar do "Copiar fixas do mês anterior": basta o valor fixo em Equipe. Mudar o valor em Equipe atualiza o salário do mês ainda não pago, e zerar tira. Nunca duplica, e quem já lançou o salário à mão (categoria "Salários e encargos" com o nome do barbeiro) não ganha outro.

### Adicionado (sites no sitemap, Search Console na Saúde e quem respondeu)

- **Sites das barbearias no sitemap:** o site publicado (/s/…) das unidades com "Aparecer no Google" entra no `sitemap.xml` (antes, só a página de agendamento).
- **Saúde do sistema → "Google Search Console":** diz se o domínio já tem o registro de verificação do Google no DNS e, se não tiver, aponta o passo a passo.
- **Conversas mostra quem respondeu:** "Diego respondeu há 5 min" ou "Respondida pelo celular há 5 min", na lista e no topo da conversa, para ninguém responder em dobro.

### Adicionado (SEO: IndexNow)

- **Buscadores avisados na hora (IndexNow):** a cada deploy, o site avisa Bing, Yandex e os outros buscadores do IndexNow de todas as páginas do sitemap; quando uma barbearia liga "Aparecer no Google" ou publica o site com ele ligado, o endereço dela é avisado no mesmo instante. O arquivo da chave fica publicado no site.

### Adicionado (anúncios: origem do cliente, relatório e agendar o pedido)

- **Clientes de anúncio:** quem chega pelo anúncio fica com a origem "Anúncio (WhatsApp)" na ficha. Em Resultados do mês → Canais, o bloco "Clientes de anúncio" mostra as conversas de anúncio, os clientes novos, quantos compraram, quanto gastaram e o ticket, com as conversas por anúncio.
- **Agendar o que o cliente pediu:** em Conversas, "Agendar o que pediu" abre o novo agendamento já com os serviços, o profissional e o horário que o cliente escolheu no bot; o agendamento conta no canal WhatsApp.
- **Respondeu pelo celular, o bot sai:** quando alguém da equipe responde o cliente direto pelo WhatsApp do celular da barbearia, a conversa passa para "Com a equipe" e o bot fica quieto (volta sozinho depois de 2 horas sem o cliente escrever, ou quando a equipe devolver em Conversas). A mensagem do celular também aparece no histórico da conversa.
- **Mensagens de anúncio por unidade:** com uma unidade escolhida em "Editando", a aba Mensagens automáticas grava as mensagens só dela; "Voltar ao padrão" faz a unidade usar de novo as da barbearia.

### Adicionado (bot do WhatsApp por unidade, mais esperto e anúncios)

- **Bot por unidade:** em Bot, "Editando" escolhe o padrão da barbearia ou uma unidade. A unidade usa o padrão até personalizar o menu e as mensagens dela; "Voltar ao padrão" desfaz.
- **Avisos antes de publicar:** unidade sem número conectado, sem serviço com preço ou sem link de agendamento aparece no alto da tela do bot.
- **Simulador explica o que carregou:** de onde veio o menu (rascunho ou publicado, da unidade ou do padrão), as opções e, se não houver rascunho ou o menu estiver sem opções, o motivo.
- **Pedido numa frase:** "quero cortar amanhã às 15h" já anota o serviço, o dia e a hora; livre, vai para a confirmação; ocupado, mostra os horários livres mais perto.
- **Preço direto:** "quanto é a barba?" responde "Barba custa R$ 35,00 e leva 30 min. Quer marcar?"; a tabela inteira fica para quem pedir.
- **VOLTAR e MENU previsíveis** no agendamento pela conversa, e "Trocar o profissional" na confirmação, mantendo o serviço.
- **Passagem para a recepção:** fora do horário, o bot diz quando a recepção volta; em Conversas, a equipe vê o que o cliente já tinha escolhido (serviço, profissional, dia e hora).
- **Mensagens automáticas de anúncio** (aba nova no Bot): quem vem de anúncio do Facebook/Instagram recebe uma conversa própria, em sequência, e passa para a equipe; a conversa fica marcada "Veio de anúncio", com as respostas.
- **Conversas:** filtro por unidade (com "Todas as unidades" no alto) e "Só quem veio de anúncio".
- **Convite "RECEBER" desligável:** em Mensagens prontas, uma chave liga ou desliga o convite para receber lembretes, que chegava logo depois do "oi".
- **Palavras-chave:** até 40 palavras por grupo (antes 20, sem aviso); passando disso, o problema aparece com o grupo e o limite, e o erro do bot diz o lugar e o motivo em vez de "Confira os campos destacados".
- **{horario} do bot** usa o horário de funcionamento da unidade (antes, o expediente dos barbeiros; sem barbeiro, aparecia "a combinar").

### Corrigido e melhorado (cadastro, unidade em uso e login — revisão de 16/11)

- **Cupom que sumia:** quem navegava por algumas páginas do site estourava o limite de consultas do login (10 por minuto), e aí os botões levavam ao cadastro sem o cupom e o cadastro apagava o LANCAMENTO em silêncio. A consulta do cupom saiu desse limite, e só a recusa do cupom (não existe, venceu, sem vagas) encerra a oferta na tela; falha passageira mantém o cupom, que a API confere de novo ao criar a conta.
- **Cadastro mostra o que será cobrado:** no anual, cada plano mostra o total do ano; um resumo diz quanto será cobrado depois do teste (por mês ou por ano, com as Automações e o cupom aplicado). No Agenda, o desconto só aparece com as Automações, como na cobrança.
- **Unidade em uso:** com "Todas as unidades" no alto, Agenda, Comandas e Caixa mostram "Unidade desta tela" e dizem que o que for lançado fica nela; a escolha vale ao passar de uma tela para outra.
- **Avisos, bot e Automações lado a lado** na página de planos: o que vem em todo plano (confirmação e lembrete), o que marca pela conversa e o que o adicional libera.
- **Login:** "Mostrar senha", como no cadastro; enviar vazio pede o e-mail e a senha, em vez de dizer "E-mail inválido".
- **Copiar de outra unidade** (Configurações → Unidades, para o dono): escolha a unidade de origem e marque o que vem — horário de funcionamento, folgas e feriados (de hoje em diante, sem mexer no que a unidade já marcou), regras de agendamento, horário do bot, site (vai para o rascunho), visual da página de agendamento e metas do mês. Endereço, endereço do site, domínio, link do Google e o WhatsApp nunca são copiados; mensagens do WhatsApp, menu do bot, equipe e clube já valem para todas as unidades.

### Adicionado (salário dos barbeiros nas despesas fixas)

- **Financeiro → Despesas → "Copiar fixas do mês anterior"** agora traz também o salário de cada barbeiro que tem valor fixo em Equipe ("Mudar valor fixo"): uma linha "Salário: nome", na categoria "Salários e encargos", com o valor do cadastro para conferir ou mudar antes de gravar. Assim o salário entra nas despesas fixas e no resultado do mês. Nunca duplica: um salário por barbeiro e mês, e o lançado à mão com o nome dele vem desmarcado.

### Corrigido (bot do WhatsApp parado)

- **O worker (bot do WhatsApp, lembretes e rotinas) parou em 16/11 às 13:32**, no deploy da atualização automática do `web-push` 3 → 4: a versão nova não tem mais a exportação padrão e o worker caía ao iniciar. O import foi corrigido e o bot, os lembretes e as rotinas voltam ao subir esta versão.
- **Para não repetir:** o CI de todo PR e a construção das imagens abrem cada módulo da API e do worker como em produção (`scripts/conferir-modulos.mjs`); imagem que não abre não é enviada nem implantada. E o deploy agora espera a API, o painel **e o worker** ficarem saudáveis; antes esperava só o painel e saía verde com o worker caído.
- **WhatsApp em duas unidades:** teste novo prova que cada unidade conecta o próprio número ao mesmo tempo (instância própria, QR próprio) e que a mensagem de cada número vai para a unidade certa.

### Acessibilidade (nome lido = texto visto)

- Botões e links cujo nome para o leitor de tela não continha o texto que aparece (regra WCAG 2.5.3, cobrada pela versão nova do axe nos testes): sino de avisos, troca de unidade, blocos da agenda, lista do dia, mês dia a dia, "Testar 14 dias grátis" dos planos e o "Fale com a gente" do site. Agora quem usa comando de voz pode dizer o que vê; o detalhe extra continua para o leitor de tela.

### Segurança (deploy)

- Valor do `.env` com `$` (como a chave do Asaas) era lido como vazio pelo Docker Compose e aparecia inteiro no log público do deploy. O `atualizar.sh` agora esconde o valor do aviso e diz qual variável pôr entre aspas simples.

### Mudado (site da barbearia mais fino e suporte em todo o painel)

- **Site da barbearia:**
  - a troca entre as páginas (Início, Serviços, Equipe...) tem um esmaecer curto, com o cabeçalho parado; quem pediu menos movimento no aparelho não vê animação;
  - os títulos com a fonte "Moderna condensada" não pulam mais enquanto a fonte carrega;
  - no celular, a barra do navegador fica na cor do cabeçalho do tema, e a seleção de texto na cor da barbearia.
- **Textos que respeitam o tamanho de letra do celular:** quem aumenta a letra nas configurações do aparelho vê o site da barbearia e o painel maiores (Chrome no Android, a partir da versão 146).
- **Página de vendas:**
  - as perguntas frequentes, no fim, só são desenhadas quando chegam perto da tela;
  - os parágrafos não deixam mais uma palavra sozinha na última linha;
  - as tabelas que rolam para o lado esmaecem a borda enquanto há mais para ver.
- **Suporte por chat em todo o painel:** um botão ao lado do sino de avisos abre a conversa com a equipe em qualquer tela (antes, só na Ajuda). A Ajuda não mostra mais o WhatsApp do suporte: o chat o substitui, e o e-mail continua.
- Na comparação da página de vendas, "Bot de WhatsApp que agenda, incluso no plano" virou "sem custo por mensagem": o bot vem no Pro e no Premium, e no Agenda e no Básico com as Automações.

### Corrigido (verificação final)

- **Backup diário:** não estava agendado no servidor (só rodavam os backups feitos à mão). Agora o próprio deploy garante o backup todo dia às 3h e o vigia de disco e memória a cada 5 minutos.
- **Bot do WhatsApp mais rápido com muitas barbearias:** as rotinas que passam por todas as contas (avisos, automações e avisos da assinatura) não seguram mais a resposta às mensagens dos clientes.
- **Feriado no calendário:** a central de avisos não manda mais o resumo do dia nem o aviso de caixa aberto num dia marcado como fechado.
- **Saúde do sistema:** mostra a última execução dos alertas da equipe, as filas de rotinas, de alertas e de limpeza, e quantas contas deram erro em cada rotina.

### Mudado (indique e ganhe mais visível)

- A página inicial tem a chamada "Não tem barbearia? Ganhe indicando" logo abaixo do botão de teste, que leva até a seção, e o menu do topo ganhou "Indique e ganhe" (no computador). Antes a seção só aparecia perto do fim da página.

### Adicionado (entrar com passkey)

- **Entrar sem senha, com a digital, o rosto ou o PIN do aparelho (passkey).** No Perfil, em "Entrar sem senha", cada pessoa cria a passkey no celular ou no computador, vê as que tem e apaga. No login, a passkey aparece na sugestão do campo de e-mail e no botão "Usar passkey". A senha continua valendo. A passkey não funciona num site falso, então protege contra golpe de link.

### Mudado (Minha página organizada e página de agendamento com tema)

- **Minha página** em três abas: **Site** (o editor com a prévia, que antes ficava lá embaixo), **Página de agendamento** e **Endereço e domínio**. A barra de publicar continua no topo.
- A página de agendamento veste o **tema inteiro**: fundo, cartões, texto, fonte dos títulos e o canto dos botões, não só a cor. Dá para escolher "Igual ao site" (o padrão) ou um dos quatro temas.
- Nova opção: **"Mostrar 'Agendamento pelo Pente Fino' no fim da página"**. A barbearia pode desligar.
- **Aba Clube do site:** os planos aparecem assim que estão cadastrados, sem esperar o recebimento online. Até o Asaas aprovar o cadastro, o botão vira "Assinar pelo WhatsApp" (ou "Assine na barbearia", sem WhatsApp); aprovado, assina pelo link. Sem planos, o Clube sai do menu e a página mostra "Perguntar pelo WhatsApp" no lugar do aviso interno de antes.

### Corrigido

- O botão "Assinar" do site aparecia com o cadastro no Asaas ainda em análise ou recusado, e a assinatura falhava. Agora só aparece com o cadastro aprovado.

### Adicionado (instalar o app no celular)

- **"Instalar o app"**: no Perfil e num convite no topo do app (só no celular, até instalar ou fechar). No Android, o botão instala direto; no iPhone, aparece o passo a passo do Safari (Compartilhar → Adicionar à Tela de Início). Onde o navegador não deixa instalar, o botão não aparece.

### Mudado (telas mais leves e fáceis de usar)

- Janelas só de leitura (Procurar, extrato do barbeiro, ficha do cliente, "Acesso pronto" e o aviso de caixa fechado) fecham tocando fora delas. As de formulário continuam só no X, para não perder o que foi digitado.
- Telefone, CPF/CNPJ e CEP pela metade mostram o aviso quando a pessoa sai do campo ("Número incompleto", "CEP incompleto"), nunca enquanto digita. O erro que aparece é lido pelo leitor de tela.
- O vídeo da página inicial só baixa quando a pessoa chega perto dele (Chrome e Edge).
- No celular, as tabelas das comparações viram um cartão por linha, com o nome de cada coluna; a tabela da página inicial mantém a primeira coluna presa ao rolar.

### Mudado (comparações mais curtas e visíveis na página inicial)

- A tabela de "Como escolher o sistema" ficou de bater o olho: um sistema por linha e, em cada célula, um sinal (sim, em parte, não) com no máximo duas palavras. O nome do sistema leva ao detalhe. Onde o site do sistema não informa aparece um traço, com uma legenda, no lugar de "Não citado" e "A página não mostra o preço"; vale também nas páginas de cada sistema.
- As páginas de comparação não fazem propaganda do concorrente: saíram "Onde o … é melhor" e "Para quem é cada um", e as fontes ficam citadas sem link.

- O menu do topo ganhou **Comparar**, no computador. Embaixo da tabela "Mais que uma agenda bonita", a página inicial mostra **"Compare com o sistema que você usa"**, com um botão para cada comparação (AppBarber, Trinks, Booksy, GENDA, Barbeiro.app e BestBarbers) e o link para ver todos lado a lado. Antes, só o rodapé levava a elas.

### Adicionado (anúncios em vídeo)

- Seis anúncios de 15 segundos para Reels, Status, TikTok e o feed: "Sobrou R$ 10.477", "O cliente marca sozinho" e "Seu WhatsApp marcando horário", cada um em 9:16 e quadrado, com o gancho, a função e o encerramento do vídeo do site e a mesma trilha.

### Adicionado (indique e ganhe na página inicial)

- A página inicial ganhou a seção **"Não tem barbearia? Ganhe indicando"**, para quem conhece barbeiros e quer divulgar. A pessoa escolhe quantas barbearias conhece e vê quanto ganharia por mês e em 12 meses (20% da mensalidade do Pro). O botão "Quero o meu link" leva ao cadastro de indicador. O FAQ ganhou a pergunta "Posso ganhar indicando sem ter barbearia?".

### Corrigido (simulador do bot ao marcar pela conversa)

- No painel do bot, aba Testar, escolher "1. Por aqui, na conversa" dava "Confira os campos destacados." e a conversa parava. Agora o simulador segue todos os passos do agendamento, inclusive "quer adicionar mais algum serviço?", "avisar se vagar antes" e o aniversário.

### Mudado (vídeo da página inicial com som)

- O vídeo da página inicial começa sozinho quando aparece na tela e pausa quando sai. Ele começa mudo, porque o navegador só deixa o autoplay sem som, e tem um botão **"Ativar som"** que volta ao começo com a trilha.

### Adicionado (aniversário pela conversa do WhatsApp)

- Depois de marcar pelo WhatsApp, quem ainda não tem o aniversário na ficha recebe a pergunta "Quer receber um parabéns no seu aniversário?". O cliente responde o dia e o mês (por exemplo, 15/03) ou 0 para pular, e a data vai para a ficha. Quando o bot oferece o "avisar se vagar antes", a pergunta vem logo depois dessa resposta.

### Adicionado (foto da unidade no fundo do link de agendamento)

- No visual do link de agendamento (Minha página), a foto de capa ganhou a opção **"No fundo da página inteira"**: a foto da unidade fica atrás de tudo, com uma camada escura por cima para o texto continuar legível. "No topo da página" continua como antes.

### Mudado (página de vendas atualizada)

- Destaques da página inicial com o que entrou nos últimos meses: sinal adiantado, preço por barbeiro, despesas fixas e preço livre; o lembrete no WhatsApp aparece sem selo, porque vem em todos os planos.
- Capturas de tela novas do Financeiro, dos Resultados do mês e de Serviços e produtos (outubro fechado da demonstração).

### Adicionado (comparativo com mais sistemas)

- Três sistemas novos no comparativo, com a página oficial e a data da consulta (14/11): **GENDA**, **Barbeiro.app** e **BestBarbers**. Cada um tem a própria página (`/comparativo/...`), com onde ele é melhor e onde o Pente Fino é melhor, e todos entram na tabela de "Como escolher o sistema".
- Quando o sistema não mostra o preço no site, a tabela diz "A página não mostra o preço".
- O rodapé leva para a tabela com todos os sistemas.

### Adicionado (indique e ganhe)

- Página **Indique e ganhe** (`/indique`): qualquer pessoa (barbeiro, cliente de barbearia, fornecedor, quem tem amigo barbeiro) gera um link com o CPF e a chave Pix e ganha **20% de cada mensalidade** que a barbearia indicada pagar, nos **12 primeiros meses** dela.
- A barbearia que entra pelo link ganha **30 dias de teste** e vê o aviso no cadastro.
- A comissão libera 30 dias depois do pagamento (se houver estorno antes, ela é cancelada); o Pix sai uma vez por mês, a partir de R$ 50 liberados.
- Painel de quem indica, aberto pelo link secreto mostrado no cadastro: barbearias indicadas, liberado, a liberar e já recebido.
- Quem já é cliente encontra o link em **Configurações → Indique e ganhe** e escolhe entre o Pix e **1 mês grátis** na assinatura por barbearia que pagar.
- Na administração (aba Vendas), a lista de quem indica, com o Pix liberado, a chave e os botões "Marcar Pix pago" e "Marcar mês aplicado".

### Adicionado (página de vendas nova, parte 1)

- Seção "Se você se identifica com algum desses problemas", logo depois da abertura: seis dores do dia a dia da barbearia, cada uma com o que o Pente Fino faz.
- Página **Recursos** (`/recursos`), com tudo o que o sistema faz, por assunto, e o selo do plano quando o recurso começa acima do Básico; link no cabeçalho e no rodapé.
- **Depoimentos em carrossel** na página inicial, cadastrados na administração (aba Vendas): o dono cola o link do Instagram, o sistema tenta puxar o nome e a foto do perfil (ou o dono envia a foto), escreve o que a pessoa disse e escolhe a data; dá para esconder e apagar.
- Rodapé com Cascavel/PR, o CNPJ e o Instagram @nossopentefino, e os links de Recursos e do comparativo.

### Melhorado (campos dos formulários)

- CPF e CNPJ com máscara e conferência do dígito na hora, sem esperar o envio: assinatura do Pente Fino, recebimento do clube online e assinatura do clube pelo cliente.
- WhatsApp e telefone com máscara "(11) 98888-7777" e aviso de DDD ou número errado em todos os formulários (clientes, equipe, convite, link de agendamento, configuração inicial, unidade, clube e administração); CEP com máscara.
- "Agendar pela conversa do WhatsApp" ligado sem as Automações mostra na hora que o bot vem com elas.

### Adicionado (plano Agenda no site)

- Em `/planos`, a faixa "Só precisa da agenda?" logo abaixo dos três planos, com o preço do Agenda e o botão de teste grátis; a tabela de recursos ganhou a coluna do Agenda.
- Página nova para quem procura "agenda para barbeiro" no Google (`/agenda-para-barbeiro`).
- No cadastro, com o Agenda ou o Básico escolhido, aparece a opção das Automações.
- Textos do site atualizados: os avisos no WhatsApp vêm em todos os planos, e o bot vem incluso no Pro e no Premium (no Agenda e no Básico, com as Automações).

### Adicionado (plano Agenda: convites na hora certa)

- O Início do Agenda mostra a agenda do mês no lugar do faturamento: atendidos, o que ainda vem, clientes novos, faltas, cancelados e marcados pelo próprio cliente (link ou WhatsApp).
- Comanda, Caixa, Resultados, Financeiro e Comissões aparecem no menu com um cadeado, na seção "No plano Básico". Tocando, o dono vê o que a tela faz e pode **experimentar o Básico por 7 dias**, uma vez por conta, sem mudar o plano.
- Convites que aparecem só quando ajudam, no Início:
  - muitas faltas no mês: as Automações (lembrete com confirmação e lista de espera);
  - depois de 30 dias: "Você atendeu N horários este mês. No Básico você vê quanto isso deu de faturamento e de lucro";
  - quem paga as Automações vê a conta do Básico.
- O aviso de limite aponta o plano que resolve: o 3º barbeiro leva ao Básico, e a 2ª unidade, ao Premium.

### Adicionado (WhatsApp comercial no site)

- Na administração, em Configurações, o campo "WhatsApp comercial do site": o número aparece no rodapé das páginas e no botão "Falar no WhatsApp" do fim da página de vendas, com a mensagem pronta. Os cliques contam no quadro "Visitantes da página de vendas". Vazio tira o WhatsApp do site.

### Adicionado (plano Agenda)

- Plano novo, o **Agenda**: R$ 10 por mês (R$ 99 no ano), com 1 unidade e até 2 barbeiros. Traz a agenda, o link de agendamento, o site da barbearia, o cadastro de clientes e os avisos no WhatsApp da barbearia (confirmação, lembrete e remarcar).
- No Agenda, a comanda, o caixa, as despesas, os resultados e as comissões ficam de fora do menu (vêm do Básico em diante). O que for lançado depois de subir de plano aparece normalmente.
- **Automações**, por mais R$ 10 por mês, no Agenda e no Básico: o bot que responde e marca pela conversa, a lista de espera, a pesquisa depois do atendimento, o convite de retorno e a mensagem de aniversário. Do Pro em diante elas já vêm no plano.
- Na Assinatura, o dono escolhe o plano e liga ou desliga as Automações. No Agenda, o cupom de desconto só vale com as Automações juntas.
- A administração cadastra o preço do Agenda e o das Automações nas tabelas de preço.

### Mudado (WhatsApp e Automações nos planos)

- Todo plano conecta o WhatsApp da barbearia para os avisos do agendamento (antes, só do Pro em diante). Sem as Automações, o WhatsApp só manda os avisos: as mensagens dos clientes ficam em Conversas e o bot não responde sozinho.
- O convite de retorno, a mensagem de aniversário e o aviso do clube passam a vir no Pro (antes, só no Premium).
- Descer de plano com o WhatsApp conectado não pede mais para desconectar.

### Adicionado (visitantes da página de vendas)

- Na administração, a aba Vendas ganhou o quadro "Visitantes da página de vendas", de hoje ou dos últimos 7 dias:
  - o funil: entrou, rolou até a metade, viu os planos e foi ao cadastro;
  - até onde rolaram a página (25%, 50%, 75% e 100%);
  - em que clicaram (planos, cadastro, WhatsApp, vídeo e chat);
  - de onde vieram (campanha ou site de origem);
  - as visitas por dia e quantas são de quem veio pela primeira vez.
- A medição é nossa e sem dado pessoal: um número anônimo por visita, que some ao fechar a aba. "Primeira vez" só conta para quem aceitou os cookies, e quem liga o "não rastrear" do navegador fica de fora.
- Os eventos com mais de 90 dias saem na limpeza diária ("Visitas à página de vendas" na Saúde do sistema).

### Adicionado (busca global)

- Novo botão "Procurar" no menu (e na barra de cima, no celular), que também abre com Ctrl+K (⌘K no Mac). Numa caixa só, acha:
  - uma tela pelo nome ou por uma palavra do dia a dia ("despesa" leva ao Financeiro, "site" à Minha página);
  - um cliente pelo nome ou pelo telefone;
  - uma comanda de hoje pelo nome do cliente.
- As setas escolhem, Enter abre e Esc fecha. Só aparecem as telas que o papel da pessoa abre.
- Correção: abrir um cliente pela busca com a tela de Clientes já aberta agora abre a ficha dele.

### Adicionado (modo recepção)

- A tela de Comandas ganhou o botão "Modo recepção", para o monitor do balcão. Em letra grande, mostra a fila do dia:
  - o próximo cliente em destaque, com horário, barbeiro e serviços, e o botão "Chegou: começar atendimento";
  - a coluna "Chegando", com quem vem depois e quem está atrasado;
  - a coluna "Na cadeira", com quem está sendo atendido;
  - a coluna "Para receber", com o valor e o botão "Receber".
- A tela se atualiza sozinha a cada 30 segundos, mostra a hora e tem o botão "Tela cheia" para esconder o menu.

### Adicionado (histórico por comanda)

- A tela da comanda ganhou a seção "Histórico", que abre com um toque e mostra em ordem tudo o que aconteceu com ela:
  - quando foi aberta, quando o atendimento começou e quando o barbeiro confirmou;
  - cada item lançado e cada pagamento, inclusive o sinal e a devolução;
  - fechar, reabrir (com o motivo), cancelar, falta e preço fora da tabela, com quem fez.

### Adicionado (resumo do fechamento do caixa para o dono)

- Quando a recepção fecha o caixa, o dono e o gestor recebem o resumo na central de avisos e no celular: quanto entrou, em quantas comandas e quanto em cada forma de pagamento (Pix, dinheiro, cartão), e quem fechou.
- Com diferença na gaveta, sai o aviso de diferença, agora com os mesmos totais: um aviso só por fechamento.
- O resumo do dia e o aviso de caixa sem fechar passam a sair no fechamento da unidade quando ela tem horário de funcionamento cadastrado (antes, só pelo expediente da equipe).
- O novo aviso pode ser ligado ou desligado no celular, no Perfil, como os outros.

### Adicionado (saúde da conta no Início)

- O quadro "Precisa de você agora", no Início, passou a avisar também:
  - o caixa de um dia anterior que ficou aberto, com o caminho para fechar;
  - as comandas de dias anteriores que não foram fechadas nem canceladas;
  - a unidade com o link de agendamento desligado, onde o cliente não consegue marcar sozinho.
- O que já aparecia continua: WhatsApp desconectado, clientes esperando atendente, comandas para confirmar e fechar e o caixa de hoje.

### Adicionado (temas do site: Clube, Letreiro e Estúdio)

- Na aba Tema de "Minha página", o dono escolhe o estilo do site entre quatro:
  - Tradicional: verde-garrafa e papel;
  - Clube: escuro, couro e marfim, elegante;
  - Letreiro: claro, azul-marinho, com a faixa listrada de barbearia no topo e fonte de letreiro;
  - Estúdio: concreto e preto, títulos condensados, moderno.
- Os quatro usam os mesmos blocos, textos e fotos: trocar de estilo não apaga nada. A cor de destaque, a fonte e o formato dos botões continuam ajustáveis.

### Adicionado (páginas extras no site: Galeria e Clube)

- Em "Minha página", o quadro "Páginas extras" liga duas páginas novas no site, que entram no menu:
  - Galeria: as fotos dos trabalhos, com legenda;
  - Clube: os planos de assinatura cadastrados no sistema, com o valor, o que cada um inclui e o botão "Assinar", que leva ao link de assinatura do clube online.
- As duas começam desligadas e funcionam também no domínio próprio (`/galeria` e `/clube`).

### Adicionado (quem faz cada serviço)

- Em Equipe, o botão "Serviços que faz": o dono marca os serviços de cada barbeiro. Com tudo marcado, ele faz todos, inclusive os serviços criados depois.
- Na página de agendamento, ao escolher o serviço, só aparecem os barbeiros que fazem esse serviço, com a foto de cada um (a mesma do site). Os horários livres seguem a mesma regra, e o bot do WhatsApp também.
- No site, cada barbeiro mostra os serviços que faz, e a lista de serviços diz com quem é, quando não são todos que fazem.
- Sem nada marcado, tudo continua como antes: todos fazem tudo.

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

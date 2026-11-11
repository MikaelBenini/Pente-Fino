# Pente Fino — melhorias do painel, da administração e do site

> **Documento único** que junta os três briefings de 10/11/2026 (painel da barbearia, administração
> `/admin` e site público). Origem: auditorias feitas em 10/11/2026 no navegador, desktop e
> celular 375 px, com um agendamento de teste real no painel. A situação abaixo foi conferida em
> 11/11/2026 contra os PRs mesclados (#148 e #150) e a [linha de desenvolvimento](linha-de-desenvolvimento.md)
> (etapas 23.2, 23.3 e 23.4).

## Regras para executar

- **Ordem:** seguir a tabela "Ordem única de execução" abaixo. Itens de dinheiro e dados vêm
  primeiro. Cada bug crítico precisa de teste automatizado que reproduza o erro antes da correção.
- **[DECISÃO DO DONO]:** implementar a opção padrão indicada, atrás de uma constante ou
  configuração fácil de trocar, e listar em "Decisões pendentes".
- **Datas** sempre no fuso da unidade (America/Sao_Paulo por padrão), nunca no UTC do servidor.
  Onde houver entrada de data e hora, escrever o fuso ("horário de Brasília").
- **Não inventar dados:** nada de depoimentos, números de clientes, notas ou logos fictícios.
  Onde o conteúdo depende do dono, criar a estrutura e deixar `TODO` claro.
- **Admin:** o `/admin` nunca mostra dados de clientes, comandas ou conversas das barbearias; toda
  ação sensível exige motivo e vai para a auditoria.
- **Entrega:** commits pequenos citando o ID (ex.: `fix(A5): bot prioriza a frase mais específica`),
  PR por grupo com a checklist da parte preenchida, `CHANGELOG.md` e linha de desenvolvimento
  atualizados, build, lint e testes passando.

## Ordem única de execução

| Ordem | Parte | IDs | Motivo | Situação |
| --- | --- | --- | --- | --- |
| 1 | Painel | A1–A4 | Caixa não batia; dinheiro no dia errado; comanda presa | ✅ #150 (A1 competência aguarda decisão) |
| 2 | Site | B1–B8, P1, P2, C1–C7, D3, D5, D6 | Textos contraditórios e oferta invisível | ✅ #148 (C2/C3/C4 aguardam dados do dono) |
| 3 | Painel | A5–A8 | Bot respondendo errado, status falso, cliente sem saída, layout quebrado | ✅ branch `fix/painel-a5-a8` |
| 4 | Admin | R1, R2 | Risco comercial e fiscal imediato (anúncios rodando, NF ligada) | ✅ R2 #152; R1 `fix/admin-r1-cupom-sem-limite` |
| 5 | Admin | R3–R6 | Status e cobrança deixam conta usando de graça e números errados | ⏳ |
| 6 | Admin | R7–R10 | Falhas invisíveis e auditoria com IP errado | ⏳ |
| 7 | Painel | M1–M10 | Informação confusa e atrito de uso | ⏳ |
| 8 | Site | S1–S6, T1–T3 | Base técnica de SEO e medição dos anúncios | ⏳ (T4 já existia) |
| 9 | Painel | X1–X4, P1–P6 | Acessibilidade e página pública de agendamento | ⏳ |
| 10 | Admin | U1–U9 | Usabilidade por aba | ⏳ |
| 11 | Site | N1–N5, P3, P4, D1, D2, D4 | Conteúdo novo e ajustes finos | ⏳ |
| 12 | Admin | F1–F9 | Recursos novos (F2 junto com o T2 do site) | ⏳ |
| 13 | Painel | Seção "Melhorias de produto" | Backlog depois dos bugs | ⏳ |

Já existia antes dos briefings (conferido no `CHANGELOG.md`), só falta completar:

- **Site S5:** `www` e `app.` já redirecionam para o domínio principal (07/11). Falta conferir
  `http` → `https` com 301.
- **Site T1:** o evento `cadastro_concluido` já dispara no sucesso do cadastro. Falta mandar o
  valor do plano para lances por valor.
- **Site T4:** aviso de cookies com Consent Mode já existe.
- **Admin R1:** feito em 11/11: LANCAMENTO sem limite de vagas. O aviso aos admins sobre cupom perto
  de esgotar fica com o F3.
- **Admin R2:** feito em 11/11 (#152): a nota só liga com os dados fiscais conferidos. Antes, faltava a trava
  contra dados de exemplo.
- **Admin R8:** a barbearia já recebe aviso e e-mail quando o WhatsApp cai. Falta o filtro em
  "Precisa de atenção" do admin.

**Publicação:** o `CHANGELOG.md` tem tudo desde 08/11 em "Não publicado". Conferir se a produção
está no `main` antes de validar itens no site real.

Itens que se sobrepõem e devem ser feitos juntos:

- **Site T2 + Admin F2:** gclid e UTMs guardados no site e gravados no cadastro, mostrados no admin.
- **Painel P3 + linha de desenvolvimento "Página da barbearia" (`/b/<slug>`):** a URL amigável é a
  mesma página.
- **Painel P4 + Site S1/S6:** indexação das páginas de barbearia, sitemap e robots.
- **Painel A6 + Admin R8:** a mesma conexão do WhatsApp, vista pela barbearia e pela plataforma.

## Decisões pendentes do dono

| ID | Decisão | Padrão adotado até decidir |
| --- | --- | --- |
| Painel A1 | Faturamento, lucro e "última visita" pela data do atendimento (competência) | Data do fechamento em todas as telas (concordam entre si) |
| Painel A2 | "Receber adiantado (sinal)" sem fechar a comanda | Não existe |
| Painel M6 | Depois de agendar, ficar na Agenda com aviso | Ficar na Agenda, configurável |
| Painel P4 | Indexar páginas de barbearia que ligarem "Aparecer no Google" | Só com a opção ligada; as demais `noindex` |
| Admin R1 | Cupom LANCAMENTO sem limite de vagas | ✅ decidido em 11/11: sem limite |
| Admin R3 | Conta "Teste" reativada indevidamente | Cortesia interna ou voltar ao teste |
| Admin R6 | Máximo de dias de teste | 60 |
| Site P2 | Lucro por serviço no Pro | Só no Premium (`LUCRO_POR_SERVICO_NO_PRO = false`) |
| Site P3 | Básico mais competitivo (preço menor ou bot no Básico) | Sem mudança |
| Site B6 | Selo do anual | "economize até R$ 504/ano" (feito) |

## O que depende do dono (dados e produção)

- **Limpeza em produção (painel A3):** cancelar a comanda reaberta de teste
  `01a1c85f-c873-7d06-b61f-c67e8f37ff3f` e fechar o caixa de 11/11 aberto indevidamente.
- **Nota fiscal (admin R2):** no Asaas (Notas fiscais → Configurações), cadastrar a inscrição
  municipal, o regime e o certificado digital (e-CNPJ A1, que a prefeitura exige). Confirmar o
  código do serviço e o ISS com o contador. No Asaas, em Integrações → Webhooks, marcar os
  eventos de nota fiscal no mesmo webhook das cobranças. Depois: `/admin` → Configurações →
  "Conferir de novo no Asaas" → ligar.
- **Contato e rodapé (site C2/C3):** WhatsApp, razão social, CNPJ, cidade e redes em `lib/contato.ts`.
- **Depoimentos (site C4):** pelo menos dois reais e autorizados.
- **Suporte (painel M10):** WhatsApp de suporte e horário de atendimento.
- **Sobre (site N5):** quem faz o Pente Fino, por que existe, cidade.
- **Conferência em produção (site B4):** passar a página no Rich Results Test.

## Parte 1 · Painel da barbearia (área logada e `/agendar`)

### Grupo A — bugs críticos

#### A1 — Cada tela usa uma data diferente para o mesmo dinheiro

**Reprodução (feita):**
1. Em 10/11, criar agendamento para **11/11 10:00** (Corte R$ 45, Unidade principal, vitor martins).
2. Abrir a comanda e "Receber e fechar" com Pix R$ 45 em **10/11**.
3. Resultado observado:
   - `/inicio`: "Entrou hoje R$ 45,00", mas "Atendidos 0 de 0".
   - `/clientes`: "Visitas 1, Última visita 10/11/2026".
   - `/caixa` (10/11): "CAIXA NÃO ABERTO · 0 comandas fechadas · R$ 0,00".
   - `/caixa` (11/11): "CAIXA ABERTO · 1 comanda fechada · Pix R$ 45,00". O caixa de 11/11 foi aberto **sem ninguém abrir**.

**Regra correta (definir num único módulo, ex.: `lib/regras-de-data.ts`, e usar em todas as telas e APIs):**
- **Dinheiro** (caixa do dia, "entrou hoje", formas de pagamento): data e hora do **recebimento** (pagamento), na unidade da comanda.
- **Atendimento** (atendidos, visitas, última visita, ocupação, comissão por dia): data do **atendimento realizado**. Se o atendimento ainda não aconteceu, não conta.
- **Faturamento e lucro do mês** ([DECISÃO DO DONO], padrão = data do atendimento, regime de competência; o caixa usa a data do pagamento). Documentar na Ajuda e no rodapé do Financeiro.
- Caixa **nunca** abre automaticamente. Recebimento em dia de caixa fechado ou não aberto → ver A2.

**Validar:** teste de integração cobrindo pagamento no mesmo dia, pagamento adiantado e pagamento atrasado (comanda de ontem paga hoje). As telas Início, Caixa, Clientes, Resultados e Financeiro devem concordar entre si.

#### A2 — Permite receber e fechar atendimento futuro, com caixa fechado

**Observado:** em 10/11, a comanda de 11/11 foi recebida e fechada sem nenhum aviso. O caixa de 10/11 não estava aberto.

**O que fazer:**
1. Se o início do atendimento é **depois de agora**: o botão "Receber e fechar" fica desativado, com a dica "O atendimento é em 11/11 às 10:00." Opcional [DECISÃO DO DONO]: permitir "Receber adiantado (sinal)", que registra o pagamento sem fechar a comanda.
2. Se o caixa do dia do recebimento **não está aberto**: abrir modal "O caixa de hoje não foi aberto. Abrir agora com troco R$ __?" antes de concluir. Se estiver **fechado**: bloquear e orientar a reabrir (exige gestor, como já é hoje).
3. Validar no servidor (`POST` de fechamento/pagamento), não só no front.

#### A3 — Comanda reaberta fica presa (sem cancelar nem mover)

**Observado:** depois de "Reabrir comanda" (status REABERTA), as ações **"Cancelar ou marcar falta"** e **"Mover horário"** somem; só resta "Receber e fechar". Clicar no horário na agenda abre a mesma tela. Não há como desfazer um fechamento por engano.

**O que fazer:** status REABERTA deve ter as mesmas ações de uma comanda aberta (cancelar, marcar falta, mover horário, começar e confirmar atendimento). Cancelar uma reaberta exige motivo e registra no histórico.

**Limpeza:** existe uma comanda REABERTA vazia de teste (Vitor martins com vitor martins, 11/11 10:00, Unidade principal, id `01a1c85f-c873-7d06-b61f-c67e8f37ff3f`) e um caixa de 11/11 aberto indevidamente. Após corrigir A1 e A3, cancelar essa comanda e reverter o caixa.

#### A4 — Permite fechar comanda vazia (R$ 0,00)

**Observado:** removendo todos os itens, "Receber e fechar" abre com total R$ 0,00 e o botão Continuar fica ativo.

**O que fazer:** comanda sem itens não pode ser fechada (front desativa o botão; servidor retorna 422). Mostrar "Sem itens. Lance um serviço ou cancele/marque falta." Exceção: assinante do clube com serviço coberto (itens existem com valor 0), que deve continuar funcionando.

#### A5 — Bot de fábrica responde "horário de funcionamento" com agendamento

**Reprodução (no simulador `/bot` → Testar, nada é enviado):** "qual o horário de funcionamento?" → o bot inicia o fluxo de agendamento.

**Causa:** palavras-chave padrão: Grupo 3 (Agendar) = `agendar, marcar, horário, agenda`; Grupo 4 (Endereço e horário) = `endereço, onde fica, localização, como chegar`. "horário" casa com o Grupo 3.

**O que fazer:**
1. **Algoritmo:** dar prioridade à regra mais específica. Pontuar cada grupo pelo número de palavras ou frases que casam e pelo comprimento da frase casada; frase de várias palavras vence palavra solta. Em empate, usar a ordem dos grupos.
2. **Padrão de fábrica (contas novas e migração opcional):** Grupo 4 ganha `horário de funcionamento, que horas abre, que horas fecha, abre hoje, abre domingo, funciona`; Grupo 3 troca `horário` por `marcar horário, agendar horário, tem horário`.
3. **Aviso no editor:** se a mesma palavra estiver em dois grupos, ou uma palavra de um grupo estiver contida numa frase de outro, mostrar alerta "Conflito: 'horário' aparece em Agendar e em Endereço e horário".
4. **Testes:** tabela de frases → ação esperada (incluir "qual o horário de funcionamento?", "quero mudar meu horário", "tem horário amanhã?", "quanto custa a barba?", "onde fica?").

#### A6 — Conversa mostra "BOT RESPONDENDO" com WhatsApp desconectado

**Observado:** `/conversas` mostra a conversa recente com selo "BOT RESPONDENDO", enquanto o aviso diz que o WhatsApp não está conectado.

**O que fazer:** o selo da conversa deriva do estado real da conexão da unidade: "Bot parado: WhatsApp desconectado" (vermelho), com link "Conectar".

#### A7 — Link público ligado numa unidade sem serviços com preço

**Observado:** unidade "kkkkkkkkk" com "LINK LIGADO"; a página `/agendar?u=kkkkkkkkk` mostra "Nenhum serviço disponível pelo link agora." e ainda exibe barbeiros, datas e formulário (o botão Agendar fica desativado). O cliente não tem saída.

**O que fazer:**
1. Ao ligar o link (`/configuracoes` → Link de agendamento), validar: há ao menos 1 serviço com preço na unidade e ao menos 1 profissional com horário. Se não houver, impedir e listar o que falta, com links para cadastrar.
2. Na página pública sem serviços: esconder os passos 2 a 4 e mostrar "Agendamento online indisponível. Fale com a barbearia:" + WhatsApp, telefone e endereço da unidade.
3. No editor do bot: se uma opção depende do link ("sem serviço com preço ou profissional, manda o link do site") e o link da unidade está desligado, mostrar alerta.

#### A8 — `/servicos` quebra o layout no celular

**Observado:** com viewport 375×812, `document.documentElement.scrollWidth` = 716 e a barra de navegação inferior (fixa) fica com 716 px e fora da área visível. A tabela está dentro de `div.overflow-x-auto`, que funciona; o vazamento vem de outro elemento. Suspeitas: a faixa de abas "Catálogo / Tabela de preços" ou um contêiner flex sem `min-w-0`.

**O que fazer:** achar o elemento com `scrollWidth > clientWidth` fora da tabela e corrigir (`min-w-0`, `overflow-x-auto` na faixa de abas, `max-w-full`). Adicionar teste visual ou E2E em 375 px para todas as rotas do painel, garantindo `scrollWidth === innerWidth`.

### Grupo M — problemas médios

- **M1 — Card de meta da Início.** Diz "Defina a meta do mês em Resultados do mês", mas existe a meta "Corte · Unidade principal · 0 de 12" e o tutorial marca "Definir a meta do mês (feito)". O card deve mostrar a meta principal existente (de faturamento ou de quantidade) ou um resumo "1 meta · 0% · abaixo do ritmo".
- **M2 — Resultados sem dados.** Gráfico e tabela de 12 meses começam em dez/2025 mesmo com a conta criada em nov/2026. Começar no mês de criação da conta. Trocar "0% (estável)" por "sem dados ainda" quando os dois períodos são zero. Nota: "Só dias de trabalho" listou domingos com os barbeiros trabalhando aos domingos, o que está correto; conferir apenas que a opção filtra as folgas.
- **M3 — Serviços sem preço nem margem.** O subtítulo é "Quanto custa cada serviço e quanto sobra dele?", mas o Catálogo mostra só o custo do produto. Adicionar as colunas **Preço** (por unidade, ou faixa quando difere), **Comissão média** e **Sobra por atendimento** (preço − comissão − custo), e ordenação. Respeitar o plano: se a margem for exclusiva do Premium, mostrar a coluna bloqueada com "Premium".
- **M4 — Coluna "Atendimentos" em Serviços.** Valores (Corte = 1, Corte + Barba = 2…) não mudaram após uma comanda fechada e divergem de Clientes e Resultados (0). Usar a mesma regra de A1 e explicar no cabeçalho ("comandas fechadas nos últimos 30 dias", por exemplo).
- **M5 — Rótulo de despesas no Financeiro.** Com Fixas, Variáveis e Manutenção em R$ 0,00 e comissão de R$ 18 sobre R$ 45, aparece "Despesas operacionais: 40% do faturamento". Separar: "Comissões: 40% · Despesas: 0%" ou renomear para "Custos (comissão + despesas)".
- **M6 — Pós-agendamento.** Depois de "Agendar", o app navega para `/comandas?id=…`. Manter na Agenda com toast "Agendado para 11/11 10:00 · Abrir comanda". [DECISÃO DO DONO] tornar configurável.
- **M7 — Remover item da comanda.** Hoje é imediato. Adicionar "Desfazer" (toast de 5 s) ou confirmação.
- **M8 — Imprimir comandas.** "Imprimir 4 por folha / 6 por folha" ficam ativos com 0 comandas. Desativar com dica.
- **M9 — Bloco da agenda.** Em 30 minutos, o nome do cliente é cortado. Em blocos curtos, mostrar "10:00 Vitor m. · Corte" numa linha só, com texto completo no `title` e tooltip.
- **M10 — Assinatura e suporte.**
  - `/configuracoes` → Assinatura: trocar "Próxima cobrança: Nada em aberto" por data e valor da próxima cobrança, forma de pagamento e dias restantes de teste.
  - `/ajuda`: além do e-mail ("respondemos em dias úteis"), adicionar WhatsApp de suporte e horário que cubra o sábado. Botão "Falar com o suporte" no rodapé do menu. **TODO: contato com o dono.**

### Grupo X — acessibilidade

- **X1 — Checkboxes sem nome no Novo agendamento.** As 8 caixas de serviço têm nome acessível "on". Associar `<label htmlFor>` ou envolver o input no `<label>`. Verificar o mesmo padrão em outros formulários (comanda, clube, bot).
- **X2 — Alvos de toque.** "Como fazer", "Fazer agora" e "Ver como reconectar" têm 20 px de altura no celular. Mínimo de 44×44 px de área clicável (padding).
- **X3 — Contraste.** Horários da grade da agenda e textos secundários em cinza sobre `#0b0b0b`: verificar AA (4,5:1) e ajustar o token de cor.
- **X4 — Auditoria automática.** Rodar axe/Lighthouse em todas as rotas do painel (desktop e 375 px) e corrigir o que for "serious" ou "critical".

### Grupo P — página pública de agendamento (`/agendar`)

- **P1 — Prévia de compartilhamento.** Hoje `og:title` = "Agendar horário · Pente Fino" e a descrição é a frase de venda do Pente Fino. Usar `generateMetadata` por unidade: título "Agende na {Barbearia} · {bairro/cidade}", descrição com serviços e preço inicial, e imagem OG com nome e logo da barbearia.
- **P2 — Informações da barbearia.** Mostrar endereço com link de mapa, WhatsApp/telefone, horário de funcionamento e, se houver, fotos e nota média da pesquisa.
- **P3 — URL amigável.** Criar `/b/{slug}` (ou `/{slug}`) com redirect 301 de `/agendar?u={slug}`, mantendo os links antigos.
- **P4 — Indexação.** Hoje `robots.txt` tem `Disallow: /agendar`. [DECISÃO DO DONO] padrão: permitir indexação das páginas de barbearias que ligarem a opção "Aparecer no Google", com `LocalBusiness`/`HairSalon` em JSON-LD; as demais ficam `noindex`.
- **P5 — Lista de barbeiros.** "Sem preferência" aparece sozinho enquanto não há serviço; após escolher o serviço, listar só quem faz aquele serviço, com foto.
- **P6 — Confirmação.** Após agendar, tela de confirmação com "Adicionar ao calendário" (.ics), link para remarcar/cancelar e aviso de que a confirmação chega no WhatsApp (quando conectado).

### Melhorias de produto (backlog, após os bugs)

- Painel de "saúde da conta" na Início: WhatsApp conectado? link ligado com serviços? caixa de ontem fechado? comandas paradas há mais de 24 h?
- Fechamento de caixa com resumo enviado ao dono (e-mail/WhatsApp).
- Histórico/auditoria visível por comanda (quem criou, alterou, reabriu e o motivo; o motivo já é gravado).
- Busca global (Ctrl+K) por cliente, comanda e serviço.
- Modo recepção (tela grande): fila do dia com "próximo" e botões grandes.

### Checklist de validação

- [x] A1 Início, Caixa, Clientes, Resultados e Financeiro concordam nos 3 cenários (mesmo dia, adiantado, atrasado); caixa não abre sozinho — #150 (dinheiro pelo recebimento; competência aguarda decisão)
- [x] A2 não fecha comanda futura; pede para abrir o caixa; validação também no servidor — #150
- [x] A3 reaberta permite cancelar, marcar falta e mover; comanda de teste limpa — #150 (limpeza em produção com o dono)
- [x] A4 comanda vazia não fecha (front + 422 no servidor); clube com item R$ 0 ainda fecha — #150
- [x] A5 frases de teste do bot com as respostas esperadas; alerta de conflito de palavras no editor — `fix/painel-a5-a8`
- [x] A6 selo da conversa reflete a conexão — `fix/painel-a5-a8`
- [x] A7 não liga o link sem serviço com preço; página pública sem serviço mostra contato — `fix/painel-a5-a8`
- [x] A8 `scrollWidth === innerWidth` em 375 px em todas as rotas — `fix/painel-a5-a8`
- [ ] M1–M10 conferidos
- [ ] X1–X4: axe sem "serious/critical"
- [ ] P1 prévia no WhatsApp mostra a barbearia; P3 redirect 301 funcionando
- [ ] Build, lint e testes passando

## Parte 2 · Administração da plataforma (`/admin`)

### Riscos e bugs (R)

#### R1 — Cupom LANCAMENTO limitado a 20 vagas, enquanto site e anúncios prometem sem limite
- **Visto:** Configurações → Cupons: `LANCAMENTO · 30% · 0 de 20 · vale até 31/01/2027 · ATIVO`. O site (/planos, faixa da home) e os anúncios do Google prometem "30% para sempre, até 31/01/2027", sem citar vagas.
- **[DECISÃO DO DONO]** padrão: remover o limite de vagas (deixar vazio). Alternativa: manter 20 vagas e expor um endpoint público `GET /api/cupons/LANCAMENTO/status` → `{ativo, vagasRestantes, valeAte}` para o site mostrar "restam X vagas" e esconder a oferta quando esgotar.
- Quando um cupom esgota, o cadastro deve dizer "Este cupom esgotou" (hoje: verificar a mensagem), em vez de seguir sem desconto em silêncio.
- Notificar os admins por e-mail quando restar 20% das vagas e quando esgotar.

#### R2 — Nota fiscal ligada com inscrição municipal de exemplo
- **Visto:** Configurações → Nota fiscal: "Dados fiscais no Asaas: inscrição municipal **123456** · Simples Nacional"; "Emitir nota fiscal das mensalidades" **ligado**; código 1.05; ISS 2%.
- **O que fazer:**
  1. Validar os dados fiscais antes de permitir ligar a emissão: recusar valores de exemplo (sequências como 123456, 000000, todos iguais) e mostrar alerta vermelho "Confira a inscrição municipal com o contador".
  2. Botão "Emitir nota de teste" (ambiente sandbox do Asaas, se disponível) antes de ligar.
  3. Registrar na Saúde do sistema o resultado da última emissão (ok/erro e mensagem).
- **TODO do dono:** confirmar inscrição municipal, código de serviço e ISS com o contador.

#### R3 — "Desbloquear" uma conta cancelada a deixa ativa, sem teste e sem cobrança
- **Visto (auditoria):** `Cancelou a conta · Teste · status: teste → cancelada` e depois `Desbloqueou a conta · Teste · status: cancelada → ativa · testeAte: 2026-11-22 → — · canceladaEm: … → —`. Resultado: conta Premium mensal, cobrança manual, **Ativa**, sem nenhuma cobrança, sem data de fim.
- **Regra correta:**
  - **Bloquear/Desbloquear** = suspensão temporária. Desbloquear volta **exatamente** ao status anterior (teste com a mesma data de fim, ou ativa com as mesmas cobranças).
  - **Cancelar** tem o par **Reativar**, que pede o próximo passo: "Voltar ao teste até [data]" | "Ativar com cobrança a partir de [data]" | "Cortesia até [data]". Nunca "ativa" sem uma das três.
  - Teste unitário para todas as transições de estado (máquina de estados explícita: `teste → ativa | cancelada | suspensa`, `suspensa → anterior`, `cancelada → teste | ativa | cortesia`).
- Corrigir a conta "Teste" atual ([DECISÃO DO DONO]: cortesia interna ou voltar ao teste).

#### R4 — Cobrança manual não gera a cobrança prevista
- **Visto:** conta Teste ativa em cobrança manual desde 08/11; aba Cobrança: "Nenhuma cobrança em aberto"; "Vence em 7 dias R$ 0,00".
- **O que fazer:** para cobrança manual, criar a cobrança prevista de cada ciclo (valor da tabela vigente na assinatura, com cupom aplicado e unidades extras; vencimento na data do ciclo). "Registrar pagamento" baixa essa cobrança. Assim ela entra em "Vence em 7 dias", "Vencido" e "Precisa de atenção", e o e-mail "Aviso de vencimento" dispara.

#### R5 — Indicadores contraditórios (Em dia × pagantes × MRR)
- **Visto:** Início: MRR R$ 0,00, "0 contas pagantes", mas "Contas por situação: Em dia 1".
- **O que fazer:**
  - "Em dia" só para conta com cobrança paga cobrindo hoje. Nova situação **"Ativa sem cobrança"** (sem cobrança paga nem cortesia) aparecendo em Precisa de atenção.
  - **Cortesia** como situação própria, com data de fim, fora do MRR e contada à parte.
  - Flag **"conta interna"** (testes da equipe, demonstração) excluída de MRR, conversão, gráficos e exportações. Marcar "Teste" e "Implantação".
  - MRR = soma das mensalidades vigentes das contas pagantes (anual ÷ 12), com unidades extras e descontos.

#### R6 — Teste sem limite (conta com teste até 2028)
- **Visto:** conta "Implantação" em teste **até 29/04/2028**; na Nova venda, "Dias de teste" é texto livre.
- **O que fazer:** campo numérico com mínimo 0 e máximo configurável (padrão 60). Acima disso, oferecer "Cortesia até [data]" com motivo. "Estender teste" com o mesmo limite. Em Precisa de atenção, mostrar testes com mais de 60 dias.

#### R7 — Falhas da fila de e-mails invisíveis
- **Visto:** Saúde → Filas → E-mails: "Falhas guardadas: 4"; "Erros das últimas 24 h: Nenhum erro"; Início "Para resolver: 0 · Nada urgente". Não há botão para ver nem reenviar.
- **O que fazer:** clicar no número de falhas abre a lista (quando, destinatário mascarado, modelo, mensagem de erro do SMTP, tentativas) com ações **Reenviar** e **Descartar** (com motivo, na auditoria). Falha nova entra em "Erros das últimas 24 h" e em Precisa de atenção. Conferir se as 4 falhas são de e-mail de confirmação de cadastro, que é crítico para conversão.

#### R8 — WhatsApp caído fora do "Precisa de atenção"
- **Visto:** Saúde: "WhatsApp que caiu · Teste · Unidade principal · desde 09/11/2026 22:18"; Início: "Tudo em dia por aqui".
- **O que fazer:** novo filtro "WhatsApp caído" em Precisa de atenção (mais de 2 h), com o tempo caído e um atalho para o WhatsApp do dono. Conferir se o modelo de e-mail "WhatsApp desconectado" foi enviado à barbearia.

#### R9 — Auditoria grava IP interno
- **Visto:** `09/11/2026 21:11 · Vitor · 172.18.0.1 · Configurou o autenticador`. Os registros do Mikael têm IP público.
- **O que fazer:** configurar a leitura do IP real atrás do proxy (`X-Forwarded-For`/`X-Real-IP` só de proxies confiáveis) num helper único usado por toda a auditoria e pelo login. Teste: requisição com cabeçalho de proxy grava o IP do cliente.

#### R10 — Trocar o hash não troca a aba
- **Visto:** com o admin aberto em `#saude`, navegar para `/admin#contas` mudou a URL mas manteve o conteúdo de Saúde (em carga nova, o hash funciona).
- **O que fazer:** ouvir `hashchange`, ou migrar para rotas reais (`/admin/contas`, `/admin/contas/[id]`), o que permite também linkar uma conta específica.

### Usabilidade por aba (U)

- **U1 — Início:** estados vazios com orientação (ex.: "Nenhuma conta paga ainda. Contas em teste: 1"); cada cartão clicável para a lista filtrada; período selecionável (mês atual, 30 dias, mês anterior).
- **U2 — Contas (tabela):** a coluna "Último acesso" exige rolagem lateral no notebook. Fixar a primeira coluna, reduzir colunas (agrupar Unidades/Profissionais) e adicionar a coluna **Ativação** (passos do tutorial, ex.: "5/8") e **Origem** (F2). Filtro "Conta interna".
- **U3 — Detalhe da conta:** mostrar próxima cobrança (data, valor, cupom), dias restantes de teste, origem do cadastro, progresso do tutorial, WhatsApp do dono com link `wa.me`, e campo **Notas internas** (texto livre, com autor e data). Substituir "Desbloquear" de conta cancelada por "Reativar" (R3).
- **U4 — Nova venda:** WhatsApp com `type="tel"` e máscara; `required` nos obrigatórios; CPF/CNPJ do dono (necessário para NF); "Dias de teste" numérico (R6); resumo antes de criar: plano, ciclo, cupom, valor da 1ª cobrança e data.
- **U5 — Vendas:** além de "por vendedor", mostrar cadastros pelo site por origem (F2), conversão teste → pago e receita por origem.
- **U6 — Equipe:** papéis **Suporte** (lê Contas e Saúde, sem cobrança nem configurações) e **Financeiro** (cobrança e NF, sem equipe); última troca de senha; desativar exige motivo.
- **U7 — Auditoria:** detalhes legíveis em vez de JSON (ex.: "Aviso geral publicado: 'Ola pessoal' · Manutenção · 09/11 01:43–01:46"), horários no fuso local, paginação além de 300 e exportação CSV.
- **U8 — Configurações:** campos de data e hora com o fuso escrito ("horário de Brasília"); prévia do aviso geral como a barbearia vai ver; "Mandar e-mail de teste" para cada modelo; histórico de mudanças de preço e cupom com link para a auditoria.
- **U9 — Saúde do sistema:** acrescentar último backup (data, tamanho, ok/erro), versão e data do deploy, estado do webhook do Asaas (último evento recebido), validade do certificado TLS e espaço em disco. Na política de limpeza, deixar explícito que "contas paradas em 90 dias" **nunca** inclui conta pagante ou em cortesia, e mostrar quais contas serão apagadas nos próximos 7 dias.

### Recursos novos (F), em ordem de impacto

- **F1 — Funil de ativação por conta:** Cadastro → serviços → barbeiros → 1º agendamento → 1ª comanda fechada → WhatsApp conectado → pagamento. Gráfico do funil (quantas contas passam de cada etapa) e, na conta, a etapa atual. Reaproveitar os eventos do tutorial do painel.
- **F2 — Origem do cadastro:** gravar `utm_source/medium/campaign/term/content`, `gclid/gbraid/wbraid` e referrer no cadastro (cookie first-party de 90 dias criado no site). Mostrar em Contas, Vendas e Início ("contas novas por origem"). Opcional: exportar conversões offline (pagamento) para o Google Ads.
- **F3 — Alertas para a equipe** (e-mail; WhatsApp opcional): cadastro novo, teste acabando em 3 dias sem comanda fechada, cobrança vencida, WhatsApp caído há mais de 2 h, falha de e-mail, falha de NF, cupom perto de esgotar. Cada admin escolhe quais recebe.
- **F4 — Nota de saúde da conta (0–100):** acessos nos últimos 7 dias, comandas fechadas por semana, WhatsApp conectado, tutorial concluído, cobrança em dia. Ordenar Contas por "risco de cancelamento".
- **F5 — Acesso de suporte com consentimento:** o dono libera nas Configurações dele por 24 h; o admin abre o painel da barbearia em modo leitura, com faixa "Modo suporte", tudo registrado nas duas auditorias. Respeita a regra de não expor dados sem permissão.
- **F6 — Chamados de suporte:** formulário "Falar com o suporte" no painel da barbearia vira chamado ligado à conta, com status e histórico no admin.
- **F7 — Métricas de SaaS:** churn mensal, MRR novo, perdido, de upgrade e de downgrade, LTV, ticket médio por plano e coortes por mês de cadastro.
- **F8 — Aviso geral segmentado:** por plano, situação (teste ou pagante), conta específica; prévia antes de publicar.
- **F9 — Gestão de cupons:** gráfico de uso, alerta de vagas e relatório de receita gerada e desconto concedido por cupom.

### Não mudar (pontos fortes)

Separação de dados das barbearias, autenticador obrigatório, auditoria imutável com motivo, tabelas de preço com vigência, cupons que não tiram o desconto de quem já usa, bloqueio que mantém leitura e exportação, Saúde do sistema com filas e limpeza visíveis, modelos de e-mail com prévia.

### Checklist de validação

- [x] R1 cupom sem limite e mensagem clara de esgotado (`fix/admin-r1-cupom-sem-limite`; o alerta de cupom perto de esgotar fica com o F3)
- [x] R2 emissão de NF bloqueada com dados de exemplo (`fix/admin-r2-nota-fiscal`). **Dados reais: com o dono** (inscrição, regime e certificado no Asaas; serviço e ISS com o contador)
- [x] R3 máquina de estados testada; "Desbloquear" volta ao estado anterior; "Reativar" exige próximo passo; cancelar para a cobrança no Asaas (`fix/admin-r3-r4-r6-situacao-da-conta`)
- [x] R4 cobrança manual gera cobrança prevista por ciclo, também para quem nunca pagou (`fix/admin-r3-r4-r6-situacao-da-conta`)
- [ ] R5 "Em dia" só com pagamento; "Ativa sem cobrança", "Cortesia" e "conta interna" fora do MRR
- [x] R6 teste com limite; acima disso só cortesia (`fix/admin-r3-r4-r6-situacao-da-conta`)
- [ ] R7 falhas de e-mail listáveis, reenviáveis e alertadas
- [ ] R8 WhatsApp caído em Precisa de atenção
- [ ] R9 IP real na auditoria atrás do proxy
- [ ] R10 abas respondem ao hash (ou rotas reais)
- [ ] U1–U9 conferidos
- [ ] F2 origem gravada num cadastro de teste vindo de `?utm_source=google&gclid=teste`
- [ ] Build, lint e testes passando

## Parte 3 · Site público (seupentefino.com.br)

### Bugs e erros

#### B1 — Não existe página 404 (soft 404 para /entrar)

- **Problema:** qualquer URL inexistente (ex.: `/blog`, `/pagina-que-nao-existe`) redireciona para `/entrar?voltar=%2F...` e responde **200**. O visitante cai numa tela de login sem entender; o Google pode tratar como *soft 404* e o link quebrado de um anúncio ou post perde o visitante.
- **Causa provável:** um `middleware.ts` (ou layout de rota protegida) que manda tudo que não é público para o login, inclusive rotas que não existem.
- **O que fazer:**
  1. No middleware, só redirecionar para `/entrar` as rotas **realmente protegidas** (prefixos `/app`, `/convite`, `/redefinir-senha`, `/agendar` e o que mais existir no app). Todo o resto deve seguir o roteamento normal.
  2. Criar `app/not-found.tsx` com status 404 real: título "Página não encontrada", uma frase, e três links (Home, Planos, Testar grátis), no mesmo layout/estilo do site.
  3. Garantir `<meta name="robots" content="noindex">` na 404.
- **Validar:** `curl -I https://seupentefino.com.br/qualquer-coisa` retorna `404`; `/app` sem login continua indo para `/entrar`.

#### B2 — FAQ de /planos diz que o bot de WhatsApp "está em construção"

- **Problema:** em /planos, a pergunta "O bot de WhatsApp cobra por mensagem?" termina com: *"O bot está em construção e chega para os planos Pro e Premium sem custo extra."* A home, a tabela de planos e os anúncios dizem que o bot funciona. O dono confirmou que **funciona**.
- **O que fazer:** trocar a última frase por: *"Está incluso no Pro e no Premium, sem custo extra."* Procurar no repositório qualquer outro "em construção"/"em breve" relacionado ao bot e alinhar.
- **Validar:** `grep -ri "em construção" ` não retorna nada sobre o bot.

#### B3 — Cupom aplicado no cadastro não mostra o desconto

- **Problema:** `/cadastro?cupom=LANCAMENTO` preenche o campo "Cupom de desconto", mas os cards de plano continuam mostrando R$ 79,90 / 149,90 / 249,90. Quem clicou em "30% off para sempre" não vê o desconto e desconfia.
- **O que fazer:**
  1. Quando houver cupom válido (vindo da URL ou digitado), mostrar em cada plano o preço cheio riscado e o preço com desconto, ex.: ~~R$ 149,90~~ **R$ 104,93/mês**, e uma linha "30% de desconto para sempre aplicado (LANCAMENTO)".
  2. Validar o cupom do lado do servidor (endpoint existente ou novo) e mostrar erro amigável se inválido/expirado. A oferta vale até **31/01/2027**: após essa data o cupom deve ser recusado e o texto some.
  3. Centralizar preços e o cupom numa única fonte (ex.: `lib/precos.ts`), usada pela home, /planos, /cadastro e JSON-LD. Hoje os mesmos números aparecem em vários lugares.
- **Cálculo (arredondar para 2 casas, confirmar regra de arredondamento usada na cobrança):**

  | Plano | Mensal cheio | Mensal −30% | Anual (por mês) | Anual −30% (por mês) |
  | --- | --- | --- | --- | --- |
  | Básico | 79,90 | 55,93 | 66,90 | 46,83 |
  | Pro | 149,90 | 104,93 | 124,90 | 87,43 |
  | Premium | 249,90 | 174,93 | 207,90 | 145,53 |
  | Unidade extra (Premium) | 99,90 | 69,93 | 82,90 | 58,03 |

  > Confirme com o código de cobrança se o desconto incide também sobre o anual e sobre unidades extras. Se não incidir, mostre só onde incide.
- **Validar:** abrir `/cadastro?cupom=LANCAMENTO`, `/cadastro?cupom=INVALIDO` e `/cadastro` sem cupom; conferir preços e mensagens.

#### B4 — JSON-LD com preço diferente do exibido

- **Problema:** o `SoftwareApplication` declara `"offers": {"price": "79.90"}`, mas a página abre no ciclo **anual** mostrando R$ 66,90. Divergência de preço entre dados estruturados e página pode gerar aviso no Search Console e em anúncios.
- **O que fazer:** trocar por `AggregateOffer` gerado a partir de `lib/precos.ts`:
  ```json
  {
    "@type": "AggregateOffer",
    "priceCurrency": "BRL",
    "lowPrice": "66.90",
    "highPrice": "249.90",
    "offerCount": 3
  }
  ```
  Opcional: listar cada plano como `Offer` com `name`, `price` e `priceSpecification` (`UnitPriceSpecification`, `billingDuration` P1M).
- **Validar:** Rich Results Test e Schema Markup Validator sem erros.

#### B5 — Vídeo "Ver em 1 minuto" só em WebM

- **Problema:** `<video>` tem apenas `/video/apresentacao.webm`. Safari em iPhones/Macs mais antigos pode não reproduzir, e iPhone é parte grande do público.
- **O que fazer:** gerar `apresentacao.mp4` (H.264 + AAC, `-movflags +faststart`) e usar dois `<source>`: MP4 primeiro para Safari ou WebM primeiro com MP4 de reserva. Manter `poster`, `preload="metadata"`, `controls`, `playsInline`. Adicionar legendas (`<track kind="captions" srclang="pt-BR">`) se houver fala.
- **Validar:** reproduz no Safari iOS, Chrome Android e desktop.

#### B6 — "2 meses grátis" não bate com a economia mostrada

- **Problema:** no anual, o Básico mostra "economia de R$ 156,00", mas 2 meses do mensal valem R$ 159,80 (Pro: 300,00 vs 299,80; Premium: 504,00 vs 499,80). Diferença pequena, mas cliente atento nota.
- **O que fazer:** **[DECISÃO DO DONO]** padrão: trocar o selo "2 meses grátis" por "economize até R$ 504/ano" ou "≈ 2 meses grátis". Calcular a economia a partir de `lib/precos.ts`, nunca digitada.

#### B7 — Link "Planos" some do menu no celular

- **Problema:** no celular (375 px) o cabeçalho mostra só "Entrar" e "Testar grátis". Quem quer ver preço precisa rolar a página inteira.
- **O que fazer:** manter "Planos" visível no celular (texto curto ou ícone) ou criar menu hambúrguer acessível com Planos, Entrar, Testar grátis. Botões com área de toque ≥ 44 px.
- **Validar:** viewport 375×812, os três destinos alcançáveis no topo.

#### B8 — Cadastro não pede celular/WhatsApp

- **Problema:** o cadastro pede nome da barbearia, nome, e-mail e senha. Sem celular não há onboarding ativo nem recuperação de quem abandona o teste. Concorrentes (AppBarber) pedem celular.
- **O que fazer:** adicionar campo **"WhatsApp (opcional)"** com `type="tel"`, `autocomplete="tel"`, máscara BR `(00) 00000-0000`, validação leve, e texto "Para ajudar na configuração. Não enviamos spam." Gravar no cadastro da conta (ajustar backend/migração conforme o projeto). Atualizar a política de privacidade se ela listar os dados coletados.
- **Validar:** cadastro funciona com e sem o campo.

### Coerência entre promessa e planos

> Este é o problema mais importante do site. A home vende **lucro e margem por serviço**, mas a tabela de /planos mostra que isso só existe no **Premium (R$ 249,90)**. A home e os anúncios vendem **comissão automática**, mas o **Básico** não tem. Quem assina um plano menor e não encontra o recurso cancela ou reclama.

Tabela atual de recursos (lida de /planos):

| Recurso | Básico | Pro | Premium |
| --- | --- | --- | --- |
| Agenda, comanda automática, caixa, despesas, indicadores, app do barbeiro, PDF, importação | ✓ | ✓ | ✓ |
| Comissão automática + extrato do barbeiro | — | ✓ | ✓ |
| Metas, clube de assinatura, bot de WhatsApp, lista de espera, ranking, pesquisa | — | ✓ | ✓ |
| Várias unidades, preço por unidade | — | — | ✓ |
| **Lucro real e margem por serviço e produto** | — | — | ✓ |
| Automações do bot (retorno, aniversário, aviso do clube) | — | — | ✓ |

#### P1 — Sinalizar o plano em toda promessa que não é de todos os planos

- **O que fazer (padrão, sem mudar o produto):** criar um componente `<SeloPlano plano="pro" | "premium" />` (pequeno, discreto, ex.: "Pro+" / "Premium") e aplicá-lo na home junto de:
  - "lucro real por serviço, por barbeiro e por unidade" (hero, subtítulo) → Premium
  - bloco "O que dá lucro, e o que só dá trabalho" → Premium
  - bloco "WhatsApp que agenda sozinho" → Pro+
  - comissão em "O barbeiro lança no celular" e "Cada um vê o que precisa" → Pro+
  - lista de recursos ("Lista de espera", "Avaliação no WhatsApp", "Clube de assinatura", "Várias unidades") → selo conforme a tabela
  - tabela "Mais que uma agenda bonita": coluna Pente Fino com nota "depende do plano" onde couber
- Ler o mapeamento recurso→plano de uma única fonte (ex.: `lib/planos.ts`) para a home e /planos nunca divergirem.

#### P2 — [DECISÃO DO DONO] Onde fica o "lucro por serviço"

- Opção A (recomendada para conversão): **incluir lucro e margem por serviço no Pro**, mantendo no Premium só o comparativo entre unidades e o painel da rede. Isso torna a promessa da home verdadeira para o plano "Mais escolhido".
- Opção B: manter só no Premium e reescrever o hero para não prometer a todos, ex.: título igual, subtítulo "…e, no Premium, o lucro real por serviço e por unidade."
- **Implementação:** deixe a escolha numa flag (`LUCRO_POR_SERVICO_NO_PRO = true|false`) que muda a tabela de /planos, os selos de P1 e o JSON-LD. A liberação real do recurso no produto é fora do site público: se a opção A for escolhida, abrir tarefa separada no app.

#### P3 — [DECISÃO DO DONO] Plano Básico pouco competitivo

- **Problema:** R$ 79,90 sem comissão e sem bot. Para barbeiro solo, ZapCorte (R$ 69,90) e EiBarber (R$ 49) entregam WhatsApp; AppBarber tem o mesmo preço com mais recursos.
- **Opções:** baixar o Básico (ex.: R$ 59,90) **ou** incluir o bot de WhatsApp no Básico **ou** reposicionar como "Solo" (1 profissional) com bot. No site: só ajustar `lib/precos.ts`/`lib/planos.ts` e textos, depois da decisão.

#### P4 — Coerência com os anúncios do Google (já publicados)

Os anúncios ativos usam estes textos; o site precisa confirmar cada um logo que o visitante chega:

- "30% de Desconto Para Sempre", "Assine até 31/01/2027…" → ver C1 e B3
- "Teste 14 Dias Grátis", "Sem Cartão e Sem Fidelidade" → já ok
- "WhatsApp que Agenda Sozinho", "Bot de WhatsApp agenda 24h" → ver B2 e P1 (deixar claro "Pro e Premium")
- "Controle Financeiro Barbearia", "Lucro real por serviço" → ver P1/P2
- "Comissão de Barbeiro na Hora" → selo Pro+ (P1)
- Extensão de preço: Básico/Pro/Premium "a partir de" R$ 66,90 / 124,90 / 207,90 por mês (anual) → manter esses valores no anual
- Sitelinks: `/cadastro?cupom=LANCAMENTO`, `/#video`, `/planos`, `/cadastro`, `/entrar` → garantir que `#video` continue existindo como âncora

### Conversão e confiança

#### C1 — Mostrar a oferta de lançamento na home

- **Problema:** "30% de desconto para sempre, até 31/01/2027" só aparece em /planos.
- **O que fazer:**
  1. Faixa fina no topo de todas as páginas públicas: "Oferta de lançamento: 30% off para sempre em qualquer plano. Até 31/01/2027." + link "Ativar desconto" → `/cadastro?cupom=LANCAMENTO`. Fechável (guardar em `localStorage` com try/catch).
  2. No bloco de preços da home, repetir a oferta acima dos cards e trocar os CTAs para incluir `cupom=LANCAMENTO`.
  3. Esconder tudo automaticamente após 31/01/2027 23:59 (America/Sao_Paulo), lendo a data de `lib/precos.ts`.
- **Validar:** simular data posterior e conferir que a faixa some.

#### C2 — Botão de WhatsApp e canal humano

- **Problema:** o único contato é `contato@seupentefino.com.br`. Para quem vende bot de WhatsApp, não ter WhatsApp no site pesa. AppBarber mostra WhatsApp e telefone.
- **O que fazer:** botão flutuante (canto inferior direito, sem cobrir o CTA no celular) com link `https://wa.me/55XXXXXXXXXXX?text=...`, mensagem pré-pronta "Oi! Vim pelo site e quero saber mais sobre o Pente Fino." Disparar evento GTM `click_whatsapp`. Também no rodapé.
- **TODO:** número oficial — **pedir ao dono**. Deixe em `lib/contato.ts`; se vazio, o botão não renderiza.

#### C3 — Rodapé com dados da empresa

- **O que fazer:** adicionar razão social, CNPJ, cidade/UF, e-mail, WhatsApp e redes sociais (Instagram, YouTube). Tudo em `lib/contato.ts`. **TODO: dados reais com o dono**; não renderizar campos vazios.

#### C4 — Seção de prova social

- **Problema:** nenhum depoimento, número de clientes, nota ou estudo de caso. É o maior freio de conversão para marca nova.
- **O que fazer:**
  1. Componente `<Depoimentos />` alimentado por `content/depoimentos.ts` (nome, barbearia, cidade/UF, foto opcional, frase, número de destaque opcional, ex.: "descobriu que a barba dava 2× mais margem que o corte").
  2. Renderizar só se houver ao menos 2 itens. **Não criar depoimentos fictícios.** Deixar o arquivo com tipos e comentário `// TODO: preencher com depoimentos reais autorizados`.
  3. Posição: logo após o bloco "Entrou bastante. E quanto ficou?" ou antes dos planos.
  4. Opcional: contador "X barbearias usando" lido de config, só exibido se o dono preencher.

#### C5 — Destacar teste e implantação

- Reforçar perto de cada CTA: "Configurado em 10 minutos · atende no mesmo dia · importamos sua planilha". **[DECISÃO DO DONO]** avaliar teste de 21–30 dias (AppBarber e EiBarber dão 30). Deixar a duração em constante única (`DIAS_TESTE = 14`) usada em todos os textos.

#### C6 — CTA principal e secundário

- Hero: manter "Testar 14 dias grátis"; o secundário "Ver em 1 minuto" deve rolar suave até o vídeo **e** dar play (com `muted` se autoplay exigir).
- Adicionar CTA ao fim de cada bloco longo (após WhatsApp, após calculadora): "Testar grátis com 30% off".

#### C7 — Calculadora "Quanto sobra de cada corte?"

- Hoje é ótima, mas não leva ao cadastro. Após o resultado, mostrar: "O Pente Fino faz essa conta em cada comanda. Testar grátis" com link para cadastro carregando os valores como UTM/param (ex.: `?origem=calculadora`).
- Garantir que inputs aceitam vírgula decimal (formato BR), têm `inputmode="decimal"` e rótulos associados.

### SEO técnico

O SEO técnico já está bom (title, description, canonical, `lang="pt-BR"`, um H1, JSON-LD de Organization/SoftwareApplication/FAQPage, WebP com alt, robots e sitemap). Ajustes:

#### S1 — Sitemap dinâmico

- Gerar `app/sitemap.ts` com todas as páginas públicas, incluindo as novas da seção 6, com `lastModified` real. Hoje tem só 5 URLs (/, /planos, /cadastro, /termos, /privacidade).

#### S2 — Metadados por página

- Cada página nova com `title` (≤ 60 caracteres, termo principal no início), `description` (≤ 155), `canonical`, Open Graph e Twitter. Imagem OG por página (pode reutilizar o gerador `opengraph-image` existente com título dinâmico).

#### S3 — Dados estruturados adicionais

- `BreadcrumbList` nas páginas internas.
- `Article` (com `datePublished`, `dateModified`, `author`) nos posts do blog.
- `FAQPage` nas páginas de intenção que tiverem FAQ.
- Corrigir `offers` (B4).

#### S4 — Links internos

- Rodapé com seção "Recursos" linkando as páginas da seção 6 e "Comparativos". Cada página nova linka para /planos e /cadastro e para 2–3 páginas irmãs.

#### S5 — www e redirecionamentos

- `www.seupentefino.com.br` serve o site com canonical correto. Preferível: redirecionar 301 `www` → raiz para consolidar sinais. Conferir também `http` → `https` (301).

#### S6 — robots.txt

- Manter os `Disallow` atuais. Remover os `Allow` redundantes (o `Allow: /` já cobre). Não bloquear `/_next/static`.

### SEO de conteúdo: páginas novas

Os concorrentes (ZapCorte, BarbeiroApp, Genda, AppBarber) atraem tráfego orgânico com blogs, comparativos e ferramentas grátis. O Pente Fino não tem nenhuma página além da home e de /planos.

> **Regras para todo o conteúdo novo:** português do Brasil, frases curtas, exemplos com números de barbearia, nada de promessa que o plano não entrega (ver seção 3), CTA para `/cadastro?cupom=LANCAMENTO` enquanto a oferta valer. Estrutura reutilizável: um template `app/(conteudo)/[slug]/page.tsx` + conteúdo em MDX ou arquivos TS.

#### N1 — Páginas por intenção de busca (uma por termo dos anúncios)

| Rota sugerida | Termo principal | Foco do texto |
| --- | --- | --- |
| `/sistema-para-barbearia` | sistema para barbearia | visão geral, do agendamento ao lucro |
| `/agenda-online-para-barbearia` | agenda online / agendamento online barbearia | agenda por barbeiro, link, comanda nascendo do horário |
| `/controle-financeiro-barbearia` | controle financeiro / controle de caixa barbearia | caixa do dia, despesas, lucro, relatório do contador |
| `/comissao-de-barbeiro` | comissão de barbeiro | comissão por item, vigência, extrato no celular (Pro+) |
| `/comanda-digital-barbearia` | comanda digital barbearia | fim da comanda de papel, QR code, PDF |
| `/whatsapp-para-barbearia` | bot de WhatsApp para barbearia | agendamento 24h, sem IA, sem custo por mensagem (Pro+) |
| `/aplicativo-para-barbearia` | aplicativo / app para barbearia | PWA no celular sem loja, app do barbeiro, funciona offline |

Estrutura de cada página: H1 com o termo · parágrafo de resposta direta · 3–5 seções com print do produto (reusar `/site/*.webp`) · bloco "Quanto custa" (lido de `lib/precos.ts`) · FAQ (3–5 perguntas, com JSON-LD) · CTA.

#### N2 — Páginas de comparação

- `/comparativo/appbarber`, `/comparativo/trinks`, `/comparativo/booksy`, e `/melhor-sistema-para-barbearia` (comparativo geral).
- **Regras obrigatórias:** só fatos verificáveis, com **data de conferência** e link para a fonte de cada preço; tom justo (dizer onde o concorrente é melhor, ex.: Trinks emite nota fiscal, AppBarber dá 30 dias de teste e tem app nas lojas). Sem logos de concorrentes. Componente de tabela com dados em arquivo (`content/comparativos.ts`) para atualizar fácil.
- Dados de referência (conferir de novo antes de publicar):

  | Sistema | Solo (mensal) | Equipe ~5 (mensal) | Teste |
  | --- | --- | --- | --- |
  | AppBarber | R$ 79,90 | R$ 109,90 (2–5) | 30 dias |
  | Trinks | R$ 110 (1–2), R$ 76 no anual | sob consulta | 5 dias |
  | Booksy | R$ 99,99 | + R$ 20 por agenda extra | 7 dias |
  | ZapCorte | R$ 69,90 | R$ 179,90 (até 10) | 7 dias |
  | EiBarber | R$ 49 (até 2) | R$ 139 (ilimitado) | 30 dias |

#### N3 — Ferramentas grátis em URL própria

- `/calculadora/lucro-por-corte` (extrair a calculadora da home para componente reutilizável; a home continua usando).
- `/calculadora/comissao-de-barbeiro` (preço, % comissão, produto → quanto fica para barbeiro e casa).
- `/calculadora/preco-do-corte` (custos fixos, cortes/mês, comissão, margem desejada → preço mínimo).
- Cada uma com explicação da fórmula, exemplo e CTA.

#### N4 — Blog

- Rota `/blog` (lista) e `/blog/[slug]` (post), em MDX, com `Article` JSON-LD, data, tempo de leitura, posts relacionados e CTA no meio e no fim.
- Pautas iniciais (criar a estrutura e 1 post de exemplo; os demais como rascunho com título e tópicos):
  1. Faturamento não é lucro: como saber quanto sobra na barbearia
  2. Como calcular comissão de barbeiro sem planilha
  3. Quanto cobrar pelo corte em 2027: a conta do preço mínimo
  4. Clube de assinatura na barbearia: como montar sem perder dinheiro
  5. Comanda de papel x comanda digital
  6. Como reduzir faltas com lembrete no WhatsApp

#### N5 — Página "Sobre" e "Contato"

- `/sobre`: quem faz o Pente Fino, por que existe, cidade. **TODO com o dono.**
- `/contato`: WhatsApp, e-mail, horário de atendimento. Aumenta confiança e serve de destino para sitelinks.

### Rastreamento e medição

#### T1 — Conversão de cadastro no Google Ads

- Confirmar que a conta criada dispara a conversão do Google Ads (`AW-18558704295/<label>`) **apenas no sucesso** do cadastro (página/estado de sucesso, não no clique do botão). Se não existir, implementar via `dataLayer.push({event: 'sign_up', plano, ciclo, cupom})` e configurar a tag no GTM.
- Incluir valor estimado (ex.: preço do plano) para lances por valor.

#### T2 — Preservar gclid e UTMs até o cadastro

- Ler `gclid`, `gbraid`, `wbraid`, `utm_*` na chegada, guardar em cookie first-party (90 dias), e enviar junto ao criar a conta (campo oculto/backend). Permite conversões offline (ex.: quem assinou depois do teste).

#### T3 — Eventos de funil

- `dataLayer` para: `view_planos`, `toggle_ciclo` (mensal/anual), `click_cta` (com posição), `play_video`, `use_calculadora`, `click_whatsapp`, `begin_sign_up` (foco no 1º campo), `sign_up`.

#### T4 — Consentimento (LGPD)

- **Verificar** se há banner de cookies. Não foi confirmado na auditoria. Se não houver, implementar Consent Mode v2 (padrão `denied` para ads/analytics até aceite) com banner simples e link para /privacidade. Recusar = só cookies essenciais.

### Desempenho, acessibilidade e detalhes

Medições atuais (home, desktop): TTFB 164 ms, LCP 552 ms (o H1), load 449 ms, 484 KB transferidos, 41 requisições, nenhum erro de console. Está muito bom; manter.

- **D1 — Imagens do hero:** `financeiro.webp` tem 1600 px de largura natural e aparece com 577 px. Usar `next/image` com `sizes` correto para servir versões menores no celular. Manter `loading="lazy"` abaixo da dobra.
- **D2 — Scripts de terceiros:** carregar GTM/gtag com `next/script` `strategy="afterInteractive"` (ou `lazyOnload` se a medição permitir) e conferir que não há gtag duplicado (GTM + gtag direto).
- **D3 — Tabela comparativa da home:** os ícones ✓/✗ têm `aria-label` ("Sim"), bom. Adicionar também texto visualmente oculto (`sr-only`) nas células e a legenda "em parte" com o ícone visível ao lado (hoje a legenda aparece só como "= em parte").
- **D4 — Contraste e foco:** conferir contraste AA do texto cinza (`text-tinta-suave`/`fraca`) sobre o fundo escuro, e foco visível em todos os links/botões (já existe `focus-visible:outline-foco` nos toggles; padronizar).
- **D5 — Formulário de cadastro:** marcar campos obrigatórios com `required` e `aria-required` (hoje nenhum input tem `required`; a validação deve continuar no servidor). Mensagens de erro ligadas ao campo (`aria-describedby`). Mostrar/ocultar senha.
- **D6 — Microcopy:** padronizar "14 dias grátis, sem cartão" em todos os pontos; padronizar "Pro e Premium" ao falar do bot; trocar "Ver em 1 minuto" e "Veja em 1 minuto" por uma só forma.

### Checklist final de validação

Situação de cada item (✅ entregue, com o PR):

- [x] B1 404 real (`curl -I` = 404) e rotas protegidas ainda redirecionam — #148
- [x] B2 nenhum texto diz que o bot está em construção — #148
- [x] B3 cupom mostra preço com desconto; cupom inválido mostra erro; expira em 31/01/2027 — #148
- [x] B4 JSON-LD válido no Rich Results Test, preços batendo com a página — #148
- [x] B5 vídeo toca no Safari iOS — #148
- [x] B6 economia anual calculada, sem número digitado — #148
- [x] B7 "Planos" acessível no celular — #148
- [x] B8 campo WhatsApp opcional gravando — #148
- [x] P1 selos de plano em todas as promessas parciais; home e /planos leem a mesma fonte — #148
- [x] P2 flag do lucro no Pro funcionando nos dois estados — #148
- [x] C1 faixa da oferta em todas as páginas; some após a data — #148
- [x] C2/C3 WhatsApp e rodapé renderizam só com dados preenchidos — #148
- [x] C4 depoimentos só aparecem com ≥ 2 itens reais — #148
- [ ] S1 sitemap lista todas as páginas públicas
- [ ] S5 `www` e `http` redirecionam com 301
- [ ] N1–N5 páginas publicadas com title/description/canonical/OG e CTA
- [ ] T1 conversão dispara só no sucesso do cadastro (verificar no Tag Assistant)
- [ ] T2 gclid/UTM chegam ao backend
- [x] T4 consentimento funcionando — já existia (Consent Mode v2)
- [ ] Lighthouse mobile da home: Performance ≥ 90, Acessibilidade ≥ 95, SEO 100
- [ ] Build, lint e testes passando

### Anexo: contexto competitivo

**Onde o Pente Fino ganha:** posicionamento "lucro, não só agenda" (único no mercado), comissão com vigência, lucro e margem por item, bot sem custo por mensagem, sem cobrança por cadeira até 10 profissionais, preços publicados para todos os planos, teste sem cartão mais longo que Trinks, Booksy e ZapCorte, site rápido e bem escrito.

**Onde perde:** plano solo caro e sem o principal diferencial; promessa da home só entregue no Premium; zero prova social; sem WhatsApp/telefone; sem conteúdo para SEO; sem app nas lojas (é PWA — explicar como vantagem: "sem baixar nada"); sem nota fiscal (Trinks tem); teste de 14 dias contra 30 de AppBarber e EiBarber.

**Fontes consultadas (10/11/2026):**
- AppBarber — https://appbarber.com.br/
- Booksy — https://biz.booksy.com/pt-br/precos
- Trinks (via comparativo de terceiros, set/2026) — https://www.barbeiro.app/alternativas/trinks
- ZapCorte e EiBarber (comparativo publicado pela ZapCorte, out/2026) — https://blog.zapcorte.com.br/melhor-app-de-agendamento-para-barbearia-em-2026-mn4o4n2p

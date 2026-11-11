# Pente Fino — briefing de correções do painel (área logada)

> **Para o Claude Code.** Este documento lista o que corrigir e melhorar no painel do Pente Fino (rotas `/inicio`, `/dia`, `/agenda`, `/comandas`, `/caixa`, `/clientes`, `/resultados`, `/financeiro`, `/servicos`, `/bot`, `/conversas`, `/configuracoes`, `/ajuda`) e na página pública `/agendar`.
>
> Origem: auditoria em 10/11/2026 (~23h, America/Sao_Paulo), na conta de teste "Teste" (Premium, 2 unidades: "Unidade principal" e "kkkkkkkkk", barbeiros "Teste" e "vitor martins"). Os bugs foram **reproduzidos** com um agendamento real de teste.
>
> **Regras para executar**
> - Stack observada: Next.js (App Router, RSC), API REST em `/api/*` (ex.: `POST /api/agendamentos`, `GET /api/comandas/:id`, `GET /api/agenda/horarios-livres`, `GET /api/clientes?busca=`), Tailwind. Confirme no repositório.
> - **Comece pelos itens do grupo A (dinheiro e dados).** Cada um precisa de teste automatizado que reproduza o bug antes da correção.
> - Itens **[DECISÃO DO DONO]**: implemente o padrão indicado atrás de constante/flag fácil de trocar.
> - Toda regra de data deve usar o fuso da unidade (America/Sao_Paulo por padrão), nunca UTC do servidor.
> - Um commit por item, com o ID (ex.: `fix(A1): caixa usa data do recebimento`).
> - Ao final, entregue a checklist da seção 7 preenchida.

---

## 1. Ordem de execução

| Ordem | IDs | Motivo |
| --- | --- | --- |
| 1º | A1, A2, A3, A4 | Caixa não bate; dinheiro registrado no dia errado; comanda presa. |
| 2º | A5, A6, A7, A8 | Bot respondendo errado, status falso, cliente final sem saída, layout quebrado no celular. |
| 3º | M1–M10 | Informação confusa e atrito de uso. |
| 4º | X1–X4, P1–P6 | Acessibilidade e página pública. |

---

## 2. Grupo A — bugs críticos

### A1 — Cada tela usa uma data diferente para o mesmo dinheiro

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

### A2 — Permite receber e fechar atendimento futuro, com caixa fechado

**Observado:** em 10/11, a comanda de 11/11 foi recebida e fechada sem nenhum aviso. O caixa de 10/11 não estava aberto.

**O que fazer:**
1. Se o início do atendimento é **depois de agora**: o botão "Receber e fechar" fica desativado, com a dica "O atendimento é em 11/11 às 10:00." Opcional [DECISÃO DO DONO]: permitir "Receber adiantado (sinal)", que registra o pagamento sem fechar a comanda.
2. Se o caixa do dia do recebimento **não está aberto**: abrir modal "O caixa de hoje não foi aberto. Abrir agora com troco R$ __?" antes de concluir. Se estiver **fechado**: bloquear e orientar a reabrir (exige gestor, como já é hoje).
3. Validar no servidor (`POST` de fechamento/pagamento), não só no front.

### A3 — Comanda reaberta fica presa (sem cancelar nem mover)

**Observado:** depois de "Reabrir comanda" (status REABERTA), as ações **"Cancelar ou marcar falta"** e **"Mover horário"** somem; só resta "Receber e fechar". Clicar no horário na agenda abre a mesma tela. Não há como desfazer um fechamento por engano.

**O que fazer:** status REABERTA deve ter as mesmas ações de uma comanda aberta (cancelar, marcar falta, mover horário, começar e confirmar atendimento). Cancelar uma reaberta exige motivo e registra no histórico.

**Limpeza:** existe uma comanda REABERTA vazia de teste (Vitor martins com vitor martins, 11/11 10:00, Unidade principal, id `01a1c85f-c873-7d06-b61f-c67e8f37ff3f`) e um caixa de 11/11 aberto indevidamente. Após corrigir A1 e A3, cancelar essa comanda e reverter o caixa.

### A4 — Permite fechar comanda vazia (R$ 0,00)

**Observado:** removendo todos os itens, "Receber e fechar" abre com total R$ 0,00 e o botão Continuar fica ativo.

**O que fazer:** comanda sem itens não pode ser fechada (front desativa o botão; servidor retorna 422). Mostrar "Sem itens. Lance um serviço ou cancele/marque falta." Exceção: assinante do clube com serviço coberto (itens existem com valor 0), que deve continuar funcionando.

### A5 — Bot de fábrica responde "horário de funcionamento" com agendamento

**Reprodução (no simulador `/bot` → Testar, nada é enviado):** "qual o horário de funcionamento?" → o bot inicia o fluxo de agendamento.

**Causa:** palavras-chave padrão: Grupo 3 (Agendar) = `agendar, marcar, horário, agenda`; Grupo 4 (Endereço e horário) = `endereço, onde fica, localização, como chegar`. "horário" casa com o Grupo 3.

**O que fazer:**
1. **Algoritmo:** dar prioridade à regra mais específica. Pontuar cada grupo pelo número de palavras ou frases que casam e pelo comprimento da frase casada; frase de várias palavras vence palavra solta. Em empate, usar a ordem dos grupos.
2. **Padrão de fábrica (contas novas e migração opcional):** Grupo 4 ganha `horário de funcionamento, que horas abre, que horas fecha, abre hoje, abre domingo, funciona`; Grupo 3 troca `horário` por `marcar horário, agendar horário, tem horário`.
3. **Aviso no editor:** se a mesma palavra estiver em dois grupos, ou uma palavra de um grupo estiver contida numa frase de outro, mostrar alerta "Conflito: 'horário' aparece em Agendar e em Endereço e horário".
4. **Testes:** tabela de frases → ação esperada (incluir "qual o horário de funcionamento?", "quero mudar meu horário", "tem horário amanhã?", "quanto custa a barba?", "onde fica?").

### A6 — Conversa mostra "BOT RESPONDENDO" com WhatsApp desconectado

**Observado:** `/conversas` mostra a conversa recente com selo "BOT RESPONDENDO", enquanto o aviso diz que o WhatsApp não está conectado.

**O que fazer:** o selo da conversa deriva do estado real da conexão da unidade: "Bot parado: WhatsApp desconectado" (vermelho), com link "Conectar".

### A7 — Link público ligado numa unidade sem serviços com preço

**Observado:** unidade "kkkkkkkkk" com "LINK LIGADO"; a página `/agendar?u=kkkkkkkkk` mostra "Nenhum serviço disponível pelo link agora." e ainda exibe barbeiros, datas e formulário (o botão Agendar fica desativado). O cliente não tem saída.

**O que fazer:**
1. Ao ligar o link (`/configuracoes` → Link de agendamento), validar: há ao menos 1 serviço com preço na unidade e ao menos 1 profissional com horário. Se não houver, impedir e listar o que falta, com links para cadastrar.
2. Na página pública sem serviços: esconder os passos 2 a 4 e mostrar "Agendamento online indisponível. Fale com a barbearia:" + WhatsApp, telefone e endereço da unidade.
3. No editor do bot: se uma opção depende do link ("sem serviço com preço ou profissional, manda o link do site") e o link da unidade está desligado, mostrar alerta.

### A8 — `/servicos` quebra o layout no celular

**Observado:** com viewport 375×812, `document.documentElement.scrollWidth` = 716 e a barra de navegação inferior (fixa) fica com 716 px e fora da área visível. A tabela está dentro de `div.overflow-x-auto`, que funciona; o vazamento vem de outro elemento. Suspeitas: a faixa de abas "Catálogo / Tabela de preços" ou um contêiner flex sem `min-w-0`.

**O que fazer:** achar o elemento com `scrollWidth > clientWidth` fora da tabela e corrigir (`min-w-0`, `overflow-x-auto` na faixa de abas, `max-w-full`). Adicionar teste visual ou E2E em 375 px para todas as rotas do painel, garantindo `scrollWidth === innerWidth`.

---

## 3. Grupo M — problemas médios

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

---

## 4. Grupo X — acessibilidade

- **X1 — Checkboxes sem nome no Novo agendamento.** As 8 caixas de serviço têm nome acessível "on". Associar `<label htmlFor>` ou envolver o input no `<label>`. Verificar o mesmo padrão em outros formulários (comanda, clube, bot).
- **X2 — Alvos de toque.** "Como fazer", "Fazer agora" e "Ver como reconectar" têm 20 px de altura no celular. Mínimo de 44×44 px de área clicável (padding).
- **X3 — Contraste.** Horários da grade da agenda e textos secundários em cinza sobre `#0b0b0b`: verificar AA (4,5:1) e ajustar o token de cor.
- **X4 — Auditoria automática.** Rodar axe/Lighthouse em todas as rotas do painel (desktop e 375 px) e corrigir o que for "serious" ou "critical".

---

## 5. Grupo P — página pública de agendamento (`/agendar`)

- **P1 — Prévia de compartilhamento.** Hoje `og:title` = "Agendar horário · Pente Fino" e a descrição é a frase de venda do Pente Fino. Usar `generateMetadata` por unidade: título "Agende na {Barbearia} · {bairro/cidade}", descrição com serviços e preço inicial, e imagem OG com nome e logo da barbearia.
- **P2 — Informações da barbearia.** Mostrar endereço com link de mapa, WhatsApp/telefone, horário de funcionamento e, se houver, fotos e nota média da pesquisa.
- **P3 — URL amigável.** Criar `/b/{slug}` (ou `/{slug}`) com redirect 301 de `/agendar?u={slug}`, mantendo os links antigos.
- **P4 — Indexação.** Hoje `robots.txt` tem `Disallow: /agendar`. [DECISÃO DO DONO] padrão: permitir indexação das páginas de barbearias que ligarem a opção "Aparecer no Google", com `LocalBusiness`/`HairSalon` em JSON-LD; as demais ficam `noindex`.
- **P5 — Lista de barbeiros.** "Sem preferência" aparece sozinho enquanto não há serviço; após escolher o serviço, listar só quem faz aquele serviço, com foto.
- **P6 — Confirmação.** Após agendar, tela de confirmação com "Adicionar ao calendário" (.ics), link para remarcar/cancelar e aviso de que a confirmação chega no WhatsApp (quando conectado).

---

## 6. Melhorias de produto (backlog, após os bugs)

- Painel de "saúde da conta" na Início: WhatsApp conectado? link ligado com serviços? caixa de ontem fechado? comandas paradas há mais de 24 h?
- Fechamento de caixa com resumo enviado ao dono (e-mail/WhatsApp).
- Histórico/auditoria visível por comanda (quem criou, alterou, reabriu e o motivo; o motivo já é gravado).
- Busca global (Ctrl+K) por cliente, comanda e serviço.
- Modo recepção (tela grande): fila do dia com "próximo" e botões grandes.

---

## 7. Checklist de validação

- [ ] A1 Início, Caixa, Clientes, Resultados e Financeiro concordam nos 3 cenários (mesmo dia, adiantado, atrasado); caixa não abre sozinho
- [ ] A2 não fecha comanda futura; pede para abrir o caixa; validação também no servidor
- [ ] A3 reaberta permite cancelar, marcar falta e mover; comanda de teste limpa
- [ ] A4 comanda vazia não fecha (front + 422 no servidor); clube com item R$ 0 ainda fecha
- [ ] A5 frases de teste do bot com as respostas esperadas; alerta de conflito de palavras no editor
- [ ] A6 selo da conversa reflete a conexão
- [ ] A7 não liga o link sem serviço com preço; página pública sem serviço mostra contato
- [ ] A8 `scrollWidth === innerWidth` em 375 px em todas as rotas
- [ ] M1–M10 conferidos
- [ ] X1–X4: axe sem "serious/critical"
- [ ] P1 prévia no WhatsApp mostra a barbearia; P3 redirect 301 funcionando
- [ ] Build, lint e testes passando

# Pente Fino — briefing de correções e melhorias do painel de administração (/admin)

> **Para o Claude Code.** Correções e melhorias do painel `/admin` (abas Início, Contas, Cobrança, Vendas, Equipe, Auditoria, Configurações, Saúde do sistema e o modal Nova venda).
>
> Origem: auditoria em 10/11/2026 (~23h20, America/Sao_Paulo), logado como administrador. Só leitura: nada foi salvo, nenhum formulário foi enviado.
>
> **Regras**
> - Manter os princípios atuais: o admin **nunca** mostra dados de clientes, comandas ou conversas das barbearias; toda ação sensível exige motivo e vai para a auditoria.
> - Itens **[DECISÃO DO DONO]**: implementar o padrão indicado atrás de configuração.
> - Datas e horas sempre exibidas em America/Sao_Paulo, com o fuso indicado onde houver entrada de data e hora.
> - Um commit por item, com o ID. Testes para toda regra de status ou de cobrança.
> - Entregar a checklist da seção 6 preenchida.

---

## 1. Ordem de execução

| Ordem | IDs | Motivo |
| --- | --- | --- |
| 1º | R1, R2 | Risco comercial e fiscal imediato (anúncios rodando, NF ligada). |
| 2º | R3, R4, R5, R6 | Regras de status e cobrança deixam conta usando de graça e números errados. |
| 3º | R7–R10 | Falhas invisíveis e auditoria com IP errado. |
| 4º | U1–U9 | Usabilidade por aba. |
| 5º | F1–F9 | Recursos novos. |

---

## 2. Riscos e bugs (R)

### R1 — Cupom LANCAMENTO limitado a 20 vagas, enquanto site e anúncios prometem sem limite
- **Visto:** Configurações → Cupons: `LANCAMENTO · 30% · 0 de 20 · vale até 31/01/2027 · ATIVO`. O site (/planos, faixa da home) e os anúncios do Google prometem "30% para sempre, até 31/01/2027", sem citar vagas.
- **[DECISÃO DO DONO]** padrão: remover o limite de vagas (deixar vazio). Alternativa: manter 20 vagas e expor um endpoint público `GET /api/cupons/LANCAMENTO/status` → `{ativo, vagasRestantes, valeAte}` para o site mostrar "restam X vagas" e esconder a oferta quando esgotar.
- Quando um cupom esgota, o cadastro deve dizer "Este cupom esgotou" (hoje: verificar a mensagem), em vez de seguir sem desconto em silêncio.
- Notificar os admins por e-mail quando restar 20% das vagas e quando esgotar.

### R2 — Nota fiscal ligada com inscrição municipal de exemplo
- **Visto:** Configurações → Nota fiscal: "Dados fiscais no Asaas: inscrição municipal **123456** · Simples Nacional"; "Emitir nota fiscal das mensalidades" **ligado**; código 1.05; ISS 2%.
- **O que fazer:**
  1. Validar os dados fiscais antes de permitir ligar a emissão: recusar valores de exemplo (sequências como 123456, 000000, todos iguais) e mostrar alerta vermelho "Confira a inscrição municipal com o contador".
  2. Botão "Emitir nota de teste" (ambiente sandbox do Asaas, se disponível) antes de ligar.
  3. Registrar na Saúde do sistema o resultado da última emissão (ok/erro e mensagem).
- **TODO do dono:** confirmar inscrição municipal, código de serviço e ISS com o contador.

### R3 — "Desbloquear" uma conta cancelada a deixa ativa, sem teste e sem cobrança
- **Visto (auditoria):** `Cancelou a conta · Teste · status: teste → cancelada` e depois `Desbloqueou a conta · Teste · status: cancelada → ativa · testeAte: 2026-11-22 → — · canceladaEm: … → —`. Resultado: conta Premium mensal, cobrança manual, **Ativa**, sem nenhuma cobrança, sem data de fim.
- **Regra correta:**
  - **Bloquear/Desbloquear** = suspensão temporária. Desbloquear volta **exatamente** ao status anterior (teste com a mesma data de fim, ou ativa com as mesmas cobranças).
  - **Cancelar** tem o par **Reativar**, que pede o próximo passo: "Voltar ao teste até [data]" | "Ativar com cobrança a partir de [data]" | "Cortesia até [data]". Nunca "ativa" sem uma das três.
  - Teste unitário para todas as transições de estado (máquina de estados explícita: `teste → ativa | cancelada | suspensa`, `suspensa → anterior`, `cancelada → teste | ativa | cortesia`).
- Corrigir a conta "Teste" atual ([DECISÃO DO DONO]: cortesia interna ou voltar ao teste).

### R4 — Cobrança manual não gera a cobrança prevista
- **Visto:** conta Teste ativa em cobrança manual desde 08/11; aba Cobrança: "Nenhuma cobrança em aberto"; "Vence em 7 dias R$ 0,00".
- **O que fazer:** para cobrança manual, criar a cobrança prevista de cada ciclo (valor da tabela vigente na assinatura, com cupom aplicado e unidades extras; vencimento na data do ciclo). "Registrar pagamento" baixa essa cobrança. Assim ela entra em "Vence em 7 dias", "Vencido" e "Precisa de atenção", e o e-mail "Aviso de vencimento" dispara.

### R5 — Indicadores contraditórios (Em dia × pagantes × MRR)
- **Visto:** Início: MRR R$ 0,00, "0 contas pagantes", mas "Contas por situação: Em dia 1".
- **O que fazer:**
  - "Em dia" só para conta com cobrança paga cobrindo hoje. Nova situação **"Ativa sem cobrança"** (sem cobrança paga nem cortesia) aparecendo em Precisa de atenção.
  - **Cortesia** como situação própria, com data de fim, fora do MRR e contada à parte.
  - Flag **"conta interna"** (testes da equipe, demonstração) excluída de MRR, conversão, gráficos e exportações. Marcar "Teste" e "Implantação".
  - MRR = soma das mensalidades vigentes das contas pagantes (anual ÷ 12), com unidades extras e descontos.

### R6 — Teste sem limite (conta com teste até 2028)
- **Visto:** conta "Implantação" em teste **até 29/04/2028**; na Nova venda, "Dias de teste" é texto livre.
- **O que fazer:** campo numérico com mínimo 0 e máximo configurável (padrão 60). Acima disso, oferecer "Cortesia até [data]" com motivo. "Estender teste" com o mesmo limite. Em Precisa de atenção, mostrar testes com mais de 60 dias.

### R7 — Falhas da fila de e-mails invisíveis
- **Visto:** Saúde → Filas → E-mails: "Falhas guardadas: 4"; "Erros das últimas 24 h: Nenhum erro"; Início "Para resolver: 0 · Nada urgente". Não há botão para ver nem reenviar.
- **O que fazer:** clicar no número de falhas abre a lista (quando, destinatário mascarado, modelo, mensagem de erro do SMTP, tentativas) com ações **Reenviar** e **Descartar** (com motivo, na auditoria). Falha nova entra em "Erros das últimas 24 h" e em Precisa de atenção. Conferir se as 4 falhas são de e-mail de confirmação de cadastro, que é crítico para conversão.

### R8 — WhatsApp caído fora do "Precisa de atenção"
- **Visto:** Saúde: "WhatsApp que caiu · Teste · Unidade principal · desde 09/11/2026 22:18"; Início: "Tudo em dia por aqui".
- **O que fazer:** novo filtro "WhatsApp caído" em Precisa de atenção (mais de 2 h), com o tempo caído e um atalho para o WhatsApp do dono. Conferir se o modelo de e-mail "WhatsApp desconectado" foi enviado à barbearia.

### R9 — Auditoria grava IP interno
- **Visto:** `09/11/2026 21:11 · Vitor · 172.18.0.1 · Configurou o autenticador`. Os registros do Mikael têm IP público.
- **O que fazer:** configurar a leitura do IP real atrás do proxy (`X-Forwarded-For`/`X-Real-IP` só de proxies confiáveis) num helper único usado por toda a auditoria e pelo login. Teste: requisição com cabeçalho de proxy grava o IP do cliente.

### R10 — Trocar o hash não troca a aba
- **Visto:** com o admin aberto em `#saude`, navegar para `/admin#contas` mudou a URL mas manteve o conteúdo de Saúde (em carga nova, o hash funciona).
- **O que fazer:** ouvir `hashchange`, ou migrar para rotas reais (`/admin/contas`, `/admin/contas/[id]`), o que permite também linkar uma conta específica.

---

## 3. Usabilidade por aba (U)

- **U1 — Início:** estados vazios com orientação (ex.: "Nenhuma conta paga ainda. Contas em teste: 1"); cada cartão clicável para a lista filtrada; período selecionável (mês atual, 30 dias, mês anterior).
- **U2 — Contas (tabela):** a coluna "Último acesso" exige rolagem lateral no notebook. Fixar a primeira coluna, reduzir colunas (agrupar Unidades/Profissionais) e adicionar a coluna **Ativação** (passos do tutorial, ex.: "5/8") e **Origem** (F2). Filtro "Conta interna".
- **U3 — Detalhe da conta:** mostrar próxima cobrança (data, valor, cupom), dias restantes de teste, origem do cadastro, progresso do tutorial, WhatsApp do dono com link `wa.me`, e campo **Notas internas** (texto livre, com autor e data). Substituir "Desbloquear" de conta cancelada por "Reativar" (R3).
- **U4 — Nova venda:** WhatsApp com `type="tel"` e máscara; `required` nos obrigatórios; CPF/CNPJ do dono (necessário para NF); "Dias de teste" numérico (R6); resumo antes de criar: plano, ciclo, cupom, valor da 1ª cobrança e data.
- **U5 — Vendas:** além de "por vendedor", mostrar cadastros pelo site por origem (F2), conversão teste → pago e receita por origem.
- **U6 — Equipe:** papéis **Suporte** (lê Contas e Saúde, sem cobrança nem configurações) e **Financeiro** (cobrança e NF, sem equipe); última troca de senha; desativar exige motivo.
- **U7 — Auditoria:** detalhes legíveis em vez de JSON (ex.: "Aviso geral publicado: 'Ola pessoal' · Manutenção · 09/11 01:43–01:46"), horários no fuso local, paginação além de 300 e exportação CSV.
- **U8 — Configurações:** campos de data e hora com o fuso escrito ("horário de Brasília"); prévia do aviso geral como a barbearia vai ver; "Mandar e-mail de teste" para cada modelo; histórico de mudanças de preço e cupom com link para a auditoria.
- **U9 — Saúde do sistema:** acrescentar último backup (data, tamanho, ok/erro), versão e data do deploy, estado do webhook do Asaas (último evento recebido), validade do certificado TLS e espaço em disco. Na política de limpeza, deixar explícito que "contas paradas em 90 dias" **nunca** inclui conta pagante ou em cortesia, e mostrar quais contas serão apagadas nos próximos 7 dias.

---

## 4. Recursos novos (F), em ordem de impacto

- **F1 — Funil de ativação por conta:** Cadastro → serviços → barbeiros → 1º agendamento → 1ª comanda fechada → WhatsApp conectado → pagamento. Gráfico do funil (quantas contas passam de cada etapa) e, na conta, a etapa atual. Reaproveitar os eventos do tutorial do painel.
- **F2 — Origem do cadastro:** gravar `utm_source/medium/campaign/term/content`, `gclid/gbraid/wbraid` e referrer no cadastro (cookie first-party de 90 dias criado no site). Mostrar em Contas, Vendas e Início ("contas novas por origem"). Opcional: exportar conversões offline (pagamento) para o Google Ads.
- **F3 — Alertas para a equipe** (e-mail; WhatsApp opcional): cadastro novo, teste acabando em 3 dias sem comanda fechada, cobrança vencida, WhatsApp caído há mais de 2 h, falha de e-mail, falha de NF, cupom perto de esgotar. Cada admin escolhe quais recebe.
- **F4 — Nota de saúde da conta (0–100):** acessos nos últimos 7 dias, comandas fechadas por semana, WhatsApp conectado, tutorial concluído, cobrança em dia. Ordenar Contas por "risco de cancelamento".
- **F5 — Acesso de suporte com consentimento:** o dono libera nas Configurações dele por 24 h; o admin abre o painel da barbearia em modo leitura, com faixa "Modo suporte", tudo registrado nas duas auditorias. Respeita a regra de não expor dados sem permissão.
- **F6 — Chamados de suporte:** formulário "Falar com o suporte" no painel da barbearia vira chamado ligado à conta, com status e histórico no admin.
- **F7 — Métricas de SaaS:** churn mensal, MRR novo, perdido, de upgrade e de downgrade, LTV, ticket médio por plano e coortes por mês de cadastro.
- **F8 — Aviso geral segmentado:** por plano, situação (teste ou pagante), conta específica; prévia antes de publicar.
- **F9 — Gestão de cupons:** gráfico de uso, alerta de vagas e relatório de receita gerada e desconto concedido por cupom.

---

## 5. Não mudar (pontos fortes)

Separação de dados das barbearias, autenticador obrigatório, auditoria imutável com motivo, tabelas de preço com vigência, cupons que não tiram o desconto de quem já usa, bloqueio que mantém leitura e exportação, Saúde do sistema com filas e limpeza visíveis, modelos de e-mail com prévia.

---

## 6. Checklist de validação

- [ ] R1 cupom sem limite (ou status público com vagas) e mensagem clara de esgotado
- [ ] R2 emissão de NF bloqueada com dados de exemplo; dados reais confirmados
- [ ] R3 máquina de estados testada; "Desbloquear" volta ao estado anterior; "Reativar" exige próximo passo
- [ ] R4 cobrança manual gera cobrança prevista por ciclo
- [ ] R5 "Em dia" só com pagamento; "Ativa sem cobrança", "Cortesia" e "conta interna" fora do MRR
- [ ] R6 teste com limite; acima disso só cortesia
- [ ] R7 falhas de e-mail listáveis, reenviáveis e alertadas
- [ ] R8 WhatsApp caído em Precisa de atenção
- [ ] R9 IP real na auditoria atrás do proxy
- [ ] R10 abas respondem ao hash (ou rotas reais)
- [ ] U1–U9 conferidos
- [ ] F2 origem gravada num cadastro de teste vindo de `?utm_source=google&gclid=teste`
- [ ] Build, lint e testes passando

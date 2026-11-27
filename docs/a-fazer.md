# A fazer

Lista viva do que está aberto. O primeiro item sem `[x]` é o próximo passo. Item concluído vai
para a [linha de desenvolvimento](linha-de-desenvolvimento.md) e sai daqui no fim da rodada. A
lista anterior (11/11 a 24/11) está em [historico/a-fazer-2026-11.md](historico/a-fazer-2026-11.md).

**Não escreva senhas, tokens nem chaves aqui:** este arquivo vai para o git.

## Plano multissegmento (pedido do dono em 27/11/2026)

Detalhe, esforço, riscos e perguntas de cada fase em
[plano-multissegmento.md](plano-multissegmento.md). Cada fase só começa com a aprovação do dono.

- [x] **Fase 0 · Documentação para IA e automação** (27/11/2026)
- [ ] **Licenças** (aprovadas pelo dono em 27/11; ADR 0015, levantamento em `concorrentes-e-precos.md`)
  - [x] Nome pelo segmento; preços por licença; Atendimento a R$ 49,90 por número
  - [x] PR 1: licença na conta, preços e limites por licença, troca só pela administração, cadastro com `?licenca=`, venda presencial com licença
  - [x] PR 2: proteção dos números de WhatsApp (aquecimento, ritmo, "digitando...", repetida, pausa por risco)
  - [x] PR 3: Licença Atendimento com o menu enxuto e o plano Agenda sem Automações para quem assina a partir de agora
  - [ ] PR 4: duas contas com um login só (seletor no menu do usuário) e 20% na segunda conta
  - [ ] A licença nas métricas e no funil da administração (`plataforma_contas()` ainda não traz; hoje todas as contas são Barbearia)
  - [ ] Páginas de vendas por licença (Fase 5), cada uma com o link de cadastro da licença
  - [ ] IA com créditos pré-pagos como complemento de todas as licenças, inclusive Atendimento (Fase 4)
- [ ] **Fase 1 · Multissegmento** (aprovada em 27/11; ordem 1a → 1b → 1d estética)
  - [x] 1a, PR 1: papel `barbeiro` → `profissional` no banco e no código (S4)
  - [x] 1a, PR 2: segmento na conta, vocabulário por segmento, funções por conta, escolha em Configurações e o primeiro lote de telas (Configurações, Equipe, Perfil, menu do usuário, Resultados, Resumo do dia)
  - [x] 1a, PR 3: as demais telas, o bot, a Ajuda, o site, o relatório e a comanda impressa com o vocabulário (S3) e o detector de "barbeiro" fixo no `regras:conferir` (S6)
  - [ ] Ficaram para a 1b: o cadastro público ("Nome da barbearia", escolha do segmento), os e-mails do sistema (`modelos-email.ts`) e o e-mail "próximo passo" (a função `plataforma_contas()` não traz o segmento)
- [ ] **Fase 2 · Interface mais simples** (aguardando aprovação; depende das decisões da Fase 1)
- [ ] **Fase 3 · Mentoria financeira** (aguardando aprovação)
- [ ] **Fase 4 · IA opcional** (aguardando aprovação; muda a ADR 0007)
- [ ] **Fase 5 · Landing page e marca** (por último)

## Pendências do dono (dados e produção)

- [ ] Trocar a senha do root da VPS (ficou registrada numa conversa em 24/11) e, quando quiser,
      tirar o acesso da chave `claude-codespace-pente-fino` do `deploy`
- [ ] Teste de restauração do backup a partir da cópia externa (`./restaurar.sh --teste --externo`)
- [ ] Página "Sobre" (N5): quem faz o Pente Fino, por que existe e de qual cidade
- [ ] Depoimentos reais (pelo menos dois, autorizados)
- [ ] Google Search Console e Bing Webmaster Tools; o TXT de verificação do Google no DNS
- [ ] Tag Assistant e o valor da conversão no Google Ads
- [ ] DNS AAAA / IPv6, se a Saúde do sistema avisar
- [ ] Limpar a comanda de teste e o caixa de 11/11 em produção

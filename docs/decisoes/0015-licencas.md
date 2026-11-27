# 0015 · Licenças: o tipo de negócio é o produto contratado

- **Status:** Aceita (substitui a parte de "o dono pode trocar de segmento" da 0014)
- **Data:** 2026-11-27

## Contexto

Com a Fase 1a, o dono podia trocar o tipo de negócio em Configurações. O dono do produto achou
isso estranho ("mudar tipo de negócio no menu de configuração é meio paia") e quer vender planos
por produto: os recursos de uma barbearia não são os de uma clínica de estética, e cada produto
precisa do seu preço. Pediu também um produto só de atendimento no WhatsApp (o bot), para
qualquer segmento, e que uma pessoa com dois negócios tenha duas contas com um login só.

Levantamento de preços dos concorrentes e o que falta para competir: `docs/concorrentes-e-precos.md`.

## Decisão

- **Pente Fino é a marca; o que ela vende são licenças**, nomeadas pelo segmento: Barbearia,
  Beleza (salão, unhas e sobrancelhas), Estética, Tatuagem, Fitness (academia e personal) e
  **Atendimento** (só o bot, para qualquer segmento). Na assinatura: *Pente Fino · Licença
  Estética · Pro*.
- **`conta.licenca`** define a tabela de preços, os planos à venda e o que o sistema traz;
  **`conta.segmento`** continua definindo o vocabulário (0014). A licença aceita só os segmentos
  dela (`SEGMENTOS_DA_LICENCA`); Atendimento aceita todos.
- **Só a administração troca a licença** (`PUT /admin/contas/:id/licenca`, com motivo, auditada;
  função `plataforma_mudar_licenca`). O seletor de Configurações sai; o dono vê a licença e liga
  funções (`PUT /conta/funcoes`).
- **A licença nasce na venda:** o link de cadastro traz `?licenca=` (e `?segmento=`) da página de
  vendas; a venda presencial escolhe na administração.
- **Preços aprovados** (`PRECOS_LICENCA` em `packages/shared/src/licencas.ts`; tabela gerada em
  `docs/gerado/planos.md`): Barbearia e Beleza com a tabela de sempre; Estética R$ 14,90 / 89,90 /
  169,90 / 279,90; Tatuagem R$ 10 / 69,90 / 129,90 / 219,90; Atendimento R$ 49,90 por número de
  WhatsApp, com as Automações dentro, 3 profissionais por número e número extra a R$ 29,90.
  Fitness fica fora da venda até a Fase 1c (check-in, turmas e treino).
- **Complementos de todas as licenças:** Automações (onde não vêm incluídas), unidade extra,
  segunda conta com 20% de desconto e, na Fase 4, créditos de IA.

## Consequências

- Uma barbearia nunca vê preço nem recurso de clínica, e vice-versa; cada página de vendas leva
  ao cadastro com a licença certa.
- Contas existentes viram Licença Barbearia (ou a licença do segmento que já tinham escolhido),
  sem mudar preço nem nada na tela.
- Trocar de negócio passa pelo suporte, que vê o plano compatível e o novo preço no Asaas.
- Próximos passos: o menu enxuto da Licença Atendimento, a proteção dos números de WhatsApp,
  duas contas com um login e a licença nas métricas da administração (a função
  `plataforma_contas()` ainda não traz a licença; hoje todas as contas são Barbearia).

<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->

# Planos e recursos

Fonte: `packages/shared/src/planos.ts` (a API confere com `temRecurso` e `verificarLimite`; o site e a tela de assinatura leem os mesmos dados).

| Plano | Mensal | Anual (por mês) | Unidades | Profissionais |
| --- | --- | --- | --- | --- |
| Agenda | R$ 10,00 | R$ 8,25 | 1 | 2 |
| Básico | R$ 79,90 | R$ 66,90 | 1 | 3 |
| Pro | R$ 149,90 | R$ 124,90 | 1 | 10 |
| Premium | R$ 249,90 | R$ 207,90 | ilimitado | ilimitado |

Unidade extra (Premium): R$ 99,90 por mês (R$ 82,90 no anual). Automações à parte nos planos Agenda e Básico: R$ 10,00 por mês (R$ 8,25 no anual), destravam bot, listaEspera, avaliacoes, automacoes; no Agenda, só para quem já tinha (desde 27/11/2026 quem quer só o bot assina a Licença Atendimento, `podeContratarAutomacoes`). Teste grátis: 14 dias.

## Preço por licença (ADR 0015)

Fonte: `packages/shared/src/licencas.ts`. Barbearia e Beleza usam a tabela acima (com vigência); as demais, a tabela da licença. Mensal / anual por mês.

| Licença | Para quem | À venda | Agenda | Básico | Pro | Premium |
| --- | --- | --- | --- | --- | --- | --- |
| Barbearia | barbearias | sim | R$ 10,00 / R$ 8,25 | R$ 79,90 / R$ 66,90 | R$ 149,90 / R$ 124,90 | R$ 249,90 / R$ 207,90 |
| Beleza | salões de beleza, unhas e sobrancelhas | sim | R$ 10,00 / R$ 8,25 | R$ 79,90 / R$ 66,90 | R$ 149,90 / R$ 124,90 | R$ 249,90 / R$ 207,90 |
| Estética | clínicas de estética | sim | R$ 14,90 / R$ 12,40 | R$ 89,90 / R$ 74,90 | R$ 169,90 / R$ 141,90 | R$ 279,90 / R$ 232,90 |
| Tatuagem | estúdios de tatuagem e piercing | sim | R$ 10,00 / R$ 8,25 | R$ 69,90 / R$ 57,90 | R$ 129,90 / R$ 107,90 | R$ 219,90 / R$ 182,90 |
| Fitness | academias, estúdios e personal trainers | não | — | R$ 149,90 / R$ 124,90 | R$ 249,90 / R$ 207,90 | R$ 349,90 / R$ 290,90 |
| Atendimento | qualquer negócio que só quer o atendimento no WhatsApp | sim | R$ 49,90 / R$ 41,90 | — | — | — |

Licença Atendimento: as Automações vêm no preço, 3 profissionais por número de WhatsApp e número extra a R$ 29,90 por mês (R$ 24,90 no anual).

## Recursos conferidos pela API

| Recurso | O que é | A partir de |
| --- | --- | --- |
| `operacao` | Comanda, caixa do dia, despesas e resultados do mês | Básico |
| `comissoes` | Comissão automática por item, com extrato de cada profissional | Básico |
| `metas` | Metas por unidade e serviço, com ritmo e projeção | Pro |
| `clube` | Clube de assinatura: planos, combos e convênios | Pro |
| `bot` | Bot de WhatsApp sem custo por mensagem | Pro |
| `listaEspera` | Lista de espera: o horário que vaga vai para quem pediu | Pro |
| `fichaProfissional` | Ficha e ranking de cada profissional | Pro |
| `avaliacoes` | Pesquisa depois do atendimento, com as notas | Pro |
| `canais` | Agendamentos por canal: balcão, WhatsApp e site | Pro |
| `rede` | Várias unidades e painel da rede | Premium |
| `lucroReal` | Lucro real e margem por serviço e produto | Premium |
| `automacoes` | Automações do bot: retorno, aniversário e aviso do clube | Pro |

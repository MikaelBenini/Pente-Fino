<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->

# Planos e recursos

Fonte: `packages/shared/src/planos.ts` (a API confere com `temRecurso` e `verificarLimite`; o site e a tela de assinatura leem os mesmos dados).

| Plano | Mensal | Anual (por mês) | Unidades | Profissionais |
| --- | --- | --- | --- | --- |
| Agenda | R$ 10,00 | R$ 8,25 | 1 | 2 |
| Básico | R$ 79,90 | R$ 66,90 | 1 | 3 |
| Pro | R$ 149,90 | R$ 124,90 | 1 | 10 |
| Premium | R$ 249,90 | R$ 207,90 | ilimitado | ilimitado |

Unidade extra (Premium): R$ 99,90 por mês (R$ 82,90 no anual). Automações à parte nos planos Agenda e Básico: R$ 10,00 por mês (R$ 8,25 no anual), destravam bot, listaEspera, avaliacoes, automacoes. Teste grátis: 14 dias.

## Recursos conferidos pela API

| Recurso | O que é | A partir de |
| --- | --- | --- |
| `operacao` | Comanda, caixa do dia, despesas e resultados do mês | Básico |
| `comissoes` | Comissão automática por item, com extrato do barbeiro | Básico |
| `metas` | Metas por unidade e serviço, com ritmo e projeção | Pro |
| `clube` | Clube da barbearia: assinatura, combos e convênios | Pro |
| `bot` | Bot de WhatsApp sem custo por mensagem | Pro |
| `listaEspera` | Lista de espera: o horário que vaga vai para quem pediu | Pro |
| `fichaProfissional` | Ficha e ranking dos barbeiros | Pro |
| `avaliacoes` | Pesquisa depois do atendimento, com as notas | Pro |
| `canais` | Agendamentos por canal: balcão, WhatsApp e site | Pro |
| `rede` | Várias unidades e painel da rede | Premium |
| `lucroReal` | Lucro real e margem por serviço e produto | Premium |
| `automacoes` | Automações do bot: retorno, aniversário e aviso do clube | Pro |

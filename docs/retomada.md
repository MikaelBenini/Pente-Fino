# Retomada do trabalho (atualizado em 11/11/2026)

Leia este arquivo primeiro ao abrir uma conversa nova. O que falta fazer, e onde parou, está em
[a-fazer.md](a-fazer.md): o primeiro item sem `[x]` é o próximo passo.

## Mapa da documentação

| Documento | Para que serve |
| --- | --- |
| [retomada.md](retomada.md) | Porta de entrada: como trabalhar e onde está cada coisa |
| [a-fazer.md](a-fazer.md) | Lista de trabalho temporária: checklist do que falta, marcado ao concluir |
| [verificacao-final.md](verificacao-final.md) | Conferência de ponta a ponta do ecossistema, feita por último (temporária) |
| [CLAUDE.md](CLAUDE.md) | Stack, comandos, regras de negócio que não podem quebrar e convenções |
| [documentacao-do-produto.md](documentacao-do-produto.md) | PRD, TRD, fluxos, UI/UX, esquema, preços: como o produto funciona |
| [linha-de-desenvolvimento.md](linha-de-desenvolvimento.md) | Histórico definitivo, etapa por etapa, com o que foi feito em cada item |
| [pente-fino-melhorias.md](pente-fino-melhorias.md) | Briefings de 10/11 (painel, admin, site): detalhe de cada ID e tabela de status |
| [producao.md](producao.md) | Operação da VPS, deploy e DNS |
| [restaurar.md](restaurar.md) | Restaurar o backup |
| [../CHANGELOG.md](../CHANGELOG.md) | O que muda para quem usa e opera ("Não publicado" até ir para produção) |

## Como trabalhar com o dono

- Responder sempre em português (pt-BR), inclusive nos avisos curtos entre etapas.
- Um PR por lote. Antes de abrir o PR, rodar tudo em sequência, nunca em paralelo:
  `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, `pnpm test:db`, `pnpm test:e2e`,
  `pnpm build` e `E2E_PORTA_WEB=3100 E2E_PORTA_API=3101 pnpm --filter @pente-fino/web test:e2e`.
  Nunca rodar dois Playwright ao mesmo tempo. Se um teste for interrompido, matar os servidores
  que ficaram nas portas 3100 e 3101.
- O merge é sempre do dono. Não mergear sem uma autorização dele para aquele PR.
- Nunca fazer commit do `.env.example`: a mudança nele é do dono. Nunca mostrar segredos do `.env`.
- Não apagar o banco local de desenvolvimento.
- Toda entrega termina com 2 a 5 sugestões. Só implementar sugestão aprovada; a aprovada entra no
  [a-fazer.md](a-fazer.md).
- Item concluído vira documentação definitiva (CHANGELOG, linha de desenvolvimento e, se mudar
  regra, documentação do produto e CLAUDE.md) e é marcado como feito no [a-fazer.md](a-fazer.md).

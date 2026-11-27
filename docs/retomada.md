# Retomada do trabalho (atualizado em 27/11/2026)

Leia este arquivo primeiro ao abrir uma conversa nova. O que falta fazer, e onde parou, está em
[a-fazer.md](a-fazer.md): o primeiro item sem `[x]` é o próximo passo.

## Mapa da documentação

O mapa completo (produto, arquitetura, regras, fluxos, modelo de dados, decisões e o que é
gerado do código) está em [README.md](README.md). O que falta fazer: [a-fazer.md](a-fazer.md); o
plano em andamento: [plano-multissegmento.md](plano-multissegmento.md).

## Como trabalhar com o dono

- Responder sempre em português (pt-BR), inclusive nos avisos curtos entre etapas.
- Um PR por lote. Antes de abrir o PR, rodar tudo em sequência, nunca em paralelo:
  `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`, `pnpm test:db`, `pnpm test:e2e`,
  `pnpm build`, `pnpm regras:conferir`, `pnpm docs:conferir` e, no navegador, **só os arquivos de teste ligados ao lote**:
  `E2E_PORTA_WEB=3100 E2E_PORTA_API=3101 pnpm --filter @pente-fino/web test:e2e e2e/x.spec.ts ...`.
  A suíte inteira de navegador fica com o CI, que roda num banco limpo; o PR só vai para o merge
  com o CI verde (decisão do dono em 12/11/2026, para encurtar o lote em ~15 min).
  Nunca rodar dois Playwright ao mesmo tempo. Se um teste for interrompido, matar os servidores
  que ficaram nas portas 3100 e 3101.
- O merge é sempre do dono. Não mergear sem uma autorização dele para aquele PR.
- Nunca fazer commit do `.env.example`: a mudança nele é do dono. Nunca mostrar segredos do `.env`.
- Não apagar o banco local de desenvolvimento.
- Toda entrega termina com 2 a 5 sugestões. Só implementar sugestão aprovada; a aprovada entra no
  [a-fazer.md](a-fazer.md).
- Item concluído vira documentação definitiva (CHANGELOG, linha de desenvolvimento e, se mudar
  regra, documentação do produto e CLAUDE.md) e é marcado como feito no [a-fazer.md](a-fazer.md).

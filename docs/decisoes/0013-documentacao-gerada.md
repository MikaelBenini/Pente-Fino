# 0013 · Documentação para IA e parte gerada do código

- **Status:** Aceita
- **Data:** 2026-11-27

## Contexto

Outra IA ou automação precisava entender o sistema só pelos documentos, e a documentação manual ficava para trás.

## Decisão

`CLAUDE.md` e `AGENTS.md` na raiz apontam para `docs/CLAUDE.md`; `docs/README.md` é o mapa. Modelo de dados, rotas da API, telas, planos e menu por papel saem do código (`pnpm docs:gerar`, em `docs/gerado/`) e o CI confere (`pnpm docs:conferir`). Listas de rodadas concluídas vão para `docs/historico/`.

## Consequências

Documentação gerada nunca fica desatualizada; a escrita à mão fica para o porquê (regras, fluxos, decisões).

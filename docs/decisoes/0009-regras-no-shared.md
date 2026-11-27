# 0009 · Regras de cálculo em packages/shared, com teste

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

A mesma conta aparece na API, no worker e na tela; divergência derruba a confiança nos números.

## Decisão

Toda regra de cálculo nova vai para `packages/shared`, com teste unitário antes da tela. Os exemplos de `docs/regras-de-negocio.md` rodam em `exemplos-das-regras.test.ts`.

## Consequências

Uma fonte só para cada número; documentação conferida pelo teste.

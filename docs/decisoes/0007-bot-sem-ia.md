# 0007 · Bot sem IA

- **Status:** Em revisão (Fase 4 do plano multissegmento)
- **Data:** 2026-11-03

## Contexto

Atendimento por IA foi descartado por custo no começo do projeto.

## Decisão

O bot é uma árvore de menus e palavras-chave; pedido em frase e preço direto são regras puras (`pedido-bot.ts`).

## Consequências

Custo zero e comportamento previsível. A Fase 4 propõe IA opcional, desligada por padrão, com o menu como caminho principal e sem pagarmos o consumo do cliente: quando aprovada, uma nova ADR substitui esta.

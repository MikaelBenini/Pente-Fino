# 0003 · Dinheiro em centavos e datas em UTC

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

Ponto flutuante erra centavos; barbearias em fusos diferentes.

## Decisão

Todo valor monetário é inteiro em centavos; percentuais em pontos-base (40% = 4000). Datas em UTC no banco (`timestamptz`); exibição e dias de trabalho em `America/Sao_Paulo` (o fuso da unidade).

## Consequências

Contas exatas e testáveis; formatação sempre por `formatarMoeda`.

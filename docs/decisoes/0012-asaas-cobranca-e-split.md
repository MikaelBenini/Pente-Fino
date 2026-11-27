# 0012 · Cobrança e clube online pelo Asaas, com split

- **Status:** Aceita
- **Data:** 2026-11-08

## Contexto

Cobrar a assinatura do sistema e o clube das barbearias sem segurar o dinheiro delas.

## Decisão

Asaas para a assinatura do Pente Fino e para o clube online, com subconta por barbearia e split direto para a carteira dela. O webhook só usa o evento e o id; os dados são buscados no próprio Asaas.

## Consequências

O Pente Fino nunca custodia o dinheiro do cliente final. Exige conta Asaas de pessoa jurídica.

# 0011 · Catálogo por unidade

- **Status:** Aceita
- **Data:** 2026-11-12

## Contexto

Redes têm serviços e produtos diferentes por endereço.

## Decisão

Cada serviço e produto tem `unidade_ids` ("Disponível em"); comanda, agenda, bot, site e clube só aceitam o que está na unidade. Unidade nova começa vazia e pode copiar o catálogo de outra.

## Consequências

Gravar preço numa unidade põe o serviço nela; a API recusa item fora da unidade (`fora_da_unidade`).

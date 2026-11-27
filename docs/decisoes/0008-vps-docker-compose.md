# 0008 · Hospedagem numa VPS com Docker Compose

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

Custo fixo baixo e previsível no início.

## Decisão

Uma VPS Ubuntu com Docker Compose atrás do Caddy (HTTPS automático): PostgreSQL, Redis, Evolution, API, worker, web e Uptime Kuma. Portas de banco, Redis e Evolution nunca publicadas. Backup diário criptografado com cópia externa.

## Consequências

Simples de operar; cada cliente novo vira margem. Cresce para nuvem gerenciada quando a VPS passar de 70% de uso com frequência.

# 0002 · Multiempresa com Row Level Security

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

Várias barbearias no mesmo banco; um vazamento entre contas seria grave.

## Decisão

Toda tabela de negócio tem `conta_id` com política RLS (`conta_id = conta_atual()`), forçada também para o dono da tabela. A API abre toda transação com `naConta()`, que define `app.conta_id`. O usuário do banco da aplicação não é superusuário. A administração usa outro usuário e funções `SECURITY DEFINER` mínimas. Tabela nova chama `habilitar_isolamento_conta('tabela')` na migração.

## Consequências

O isolamento é garantido pelo banco, não só pelo código. Migração que mexe em dados precisa de `NO FORCE ROW LEVEL SECURITY` temporário. Testes `test:db` tentam ler dados de outra conta.

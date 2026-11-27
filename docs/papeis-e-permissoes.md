# Papéis e permissões

## Na barbearia (painel)

Papéis: **dono**, **gestor**, **recepcao** e **barbeiro** (enum `Papel`). Cada pessoa pode ter
papéis em uma unidade ou em todas (`papel_usuario.unidade_id` vazio = todas). A API confere com
`@Papeis(...)` em cada rota ([gerado/api.md](gerado/api.md)) e com o escopo da unidade
(`exigirUnidade`, `filtroUnidade`); o menu mostra só o que o papel abre
([gerado/menu-por-papel.md](gerado/menu-por-papel.md)), sem cadeado.

| Recurso | Dono | Gestor | Recepção | Barbeiro |
| --- | --- | --- | --- | --- |
| Agenda | todas as unidades | a unidade dele | a unidade dela | só a própria |
| Comandas | tudo | a unidade dele | abrir, receber, fechar | lançar e confirmar as próprias |
| Alterar comanda fechada (reabrir) | sim, com motivo | sim, com motivo | não | não |
| Clientes | todos | a unidade dele | a unidade dela | os que atendeu; telefone pode ficar oculto |
| Preços e custos | editar | ver | ver preço | ver preço; muda o próprio preço no Perfil |
| Preço livre na comanda | sim | sim | sim | só se o dono liberar |
| Financeiro e lucro | tudo | a unidade dele | caixa do dia | não |
| Comissões | todas | a unidade dele | não | só a própria |
| Metas | definir | ver | ver | ver a própria |
| Bot e configurações | sim | bot da unidade | conversas | não |
| Convidar pessoas | dono, gestor, recepção, barbeiro | recepção, barbeiro | não | não |
| Assinatura, importação, acesso do suporte | sim | não | não | não |
| Exportar dados | sim | a unidade dele | não | não |

Regras de código: `podeNaUnidade`, `papeisNaUnidade`, `unidadesPermitidas`, `PODE_CONVIDAR`
(`packages/shared/src/permissoes.ts`); `podeAgirNaComanda` (`comanda.ts`); `menuPara`
(`menu.ts`). O que a recepção vê, dono e gestor também veem (testado em `menu.test.ts`).

Além do papel, o **plano** libera ou não cada recurso (`temRecurso`): ver
[gerado/planos.md](gerado/planos.md). Conta parada (teste vencido, cancelada, bloqueada) fica só
para consulta: lê e exporta, não grava (`AssinaturaGuard`).

## Na plataforma (`/admin`)

Papéis da equipe do Pente Fino (enum `PapelPlataforma`), conferidos pelo `AdminGuard` e por
`@PapeisPlataforma(...)`, com segundo fator obrigatório:

| Papel | O que faz |
| --- | --- |
| admin | tudo na administração |
| vendedor | cria conta, registra pagamento e vê só as contas dele |
| suporte | lê as contas e a saúde do sistema; sem cobrança, configurações nem equipe |
| financeiro | cobranças, pagamentos e nota fiscal de todas as contas; sem equipe nem configurações |

A administração usa outro usuário de banco (`pente_fino_plataforma`) e só enxerga o que as
funções `SECURITY DEFINER` (`plataforma_*`) entregam. Ver o painel de uma barbearia só com o
acesso de suporte liberado pelo dono, somente leitura e registrado nas duas auditorias.

## Cliente final

Não tem login. Age pelo link de agendamento, pelo link do horário (`/horario?t=`, token de uso
próprio, só o hash fica no banco) e pelo WhatsApp, sempre limitado aos próprios horários.

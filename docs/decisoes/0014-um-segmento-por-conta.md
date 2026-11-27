# 0014 · Um segmento por conta

- **Status:** Aceita
- **Data:** 2026-11-27

## Contexto

O Pente Fino passa a atender vários segmentos (barbearia, salão de beleza, estética, unhas e
sobrancelhas, tatuagem e piercing, academia e estúdio, personal trainer). O dono perguntou se uma
conta precisa de mais de um segmento e deixou a decisão com o desenvolvimento: "difícil ter uma
barbearia e uma estética".

## Decisão

Cada conta tem **um segmento** (`conta.segmento`), que define o vocabulário (profissional,
cliente, atendimento), o catálogo inicial, as mensagens do bot e as funções ligadas por padrão.
Negócio misto (barbearia que vende pacotes, salão com estética) liga as **funções** de que
precisa (`conta.funcoes`: pacotes, anamnese, fotos, check-in, turmas...), sem trocar de segmento.
Rede com negócios realmente diferentes usa uma conta por negócio.

## Consequências

- Vocabulário, relatórios e site ficam coerentes dentro da conta (nada de "barbeiro" numa unidade
  e "esteticista" em outra na mesma tela).
- ~~O dono pode trocar de segmento depois.~~ Desde a [0015](0015-licencas.md), o segmento vem
  da licença contratada e só a administração troca (os dados ficam).
- Segmento por unidade fica descartado; se aparecer demanda real, vira uma decisão nova.

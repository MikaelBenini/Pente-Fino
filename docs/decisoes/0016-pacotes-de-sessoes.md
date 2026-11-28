# 0016 · Pacotes de sessões: igual ao clube nos números

- **Status:** Aceita
- **Data:** 2026-11-28

## Contexto

A Fase 1d (estética) precisa de pacotes: o cliente paga antes um número de sessões de um serviço
("10 drenagens por R$ 1.000") e usa até a validade. Clínicas de estética e estúdios de unhas
vendem assim, e os concorrentes do segmento (Trinks, Avec) têm. A dúvida era como o dinheiro
entra nos números: no dia da venda ou aos poucos, a cada sessão.

## Decisão

O dono escolheu **"igual ao clube"** (28/11/2026):

- O valor do pacote **entra no faturamento no dia em que é pago**, numa linha própria ("Pacotes"),
  como a mensalidade do clube. Cancelar depois não tira o que entrou; devolução é despesa.
- A sessão usada sai na comanda com **valor zero**, conta como **cliente e atendimento**, fica
  **fora do ticket médio** e paga **comissão sobre o preço de tabela** da unidade na data.
- O saldo é lido das comandas não canceladas (`usadasDoPacote`), nunca de um contador: cancelar
  ou reabrir a comanda já corrige.
- O serviço do cliente usa primeiro o clube, depois o pacote que vence primeiro, e o resto com
  preço normal (`partesDoServico`).
- É uma **função da conta** (`pacotes`): ligada de saída na estética e em unhas; qualquer negócio
  liga em Configurações. A API recusa cadastro e venda com a função desligada.

## Consequências

- O mês da venda fica maior e os seguintes, menores, como no clube; o dono vê as sessões usadas
  no cartão "Pacotes" de Resultados.
- O caixa do dia não mostra a venda do pacote (igual à mensalidade do clube no balcão). Se o dono
  pedir, a venda passa a gerar um pagamento no caixa.
- Próximos passos possíveis: pacote com vários serviços, aviso de saldo acabando pelo WhatsApp e
  venda do pacote no link público.

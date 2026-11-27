# Concorrentes, preços e como competir por segmento

> Levantamento de 27/11/2026, feito na web a pedido do dono. Os preços vêm dos sites dos
> fornecedores ou de comparativos publicados por eles mesmos (tendem a favorecer quem publica):
> **confirmar no site de cada um antes de anunciar**. Refazer a cada 6 meses.
>
> Nada aqui está aprovado ainda: a proposta de preço e a estrutura de marca e licenças esperam a
> decisão do dono (ver `a-fazer.md`). Quando aprovado, vira uma decisão em `decisoes/` e os
> preços entram em `packages/shared/src/planos.ts`.

## 1. O que o mercado cobra (por mês)

| Segmento | Concorrente | Preço | Observação |
| --- | --- | --- | --- |
| Barbearia | AppBarber | R$ 79,90 (1 profissional), R$ 109,90 (2 a 5), R$ 164,50 (6 a 15), R$ 219,90 (16+) | anual com 30% de desconto (R$ 55,90 para 1 profissional) |
| Barbearia | Trinks | R$ 94 (1 a 2), R$ 136 (3 a 4), R$ 230 (5 a 10) | outra fonte: R$ 110 mensal / R$ 76 anual para 1 a 2; acima disso, sob consulta |
| Barbearia | BestBarbers | a partir de R$ 299 | tudo incluso, sem implantação |
| Barbearia | Cash Barber | a partir de R$ 300 | inclui cursos e mentoria |
| Salão e unhas | AppBeleza | mesmas faixas do AppBarber | |
| Salão e unhas | Trinks | mesmas faixas acima | |
| Estética | Iter Clinic | R$ 69 (solo), R$ 99 (até 3), R$ 169 (até 6) | anual a partir de R$ 39 |
| Estética | CM Gestão | R$ 59,90 (1), R$ 159,90 (até 3) | |
| Estética | Clinicorp | R$ 159,90 (Standard), R$ 369,90 (Premium) | + implantação obrigatória |
| Estética | FLEXUS | R$ 99, R$ 199 (equipes), R$ 379 (Enterprise) | |
| Estética | Clínica Experts | a partir de R$ 249 (anual) | |
| Estética | EsteticFlow | R$ 29,90 a R$ 99,90 | mais simples |
| Estética | Belle Software | sob consulta | redes e franquias |
| Tatuagem | TattFlow | R$ 49,90, usuários ilimitados | preço de lançamento |
| Tatuagem | Simples Agenda | R$ 59,90 (1 profissional) | sobe por profissional |
| Tatuagem | Fragasoft | R$ 120 por empresa | |
| Tatuagem | E-condo Tattoo | R$ 129 (até 3), R$ 299, R$ 499 | |
| Personal | MFIT | grátis (1 aluno), R$ 10,90 (até 3), R$ 39,90 (ilimitado) | app de treino |
| Personal | Tecnofit Personal | grátis (até 5 alunos), R$ 24,90 a R$ 36,90 | |
| Academia e estúdio | Tecnofit | ~R$ 3,38 por aluno ativo (R$ 269 para 50 alunos) | + implantação; outra fonte: a partir de R$ 189 |
| Academia e estúdio | Next Fit | sob consulta (demonstração) | |

## 2. Proposta de preço por licença (a aprovar)

Mesma lógica de hoje (Agenda, Básico, Pro, Premium; limite de profissionais; anual ~17% mais
barato; Automações à parte no Agenda e no Básico). O preço sobe só onde a licença entrega mais.

| Licença | Agenda | Básico | Pro | Premium | Posição |
| --- | --- | --- | --- | --- | --- |
| Barbearia (hoje) | R$ 10 | R$ 79,90 | R$ 149,90 | R$ 249,90 | igual ao AppBarber no preço, com lucro real, clube e bot; abaixo de BestBarbers e Cash Barber |
| Beleza (salão e unhas) | R$ 10 | R$ 79,90 | R$ 149,90 | R$ 249,90 | mesmo preço de Trinks e AppBeleza |
| Estética | R$ 14,90 | R$ 89,90 | R$ 169,90 | R$ 279,90 | abaixo de Clinicorp (sem implantação) e FLEXUS Pro; Pro com 10 profissionais contra 6 do Iter Gold |
| Tatuagem | R$ 10 | R$ 69,90 (até 3) | R$ 129,90 (até 10) | R$ 219,90 | abaixo do E-condo para o mesmo tamanho |
| Academia e estúdio | — | R$ 149,90 (até 100 alunos) | R$ 249,90 (até 300) | R$ 349,90 (ilimitado) | limite por aluno ativo; sem implantação (a Tecnofit cobra) |
| Personal | R$ 19,90 | R$ 39,90 | — | — | só depois da montagem de treino (Fase 1c) |

**Segunda conta** (mesmo login, outro negócio): 20% de desconto na mensalidade dela.

**Por que fecha a conta para nós:** uma VPS atende muitas contas, o WhatsApp não cobra por
mensagem (Evolution API) e não há implantação. Mesmo a R$ 69,90 sobra margem para o suporte.
Receitas fora da mensalidade: Automações (R$ 10) e créditos de IA (Fase 4).

## 3. O que falta para competir em cada segmento

Preço baixo não basta: a licença precisa ter o que o concorrente tem. ✅ já existe, 🟡 existe em
parte, ❌ falta.

### Barbearia (pronta para vender)

- ✅ agenda, link, site, comanda única, caixa, comissão, clube com cobrança, bot sem custo por
  mensagem, lucro real por serviço, várias unidades.
- Diferencial sobre AppBarber e Trinks: lucro real e bot incluso. Sobre BestBarbers e Cash
  Barber: metade do preço.
- 🟡 app próprio com a marca da barbearia (BestBarbers vende isso): hoje é PWA com o nosso nome.

### Beleza: salão e unhas (quase pronta)

- ✅ tudo da barbearia, com o vocabulário do segmento.
- ❌ pacotes de sessões (manicure mensal, escova progressiva em etapas): função `pacotes`.
- 🟡 catálogo de serviços pronto para salão e unhas (Fase 1b).

### Estética (Fase 1d)

- ❌ ficha de anamnese por cliente, com modelo editável (todos os concorrentes têm).
- ❌ fotos de antes e depois na ficha do cliente.
- ❌ pacotes de sessões com saldo (vende 10, usa 1 por vez).
- ❌ termo de consentimento com aceite do cliente.
- 🟡 prontuário / evolução por sessão (anotação na comanda existe, falta histórico organizado).
- Diferencial: lucro real por procedimento (custo de produto já é calculado), bot e clube.

### Tatuagem

- ✅ sinal (pagamento adiantado) e agenda por profissional.
- ❌ orçamento com fotos de referência e aprovação do cliente.
- ❌ projeto em várias sessões (uma tatuagem, vários horários, um preço).
- ❌ termo de consentimento (menor de idade, saúde).
- 🟡 portfólio por tatuador no site (a equipe aparece, falta galeria por pessoa).

### Academia e estúdio (Fase 1c)

- 🟡 mensalidade recorrente (o clube online com Pix e cartão serve de base).
- ❌ check-in do aluno (QR na recepção ou no app) e controle de frequência.
- ❌ turmas e aulas com vagas (agenda coletiva).
- ❌ limite e preço por aluno ativo.
- Fora do escopo por enquanto: integração com catraca.

### Personal (Fase 1c)

- ❌ montagem de treino e app do aluno: sem isso, não compete com MFIT e Tecnofit Personal.
- ❌ avaliação física.
- ✅ agenda, cobrança e lembrete no WhatsApp.

## 4. Marca e licenças (ideias, para o dono decidir)

A ideia do dono: **Pente Fino é a marca**, e o que ela vende são **licenças** do sistema. Cada
licença é o sistema configurado para um tipo de negócio.

**Estrutura sugerida (quatro camadas):**

1. **Marca:** Pente Fino. Frase: *"Seu negócio no pente fino."* (vale para qualquer segmento:
   passar o pente fino nas contas).
2. **Licença** (o tipo de negócio): define vocabulário, funções e catálogo inicial.
3. **Plano** (o tamanho): Agenda, Básico, Pro, Premium.
4. **Complementos:** Automações, créditos de IA, unidade extra, segunda conta.

Na assinatura aparece assim: *Pente Fino · Licença Estética · Pro*.

**Como chamar as licenças:**

| Opção | Barbearia | Salão e unhas | Estética | Tatuagem | Academia e personal | Prós e contras |
| --- | --- | --- | --- | --- | --- | --- |
| A. Pelo segmento | Licença Barbearia | Licença Beleza | Licença Estética | Licença Tatuagem | Licença Fitness | claro e bom para busca no Google; pouco charme |
| B. Ferramenta do ofício | Navalha | Escova | Pele | Nanquim | Fôlego | memorável, o cliente se reconhece; precisa explicar na primeira vez |
| C. Material e cor | Cobre | Rosa | Pérola | Nanquim | Aço | soa premium e combina com as cores do site; não diz o segmento |
| D. Inglês curto | Barber | Beauty | Clinic | Ink | Fit | moderno, curto; foge do português do resto do produto |

Possível combinação: **nome da licença pela opção B, com o segmento ao lado na venda**
("Pente Fino Navalha, para barbearias"), o que junta charme e busca no Google.

Antes de escolher: conferir INPI e domínios .com.br dos finalistas.

## Fontes

- [Iter Clinic: comparativo para clínica de estética](https://www.iterclinic.com/comparativo/melhores-sistemas-para-clinica-de-estetica)
- [Iter Clinic: os 6 melhores sistemas para clínica estética](https://www.iterclinic.com/blog/os-6-melhores-sistemas-de-gestao-para-clinica-estetica-no-brasil-testados-em-2026)
- [Harmony: sistemas para clínica de estética](https://www.harmonyapp.com.br/melhores-sistemas-para-clinica-de-estetica)
- [CM Gestão: quanto custa](https://cmgestao.net/blog/quanto-custa-software-gestao-clinica-aba-guia-precos-2026.html)
- [EsteticFlow: preços](https://www.esteticflow.com.br/precos)
- [FLEXUS: estéticas](https://xfts-flexus.com/produtos/gestao-esteticas)
- [AppBarber / AppBeleza: planos](https://appbarber-appbeleza.zendesk.com/hc/pt-br/articles/360001701331-Planos-e-Pre%C3%A7os-do-Sistema)
- [Eicortei: quanto custa o AppBarber](https://eicortei.com.br/blog/quanto-custa-o-appbarber)
- [Trinks: sistema para barbearia](https://www.trinks.com/negocios/sistema-para-barbearia)
- [BarbeiroApp: alternativas ao Trinks](https://www.barbeiro.app/alternativas/trinks)
- [BestBarbers: comparativo 2026](https://www.bestbarbers.app/blog/melhor-sistema-barbearia-2026)
- [Cash Barber](https://sistemacashbarber.com.br/)
- [TattFlow](https://www.tattflow.com.br/)
- [Fragasoft: tatuagem](https://www.fragasoft.com.br/fabrica-40/tatuagem)
- [Simples Agenda: tatuagem](https://www.simplesagenda.com.br/site/sistema-para-estudio-de-tatuagem.php)
- [E-condo Tattoo](https://tattoo.e-condo.com/)
- [Welltrainer: alternativas ao MFIT](https://welltrainer.com.br/alternativas-ao-mfit/)
- [Welltrainer: apps para personal](https://welltrainer.com.br/melhor-app-para-personal-trainer/)
- [TreinoAI: apps para personal 2026](https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026)
- [Tecnofit: preços](https://www.tecnofit.com.br/precos/)

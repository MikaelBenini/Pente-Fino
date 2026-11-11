# Pente Fino — briefing de melhorias do site (seupentefino.com.br)

> **Para o Claude Code.** Este documento lista tudo o que deve ser corrigido, mudado e melhorado no site público do Pente Fino (home, /planos, /cadastro e páginas novas). Cada item traz: **o problema**, **o que fazer**, **onde mexer** (quando foi possível identificar) e **como validar**.
>
> Origem: auditoria feita em 10/11/2026 no navegador (desktop e celular 375 px), leitura do HTML, `robots.txt`, `sitemap.xml`, JSON-LD, e comparação com AppBarber, Trinks, Booksy, ZapCorte e EiBarber.
>
> **Regras gerais para executar este briefing**
> - Stack observada: Next.js (App Router, build com Turbopack), Tailwind, ícones `lucide`, GTM `GTM-WKWRDX4R` e Google Ads `AW-18558704295`. Confirme no repositório antes de mudar.
> - **Não invente dados.** Nada de depoimentos, número de clientes, notas ou logos fictícios. Onde o conteúdo depende do dono do negócio, crie a estrutura (componente + arquivo de dados) e deixe `TODO` claro.
> - Itens marcados **[DECISÃO DO DONO]** dependem de escolha comercial. Implemente a opção padrão indicada, isolada atrás de uma constante/flag fácil de trocar.
> - Mantenha o tom de voz atual (frases curtas, concretas, "você"). O texto do site é bom; o problema é coerência, não estilo.
> - Faça commits pequenos, um por item, com mensagem citando o ID (ex.: `fix(B1): página 404 real`).
> - Ao final, rode build, lint e os testes existentes, e entregue a checklist de validação (seção 9) preenchida.

---

## Índice

1. [Prioridade e ordem de execução](#1-prioridade-e-ordem-de-execução)
2. [Bugs e erros (B1–B8)](#2-bugs-e-erros)
3. [Coerência entre promessa e planos (P1–P4)](#3-coerência-entre-promessa-e-planos)
4. [Conversão e confiança (C1–C7)](#4-conversão-e-confiança)
5. [SEO técnico (S1–S6)](#5-seo-técnico)
6. [SEO de conteúdo: páginas novas (N1–N5)](#6-seo-de-conteúdo-páginas-novas)
7. [Rastreamento e medição (T1–T4)](#7-rastreamento-e-medição)
8. [Desempenho, acessibilidade e detalhes (D1–D6)](#8-desempenho-acessibilidade-e-detalhes)
9. [Checklist final de validação](#9-checklist-final-de-validação)
10. [Anexo: contexto competitivo](#10-anexo-contexto-competitivo)

---

## 1. Prioridade e ordem de execução

| Ordem | IDs | Por quê |
| --- | --- | --- |
| 1º (hoje) | B2, C1, B3, C2, C3 | Textos contraditórios e oferta invisível custam vendas agora; os anúncios do Google já prometem bot de WhatsApp e 30% off. |
| 2º | B1, B4, B5, B6, P1, P2 | Erros que afetam SEO, iPhone e expectativa do cliente. |
| 3º | C4–C7, S1–S6, T1–T4 | Confiança, medição e base técnica para crescer. |
| 4º | N1–N5, P3, P4, D1–D6 | Conteúdo novo e ajustes finos. |

---

## 2. Bugs e erros

### B1 — Não existe página 404 (soft 404 para /entrar)

- **Problema:** qualquer URL inexistente (ex.: `/blog`, `/pagina-que-nao-existe`) redireciona para `/entrar?voltar=%2F...` e responde **200**. O visitante cai numa tela de login sem entender; o Google pode tratar como *soft 404* e o link quebrado de um anúncio ou post perde o visitante.
- **Causa provável:** um `middleware.ts` (ou layout de rota protegida) que manda tudo que não é público para o login, inclusive rotas que não existem.
- **O que fazer:**
  1. No middleware, só redirecionar para `/entrar` as rotas **realmente protegidas** (prefixos `/app`, `/convite`, `/redefinir-senha`, `/agendar` e o que mais existir no app). Todo o resto deve seguir o roteamento normal.
  2. Criar `app/not-found.tsx` com status 404 real: título "Página não encontrada", uma frase, e três links (Home, Planos, Testar grátis), no mesmo layout/estilo do site.
  3. Garantir `<meta name="robots" content="noindex">` na 404.
- **Validar:** `curl -I https://seupentefino.com.br/qualquer-coisa` retorna `404`; `/app` sem login continua indo para `/entrar`.

### B2 — FAQ de /planos diz que o bot de WhatsApp "está em construção"

- **Problema:** em /planos, a pergunta "O bot de WhatsApp cobra por mensagem?" termina com: *"O bot está em construção e chega para os planos Pro e Premium sem custo extra."* A home, a tabela de planos e os anúncios dizem que o bot funciona. O dono confirmou que **funciona**.
- **O que fazer:** trocar a última frase por: *"Está incluso no Pro e no Premium, sem custo extra."* Procurar no repositório qualquer outro "em construção"/"em breve" relacionado ao bot e alinhar.
- **Validar:** `grep -ri "em construção" ` não retorna nada sobre o bot.

### B3 — Cupom aplicado no cadastro não mostra o desconto

- **Problema:** `/cadastro?cupom=LANCAMENTO` preenche o campo "Cupom de desconto", mas os cards de plano continuam mostrando R$ 79,90 / 149,90 / 249,90. Quem clicou em "30% off para sempre" não vê o desconto e desconfia.
- **O que fazer:**
  1. Quando houver cupom válido (vindo da URL ou digitado), mostrar em cada plano o preço cheio riscado e o preço com desconto, ex.: ~~R$ 149,90~~ **R$ 104,93/mês**, e uma linha "30% de desconto para sempre aplicado (LANCAMENTO)".
  2. Validar o cupom do lado do servidor (endpoint existente ou novo) e mostrar erro amigável se inválido/expirado. A oferta vale até **31/01/2027**: após essa data o cupom deve ser recusado e o texto some.
  3. Centralizar preços e o cupom numa única fonte (ex.: `lib/precos.ts`), usada pela home, /planos, /cadastro e JSON-LD. Hoje os mesmos números aparecem em vários lugares.
- **Cálculo (arredondar para 2 casas, confirmar regra de arredondamento usada na cobrança):**

  | Plano | Mensal cheio | Mensal −30% | Anual (por mês) | Anual −30% (por mês) |
  | --- | --- | --- | --- | --- |
  | Básico | 79,90 | 55,93 | 66,90 | 46,83 |
  | Pro | 149,90 | 104,93 | 124,90 | 87,43 |
  | Premium | 249,90 | 174,93 | 207,90 | 145,53 |
  | Unidade extra (Premium) | 99,90 | 69,93 | 82,90 | 58,03 |

  > Confirme com o código de cobrança se o desconto incide também sobre o anual e sobre unidades extras. Se não incidir, mostre só onde incide.
- **Validar:** abrir `/cadastro?cupom=LANCAMENTO`, `/cadastro?cupom=INVALIDO` e `/cadastro` sem cupom; conferir preços e mensagens.

### B4 — JSON-LD com preço diferente do exibido

- **Problema:** o `SoftwareApplication` declara `"offers": {"price": "79.90"}`, mas a página abre no ciclo **anual** mostrando R$ 66,90. Divergência de preço entre dados estruturados e página pode gerar aviso no Search Console e em anúncios.
- **O que fazer:** trocar por `AggregateOffer` gerado a partir de `lib/precos.ts`:
  ```json
  {
    "@type": "AggregateOffer",
    "priceCurrency": "BRL",
    "lowPrice": "66.90",
    "highPrice": "249.90",
    "offerCount": 3
  }
  ```
  Opcional: listar cada plano como `Offer` com `name`, `price` e `priceSpecification` (`UnitPriceSpecification`, `billingDuration` P1M).
- **Validar:** Rich Results Test e Schema Markup Validator sem erros.

### B5 — Vídeo "Ver em 1 minuto" só em WebM

- **Problema:** `<video>` tem apenas `/video/apresentacao.webm`. Safari em iPhones/Macs mais antigos pode não reproduzir, e iPhone é parte grande do público.
- **O que fazer:** gerar `apresentacao.mp4` (H.264 + AAC, `-movflags +faststart`) e usar dois `<source>`: MP4 primeiro para Safari ou WebM primeiro com MP4 de reserva. Manter `poster`, `preload="metadata"`, `controls`, `playsInline`. Adicionar legendas (`<track kind="captions" srclang="pt-BR">`) se houver fala.
- **Validar:** reproduz no Safari iOS, Chrome Android e desktop.

### B6 — "2 meses grátis" não bate com a economia mostrada

- **Problema:** no anual, o Básico mostra "economia de R$ 156,00", mas 2 meses do mensal valem R$ 159,80 (Pro: 300,00 vs 299,80; Premium: 504,00 vs 499,80). Diferença pequena, mas cliente atento nota.
- **O que fazer:** **[DECISÃO DO DONO]** padrão: trocar o selo "2 meses grátis" por "economize até R$ 504/ano" ou "≈ 2 meses grátis". Calcular a economia a partir de `lib/precos.ts`, nunca digitada.

### B7 — Link "Planos" some do menu no celular

- **Problema:** no celular (375 px) o cabeçalho mostra só "Entrar" e "Testar grátis". Quem quer ver preço precisa rolar a página inteira.
- **O que fazer:** manter "Planos" visível no celular (texto curto ou ícone) ou criar menu hambúrguer acessível com Planos, Entrar, Testar grátis. Botões com área de toque ≥ 44 px.
- **Validar:** viewport 375×812, os três destinos alcançáveis no topo.

### B8 — Cadastro não pede celular/WhatsApp

- **Problema:** o cadastro pede nome da barbearia, nome, e-mail e senha. Sem celular não há onboarding ativo nem recuperação de quem abandona o teste. Concorrentes (AppBarber) pedem celular.
- **O que fazer:** adicionar campo **"WhatsApp (opcional)"** com `type="tel"`, `autocomplete="tel"`, máscara BR `(00) 00000-0000`, validação leve, e texto "Para ajudar na configuração. Não enviamos spam." Gravar no cadastro da conta (ajustar backend/migração conforme o projeto). Atualizar a política de privacidade se ela listar os dados coletados.
- **Validar:** cadastro funciona com e sem o campo.

---

## 3. Coerência entre promessa e planos

> Este é o problema mais importante do site. A home vende **lucro e margem por serviço**, mas a tabela de /planos mostra que isso só existe no **Premium (R$ 249,90)**. A home e os anúncios vendem **comissão automática**, mas o **Básico** não tem. Quem assina um plano menor e não encontra o recurso cancela ou reclama.

Tabela atual de recursos (lida de /planos):

| Recurso | Básico | Pro | Premium |
| --- | --- | --- | --- |
| Agenda, comanda automática, caixa, despesas, indicadores, app do barbeiro, PDF, importação | ✓ | ✓ | ✓ |
| Comissão automática + extrato do barbeiro | — | ✓ | ✓ |
| Metas, clube de assinatura, bot de WhatsApp, lista de espera, ranking, pesquisa | — | ✓ | ✓ |
| Várias unidades, preço por unidade | — | — | ✓ |
| **Lucro real e margem por serviço e produto** | — | — | ✓ |
| Automações do bot (retorno, aniversário, aviso do clube) | — | — | ✓ |

### P1 — Sinalizar o plano em toda promessa que não é de todos os planos

- **O que fazer (padrão, sem mudar o produto):** criar um componente `<SeloPlano plano="pro" | "premium" />` (pequeno, discreto, ex.: "Pro+" / "Premium") e aplicá-lo na home junto de:
  - "lucro real por serviço, por barbeiro e por unidade" (hero, subtítulo) → Premium
  - bloco "O que dá lucro, e o que só dá trabalho" → Premium
  - bloco "WhatsApp que agenda sozinho" → Pro+
  - comissão em "O barbeiro lança no celular" e "Cada um vê o que precisa" → Pro+
  - lista de recursos ("Lista de espera", "Avaliação no WhatsApp", "Clube de assinatura", "Várias unidades") → selo conforme a tabela
  - tabela "Mais que uma agenda bonita": coluna Pente Fino com nota "depende do plano" onde couber
- Ler o mapeamento recurso→plano de uma única fonte (ex.: `lib/planos.ts`) para a home e /planos nunca divergirem.

### P2 — [DECISÃO DO DONO] Onde fica o "lucro por serviço"

- Opção A (recomendada para conversão): **incluir lucro e margem por serviço no Pro**, mantendo no Premium só o comparativo entre unidades e o painel da rede. Isso torna a promessa da home verdadeira para o plano "Mais escolhido".
- Opção B: manter só no Premium e reescrever o hero para não prometer a todos, ex.: título igual, subtítulo "…e, no Premium, o lucro real por serviço e por unidade."
- **Implementação:** deixe a escolha numa flag (`LUCRO_POR_SERVICO_NO_PRO = true|false`) que muda a tabela de /planos, os selos de P1 e o JSON-LD. A liberação real do recurso no produto é fora do site público: se a opção A for escolhida, abrir tarefa separada no app.

### P3 — [DECISÃO DO DONO] Plano Básico pouco competitivo

- **Problema:** R$ 79,90 sem comissão e sem bot. Para barbeiro solo, ZapCorte (R$ 69,90) e EiBarber (R$ 49) entregam WhatsApp; AppBarber tem o mesmo preço com mais recursos.
- **Opções:** baixar o Básico (ex.: R$ 59,90) **ou** incluir o bot de WhatsApp no Básico **ou** reposicionar como "Solo" (1 profissional) com bot. No site: só ajustar `lib/precos.ts`/`lib/planos.ts` e textos, depois da decisão.

### P4 — Coerência com os anúncios do Google (já publicados)

Os anúncios ativos usam estes textos; o site precisa confirmar cada um logo que o visitante chega:

- "30% de Desconto Para Sempre", "Assine até 31/01/2027…" → ver C1 e B3
- "Teste 14 Dias Grátis", "Sem Cartão e Sem Fidelidade" → já ok
- "WhatsApp que Agenda Sozinho", "Bot de WhatsApp agenda 24h" → ver B2 e P1 (deixar claro "Pro e Premium")
- "Controle Financeiro Barbearia", "Lucro real por serviço" → ver P1/P2
- "Comissão de Barbeiro na Hora" → selo Pro+ (P1)
- Extensão de preço: Básico/Pro/Premium "a partir de" R$ 66,90 / 124,90 / 207,90 por mês (anual) → manter esses valores no anual
- Sitelinks: `/cadastro?cupom=LANCAMENTO`, `/#video`, `/planos`, `/cadastro`, `/entrar` → garantir que `#video` continue existindo como âncora

---

## 4. Conversão e confiança

### C1 — Mostrar a oferta de lançamento na home

- **Problema:** "30% de desconto para sempre, até 31/01/2027" só aparece em /planos.
- **O que fazer:**
  1. Faixa fina no topo de todas as páginas públicas: "Oferta de lançamento: 30% off para sempre em qualquer plano. Até 31/01/2027." + link "Ativar desconto" → `/cadastro?cupom=LANCAMENTO`. Fechável (guardar em `localStorage` com try/catch).
  2. No bloco de preços da home, repetir a oferta acima dos cards e trocar os CTAs para incluir `cupom=LANCAMENTO`.
  3. Esconder tudo automaticamente após 31/01/2027 23:59 (America/Sao_Paulo), lendo a data de `lib/precos.ts`.
- **Validar:** simular data posterior e conferir que a faixa some.

### C2 — Botão de WhatsApp e canal humano

- **Problema:** o único contato é `contato@seupentefino.com.br`. Para quem vende bot de WhatsApp, não ter WhatsApp no site pesa. AppBarber mostra WhatsApp e telefone.
- **O que fazer:** botão flutuante (canto inferior direito, sem cobrir o CTA no celular) com link `https://wa.me/55XXXXXXXXXXX?text=...`, mensagem pré-pronta "Oi! Vim pelo site e quero saber mais sobre o Pente Fino." Disparar evento GTM `click_whatsapp`. Também no rodapé.
- **TODO:** número oficial — **pedir ao dono**. Deixe em `lib/contato.ts`; se vazio, o botão não renderiza.

### C3 — Rodapé com dados da empresa

- **O que fazer:** adicionar razão social, CNPJ, cidade/UF, e-mail, WhatsApp e redes sociais (Instagram, YouTube). Tudo em `lib/contato.ts`. **TODO: dados reais com o dono**; não renderizar campos vazios.

### C4 — Seção de prova social

- **Problema:** nenhum depoimento, número de clientes, nota ou estudo de caso. É o maior freio de conversão para marca nova.
- **O que fazer:**
  1. Componente `<Depoimentos />` alimentado por `content/depoimentos.ts` (nome, barbearia, cidade/UF, foto opcional, frase, número de destaque opcional, ex.: "descobriu que a barba dava 2× mais margem que o corte").
  2. Renderizar só se houver ao menos 2 itens. **Não criar depoimentos fictícios.** Deixar o arquivo com tipos e comentário `// TODO: preencher com depoimentos reais autorizados`.
  3. Posição: logo após o bloco "Entrou bastante. E quanto ficou?" ou antes dos planos.
  4. Opcional: contador "X barbearias usando" lido de config, só exibido se o dono preencher.

### C5 — Destacar teste e implantação

- Reforçar perto de cada CTA: "Configurado em 10 minutos · atende no mesmo dia · importamos sua planilha". **[DECISÃO DO DONO]** avaliar teste de 21–30 dias (AppBarber e EiBarber dão 30). Deixar a duração em constante única (`DIAS_TESTE = 14`) usada em todos os textos.

### C6 — CTA principal e secundário

- Hero: manter "Testar 14 dias grátis"; o secundário "Ver em 1 minuto" deve rolar suave até o vídeo **e** dar play (com `muted` se autoplay exigir).
- Adicionar CTA ao fim de cada bloco longo (após WhatsApp, após calculadora): "Testar grátis com 30% off".

### C7 — Calculadora "Quanto sobra de cada corte?"

- Hoje é ótima, mas não leva ao cadastro. Após o resultado, mostrar: "O Pente Fino faz essa conta em cada comanda. Testar grátis" com link para cadastro carregando os valores como UTM/param (ex.: `?origem=calculadora`).
- Garantir que inputs aceitam vírgula decimal (formato BR), têm `inputmode="decimal"` e rótulos associados.

---

## 5. SEO técnico

O SEO técnico já está bom (title, description, canonical, `lang="pt-BR"`, um H1, JSON-LD de Organization/SoftwareApplication/FAQPage, WebP com alt, robots e sitemap). Ajustes:

### S1 — Sitemap dinâmico

- Gerar `app/sitemap.ts` com todas as páginas públicas, incluindo as novas da seção 6, com `lastModified` real. Hoje tem só 5 URLs (/, /planos, /cadastro, /termos, /privacidade).

### S2 — Metadados por página

- Cada página nova com `title` (≤ 60 caracteres, termo principal no início), `description` (≤ 155), `canonical`, Open Graph e Twitter. Imagem OG por página (pode reutilizar o gerador `opengraph-image` existente com título dinâmico).

### S3 — Dados estruturados adicionais

- `BreadcrumbList` nas páginas internas.
- `Article` (com `datePublished`, `dateModified`, `author`) nos posts do blog.
- `FAQPage` nas páginas de intenção que tiverem FAQ.
- Corrigir `offers` (B4).

### S4 — Links internos

- Rodapé com seção "Recursos" linkando as páginas da seção 6 e "Comparativos". Cada página nova linka para /planos e /cadastro e para 2–3 páginas irmãs.

### S5 — www e redirecionamentos

- `www.seupentefino.com.br` serve o site com canonical correto. Preferível: redirecionar 301 `www` → raiz para consolidar sinais. Conferir também `http` → `https` (301).

### S6 — robots.txt

- Manter os `Disallow` atuais. Remover os `Allow` redundantes (o `Allow: /` já cobre). Não bloquear `/_next/static`.

---

## 6. SEO de conteúdo: páginas novas

Os concorrentes (ZapCorte, BarbeiroApp, Genda, AppBarber) atraem tráfego orgânico com blogs, comparativos e ferramentas grátis. O Pente Fino não tem nenhuma página além da home e de /planos.

> **Regras para todo o conteúdo novo:** português do Brasil, frases curtas, exemplos com números de barbearia, nada de promessa que o plano não entrega (ver seção 3), CTA para `/cadastro?cupom=LANCAMENTO` enquanto a oferta valer. Estrutura reutilizável: um template `app/(conteudo)/[slug]/page.tsx` + conteúdo em MDX ou arquivos TS.

### N1 — Páginas por intenção de busca (uma por termo dos anúncios)

| Rota sugerida | Termo principal | Foco do texto |
| --- | --- | --- |
| `/sistema-para-barbearia` | sistema para barbearia | visão geral, do agendamento ao lucro |
| `/agenda-online-para-barbearia` | agenda online / agendamento online barbearia | agenda por barbeiro, link, comanda nascendo do horário |
| `/controle-financeiro-barbearia` | controle financeiro / controle de caixa barbearia | caixa do dia, despesas, lucro, relatório do contador |
| `/comissao-de-barbeiro` | comissão de barbeiro | comissão por item, vigência, extrato no celular (Pro+) |
| `/comanda-digital-barbearia` | comanda digital barbearia | fim da comanda de papel, QR code, PDF |
| `/whatsapp-para-barbearia` | bot de WhatsApp para barbearia | agendamento 24h, sem IA, sem custo por mensagem (Pro+) |
| `/aplicativo-para-barbearia` | aplicativo / app para barbearia | PWA no celular sem loja, app do barbeiro, funciona offline |

Estrutura de cada página: H1 com o termo · parágrafo de resposta direta · 3–5 seções com print do produto (reusar `/site/*.webp`) · bloco "Quanto custa" (lido de `lib/precos.ts`) · FAQ (3–5 perguntas, com JSON-LD) · CTA.

### N2 — Páginas de comparação

- `/comparativo/appbarber`, `/comparativo/trinks`, `/comparativo/booksy`, e `/melhor-sistema-para-barbearia` (comparativo geral).
- **Regras obrigatórias:** só fatos verificáveis, com **data de conferência** e link para a fonte de cada preço; tom justo (dizer onde o concorrente é melhor, ex.: Trinks emite nota fiscal, AppBarber dá 30 dias de teste e tem app nas lojas). Sem logos de concorrentes. Componente de tabela com dados em arquivo (`content/comparativos.ts`) para atualizar fácil.
- Dados de referência (conferir de novo antes de publicar):

  | Sistema | Solo (mensal) | Equipe ~5 (mensal) | Teste |
  | --- | --- | --- | --- |
  | AppBarber | R$ 79,90 | R$ 109,90 (2–5) | 30 dias |
  | Trinks | R$ 110 (1–2), R$ 76 no anual | sob consulta | 5 dias |
  | Booksy | R$ 99,99 | + R$ 20 por agenda extra | 7 dias |
  | ZapCorte | R$ 69,90 | R$ 179,90 (até 10) | 7 dias |
  | EiBarber | R$ 49 (até 2) | R$ 139 (ilimitado) | 30 dias |

### N3 — Ferramentas grátis em URL própria

- `/calculadora/lucro-por-corte` (extrair a calculadora da home para componente reutilizável; a home continua usando).
- `/calculadora/comissao-de-barbeiro` (preço, % comissão, produto → quanto fica para barbeiro e casa).
- `/calculadora/preco-do-corte` (custos fixos, cortes/mês, comissão, margem desejada → preço mínimo).
- Cada uma com explicação da fórmula, exemplo e CTA.

### N4 — Blog

- Rota `/blog` (lista) e `/blog/[slug]` (post), em MDX, com `Article` JSON-LD, data, tempo de leitura, posts relacionados e CTA no meio e no fim.
- Pautas iniciais (criar a estrutura e 1 post de exemplo; os demais como rascunho com título e tópicos):
  1. Faturamento não é lucro: como saber quanto sobra na barbearia
  2. Como calcular comissão de barbeiro sem planilha
  3. Quanto cobrar pelo corte em 2027: a conta do preço mínimo
  4. Clube de assinatura na barbearia: como montar sem perder dinheiro
  5. Comanda de papel x comanda digital
  6. Como reduzir faltas com lembrete no WhatsApp

### N5 — Página "Sobre" e "Contato"

- `/sobre`: quem faz o Pente Fino, por que existe, cidade. **TODO com o dono.**
- `/contato`: WhatsApp, e-mail, horário de atendimento. Aumenta confiança e serve de destino para sitelinks.

---

## 7. Rastreamento e medição

### T1 — Conversão de cadastro no Google Ads

- Confirmar que a conta criada dispara a conversão do Google Ads (`AW-18558704295/<label>`) **apenas no sucesso** do cadastro (página/estado de sucesso, não no clique do botão). Se não existir, implementar via `dataLayer.push({event: 'sign_up', plano, ciclo, cupom})` e configurar a tag no GTM.
- Incluir valor estimado (ex.: preço do plano) para lances por valor.

### T2 — Preservar gclid e UTMs até o cadastro

- Ler `gclid`, `gbraid`, `wbraid`, `utm_*` na chegada, guardar em cookie first-party (90 dias), e enviar junto ao criar a conta (campo oculto/backend). Permite conversões offline (ex.: quem assinou depois do teste).

### T3 — Eventos de funil

- `dataLayer` para: `view_planos`, `toggle_ciclo` (mensal/anual), `click_cta` (com posição), `play_video`, `use_calculadora`, `click_whatsapp`, `begin_sign_up` (foco no 1º campo), `sign_up`.

### T4 — Consentimento (LGPD)

- **Verificar** se há banner de cookies. Não foi confirmado na auditoria. Se não houver, implementar Consent Mode v2 (padrão `denied` para ads/analytics até aceite) com banner simples e link para /privacidade. Recusar = só cookies essenciais.

---

## 8. Desempenho, acessibilidade e detalhes

Medições atuais (home, desktop): TTFB 164 ms, LCP 552 ms (o H1), load 449 ms, 484 KB transferidos, 41 requisições, nenhum erro de console. Está muito bom; manter.

- **D1 — Imagens do hero:** `financeiro.webp` tem 1600 px de largura natural e aparece com 577 px. Usar `next/image` com `sizes` correto para servir versões menores no celular. Manter `loading="lazy"` abaixo da dobra.
- **D2 — Scripts de terceiros:** carregar GTM/gtag com `next/script` `strategy="afterInteractive"` (ou `lazyOnload` se a medição permitir) e conferir que não há gtag duplicado (GTM + gtag direto).
- **D3 — Tabela comparativa da home:** os ícones ✓/✗ têm `aria-label` ("Sim"), bom. Adicionar também texto visualmente oculto (`sr-only`) nas células e a legenda "em parte" com o ícone visível ao lado (hoje a legenda aparece só como "= em parte").
- **D4 — Contraste e foco:** conferir contraste AA do texto cinza (`text-tinta-suave`/`fraca`) sobre o fundo escuro, e foco visível em todos os links/botões (já existe `focus-visible:outline-foco` nos toggles; padronizar).
- **D5 — Formulário de cadastro:** marcar campos obrigatórios com `required` e `aria-required` (hoje nenhum input tem `required`; a validação deve continuar no servidor). Mensagens de erro ligadas ao campo (`aria-describedby`). Mostrar/ocultar senha.
- **D6 — Microcopy:** padronizar "14 dias grátis, sem cartão" em todos os pontos; padronizar "Pro e Premium" ao falar do bot; trocar "Ver em 1 minuto" e "Veja em 1 minuto" por uma só forma.

---

## 9. Checklist final de validação

Entregar esta lista preenchida (✅/❌ + observação):

- [ ] B1 404 real (`curl -I` = 404) e rotas protegidas ainda redirecionam
- [ ] B2 nenhum texto diz que o bot está em construção
- [ ] B3 cupom mostra preço com desconto; cupom inválido mostra erro; expira em 31/01/2027
- [ ] B4 JSON-LD válido no Rich Results Test, preços batendo com a página
- [ ] B5 vídeo toca no Safari iOS
- [ ] B6 economia anual calculada, sem número digitado
- [ ] B7 "Planos" acessível no celular
- [ ] B8 campo WhatsApp opcional gravando
- [ ] P1 selos de plano em todas as promessas parciais; home e /planos leem a mesma fonte
- [ ] P2 flag do lucro no Pro funcionando nos dois estados
- [ ] C1 faixa da oferta em todas as páginas; some após a data
- [ ] C2/C3 WhatsApp e rodapé renderizam só com dados preenchidos
- [ ] C4 depoimentos só aparecem com ≥ 2 itens reais
- [ ] S1 sitemap lista todas as páginas públicas
- [ ] S5 `www` e `http` redirecionam com 301
- [ ] N1–N5 páginas publicadas com title/description/canonical/OG e CTA
- [ ] T1 conversão dispara só no sucesso do cadastro (verificar no Tag Assistant)
- [ ] T2 gclid/UTM chegam ao backend
- [ ] T4 consentimento funcionando
- [ ] Lighthouse mobile da home: Performance ≥ 90, Acessibilidade ≥ 95, SEO 100
- [ ] Build, lint e testes passando

---

## 10. Anexo: contexto competitivo

**Onde o Pente Fino ganha:** posicionamento "lucro, não só agenda" (único no mercado), comissão com vigência, lucro e margem por item, bot sem custo por mensagem, sem cobrança por cadeira até 10 profissionais, preços publicados para todos os planos, teste sem cartão mais longo que Trinks, Booksy e ZapCorte, site rápido e bem escrito.

**Onde perde:** plano solo caro e sem o principal diferencial; promessa da home só entregue no Premium; zero prova social; sem WhatsApp/telefone; sem conteúdo para SEO; sem app nas lojas (é PWA — explicar como vantagem: "sem baixar nada"); sem nota fiscal (Trinks tem); teste de 14 dias contra 30 de AppBarber e EiBarber.

**Fontes consultadas (10/11/2026):**
- AppBarber — https://appbarber.com.br/
- Booksy — https://biz.booksy.com/pt-br/precos
- Trinks (via comparativo de terceiros, set/2026) — https://www.barbeiro.app/alternativas/trinks
- ZapCorte e EiBarber (comparativo publicado pela ZapCorte, out/2026) — https://blog.zapcorte.com.br/melhor-app-de-agendamento-para-barbearia-em-2026-mn4o4n2p

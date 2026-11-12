---
name: video-pente-fino
description: Padrão profissional dos vídeos do Pente Fino (site, anúncios, Reels e Status) feitos com Remotion. Use antes de criar, editar ou exportar qualquer vídeo da marca. Cobre o roteiro, as telas reais, a marca, o ritmo, as legendas, o áudio e a exportação.
---

# Vídeo do Pente Fino com cara de profissional

Este é o ponto de entrada para qualquer vídeo da marca. As skills `remotion-*` desta pasta ensinam a
ferramenta: criar o projeto, as cenas, as legendas, a prévia e a exportação. Esta skill diz **o que**
o vídeo tem que ser e como ele precisa ficar.

## Antes de começar

1. Leia `apps/web/video/LEIAME.md`. As gravações reais das telas saem do `gravar.mjs`, com a
   conta de demonstração, e as fotos saem do `telas.mjs`.
2. O projeto do vídeo fica em `apps/video`, criado com a skill `remotion-create`. Ele não tem
   script `build`, para o Turborepo não incluir o vídeo no build do site. Ficam só `studio` e
   `render`.
3. Abra a prévia (`remotion-studio`) antes de escrever as cenas e deixe aberta.
4. Licença: a Remotion é grátis para empresa de até 3 pessoas (`remotion-license`). Se a equipe
   passar disso, avise o dono antes de exportar.

## Primeiro passo, obrigatório: o levantamento do que vende

Antes de qualquer roteiro, percorra o sistema inteiro com a conta de demonstração. Passe por todas
as telas, com cada papel (dono, gestor, recepção e barbeiro), no computador e no celular, e anote
tudo o que ele faz. Leia cada tela como um barbeiro que nunca viu o sistema e pergunte: "ele bate o
olho e pensa: isso faria diferença?"

Registre o levantamento em `apps/web/video/levantamento.md`, uma linha por achado:

| Dor do barbeiro                       | O que o sistema faz                   | Onde aparece (tela e papel) | Frase de venda                             | Plano   |
| ------------------------------------- | ------------------------------------- | --------------------------- | ------------------------------------------ | ------- |
| "No fim do mês não sei quanto sobrou" | Lucro do mês e margem de cada serviço | Financeiro, dono            | "Saiba quanto sobra, não só quanto entrou" | Premium |

- Ordene pelo impacto que causa em quem vê pela primeira vez, não pela ordem do menu.
- Os itens mais fortes viram as cenas do vídeo do site, e cada um dos outros pode virar um anúncio
  curto.
- O roteiro só é escrito depois que o dono aprovar o levantamento. O roteiro de exemplo abaixo é um
  ponto de partida e muda conforme o que o levantamento mostrar.

## Regras que não podem quebrar

- **Só telas reais.** Use as gravações e fotos do sistema de verdade. Nunca desenhe uma tela, um
  botão ou um número que o sistema não tem.
- **Nada que o plano não entregue.** A função que não vem em todos os planos leva o selo do plano
  na cena ("Pro e Premium", "Premium"), lido de `RECURSOS` em `@pente-fino/shared`.
- **Preços e limites da mesma fonte do site:** `precoPorMes`, `LIMITES_PLANO` e `DIAS_TESTE`, de
  `@pente-fino/shared`. Nunca digite um preço na cena.
- **Português do Brasil**, frases curtas, números de barbearia. O bot é "sem inteligência
  artificial": não diga que o produto usa IA.
- **A proposta aparece no vídeo:** "Saiba quanto sobra, não só quanto entrou."

## Marca

| Uso                          | Valor                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| Fundo                        | `#0b0b0b` (cartões em `#141414` e `#1c1c1b`)                     |
| Texto                        | `#f4f4ef`; texto secundário `#aaaaa1`                            |
| Destaque (amarelo do módulo) | `#f5d33b`, só no número ou na palavra que importa                |
| Ação (verde)                 | `#a5e34b`, só no botão final ("Testar grátis")                   |
| Títulos                      | Barlow Condensed, 700, em maiúsculas, entrelinha 0,95            |
| Texto corrido e legenda      | Barlow, 500 a 600                                                |
| Marca                        | o pente amarelo e o nome "PENTE FINO" (`apps/web/public/icones`) |

Carregue as fontes com `@remotion/google-fonts` (ver `google-fonts.md` em `remotion-markup`). Use no
máximo duas cores de destaque por cena.

## Formatos

| Peça                  | Tamanho                   | Duração      |
| --------------------- | ------------------------- | ------------ |
| Site (home)           | 1920 × 1080, 30 fps       | 60 a 75 s    |
| Anúncio               | 1920 × 1080 e 1080 × 1920 | 15 s ou 30 s |
| Reels, Status, TikTok | 1080 × 1920, 30 fps       | 15 a 45 s    |
| Quadrado (feed)       | 1080 × 1080               | 15 a 30 s    |

Uma composição por formato no mesmo projeto, com as mesmas cenas (`compositions.md`). No 9:16,
deixe livres os 12% de cima e os 20% de baixo, onde o Instagram põe nome e botões. Em todo formato,
mantenha títulos e legendas dentro de 5% de margem.

## Ritmo e movimento

- **Gancho nos 2 primeiros segundos:** uma pergunta ou um número. Por exemplo: "Faturou R$ 30 mil.
  Quanto sobrou?"
- **Uma ideia por cena**, de 3 a 6 segundos. A legenda fica na tela pelo tempo de leitura,
  cerca de 15 caracteres por segundo e no mínimo 1,5 s.
- **Molas, nunca movimento linear:** `spring()` com `damping` entre 14 e 20 para entradas.
  Saídas mais rápidas que as entradas.
- **No máximo dois tipos de transição** no vídeo inteiro, por exemplo deslizar e esmaecer, de 12 a
  15 quadros (`transitions.md`).
- **Câmera nas telas:** aproximação lenta (de 1,00 a 1,08) e foco no ponto que importa, com um
  contorno amarelo ou escurecendo o resto. A tela gravada nunca fica parada mais de 3 s sem um
  destaque.
- **Números contam:** o valor sobe até o final em cerca de 20 quadros, com `tabular-nums`.
- **Aparelhos:** a tela do computador entra numa janela de navegador escura, como no site. A do
  celular entra num aparelho com borda `#26262b`.

## Texto na tela

- Títulos com pelo menos 96 px em 1080p e legenda com pelo menos 48 px. No 9:16, a legenda tem
  pelo menos 56 px.
- No máximo 2 linhas por legenda e 7 palavras por linha.
- Legenda sempre ligada, porque a maioria assiste sem som (`remotion-captions`).
- Contraste: texto claro sobre fundo escuro. Sobre uma tela gravada, use uma faixa `#0b0b0b` com
  85% de opacidade atrás do texto.

## Áudio

- Use só trilha com licença comercial (biblioteca sem royalties). Anote a fonte e a licença no
  `LEIAME.md`.
- Mixagem: trilha em torno de −18 LUFS, abaixando 8 a 10 dB quando houver narração (`audio.md`).
- Narração é opcional, em pt-BR, com voz natural. Sem narração, as legendas contam a história
  sozinhas.
- Efeitos sonoros discretos (clique, "pop" do número), no máximo um a cada 2 s (`sfx.md`).

## Roteiro de exemplo: vídeo com todas as funções (site, cerca de 70 s)

1. **Gancho (0 a 4 s):** "Faturou. Mas quanto sobrou?" O número do faturamento aparece e é
   riscado.
2. **Agenda e link (4 a 10 s):** o cliente marca pelo link, e o horário aparece na agenda do
   barbeiro.
3. **A comanda nasce do horário (10 a 16 s):** a comanda prevista abre sozinha.
4. **App do barbeiro (16 a 23 s):** o barbeiro lança o extra no celular e confirma.
5. **Caixa do dia (23 a 29 s):** a recepção recebe e fecha, e a diferença aparece.
6. **Comissão (29 a 35 s):** item a item, com o extrato no celular (todos os planos).
7. **Lucro e margem (35 a 43 s):** o financeiro mostra quanto sobrou e a margem de cada serviço
   (Premium).
8. **Metas (43 a 48 s):** ritmo e projeção do mês (Pro e Premium).
9. **Clube (48 a 53 s):** assinatura com cobrança automática (Pro e Premium).
10. **Bot do WhatsApp (53 a 59 s):** marca sozinho, sem custo por mensagem (Pro e Premium).
11. **Rede (59 a 63 s):** várias unidades no painel da rede (Premium).
12. **Encerramento (63 a 70 s):** "Saiba quanto sobra, não só quanto entrou.",
    seupentefino.com.br, "14 dias grátis, sem cartão" (de `DIAS_TESTE`) e o botão verde.

Para os anúncios de 15 s, use o gancho, uma função e o encerramento.

## Antes de exportar

- [ ] Toda tela é real e atual; nenhum dado de cliente de verdade aparece.
- [ ] Os selos de plano estão certos, conferidos com `RECURSOS`.
- [ ] Os preços e o "14 dias" vêm de `@pente-fino/shared`.
- [ ] Os textos estão dentro da margem de 5% e, no 9:16, longe das bordas de cima e de baixo.
- [ ] Toda legenda fica tempo suficiente para ser lida, e o vídeo é entendido sem som.
- [ ] A trilha tem licença anotada e o volume foi conferido.
- [ ] O vídeo foi assistido inteiro na prévia, no tamanho real.

## Exportar (`remotion-render`)

1. Master: H.264, `--crf 18`, 30 fps.
2. Para o site, recomprimir como o vídeo atual: MP4 com `ffmpeg -vf fps=30 -crf 26` e WebM com
   `-crf 38`, mais a capa `.jpg` (o primeiro quadro forte, não o preto).
3. Salvar em `apps/web/public/video/` com os mesmos nomes (`apresentacao.mp4`, `.webm`, `.jpg`),
   ou com nome novo para anúncios.
4. Anotar no `apps/web/video/LEIAME.md` a data, a duração e o que mudou, e registrar no
   CHANGELOG.

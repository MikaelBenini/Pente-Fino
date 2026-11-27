# 0006 · WhatsApp pela Evolution API (QR Code)

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

A API oficial cobra por conversa e exige aprovação da Meta; o bot precisava ser incluso no plano.

## Decisão

Evolution API instalada no próprio servidor, conectada como WhatsApp Web por QR Code; um número por unidade. O provedor fica atrás da interface `ProvedorWhatsApp` (`packages/whatsapp`).

## Consequências

Sem custo por mensagem. Risco de restrição do número (não é oficial): envios espaçados, nada de envio em massa, proteção do número (só fala com quem escreveu), silêncio de madrugada e trava contra loop.

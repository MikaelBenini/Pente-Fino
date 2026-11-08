# Vídeo de apresentação

O vídeo da home (`public/video/apresentacao.mp4`, `.webm` e a capa `.jpg`) é **gravado do sistema
de verdade**, com a conta de demonstração, por um roteiro do Playwright. Quando uma tela mudar,
basta gravar de novo. Nada é editado à mão.

## Como regravar

Precisa do Docker de desenvolvimento rodando, do `ffmpeg` (`sudo apt-get install ffmpeg`) e do build
(`pnpm build`). Em `apps/web`:

```bash
./video/banco.sh          # banco limpo só com a demonstração (pente_fino_video)
./video/servidores.sh     # API em 3201 e site em 3200 contra esse banco (deixe aberto)
node video/gravar.mjs     # grava as cenas em video-tmp/cenas
node video/editar.mjs     # junta, transições, MP4 + WebM + capa em public/video
```

Grave em horário comercial: fora dele, o simulador do bot mostra a mensagem de "fechado".

## Arquivos

- `gravar.mjs`: o roteiro (cenas, legendas, cliques). Cria um horário de amanhã com o Rafael para
  a cena do celular (lança o extra e confirma) e a da recepção (recebe e fecha).
- `estudio.js`: injetado nas páginas gravadas — cursor visível, legenda animada, destaque.
- `cartoes.mjs`: abertura, encerramento e o fundo da cena do celular, em HTML com a marca.
- `editar.mjs`: recorta, encaixa o celular no aparelho, transições (`xfade`), exporta.
- `banco.sh` e `servidores.sh`: banco e servidores só da gravação (leem o `.env`, não imprimem nada).

O vídeo não tem som: as legendas fazem a explicação. Para narração, grave a voz por cima do MP4.

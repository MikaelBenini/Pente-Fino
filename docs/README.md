# Documentação do Pente Fino

Mapa de tudo o que está escrito sobre o sistema. Para entender o sistema inteiro, leia nesta
ordem: **produto → arquitetura → regras → fluxos → modelo de dados**. Para trabalhar no código,
comece pelo [CLAUDE.md](CLAUDE.md).

## Entender

| Documento | Responde a |
| --- | --- |
| [documentacao-do-produto.md](documentacao-do-produto.md) | O que é, para quem, módulos, planos e mercado |
| [arquitetura.md](arquitetura.md) | Como é montado (diagrama), filas e rotinas, integrações, segurança |
| [regras-de-negocio.md](regras-de-negocio.md) | As contas do sistema, com exemplos numéricos conferidos por teste |
| [fluxos.md](fluxos.md) | O caminho de cada pessoa: conta nova, recepção, barbeiro, dono, cliente, bot, clube |
| [papeis-e-permissoes.md](papeis-e-permissoes.md) | Quem pode o quê, na barbearia e na administração |
| [glossario.md](glossario.md) | Os termos do produto e o nome de cada um no código |
| [decisoes/](decisoes/README.md) | Por que o sistema é como é (registro de decisões) |
| [concorrentes-e-precos.md](concorrentes-e-precos.md) | Quanto o mercado cobra em cada segmento, a proposta de preço por licença e o que falta para competir |

## Gerado do código

Refeito com `pnpm docs:gerar`; o CI falha se ficar diferente do código. Não edite à mão.

| Documento | Fonte |
| --- | --- |
| [gerado/modelo-de-dados.md](gerado/modelo-de-dados.md) | As entidades, campos, relações e enums do `schema.prisma` |
| [gerado/api.md](gerado/api.md) | As rotas da API por módulo, com quem pode chamar |
| [gerado/telas.md](gerado/telas.md) | As páginas do Next e o componente de cada uma |
| [gerado/planos.md](gerado/planos.md) | Preços, limites e recursos de cada plano |
| [gerado/menu-por-papel.md](gerado/menu-por-papel.md) | O menu de cada papel |

## Trabalhar

| Documento | Para que serve |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Stack, comandos, regras que não podem quebrar e convenções (carregado pelo `CLAUDE.md` e citado no `AGENTS.md` da raiz) |
| [retomada.md](retomada.md) | Como trabalhar com o dono (PR por lote, testes, sugestões) |
| [a-fazer.md](a-fazer.md) | O que está aberto agora e o próximo passo |
| [plano-multissegmento.md](plano-multissegmento.md) | Plano das fases 0 a 5: multissegmento, interface simples, mentoria financeira, IA opcional e site |
| [linha-de-desenvolvimento.md](linha-de-desenvolvimento.md) | Histórico definitivo, etapa por etapa, do que foi feito |
| [../CHANGELOG.md](../CHANGELOG.md) | O que muda para quem usa e opera |

## Operar

| Documento | Para que serve |
| --- | --- |
| [producao.md](producao.md) | VPS, deploy, DNS, Asaas, webhooks, monitoramento |
| [restaurar.md](restaurar.md) | Backup, cópia externa e restauração |

## Histórico

Rodadas concluídas, guardadas só para consulta, em [historico/](historico/): a lista de trabalho
de novembro, os briefings de 10/11 (painel, administração e site), a verificação final de 15/11 e
a documentação original do produto de 03/11.

## Como manter

- Mudou o schema, uma rota, uma tela, um plano ou o menu: rode `pnpm docs:gerar` e commite.
- Mudou uma regra de cálculo: atualize [regras-de-negocio.md](regras-de-negocio.md) e o exemplo
  em `packages/shared/src/exemplos-das-regras.test.ts`.
- Decisão de produto ou de arquitetura nova: um arquivo novo em [decisoes/](decisoes/README.md).
- Entregou algo: CHANGELOG, linha de desenvolvimento e marcar no [a-fazer.md](a-fazer.md).

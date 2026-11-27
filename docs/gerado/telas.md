<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->

# Telas

75 páginas do Next (`apps/web/src/app`). As telas do painel ficam em `apps/web/src/componentes/telas`; o menu por papel está em [menu-por-papel.md](menu-por-papel.md).

## Painel (logado)

| Rota | Componente | Arquivo |
| --- | --- | --- |
| `/agenda` | TelaAgenda (`componentes/telas/agenda.tsx`) | `apps/web/src/app/(app)/agenda/page.tsx` |
| `/ajuda` | TelaAjuda (`componentes/telas/ajuda.tsx`) | `apps/web/src/app/(app)/ajuda/page.tsx` |
| `/app` | useApp (`componentes/contexto-app.tsx`) | `apps/web/src/app/(app)/app/page.tsx` |
| `/avisos` | TelaAvisos (`componentes/telas/avisos.tsx`) | `apps/web/src/app/(app)/avisos/page.tsx` |
| `/bot` | TelaBot (`componentes/telas/bot.tsx`) | `apps/web/src/app/(app)/bot/page.tsx` |
| `/caixa` | TelaCaixa (`componentes/telas/caixa.tsx`) | `apps/web/src/app/(app)/caixa/page.tsx` |
| `/clientes` | TelaClientes (`componentes/telas/clientes.tsx`) | `apps/web/src/app/(app)/clientes/page.tsx` |
| `/clube` | TelaClube (`componentes/telas/clube.tsx`) | `apps/web/src/app/(app)/clube/page.tsx` |
| `/comandas` | TelaComandas (`componentes/telas/comandas.tsx`) | `apps/web/src/app/(app)/comandas/page.tsx` |
| `/comissoes` | TelaComissoesBarbeiro (`componentes/telas/barbeiro.tsx`) | `apps/web/src/app/(app)/comissoes/page.tsx` |
| `/configuracao-inicial` | TelaConfiguracaoInicial (`componentes/telas/configuracao-inicial.tsx`) | `apps/web/src/app/(app)/configuracao-inicial/page.tsx` |
| `/configuracoes` | TelaConfiguracoes (`componentes/telas/configuracoes.tsx`) | `apps/web/src/app/(app)/configuracoes/page.tsx` |
| `/conhecer` | TelaConhecer (`componentes/telas/conhecer-basico.tsx`) | `apps/web/src/app/(app)/conhecer/page.tsx` |
| `/conversas` | TelaConversas (`componentes/telas/conversas.tsx`) | `apps/web/src/app/(app)/conversas/page.tsx` |
| `/desempenho` | TelaDesempenhoBarbeiro (`componentes/telas/equipe-desempenho.tsx`) | `apps/web/src/app/(app)/desempenho/page.tsx` |
| `/dia` | TelaResumoDia (`componentes/telas/resumo-dia.tsx`) | `apps/web/src/app/(app)/dia/page.tsx` |
| `/equipe` | TelaEquipe (`componentes/telas/equipe.tsx`) | `apps/web/src/app/(app)/equipe/page.tsx` |
| `/equipe/ficha` | TelaFichaProfissional (`componentes/telas/equipe-desempenho.tsx`) | `apps/web/src/app/(app)/equipe/ficha/page.tsx` |
| `/financeiro` | TelaFinanceiro (`componentes/telas/financeiro.tsx`) | `apps/web/src/app/(app)/financeiro/page.tsx` |
| `/hoje` | TelaHoje (`componentes/telas/barbeiro.tsx`) | `apps/web/src/app/(app)/hoje/page.tsx` |
| `/inicio` | TelaInicio (`componentes/telas/inicio.tsx`) | `apps/web/src/app/(app)/inicio/page.tsx` |
| `/metas` | na própria página | `apps/web/src/app/(app)/metas/page.tsx` |
| `/metricas` | na própria página | `apps/web/src/app/(app)/metricas/page.tsx` |
| `/outro-negocio` | TelaOutroNegocio (`componentes/telas/outro-negocio.tsx`) | `apps/web/src/app/(app)/outro-negocio/page.tsx` |
| `/pagina` | TelaMinhaPagina (`componentes/telas/minha-pagina.tsx`) | `apps/web/src/app/(app)/pagina/page.tsx` |
| `/perfil` | AssistenteEquipe (`componentes/assistente-equipe.tsx`) | `apps/web/src/app/(app)/perfil/page.tsx` |
| `/produtos` | TelaProdutos (`componentes/telas/produtos.tsx`) | `apps/web/src/app/(app)/produtos/page.tsx` |
| `/rede` | na própria página | `apps/web/src/app/(app)/rede/page.tsx` |
| `/relatorio` | na própria página | `apps/web/src/app/(app)/relatorio/page.tsx` |
| `/resultados` | TelaResultados (`componentes/telas/resultados.tsx`) | `apps/web/src/app/(app)/resultados/page.tsx` |
| `/servicos` | TelaServicos (`componentes/telas/servicos.tsx`) | `apps/web/src/app/(app)/servicos/page.tsx` |
| `/unidade` | useApp (`componentes/contexto-app.tsx`) | `apps/web/src/app/(app)/unidade/page.tsx` |

## Páginas públicas

| Rota | Componente | Arquivo |
| --- | --- | --- |
| `/agendar` | TelaAgendar (`componentes/telas/agendar.tsx`) | `apps/web/src/app/agendar/page.tsx` |
| `/assinar` | AssinarClube (`componentes/assinar-clube.tsx`) | `apps/web/src/app/(publico)/assinar/page.tsx` |
| `/b/[slug]` | TelaAgendar (`componentes/telas/agendar.tsx`) | `apps/web/src/app/b/[slug]/page.tsx` |
| `/b/[slug]/agendar` | na própria página | `apps/web/src/app/b/[slug]/agendar/page.tsx` |
| `/cadastro` | AvisoCookies (`componentes/site/tag-google.tsx`) | `apps/web/src/app/(publico)/cadastro/page.tsx` |
| `/confirmar-email` | ConfirmarEmail (`componentes/confirmar-email.tsx`) | `apps/web/src/app/(publico)/confirmar-email/page.tsx` |
| `/convite` | FormularioNovaSenha (`componentes/formularios-publicos.tsx`) | `apps/web/src/app/(publico)/convite/page.tsx` |
| `/entrar` | FormularioEntrar (`componentes/formularios-publicos.tsx`) | `apps/web/src/app/(publico)/entrar/page.tsx` |
| `/esqueci-senha` | FormularioEsqueciSenha (`componentes/formularios-publicos.tsx`) | `apps/web/src/app/(publico)/esqueci-senha/page.tsx` |
| `/horario` | TelaHorario (`componentes/telas/horario.tsx`) | `apps/web/src/app/horario/page.tsx` |
| `/offline` | Marca (`componentes/marca.tsx`) | `apps/web/src/app/offline/page.tsx` |
| `/redefinir-senha` | FormularioNovaSenha (`componentes/formularios-publicos.tsx`) | `apps/web/src/app/(publico)/redefinir-senha/page.tsx` |
| `/s/[slug]` | CorDoNavegador (`componentes/site-barbearia/cor-do-navegador.tsx`) | `apps/web/src/app/s/[slug]/page.tsx` |
| `/s/[slug]/[pagina]` | CorDoNavegador (`componentes/site-barbearia/cor-do-navegador.tsx`) | `apps/web/src/app/s/[slug]/[pagina]/page.tsx` |
| `/suporte` | na própria página | `apps/web/src/app/(publico)/suporte/page.tsx` |

## Site de vendas

| Rota | Componente | Arquivo |
| --- | --- | --- |
| `/` | ComandaExemplo (`componentes/comanda-exemplo.tsx`) | `apps/web/src/app/(site)/page.tsx` |
| `/agenda-online-para-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/agenda-online-para-barbearia/page.tsx` |
| `/agenda-para-barbeiro` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/agenda-para-barbeiro/page.tsx` |
| `/aplicativo-para-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/aplicativo-para-barbearia/page.tsx` |
| `/blog` | ListaDoBlog (`componentes/site/pagina-blog.tsx`) | `apps/web/src/app/(site)/blog/page.tsx` |
| `/blog/faturamento-nao-e-lucro` | metadadosPost (`componentes/site/pagina-blog.tsx`) | `apps/web/src/app/(site)/blog/faturamento-nao-e-lucro/page.tsx` |
| `/calculadora/comissao-de-barbeiro` | CalculadoraComissao (`componentes/site/calculadoras-extras.tsx`) | `apps/web/src/app/(site)/calculadora/comissao-de-barbeiro/page.tsx` |
| `/calculadora/lucro-por-corte` | CalculadoraSobra (`componentes/site/calculadora-sobra.tsx`) | `apps/web/src/app/(site)/calculadora/lucro-por-corte/page.tsx` |
| `/calculadora/preco-do-corte` | CalculadoraPreco (`componentes/site/calculadoras-extras.tsx`) | `apps/web/src/app/(site)/calculadora/preco-do-corte/page.tsx` |
| `/comanda-digital-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/comanda-digital-barbearia/page.tsx` |
| `/comissao-de-barbeiro` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/comissao-de-barbeiro/page.tsx` |
| `/comparativo/appbarber` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/appbarber/page.tsx` |
| `/comparativo/barbeiro-app` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/barbeiro-app/page.tsx` |
| `/comparativo/bestbarbers` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/bestbarbers/page.tsx` |
| `/comparativo/booksy` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/booksy/page.tsx` |
| `/comparativo/genda` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/genda/page.tsx` |
| `/comparativo/trinks` | metadadosComparativo (`componentes/site/pagina-comparativo.tsx`) | `apps/web/src/app/(site)/comparativo/trinks/page.tsx` |
| `/controle-financeiro-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/controle-financeiro-barbearia/page.tsx` |
| `/indique` | CadastroIndicador (`componentes/site/indique.tsx`) | `apps/web/src/app/(site)/indique/page.tsx` |
| `/indique/painel` | PainelPeloLink (`componentes/site/indique.tsx`) | `apps/web/src/app/(site)/indique/painel/page.tsx` |
| `/melhor-sistema-para-barbearia` | na própria página | `apps/web/src/app/(site)/melhor-sistema-para-barbearia/page.tsx` |
| `/planos` | CartoesPlanos (`componentes/site/cartoes-planos.tsx`) | `apps/web/src/app/(site)/planos/page.tsx` |
| `/privacidade` | TrilhaGoogle (`componentes/site/trilha-google.tsx`) | `apps/web/src/app/(site)/privacidade/page.tsx` |
| `/recursos` | LinkCadastro (`componentes/site/oferta-lancamento.tsx`) | `apps/web/src/app/(site)/recursos/page.tsx` |
| `/sistema-para-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/sistema-para-barbearia/page.tsx` |
| `/termos` | TrilhaGoogle (`componentes/site/trilha-google.tsx`) | `apps/web/src/app/(site)/termos/page.tsx` |
| `/whatsapp-para-barbearia` | metadadosBusca (`componentes/site/pagina-busca.tsx`) | `apps/web/src/app/(site)/whatsapp-para-barbearia/page.tsx` |

## Administração da plataforma

| Rota | Componente | Arquivo |
| --- | --- | --- |
| `/admin` | TelaAdmin (`componentes/admin/tela-admin.tsx`) | `apps/web/src/app/admin/page.tsx` |

<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->

# Menu por papel

Fonte: `packages/shared/src/menu.ts` (`ITENS_MENU`, `menuPara`). A tela só aparece no menu de quem pode abri-la; o plano pode esconder telas (`RECURSO_DA_TELA`).

| Tela | Rota | Grupo | dono | gestor | recepcao | profissional | Recurso do plano |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Início | `/inicio` | Dia a dia | sim | sim |  |  |  |
| Resumo do dia | `/dia` | Dia a dia | sim | sim |  |  | operacao |
| Hoje | `/hoje` | Dia a dia |  |  |  | sim |  |
| Agenda | `/agenda` | Dia a dia | sim | sim | sim |  |  |
| Comandas | `/comandas` | Dia a dia | sim | sim | sim | sim | operacao |
| Caixa do dia | `/caixa` | Dia a dia | sim | sim | sim |  | operacao |
| Clientes | `/clientes` | Dia a dia | sim | sim | sim | sim |  |
| Resultados do mês | `/resultados` | Gestão | sim | sim |  |  | operacao |
| Financeiro | `/financeiro` | Gestão | sim | sim |  |  | operacao |
| Equipe | `/equipe` | Gestão | sim | sim |  |  |  |
| Desempenho | `/desempenho` | Gestão |  |  |  | sim |  |
| Comissões | `/comissoes` | Gestão |  |  |  | sim | comissoes |
| Serviços | `/servicos` | Cadastros | sim | sim |  |  |  |
| Produtos | `/produtos` | Cadastros | sim | sim |  |  |  |
| Clube | `/clube` | Cadastros | sim | sim |  |  |  |
| Pacotes | `/pacotes` | Cadastros | sim | sim |  |  | operacao |
| Minha página | `/pagina` | Cadastros | sim | sim |  |  |  |
| Bot | `/bot` | WhatsApp | sim | sim |  |  |  |
| Conversas do bot | `/conversas` | WhatsApp | sim | sim | sim |  |  |
| Configurações | `/configuracoes` | Conta | sim | sim |  |  |  |
| Perfil | `/perfil` | Conta |  |  |  | sim |  |
| Ajuda | `/ajuda` | Conta | sim | sim | sim | sim |  |

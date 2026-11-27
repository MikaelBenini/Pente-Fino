# Glossário

Os termos do produto e o nome deles no código (que é em português).

| Termo | No código | O que é |
| --- | --- | --- |
| Conta | `Conta` (`conta`) | A empresa cliente do Pente Fino (a barbearia ou a rede). Raiz do isolamento: tudo tem `conta_id`. |
| Unidade | `Unidade` | Um endereço da barbearia, com agenda, equipe, catálogo, WhatsApp e link próprios. |
| Profissional / barbeiro | `Profissional` + papel `profissional` (antes `barbeiro`) | Quem atende. O cadastro (`profissional`) tem entrada, horários, regras de comissão e preços próprios. |
| Comanda | `Comanda` | O atendimento de um cliente: itens, total, pagamentos e estado. Nasce do agendamento ou na hora. |
| Item da comanda | `ItemComanda` | Serviço, produto ou não operacional, com o preço e a comissão gravados no momento. |
| Agendamento | `Agendamento` | Horário marcado com um profissional; cria a comanda prevista. |
| Encaixe | — | Agendamento feito pelo balcão fora da grade de horários livres. |
| Extra | `servico.ehExtra` | Serviço adicional (sobrancelha, pezinho): peso 0 em atendimentos, contado no % de extras. |
| Peso de atendimento | `pesoAtendimento` | Quanto o serviço conta em "atendimentos" (principal 1, extra 0, combo = soma). |
| Preço livre | `servico.precoLivre` | Serviço cujo valor é digitado na comanda (dentro da faixa). |
| Vigência | `vigenciaInicio` | Data a partir da qual um preço ou uma regra de comissão vale. |
| Sinal | `pagamento.sinal` | Pagamento adiantado na comanda aberta. |
| Caixa do dia | `CaixaDia` | Abertura e fechamento do caixa da unidade, com divergência. |
| Despesa operacional | grupos `fixa`, `variavel`, `manutencao` + comissões | O que entra no % de despesas e no lucro. |
| Clube | `ItemClube`, `AdesaoClube` | Planos de assinatura, combos e convênios do cliente final. |
| Clube online | `AssinaturaClubeOnline`, `RecebimentoOnline` | Clube cobrado pelo Asaas, com split para a subconta da barbearia. |
| Lista de espera | `ListaEspera` | Quem quer um horário num dia; recebe a vaga quando abre. |
| Bot | `BotMenu`, `BotSessao`, `Mensagem` | Atendimento automático no WhatsApp por menu e palavras-chave (sem IA). |
| Sessão do bot / conversa | `BotSessao` | O estado da conversa de um número com uma unidade. |
| Assistente da equipe | `AssistenteEquipe` | Avisos pelo WhatsApp para a própria equipe (próximo cliente, agenda do dia). |
| Central de avisos | `Aviso` | Avisos por pessoa no painel e no celular (push). |
| Minha página / site | `unidade.siteRascunho`, `sitePublicado` | O site da barbearia, montado em blocos. |
| Link de agendamento | `unidade.slug` → `/b/<slug>` | Página pública onde o cliente marca sozinho. |
| Resultados do mês | tela `resultados` | Todos os números do mês num lugar só. |
| Plano | `conta.plano` (`agenda`, `basico`, `pro`, `premium`) | A assinatura do Pente Fino que a conta paga. |
| Automações | `conta.automacoesContratadas` (e `conta.automacoes`, a configuração) | Adicional que libera bot, lista de espera, pesquisa e automações no Agenda e no Básico. |
| Conta interna | `conta.interna` | Conta da própria equipe, fora das métricas e da cobrança. |
| RLS | políticas `isolamento_conta` | Row Level Security do PostgreSQL, que filtra cada tabela pela conta da sessão. |
| `naConta()` | `packages/db/src/index.ts` | Abre a transação já dentro da conta (define `app.conta_id`). |
| Centavos | — | Todo dinheiro é inteiro em centavos (R$ 50,00 = 5000). |
| Bp (pontos-base) | `percentualBp` | Percentual em centésimos de ponto: 40% = 4000. |

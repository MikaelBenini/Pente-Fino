<!-- Gerado por scripts/docs/gerar-docs.mjs (pnpm docs:gerar). Não edite à mão: mude o código e gere de novo. -->

# Rotas da API

330 rotas em 48 controllers (`apps/api/src`), por módulo. "Quem" vem do `@Papeis` (constantes como `QUEM_CONVERSA` são listas definidas no próprio módulo) ou `@Publico`. A documentação interativa fica em `/docs` (Swagger) com a API rodando.

## admin

`apps/api/src/admin/admin-config.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/admin/configuracoes` | plataforma: admin | Configurações do sistema: aviso geral e teste grátis |
| PUT | `/admin/configuracoes/aviso-geral` | plataforma: admin | Aviso para todas as contas (com início e fim) ou tirar o aviso |
| PUT | `/admin/configuracoes/teste` | plataforma: admin | Dias de teste grátis e versão dos termos em vigor |
| PUT | `/admin/configuracoes/clube-online` | plataforma: admin | Taxa da plataforma sobre o clube online (vale para assinaturas novas) |
| PUT | `/admin/configuracoes/contato-site` | plataforma: admin | WhatsApp comercial do site de vendas (vazio tira do site) |
| GET | `/admin/configuracoes/smtp` | plataforma: admin | SMTP configurado (sem a senha); null = vale o do .env |
| PUT | `/admin/configuracoes/smtp` | plataforma: admin | Salvar o SMTP (senha cifrada; em branco = manter a guardada) |
| DELETE | `/admin/configuracoes/smtp` | plataforma: admin | Voltar a usar o SMTP do .env |
| POST | `/admin/configuracoes/smtp/conexao` | plataforma: admin | Testar a conexão com os dados da tela (antes de salvar); senha null = a guardada |
| POST | `/admin/configuracoes/smtp/teste` | plataforma: admin | Mandar agora um e-mail de teste para quem está na administração (SMTP salvo) |
| POST | `/admin/configuracoes/modelos-email/:chave/teste` | plataforma: admin | Admin U8: mandar o modelo (com valores de exemplo) para quem está na administração |
| GET | `/admin/configuracoes/modelos-email` | plataforma: admin | Modelos de e-mail: variáveis, texto padrão e o personalizado |
| PUT | `/admin/configuracoes/modelos-email/:chave` | plataforma: admin | Personalizar um modelo (só as variáveis que ele tem) |
| DELETE | `/admin/configuracoes/modelos-email/:chave` | plataforma: admin | Voltar o modelo ao texto padrão |
| GET | `/admin/configuracoes/precos` | plataforma: admin | Tabelas de preço dos planos, em ordem de vigência |
| PUT | `/admin/configuracoes/precos` | plataforma: admin | Cadastrar uma tabela que vale a partir de hoje ou de uma data futura (quem já assinou não muda) |
| DELETE | `/admin/configuracoes/precos/:desde` | plataforma: admin | Desistir de uma tabela que ainda não começou a valer |
| GET | `/admin/configuracoes/cupons` | plataforma: admin | Cupons de desconto, com quantas contas já usaram |
| GET | `/admin/configuracoes/respostas-chat` | plataforma: admin | Respostas prontas do chat como a equipe escreveu (com os marcadores) |
| PUT | `/admin/configuracoes/respostas-chat` | plataforma: admin | Trocar as respostas prontas do chat (lista vazia = volta às de fábrica) |
| GET | `/admin/configuracoes/cupons/relatorio` | plataforma: admin | Resultado dos cupons: contas, pagantes, receita, desconto concedido e uso por mês |
| PUT | `/admin/configuracoes/cupons` | plataforma: admin | Criar ou mudar um cupom (pelo código); desativar não tira de quem já usa |
| GET | `/admin/saude/emails` | plataforma: admin,suporte | E-mails que não saíram (destinatário mascarado, motivo do SMTP) |
| POST | `/admin/saude/emails/:id/reenviar` | plataforma: admin,suporte | Reenviar um e-mail que falhou |
| POST | `/admin/saude/emails/:id/descartar` | plataforma: admin,suporte | Descartar um e-mail que falhou, com o motivo |
| GET | `/admin/saude` | plataforma: admin,suporte | Saúde do sistema: filas, WhatsApp que caiu e erros recentes |

`apps/api/src/admin/admin-gestao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/admin/pendencias` | plataforma: admin,vendedor,suporte,financeiro | O que precisa de atenção hoje (cobrança, teste, uso, ativação, WhatsApp caído, e-mail que não saiu) |
| GET | `/admin/cobrancas` | plataforma: admin,vendedor,financeiro | Cobranças em aberto, vencidas e recebidas de todas as contas |
| GET | `/admin/equipe` | plataforma: admin | Quem opera o sistema: papel, autenticador, último acesso e vendas |
| POST | `/admin/equipe` | plataforma: admin | Dar acesso a alguém (senha temporária; autenticador no 1º acesso) |
| PUT | `/admin/equipe/:id` | plataforma: admin | Mudar o papel ou desativar/reativar (desativar encerra as sessões) |
| POST | `/admin/equipe/:id/redefinir` | plataforma: admin | Senha nova e autenticador do zero (quem perdeu o celular) |
| GET | `/admin/auditoria` | plataforma: admin | Ações da administração, com filtros (300 por vez; até 2000 para exportar) |

`apps/api/src/admin/admin-nota-fiscal.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/admin/configuracoes/nota-fiscal` | plataforma: admin,financeiro | Configuração atual da nota fiscal das mensalidades |
| PUT | `/admin/configuracoes/nota-fiscal` | plataforma: admin,financeiro | Nota fiscal das mensalidades: serviço, ISS e quando emitir |
| GET | `/admin/configuracoes/nota-fiscal/asaas` | plataforma: admin,financeiro | Dados fiscais da conta do Pente Fino no Asaas e o que falta para ligar a emissão |
| GET | `/admin/configuracoes/nota-fiscal/servicos` | plataforma: admin,financeiro | Serviços da prefeitura cadastrados no Asaas (busca por nome ou código) |
| POST | `/admin/configuracoes/nota-fiscal/aplicar` | plataforma: admin,financeiro | Aplicar a configuração salva a todas as assinaturas do sistema que já existem |

`apps/api/src/admin/admin.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/admin/auth/entrar` | plataforma: equipe | Entrar na administração: senha e código do autenticador (configura no 1º acesso) |
| GET | `/admin/eu` | plataforma: admin,vendedor,suporte,financeiro | Quem está na administração |
| GET | `/admin/eu/alertas` | plataforma: admin,vendedor,suporte,financeiro | Alertas que eu recebo por e-mail (admin F3) |
| PUT | `/admin/eu/alertas` | plataforma: admin,vendedor,suporte,financeiro | Escolher os alertas que eu recebo por e-mail (admin F3) |
| POST | `/admin/auth/sair` | plataforma: admin,vendedor,suporte,financeiro | Encerrar a sessão da administração |
| GET | `/admin/metricas` | plataforma: admin | Números do negócio: contas, MRR, conversão do teste, cancelamentos e renovações |
| GET | `/admin/metricas/saas` | plataforma: admin | Métricas de SaaS: MRR por mês (novo, upgrade, downgrade, perdido), churn, LTV e coortes |
| GET | `/admin/funil` | plataforma: admin | Funil de ativação: quantas contas fizeram cada etapa, do cadastro ao pagamento |
| GET | `/admin/contas` | plataforma: admin,vendedor,suporte,financeiro | Contas das barbearias: plano, situação, datas e uso (sem dado de cliente) |
| POST | `/admin/contas/:id/suporte` | plataforma: admin,suporte | Abrir o painel da barbearia em modo suporte, só leitura (admin F5) |
| GET | `/admin/contas/:id` | plataforma: admin,vendedor,suporte,financeiro | Ficha da conta: donos, unidades, plano, datas, cobrança e histórico |
| PUT | `/admin/contas/:id/plano` | plataforma: admin | Mudar plano e ciclo (motivo obrigatório; o Asaas acompanha) |
| PUT | `/admin/contas/:id/teste` | plataforma: admin | Estender o teste ou dar cortesia até uma data (motivo obrigatório) |
| PUT | `/admin/contas/:id/situacao` | plataforma: admin | Bloquear, desbloquear, cancelar, reativar (com o próximo passo), cortesia ou início da cobrança |
| PUT | `/admin/contas/:id/interna` | plataforma: admin | Marcar como conta interna (fora das métricas e da cobrança) ou desmarcar |
| PUT | `/admin/contas/:id/whatsapp-dono` | plataforma: admin | Trocar o WhatsApp do dono da conta (motivo obrigatório) |
| POST | `/admin/contas/:id/pagamentos` | plataforma: admin,vendedor,financeiro | Registrar pagamento manual (Pix, dinheiro, maquininha, boleto, transferência) |
| POST | `/admin/contas/:id/notas` | plataforma: admin | Nota interna da equipe sobre a conta (a barbearia não vê) |
| POST | `/admin/contas` | plataforma: admin,vendedor | Venda presencial: cria a conta e manda ao dono o convite para criar a senha |
| GET | `/admin/vendas` | plataforma: admin | Vendas por vendedor: contas criadas, ativadas pelo dono e pagas |
| GET | `/admin/vendas/origens` | plataforma: admin | Vendas por origem do cadastro: cadastros, conversão do teste e receita paga |

## agenda

`apps/api/src/agenda/agenda.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/agenda` | TODOS | Agenda da unidade no período (até 6 semanas) |
| GET | `/agenda/horarios-livres` | TODOS | Horários livres por profissional para a duração pedida |
| POST | `/agendamentos` | dono,gestor,recepcao | Agendar (cria a comanda prevista com os serviços) |
| PATCH | `/agendamentos/:id` | dono,gestor,recepcao | Remarcar (horário ou profissional) antes do atendimento começar |

`apps/api/src/agenda/espera.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/espera` | BALCAO | Lista de espera do dia na unidade, na ordem de chegada |
| POST | `/espera` | BALCAO | Pôr o cliente na lista de espera do dia |
| POST | `/espera/:id/cancelar` | BALCAO | Tirar da lista de espera |

## auth

`apps/api/src/auth/auth.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/auth/login` | público | Entrar com e-mail e senha |
| POST | `/auth/renovar` | público | Trocar o refreshToken por uma sessão nova (rotação) |
| POST | `/auth/sair` | público | Encerrar a sessão do refreshToken |
| GET | `/auth/eu` | logado | Usuário logado, com conta e papéis |
| POST | `/auth/reenviar-confirmacao` | logado | Mandar de novo o link de confirmação do e-mail |
| POST | `/auth/esqueci-senha` | público | Enviar link de redefinição de senha por e-mail |
| POST | `/auth/redefinir-senha` | público | Criar nova senha com o link recebido por e-mail |
| POST | `/auth/trocar-senha` | logado | Trocar a senha informando a atual (encerra as outras sessões) |
| POST | `/auth/convite` | público | Aceitar convite criando a senha |

## avisos

`apps/api/src/avisos/avisos.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/avisos` | PAPEIS | Meus avisos (os mais novos primeiro) e quantos ainda não li |
| GET | `/avisos/preferencias` | PAPEIS | Quais avisos vão para o celular e se o resumo vai por e-mail |
| PUT | `/avisos/preferencias` | PAPEIS | Salvar as preferências de avisos (só da própria pessoa) |
| POST | `/avisos/lidos` | PAPEIS | Marcar todos os meus avisos como lidos |
| POST | `/avisos/:id/lido` | PAPEIS | Marcar um aviso como lido |

## bot

`apps/api/src/bot/bot.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/bot` | GESTAO | Menu publicado e rascunho, mensagens prontas e horário de cada unidade |
| PUT | `/bot/menu` | dono | Salvar o rascunho do menu (pode estar incompleto; volta os problemas) |
| DELETE | `/bot/menu/rascunho` | dono | Descartar o rascunho |
| POST | `/bot/menu/publicar` | dono | Publicar o rascunho (só sem problemas); o anterior fica guardado |
| POST | `/bot/menu/restaurar` | dono | Voltar à versão publicada antes desta |
| DELETE | `/bot/unidade/:unidadeId/personalizacao` | dono | A unidade volta a usar o menu e as mensagens do padrão da barbearia |
| GET | `/bot/anuncio` | GESTAO | Mensagens automáticas de quem vem de anúncio |
| DELETE | `/bot/anuncio` | dono | A unidade volta a usar as mensagens de anúncio da barbearia |
| PUT | `/bot/anuncio` | dono | Gravar o fluxo de quem vem de anúncio: frases, mensagens em sequência e a final |
| PUT | `/bot/pesquisa` | dono | Ligar ou desligar a pesquisa de 1 a 5 depois do atendimento |
| PUT | `/bot/mensagens` | dono | Mensagens prontas (boas-vindas, fora do horário, não entendi…) |
| PUT | `/bot/horario/:unidadeId` | GESTAO | Horário do bot na unidade (null = segue o expediente da equipe) |
| GET | `/bot/automacoes` | GESTAO | Automações (retorno e aniversário) e os números de cada uma no período |
| PUT | `/bot/automacoes` | dono | Ligar e desligar o convite de retorno e o parabéns |
| PUT | `/bot/google/:unidadeId` | GESTAO | Link do Google da unidade para o convite depois da nota 5 |
| POST | `/bot/simular` | GESTAO | Conversa de teste com o rascunho ou o menu publicado (não envia nada) |
| GET | `/bot/conexao/:unidadeId` | GESTAO | Estado do WhatsApp da unidade e o QR Code enquanto aguarda a leitura |
| POST | `/bot/conexao/:unidadeId` | GESTAO | Conectar (ou reconectar) o WhatsApp da unidade: devolve o QR Code |
| DELETE | `/bot/conexao/:unidadeId` | GESTAO | Desconectar o WhatsApp da unidade |

## caixa

`apps/api/src/caixa/caixa.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/caixa` | dono,gestor,recepcao | Caixa do dia: entradas por forma, a receber e divergência |
| POST | `/caixa/abrir` | dono,gestor,recepcao | Abrir o caixa com o troco da gaveta |
| POST | `/caixa/fechar` | dono,gestor,recepcao | Fechar o caixa com a contagem da gaveta (registra a divergência) |
| POST | `/caixa/reabrir` | dono,gestor | Reabrir um caixa fechado (motivo obrigatório) |

## chat

`apps/api/src/chat/chat-painel.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/chat/minha` | dono,gestor,recepcao,profissional | Minha conversa com o suporte (Ajuda do painel); null = nenhuma |
| POST | `/chat/minha/avaliacao` | dono,gestor,recepcao,profissional | Avaliar a última conversa encerrada com o suporte |
| POST | `/chat/minha/mensagens` | dono,gestor,recepcao,profissional | Mandar mensagem ao suporte (começa a conversa se não houver aberta) |

`apps/api/src/chat/chat.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/chat/conversas` | plataforma: equipe | Começar uma conversa no chat do site (visitante) |
| GET | `/chat/conversas/:id` | plataforma: equipe | Mensagens, situação e posição na fila (visitante) |
| POST | `/chat/conversas/:id/avaliacao` | plataforma: equipe | Avaliar a conversa encerrada: foi útil? (visitante) |
| POST | `/chat/conversas/:id/mensagens` | plataforma: equipe | Mandar uma mensagem (visitante) |
| GET | `/chat` | plataforma: ...PAPEIS_CHAT | Conversas do chat: fila e em atendimento, ou encerradas |
| GET | `/chat/push` | plataforma: ...PAPEIS_CHAT | Push do chat neste aparelho: chave pública e quantos aparelhos ligados |
| POST | `/chat/push` | plataforma: ...PAPEIS_CHAT | Ligar o aviso do chat neste aparelho (push) |
| POST | `/chat/push/desligar` | plataforma: ...PAPEIS_CHAT | Desligar o aviso do chat neste aparelho |
| GET | `/chat/respostas` | plataforma: ...PAPEIS_CHAT | Respostas prontas, com os preços e os dias de teste atuais |
| GET | `/chat/resumo` | plataforma: ...PAPEIS_CHAT | Últimos 30 dias: conversas, quantas viraram cadastro e a primeira resposta |
| GET | `/chat/:id` | plataforma: ...PAPEIS_CHAT | Uma conversa com todas as mensagens |
| POST | `/chat/:id/assumir` | plataforma: ...PAPEIS_CHAT | Assumir a conversa |
| POST | `/chat/:id/mensagens` | plataforma: ...PAPEIS_CHAT | Responder (assume a conversa se ninguém assumiu) |
| POST | `/chat/:id/encerrar` | plataforma: ...PAPEIS_CHAT | Encerrar a conversa (o histórico fica guardado) |

## clientes

`apps/api/src/clientes/clientes.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/clientes` | TODOS | Buscar por nome ou telefone (50 por página) |
| GET | `/clientes/recuperar` | BALCAO_CLIENTES | Clientes para recuperar: nota baixa sem resolver, faltou e não voltou, sumiu |
| GET | `/clientes/:id` | TODOS | Cliente com histórico de comandas fechadas e anotações |
| POST | `/clientes` | dono,gestor,recepcao | Novo cliente (telefone único na conta) |
| PATCH | `/clientes/:id` | dono,gestor,recepcao | Alterar cliente |
| GET | `/clientes/:id/mensagens` | dono,gestor,recepcao | Mensagens do WhatsApp com o cliente (as 200 mais recentes) |
| POST | `/clientes/:id/notas` | TODOS | Anotar algo do atendimento (preferências, cuidados) |

`apps/api/src/clientes/dados-cliente.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/clientes/:id/dados` | dono | LGPD: tudo o que o sistema guarda do cliente, para entregar a ele |
| POST | `/clientes/:id/anonimizar` | dono | LGPD: apaga os dados pessoais do cliente (nome, telefone, e-mail, conversas, anotações); comandas e caixa ficam sem nome |

## clube

`apps/api/src/clube/clube-online.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/clube/recebimento` | dono | Conta para receber o clube online: situação no Asaas, taxa e saldo |
| POST | `/clube/recebimento` | dono | Criar a conta para receber (subconta do Asaas com os dados da barbearia) |
| GET | `/clube/recebimento/documentos` | dono | Página do Asaas para enviar os documentos da conta |
| GET | `/clube/recebimentos` | dono,gestor | Mensalidades pagas pelo link no mês, com taxas e repasse |
| GET | `/clube/itens/:id/link` | dono,gestor,recepcao | Link de assinatura do plano e a mensagem pronta para o WhatsApp |
| POST | `/clube/planos-sugeridos` | dono | Criar os planos sugeridos a partir dos serviços e preços da unidade |
| GET | `/clube/:slug` | público | Planos do clube para assinar pelo link |
| POST | `/clube/:slug/assinar` | público | Assinar um plano: devolve a página de pagamento do Asaas |

`apps/api/src/clube/clube.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/clube/itens` | BALCAO | Planos do clube (assinatura, combo, convênio) por unidade |
| POST | `/clube/itens` | dono | Novo plano do clube |
| PUT | `/clube/itens/:id` | dono | Alterar o plano (vale para os próximos atendimentos) |
| GET | `/clube/adesoes` | BALCAO | Assinantes do clube, com usos e o que resta no ciclo |
| GET | `/clube/cliente/:clienteId` | dono,gestor,recepcao,profissional | O plano do cliente (ficha e comanda); null se não é assinante |
| POST | `/clube/adesoes` | BALCAO | Colocar o cliente no plano (um plano ativo por cliente) |
| GET | `/clube/relatorio` | dono,gestor | Se o clube dá lucro: mensalidades x comissões e produto, por plano |
| GET | `/clube/pix` | dono,gestor | Pix da barbearia para as mensalidades (null = não cadastrado) |
| PUT | `/clube/pix` | dono | Cadastrar a chave Pix que recebe as mensalidades |
| GET | `/clube/adesoes/:id/mensalidade` | BALCAO | Valor, vencimento e o Pix copia e cola da mensalidade |
| POST | `/clube/adesoes/:id/pagamentos` | BALCAO | Dar baixa na mensalidade: o vencimento anda um mês |
| POST | `/clube/adesoes/:id/cancelar` | BALCAO | Cancelar a adesão, com motivo (o histórico fica) |

## cobranca

`apps/api/src/cobranca/webhook-asaas.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/webhooks/asaas` | público |  |

## comandas

`apps/api/src/comandas/comandas.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/comandas` | TODOS | Comandas do dia (barbeiro vê só as dele). status: lista separada por vírgula |
| GET | `/comandas/impressao` | dono,gestor,recepcao | PDF A4 das comandas do dia (4 ou 6 por folha), com QR code |
| GET | `/comandas/:id/historico` | TODOS | Linha do tempo da comanda: abertura, itens, pagamentos, fechar e reabrir |
| GET | `/comandas/:id` | TODOS | Comanda com itens e pagamentos |
| POST | `/comandas` | dono,gestor,recepcao | Abrir comanda na hora (cliente sem horário) |
| POST | `/comandas/:id/itens` | TODOS | Lançar serviço, produto ou receita não operacional |
| PATCH | `/comandas/:id/itens/:itemId` | TODOS | Ajustar quantidade, desconto ou trocar o serviço |
| DELETE | `/comandas/:id/itens/:itemId` | TODOS | Remover item |
| POST | `/comandas/:id/iniciar` | TODOS | Começar o atendimento |
| POST | `/comandas/:id/confirmar` | TODOS | Barbeiro confirma o que foi feito |
| POST | `/comandas/:id/nao-veio` | TODOS | Passou da tolerância e o cliente não veio: cancela como atraso |
| POST | `/comandas/:id/desfazer-nao-veio` | TODOS | Desfazer o "Não veio" em até 5 min (o cliente chegou) |
| POST | `/comandas/:id/fechar` | dono,gestor,recepcao | Receber (várias formas) e fechar: entra no faturamento e na comissão |
| POST | `/comandas/:id/cancelar` | dono,gestor,recepcao | Cancelar (falta: true quando o cliente não veio) |
| POST | `/comandas/:id/sinal` | dono,gestor,recepcao | Receber adiantado (sinal): entra no caixa de hoje e abate ao fechar |
| POST | `/comandas/:id/sinal/:pagamentoId/devolver` | dono,gestor,recepcao | Devolver o sinal ao cliente (sai do caixa de hoje) |
| POST | `/comandas/:id/reabrir` | dono,gestor | Reabrir comanda fechada (motivo obrigatório, auditado) |

## comissoes

`apps/api/src/comissoes/comissoes.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/comissoes` | GESTAO | Comissão por barbeiro no período: previsto, fechado, pago e a receber |
| GET | `/comissoes/:profissionalId/extrato` | TODOS | Extrato item por item (barbeiro só o próprio) |
| POST | `/comissoes/pagamentos` | GESTAO | Registrar comissão paga (até o que falta pagar no período) |

## configuracao

`apps/api/src/configuracao/configuracao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/configuracao/estado` | dono,gestor | Em que ponto está a configuração da conta |
| POST | `/configuracao/servicos` | dono | Criar os serviços escolhidos com preço em todas as unidades (a partir de hoje) |
| POST | `/configuracao/concluir` | dono | Marcar a configuração guiada como concluída |

## conta

`apps/api/src/conta/conta.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/conta/situacao` | logado | Situação da assinatura (teste, em dia, atrasada, só consulta) para o aviso do painel |
| GET | `/conta/assinatura` | dono | Plano, situação, fatura pendente e histórico de faturas (dono) |
| POST | `/conta/assinatura` | dono | Assinar: cria a assinatura no Asaas e devolve a página de pagamento (Pix, boleto ou cartão) |
| GET | `/conta/plano/previa` | dono | Prévia da troca de plano: valor novo, o que impede e o que deixa de usar |
| PUT | `/conta/plano` | dono | Trocar de plano (subir vale na hora; descer só cabendo no plano novo) |
| POST | `/conta/experimentar` | dono | Plano Agenda: experimentar os recursos do Básico por 7 dias (uma vez por conta) |
| POST | `/conta/assinatura/conferir` | dono | "Já paguei": busca as cobranças no Asaas e atualiza as faturas |
| GET | `/conta/primeiros-passos` | dono,gestor | Tutorial do Início: quais primeiros passos a barbearia já fez |
| GET | `/conta` | logado | Conta, plano e uso dos limites |
| GET | `/conta/suporte` | dono | Até quando o suporte do Pente Fino pode ver o painel (admin F5) |
| PUT | `/conta/suporte` | dono | Liberar por 24 h (ou cancelar) o acesso de suporte, só leitura (admin F5) |
| PATCH | `/conta` | dono | Alterar o nome da barbearia |

`apps/api/src/conta/sistema.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/sistema/aviso` | TODOS | Aviso geral em vigor (manutenção programada, novidade) ou nenhum |

## conversas

`apps/api/src/conversas/conversas.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/conversas` | QUEM_CONVERSA | Conversas da unidade: quem espera atendente primeiro, depois as mais recentes |
| GET | `/conversas/cliente/:clienteId` | QUEM_CONVERSA | Dá para mandar mensagem a este cliente pelo número da barbearia? Se não, por quê |
| POST | `/conversas/cliente/:clienteId` | QUEM_CONVERSA | Mandar mensagem pelo bot (só para quem já escreveu e não pediu SAIR) |
| GET | `/conversas/:id/mensagens` | QUEM_CONVERSA | Mensagens da conversa, em ordem (as 200 mais recentes) |
| GET | `/conversas/:id/estados` | QUEM_CONVERSA | Histórico do estado da conversa (bot, aguardando, atendimento) |
| POST | `/conversas/:id/responder` | QUEM_CONVERSA | Responder pelo painel: a equipe assume e o bot fica quieto |
| POST | `/conversas/:id/assumir` | QUEM_CONVERSA | Assumir a conversa: o bot para de responder este cliente |
| POST | `/conversas/:id/devolver` | QUEM_CONVERSA | Devolver ao bot, com a mensagem de encerramento |

## desempenho

`apps/api/src/desempenho/desempenho.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/profissionais/desempenho` | GESTAO | Ranking da equipe no período (dono: rede; gestor: sua unidade) |
| GET | `/profissionais/:id/desempenho` | dono,gestor,profissional | Ficha do profissional: dono e gestor da unidade, ou o próprio barbeiro (sem margem) |

`apps/api/src/desempenho/ocupacao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/ocupacao` | GESTAO | Ocupação da unidade no período: total, por faixa do dia e hora a hora (mapa da semana) |

`apps/api/src/desempenho/rede.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/rede` | GESTAO | Painel da rede: unidades lado a lado e o total (dono: todas; gestor: as dele) |

## despesas

`apps/api/src/despesas/despesas.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/categorias-despesa` | GESTAO | Categorias e o grupo de cada uma |
| POST | `/categorias-despesa` | dono | Nova categoria |
| GET | `/despesas` | GESTAO | Despesas da competência (gestor vê só a unidade dele) |
| GET | `/despesas/fixas-para-copiar` | GESTAO | Prévia do "Copiar fixas do mês anterior": as fixas que ainda não vieram para o mês |
| POST | `/despesas/copiar-fixas` | GESTAO | Copiar para o mês as fixas do mês anterior que a pessoa confirmou |
| POST | `/despesas` | GESTAO | Lançar despesa |
| PATCH | `/despesas/:id` | GESTAO | Alterar despesa ou marcar como paga |
| DELETE | `/despesas/:id` | GESTAO | Excluir despesa |

## exportacao

`apps/api/src/exportacao/exportacao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/exportacao` | GESTAO | Relatório do mês para o contador (CSV ou PDF) |

## importacao

`apps/api/src/importacao/importacao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/importacao/:tipo` | dono | Conferir (simular: true) ou importar linhas da planilha |

## indicacao

`apps/api/src/indicacao/indicacao.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/publico/indicadores` | plataforma: equipe | Indique e ganhe: cadastro de quem indica (qualquer pessoa) |
| GET | `/publico/indicadores/painel` | plataforma: equipe | Painel de quem indica (pelo link secreto, no cabeçalho) |
| GET | `/publico/indicadores/codigo/:codigo` | plataforma: equipe | O código do link de indicação vale? (cadastro da barbearia) |
| GET | `/publico/indicadores` | plataforma: equipe | Indique e ganhe do dono: link, indicadas e comissões |
| PUT | `/publico/indicadores` | plataforma: equipe | Entrar no indique e ganhe ou trocar Pix e meses grátis |
| GET | `/publico/indicadores` | plataforma: admin,financeiro | Quem indica: Pix a pagar e meses grátis a aplicar |
| POST | `/publico/indicadores/:id/pagar` | plataforma: admin,financeiro | Marcar o Pix do mês como pago (o que já liberou) |
| POST | `/publico/indicadores/comissoes/:id/aplicar` | plataforma: admin,financeiro | Marcar o mês grátis como aplicado na assinatura |

## me

`apps/api/src/me/assistente.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/me/assistente` | TODOS | Situação do assistente da equipe no WhatsApp |
| POST | `/me/assistente` | TODOS | Ligar: gera o código para mandar ao WhatsApp da unidade ("ATIVAR código") |
| PUT | `/me/assistente/avisos` | TODOS | Escolher os avisos que o assistente manda |
| DELETE | `/me/assistente` | TODOS | Desligar: o número deixa de ser do assistente |

`apps/api/src/me/me.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/me/precos` | TODOS | Meus preços: os serviços da unidade em que atendo, com o preço dela e o meu |
| PUT | `/me/precos` | TODOS | Mudar meus preços (vale de hoje em diante; null volta para o preço da unidade) |
| GET | `/me/hoje` | TODOS | Próximos clientes do dia, comissão do dia e do mês, metas da unidade |
| GET | `/me/desempenho` | TODOS | Meu mês contra o mês anterior |
| GET | `/me/comissoes` | TODOS | Meu extrato de comissões no período |

`apps/api/src/me/push.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/me/push` | TODOS | Chave pública do push e quantos aparelhos estão ligados |
| POST | `/me/push` | TODOS | Ligar as notificações neste aparelho |
| POST | `/me/push/remover` | TODOS | Desligar as notificações neste aparelho |
| POST | `/me/push/teste` | TODOS | Mandar uma notificação de teste para os aparelhos ligados |

## produtos

`apps/api/src/produtos/produtos.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/produtos` | TODOS | Produtos à venda (custo só para dono e gestor) |
| POST | `/produtos` | dono | Novo produto |
| PATCH | `/produtos/:id` | dono | Alterar produto (não muda comandas já lançadas) |

## profissionais

`apps/api/src/profissionais/profissionais.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/profissionais` | TODOS | Profissionais (barbeiro vê só o próprio cadastro; comissão só para dono e gestor) |
| POST | `/profissionais` | GESTAO | Novo profissional (de alguém da equipe ou convidando um novo barbeiro) |
| PATCH | `/profissionais/:id` | GESTAO | Datas de entrada e saída; ativar ou desativar |
| PUT | `/profissionais/:id/horarios` | GESTAO | Expediente semanal (substitui o atual) |
| PUT | `/profissionais/:id/servicos` | GESTAO | Serviços que o barbeiro faz (vazio = todos); vale no link, bot e site |
| POST | `/profissionais/:id/regras-comissao` | GESTAO | Nova regra de comissão a partir de uma data |
| GET | `/profissionais/:id/bloqueios` | TODOS | Bloqueios de agenda no período |
| POST | `/profissionais/:id/bloqueios` | dono,gestor,recepcao | Bloquear um horário (almoço, folga, compromisso) |
| DELETE | `/profissionais/:id/bloqueios/:bloqueioId` | dono,gestor,recepcao | Remover um bloqueio |
| GET | `/profissionais/:id/bloqueios-recorrentes` | dono,gestor,recepcao | Bloqueios que repetem toda semana (almoço de toda terça) |
| POST | `/profissionais/:id/bloqueios-recorrentes` | dono,gestor,recepcao | Bloquear um horário toda semana |
| DELETE | `/profissionais/:id/bloqueios-recorrentes/:bloqueioId` | dono,gestor,recepcao | Remover um bloqueio que repete |

## publico

`apps/api/src/publico/horario-publico.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/publico/horario/:token` | público | O horário do link: quando, com quem, e se ainda dá para mudar |
| GET | `/publico/horario/:token/horarios` | público | Horários livres para remarcar (mesmo serviço e profissional) |
| POST | `/publico/horario/:token/remarcar` | público | Remarcar pelo link (mesmo serviço e profissional) |
| POST | `/publico/horario/:token/antecipar` | público | "Me avise se vagar antes": entra na lista para antecipar este horário |
| POST | `/publico/horario/:token/cancelar` | público | Cancelar pelo link (libera o horário, não conta como falta) |

`apps/api/src/publico/publico.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/publico/precos` | público | Preços dos planos que valem hoje (site e cadastro) |
| GET | `/publico/contato` | público | WhatsApp comercial do site de vendas (rodapé e fim da página) |
| GET | `/publico/cupom/:codigo` | público | Conferir um cupom antes de se cadastrar (desconto ou o motivo) |
| POST | `/publico/contas` | público | Criar conta (barbearia + dono) e já entrar |
| POST | `/publico/confirmar-email` | público | Confirmar o e-mail pelo link (cadastro pelo site) |
| GET | `/publico/agendamento/:slug` | público | Dados da página de agendamento: serviços com preço e barbeiros |
| GET | `/publico/site/:slug` | público | Site publicado da barbearia (blocos do dono e dados vivos); 404 sem site publicado |
| GET | `/publico/dominio/:host` | público | Domínio próprio (lote 7e): os endereços do site e do agendamento da unidade |
| GET | `/publico/dominio-liberado` | público | Pergunta do Caddy antes de emitir o certificado: o domínio é de uma barbearia? |
| GET | `/publico/endereco-antigo/:tipo/:slug` | público | Endereço que a unidade deixou de usar: devolve o atual (link ou site) para redirecionar |
| GET | `/publico/fotos/:arquivo` | público | Foto do site da barbearia (<id>-640.webp ou <id>-1600.webp) |
| GET | `/publico/paginas` | público | Páginas de barbearia que aparecem no Google (para o sitemap): endereço e data |
| GET | `/publico/sites` | público | Sites de barbearia publicados que aparecem no Google (para o sitemap) |
| GET | `/publico/agendamento/:slug/cliente` | público | Quem veio pelo link do bot: nome e telefone para preencher |
| GET | `/publico/agendamento/:slug/horarios` | público | Horários livres para os serviços escolhidos |
| POST | `/publico/agendamento/:slug` | público | Agendar pelo link (cria cliente pelo telefone e a comanda prevista) |
| POST | `/publico/agendamento/:slug/espera` | público | "Avise-me se vagar": entra na lista de espera do dia pelo site |

## resultados

`apps/api/src/resultados/relatorio.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/relatorio/mes` | dono,gestor | Relatório do mês contra o anterior: indicadores, clientes, canais, barbeiros (custo e lucro), mix e 12 meses |
| GET | `/relatorio/mes/arquivo` | dono,gestor | Relatório do mês para baixar: planilha (CSV) ou PDF |

`apps/api/src/resultados/resultados.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/indicadores` | dono,gestor | Faturamento, clientes, ticket, atendimentos, extras, % despesas, lucro e projeção |
| GET | `/avaliacoes` | dono,gestor | Notas do atendimento e da barbearia, notas baixas e comentários do período |
| POST | `/avaliacoes/:id/tratar` | dono,gestor | Marcar a nota baixa como resolvida, com o que foi feito |
| GET | `/canais` | dono,gestor | Por onde os clientes marcam: agendados, atendidos, faltas e faturamento por canal |
| GET | `/anuncios` | dono,gestor | Clientes que vieram de anúncio: conversas, novos e quanto gastaram |
| GET | `/lucratividade` | dono,gestor | Lucro e margem por serviço (receita − custo de produto − comissão) |
| GET | `/metas` | TODOS | Metas do mês com o atual calculado |
| PUT | `/metas` | dono | Definir meta do mês (substitui a mesma meta, se existir) |
| DELETE | `/metas/:id` | dono | Remover meta |

## resumo

`apps/api/src/resumo/resumo.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/resumo/dia` | GESTAO | O que tem para o dia e o que já foi feito, por profissional |
| GET | `/resumo/saude` | GESTAO | Saúde da conta no Início: caixa de dia anterior aberto e comandas paradas |
| GET | `/resumo/mes` | GESTAO | O mês dia a dia: agenda, faltas, clientes e faturamento |
| GET | `/resumo/agenda` | GESTAO | Plano Agenda: os números da agenda do mês para o Início |

## saude

`apps/api/src/saude/raiz.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/` | público |  |

`apps/api/src/saude/saude.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/health` | público | Banco e Redis respondendo? 200 se sim, 503 se não |

## servicos

`apps/api/src/servicos/servicos.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/servicos` | TODOS | Catálogo de serviços (custo só para dono e gestor) |
| GET | `/servicos/preco-livre` | TODOS | Quem digita o valor dos serviços com preço livre |
| PUT | `/servicos/preco-livre` | dono | Liberar (ou não) o barbeiro para digitar o preço livre |
| POST | `/servicos` | dono | Novo serviço |
| PATCH | `/servicos/:id` | dono | Alterar serviço (não muda comandas já lançadas) |
| GET | `/precos` | TODOS | Tabela de preços vigente numa data (padrão: hoje) e mudanças programadas |
| GET | `/servicos/:id/precos` | TODOS | Histórico de preços do serviço por unidade |
| POST | `/precos` | dono | Novos preços a partir de uma data (hoje ou depois). O passado não muda. |

## site

`apps/api/src/site/depoimentos.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/publico/depoimentos` | plataforma: equipe | Depoimentos ativos da página de vendas (carrossel) |
| GET | `/publico/depoimentos/:id/foto` | plataforma: equipe | Foto de um depoimento ativo |
| GET | `/publico/depoimentos` | plataforma: admin | Todos os depoimentos (ativos e escondidos) |
| POST | `/publico/depoimentos/instagram` | plataforma: admin | Tentar puxar o nome e a foto do perfil do Instagram |
| POST | `/publico/depoimentos` | plataforma: admin | Novo depoimento (tenta puxar a foto do Instagram) |
| PUT | `/publico/depoimentos/:id` | plataforma: admin | Alterar o depoimento (texto, data, mostrar ou esconder) |
| PUT | `/publico/depoimentos/:id/foto` | plataforma: admin | Enviar a foto (quando o Instagram não deixa puxar) |
| DELETE | `/publico/depoimentos/:id` | plataforma: admin | Apagar o depoimento |

## unidades

`apps/api/src/unidades/unidades.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/unidades/:id/funcionamento` | GESTAO | Horário de funcionamento da unidade (turnos por dia da semana) |
| PUT | `/unidades/:id/funcionamento` | GESTAO | Gravar o horário de funcionamento: o agendamento só oferece horário dentro dele (vazio = sem limite) |
| GET | `/unidades/:id/agendamento-visual` | GESTAO | Visual da página de agendamento (cor, logotipo, capa, boas-vindas) |
| PUT | `/unidades/:id/agendamento-visual` | GESTAO | Gravar o visual da página de agendamento (vale na hora) |
| GET | `/unidades/:id/regras-agendamento` | GESTAO | Regras de agendamento da unidade (antecedência, janela, prazos, lembretes) |
| PUT | `/unidades/:id/regras-agendamento` | GESTAO | Gravar as regras de agendamento da unidade (bot e site) |
| PUT | `/unidades/:id/site/dominio` | GESTAO | Domínio próprio do site (lote 7e): grava e já confere o DNS |
| POST | `/unidades/:id/site/dominio/verificar` | GESTAO | Conferir de novo o DNS do domínio próprio |
| DELETE | `/unidades/:id/site/dominio` | GESTAO | Tirar o domínio próprio (o site segue no endereço do Pente Fino) |
| GET | `/unidades/:id/site` | GESTAO | Site da unidade para editar: rascunho (ou o sugerido) e situação |
| PUT | `/unidades/:id/site` | GESTAO | Gravar o rascunho do site (não muda o que o cliente vê) |
| POST | `/unidades/:id/site/fotos` | GESTAO | Enviar foto do site (reduzida no navegador; refeita aqui sem os dados da câmera) |
| PUT | `/unidades/:id/site/endereco` | GESTAO | Trocar o endereço do site (/s/<slug>); o antigo passa a levar ao novo |
| GET | `/unidades/:id/site/previa` | GESTAO | Prévia do site com o rascunho e os dados vivos da unidade |
| POST | `/unidades/:id/site/publicar` | GESTAO | Publicar o rascunho no endereço do site (/s/<site_slug>); sem endereço, usa a sugestão |
| DELETE | `/unidades/:id/site/publicado` | GESTAO | Tirar o site do ar (o rascunho e o endereço ficam guardados) |
| GET | `/unidades` | logado | Unidades que o usuário alcança (papel sem unidade = todas da conta) |
| POST | `/unidades` | dono | Nova unidade (respeita o limite do plano) |
| POST | `/unidades/:id/copiar-catalogo` | dono | Copiar o catálogo de outra unidade: serviços (com os preços de hoje) e produtos |
| POST | `/unidades/:id/copiar-configuracoes` | GESTAO | Copiar configurações de outra unidade, escolhendo o que vem |
| PATCH | `/unidades/:unidadeId` | dono | Alterar unidade (nome, endereço, dias de trabalho, capacidade, ativa) |
| GET | `/unidades/:unidadeId/calendario` | TODOS | Folgas, feriados e dias extras da unidade no período |
| PUT | `/unidades/:unidadeId/calendario/:data` | GESTAO | Marcar um dia como folga/feriado (trabalha: false) ou dia extra (true) |
| DELETE | `/unidades/:unidadeId/calendario/:data` | GESTAO | Voltar o dia ao expediente normal da unidade |

## usuarios

`apps/api/src/usuarios/usuarios.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/usuarios` | dono,gestor | Equipe: usuários, papéis e situação (gestor vê só a unidade dele) |
| POST | `/usuarios/convites` | dono,gestor | Convidar alguém para a equipe (e-mail e link de WhatsApp) |
| PUT | `/usuarios/:id/papeis` | dono,gestor | Trocar os papéis de um usuário (encerra as sessões dele) |
| PATCH | `/usuarios/:id` | dono,gestor | Desativar ou reativar o acesso de um usuário |

## visitas

`apps/api/src/visitas/visitas.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/visitas` | plataforma: equipe | Eventos anônimos da visita à página de vendas (entrada, rolagem, clique) |
| GET | `/visitas` | plataforma: admin | Visitantes da página de vendas: hoje, 7 dias e o funil |

## whatsapp

`apps/api/src/whatsapp/webhooks.controller.ts`

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| POST | `/webhooks/whatsapp` | público |  |

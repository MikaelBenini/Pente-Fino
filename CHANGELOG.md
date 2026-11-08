# Changelog

O que muda no Pente Fino, do ponto de vista de quem usa e de quem opera. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as datas são as da publicação em
produção (`https://seupentefino.com.br`). Detalhes técnicos e o porquê de cada item ficam na
[linha de desenvolvimento](docs/linha-de-desenvolvimento.md) e nos pull requests citados.

## [Não publicado]

### Adicionado (alerta do WhatsApp)

- WhatsApp da unidade que cai sozinho avisa na hora: aviso na central para dono e gestor,
  notificação no celular e e-mail para os donos com o botão "Reconectar o WhatsApp" (modelo
  editável na administração).

### Adicionado (status)

- `infra/status.sh`: configura o Uptime Kuma de uma vez — monitores do site, API, painel do
  WhatsApp, backup e disco/memória, alerta por e-mail e página pública
  `status.seudominio/status/pente-fino`; grava as URLs push no `.env`.

### Adicionado (limpeza de dados)

- Limpeza automática de dados, todo dia às 3h30: conversas do bot, logins e links vencidos, avisos
  lidos e trabalhos das filas com mais de 90 dias saem; avaliações perdem o comentário (a nota
  fica). Conta criada pelo site sem confirmar o e-mail sai em 7 dias (aviso 2 dias antes); conta
  cancelada ou com o teste vencido sem pagamento sai 90 dias depois (avisos 15 e 3 dias antes).
  Conta com cobrança ativa no Asaas fica retida. Saúde do sistema mostra o que cada execução
  apagou.
- Privacidade e termos com os prazos de guarda (versão 2026-11-08).

### Adicionado (nota fiscal)

- Nota fiscal de serviço (NFS-e) das mensalidades do Pente Fino, emitida pelo Asaas: configuração
  em `/admin` → Configurações (serviço da prefeitura ou código, ISS, retenções, emitir no pagamento
  ou no vencimento), conferência dos dados fiscais no Asaas e "Aplicar às assinaturas atuais". As
  assinaturas novas já saem com a nota ligada.

### Adicionado (clube online)

- Clube online: a barbearia ativa em Clube → "Receber online" uma conta no Asaas; cada plano ganha
  "Copiar link" e "Mandar pelo WhatsApp"; o cliente assina pela página `/assinar` no Pix ou no
  cartão e a mensalidade é cobrada todo mês, caindo direto na conta da barbearia (split). A
  adesão nasce e renova sozinha a cada pagamento; repasses, taxas e saldo na mesma aba; aviso de
  novo assinante na central. "Criar planos sugeridos" monta os planos a partir dos preços.
- Administração: taxa da plataforma sobre o clube online, ajustável em Configurações.

### Segurança

- Cadastro pelo site protegido contra robôs: campo isca invisível, tempo mínimo de preenchimento,
  limite de 3 contas por hora e 10 por dia por conexão e recusa de e-mail descartável.
- Confirmação de e-mail no cadastro pelo site: até clicar no link do e-mail de boas-vindas, a conta
  não agenda, não convida a equipe nem conecta o WhatsApp; aviso no painel com "Reenviar e-mail".

### Alterado

- Página inicial nova: telas reais do sistema no topo (computador e celular), "Faturamento não é
  lucro", vídeo, recursos em mosaico com as telas, calculadora "Quanto sobra de cada corte?",
  comparação com app de agenda comum e planilha, perguntas frequentes atualizadas. Seção de
  depoimentos pronta para quando houver depoimentos reais autorizados.

### Adicionado

- Site público: Google Tag Manager e tag do Google Ads com aviso de cookies e Consent Mode —
  sem "Aceitar", nada de cookie de anúncio; evento `cadastro_concluido` para medir conversão.
  Privacidade atualizada.
- Home: vídeo de 1 minuto do sistema funcionando (agenda, comanda no celular, fechamento, lucro do
  mês e agendamento pelo WhatsApp), gravado da conta de demonstração por roteiro (`apps/web/video`).
- Bot do WhatsApp: depois de escolher um serviço, o cliente pode adicionar outro (corte + barba)
  antes de ir para o horário; o bot mostra o total anotado (Etapa 15.3).
- Cancelar comanda: caixa "Avisar o cliente pelo WhatsApp", que manda o cancelamento com o
  convite para marcar outro horário (Etapa 15.3).
- Mover horário: caixa "Avisar o cliente" também quando muda o horário (antes o aviso saía
  sempre); desmarcada, o cliente não recebe nada (Etapa 15.3).
- Sino de avisos: o primeiro toque pede a permissão do navegador e liga as notificações no
  aparelho; a tela de Avisos mostra o convite enquanto não estiverem ligadas (#109).
- Segurança: 5 senhas erradas seguidas bloqueiam o login daquele e-mail por 15 minutos
  (barbearias e administração); política de conteúdo (CSP) no site (#108, Etapa 21).

### Corrigido

- Arquivos de `/video` eram tratados como página com login e redirecionavam para `/entrar`.
- Teste da administração prática que quebrava o CI do `main` (#108).

## 2026-11-08

### Adicionado

- Administração por abas: Início com "Precisa de atenção" (cobrança vencida, teste acabando,
  dono que não ativou, conta parada), Cobrança de todas as contas, Equipe (dar e tirar acesso
  sem o servidor), Auditoria com filtros, contas com ordenação e planilha (#107, Etapa 15.2).
- Backup diário criptografado do banco e das sessões do WhatsApp, com restauração testada;
  monitoramento (Uptime Kuma em `status.`) e vigia de disco e memória; deploy automático a cada
  merge, com chave restrita (#106, Etapas 17 a 19).
- E-mails com a marca (cabeçalho com a logo, botão amarelo, rodapé com o site), textos novos em
  todos os modelos, e-mail de boas-vindas no cadastro pelo site e aviso de senha alterada
  editável (#105).

## 2026-11-07

### Adicionado

- Sistema no ar em `https://seupentefino.com.br` (o site e o painel no domínio principal; `www`
  e `app.` redirecionam), com HTTPS automático (#100, #103).
- E-mail: botão "Testar conexão" do SMTP e e-mail de teste que mostra a resposta do servidor
  (#101, #103).
- Ícone da aba e do app instalado iguais à logo (#101).

### Corrigido

- Sitemap, robots e prévia de link saíam com `localhost` (#104).
- Imagens Docker de volta ao Node 24 LTS: o Node 25 não traz o `corepack` (#94).

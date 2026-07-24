# Volt Tray Dashboard

## Modo todos os pedidos do mês

Para contar todos os pedidos, independentemente do status, use `STATUS=*`. A sincronização consulta o período do primeiro dia do mês atual até o fim do dia atual. O webhook aceita qualquer status e mantém o pedido atualizado.

No Render, configure `APP_URL=https://dashtray.onrender.com`. Se o log informar autorização expirada ou revogada, abra a aba **Integração Tray** e autorize novamente a loja, pois tokens inválidos não podem ser recuperados pelo código.


Painel dark, moderno e responsivo para acompanhar pedidos mensais da Tray, metas configuráveis e atualizações ao vivo.

## O que está pronto

- Autorização oficial da Tray com `consumer_key`, `consumer_secret`, `code` e `api_address`.
- Renovação automática de `access_token` usando `refresh_token`.
- Tokens criptografados no Neon com AES-256-GCM.
- Carga do primeiro dia do mês atual até o dia atual via `GET /orders`, paginação de 50 registros e filtro por `STATUS`.
- Webhook `order_insert`, `order_update` e `order_delete`.
- Deduplicação de notificações idênticas em janelas de 30 segundos.
- Retentativa persistente de webhooks com backoff exponencial e recuperação após reinício.
- Fila de requisições por loja para respeitar os limites da Tray.
- Fechamento mensal e agrupamento diário no fuso `America/Sao_Paulo`.
- Socket.IO para atualizar o contador, gráfico e pedidos recentes sem recarregar a página.
- Meta mensal editável, percentual atingido, faltantes, ritmo diário necessário e contagem regressiva até o fim do mês.
- Menu lateral recolhível e modo de tela cheia com contador animado.
- Prisma Migrate executado automaticamente no start do Render.
- Autenticação administrativa por cookie HTTP-only.
- Health check em `/health`.

## Stack

- React 19 + Vite
- TypeScript
- Express 5
- Socket.IO
- Prisma ORM + PostgreSQL Neon
- Recharts
- Render Web Service

## 1. Instalação local

```bash
npm install
cp .env.example .env
npm run secret:generate
npm run admin:hash -- "SUA SENHA FORTE"
```

Copie os três segredos gerados para o `.env`. Cole o hash retornado em `ADMIN_PASSWORD_HASH`.

No Neon, copie:

- A URL com pool em `DATABASE_URL`.
- A URL direta, sem `-pooler`, em `DIRECT_URL`.

Depois execute:

```bash
npm run db:migrate:deploy
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`

## 2. Credenciais Tray

Preencha no `.env`:

```env
TRAY_CONSUMER_KEY=...
TRAY_CONSUMER_SECRET=...
STATUS=A ENVIAR
```

`STATUS` deve ser exatamente o nome do status da Tray que entrará no contador. A listagem mensal e cada pedido consultado após o webhook passam por esse mesmo filtro.

O código de autorização de 64 caracteres não deve entrar no Git. Há três maneiras de concluir a conexão:

1. Abrir a aba **Integração Tray** e informar `api_address` e `code`.
2. Usar o fluxo oficial de instalação e callback.
3. Executar o script abaixo:

```bash
npm run tray:connect -- \
  --api-address=https://sualoja.com.br/web_api \
  --store-host=https://sualoja.com.br \
  --code=CODIGO_RECEBIDO_DA_TRAY
```

O código é usado para gerar os tokens e não é armazenado.

## 3. URLs que devem ser cadastradas

Após publicar, configure `APP_URL` com o endereço final do Render, sem barra no fim.

- Callback principal: `${APP_URL}/tray/callback`
- Retorno OAuth: `${APP_URL}/tray/callback/auth`
- Webhook: `${APP_URL}/api/tray/webhook?token=${TRAY_WEBHOOK_TOKEN}`

A URL exata aparece na aba **Integração Tray**.

A Tray exige abertura de chamado para ativar a URL de notificação do webhook no aplicativo. Solicite inicialmente o escopo `order`.

## 4. Logo própria

Coloque a logo em:

```text
client/public/logo.png
```

Recomendação: PNG transparente, aproximadamente 320 x 96 px. Caso o arquivo não exista, o painel exibe o monograma `D`.

## 5. Deploy no Render

1. Suba este projeto para GitHub.
2. No Render, escolha **New > Blueprint** e selecione o repositório.
3. O arquivo `render.yaml` criará o Web Service.
4. Preencha todas as variáveis marcadas como `sync: false`.
5. Em `APP_URL`, informe a URL final, por exemplo `https://volt-tray-dashboard.onrender.com`.
6. Faça o deploy.

O comando de inicialização executa:

```bash
prisma migrate deploy
node dist/server/index.js
```

Assim, cada deploy aplica as migrations pendentes antes de iniciar o servidor.

## 6. Sincronização

O projeto combina três camadas:

- **Carga mensal inicial:** busca todas as páginas do primeiro dia do mês atual até o dia de hoje, usando o `STATUS` configurado.
- **Webhook:** ao receber o ID de um pedido, consulta o registro completo e só mantém no contador se a data estiver no mês atual e o status for igual a `STATUS`.
- **Reconciliação automática:** o cron repete a sincronização do período ao vivo a cada hora por padrão e remove registros que deixaram o status monitorado.

Altere o cron com:

```env
SYNC_CRON=*/3 * * * *
```

Em planos gratuitos, o Render pode suspender a instância sem tráfego. O webhook reativa o serviço, mas uma instância sempre ativa oferece comportamento mais consistente para a reconciliação periódica.

## 7. Scripts úteis

```bash
npm run typecheck
npm test
npm run build
npm run db:studio
npm run db:migrate
npm run db:migrate:deploy
npm run demo:seed
```

## 8. Segurança

- Nunca envie `consumer_secret`, tokens, `DATABASE_URL` ou chaves de criptografia para o Git.
- Use um `TRAY_WEBHOOK_TOKEN` longo na URL registrada.
- Se a chave `TOKEN_ENCRYPTION_KEY` for trocada, os tokens já gravados não poderão ser descriptografados. Reautorize a loja após a troca.
- O webhook responde HTTP 200 rapidamente e processa o evento após persistir a notificação.
- O payload da Tray não possui assinatura documentada. Por isso o projeto valida o token secreto da URL e o `seller_id` contra lojas autorizadas.

## Documentação consultada

- Tray Developers: https://developers.tray.com.br
- Render Web Services: https://render.com/docs/web-services
- Render Blueprints: https://render.com/docs/blueprint-spec
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- Prisma migrate deploy: https://www.prisma.io/docs/cli/migrate/deploy

## Níveis de meta e atualização a cada 3 minutos

A versão atual permite configurar até 8 níveis mensais de meta. Os níveis devem ser crescentes, por exemplo:

- Meta Base: 1.000 pedidos
- Meta Ouro: 1.250 pedidos
- Meta Diamante: 1.500 pedidos

Quando um nível é alcançado, o backend registra a conquista uma única vez na tabela `goal_achievements`, atualiza automaticamente a meta ativa e envia o evento `goal:achieved` por Socket.IO. O frontend exibe confetes, alerta festivo, som curto e a próxima meta.

A nova migration é aplicada automaticamente no Render pelo comando `prisma migrate deploy`:

```text
prisma/migrations/202607240002_goal_levels/migration.sql
```

Para sincronizar os pedidos a cada 3 minutos, configure no ambiente local e no Render:

```env
SYNC_CRON=*/3 * * * *
```

A tela cheia mostra somente a tag animada `AO VIVO`. O gráfico desse modo exibe a quantidade de pedidos de cada dia; o dashboard administrativo mantém o gráfico acumulado versus ritmo da meta.

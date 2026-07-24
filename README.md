# Volt Tray Dashboard

Painel dark, moderno e responsivo para acompanhar pedidos mensais da Tray, metas configuráveis e atualizações ao vivo.

## O que está pronto

- Autorização oficial da Tray com `consumer_key`, `consumer_secret`, `code` e `api_address`.
- Renovação automática de `access_token` usando `refresh_token`.
- Tokens criptografados no Neon com AES-256-GCM.
- Carga inicial do mês via `GET /orders`, paginação de 50 registros e filtro de data.
- Webhook `order_insert`, `order_update` e `order_delete`.
- Deduplicação de notificações idênticas em janelas de 30 segundos.
- Retentativa persistente de webhooks com backoff exponencial e recuperação após reinício.
- Fila de requisições por loja para permanecer abaixo do limite por minuto da Tray.
- Fechamento mensal e agrupamento diário no fuso `America/Sao_Paulo`.
- Socket.IO para atualizar o contador, gráfico e pedidos recentes sem recarregar a página.
- Meta mensal editável pelo administrador.
- Menu lateral ocultável para liberar toda a largura e modo de tela cheia com contador animado.
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
TRAY_ALLOWED_HOSTNAMES=www.drossiinteriores.com.br,drossiinteriores.com.br,*.commercesuite.com.br,*.tray.com.br
```

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

Os scripts usados pelo Blueprint são:

```text
scripts/render-build.sh
scripts/render-start.sh
```

O script de inicialização executa `prisma migrate deploy` no Neon antes de subir o servidor. Para aplicar migrations manualmente, use:

```bash
bash scripts/neon-migrate.sh
```

Assim, cada deploy aplica as migrations pendentes antes de iniciar o servidor.

## 6. Sincronização

O projeto combina três camadas:

- **Carga mensal inicial:** busca todas as páginas de pedidos do mês.
- **Webhook:** ao receber o ID de um pedido, consulta somente aquele registro.
- **Reconciliação automática:** o cron repete a sincronização do mês a cada hora por padrão.

Altere o cron com:

```env
SYNC_CRON=0 * * * *
```

O `render.yaml` está no plano gratuito para homologação. Nesse plano, a instância pode suspender sem tráfego e o primeiro webhook após a pausa pode sofrer atraso de inicialização. Para um placar realmente contínuo em TV ou operação, altere o plano para uma instância sempre ativa.

## 7. Scripts úteis

```bash
npm run verify
# ou separadamente:
npm run typecheck
npm test
npm run build
npm run db:studio
npm run db:migrate
npm run db:migrate:deploy
npm run demo:seed
```

## 8. Segurança

- Nunca envie `consumer_secret`, códigos de autorização, tokens, `DATABASE_URL` ou chaves de criptografia para o Git.
- Use um `TRAY_WEBHOOK_TOKEN` longo na URL registrada.
- Se a chave `TOKEN_ENCRYPTION_KEY` for trocada, os tokens já gravados não poderão ser descriptografados. Reautorize a loja após a troca.
- O webhook responde HTTP 200 rapidamente e processa o evento após persistir a notificação.
- Falhas transitórias da Tray são repetidas; eventos com falha ficam no Neon e são retomados pelo scheduler.
- O payload da Tray não possui assinatura documentada. Por isso o projeto valida o token secreto da URL e o `seller_id` contra lojas autorizadas.

## Documentação consultada

- Tray Developers: https://developers.tray.com.br
- Render Web Services: https://render.com/docs/web-services
- Render Blueprints: https://render.com/docs/blueprint-spec
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- Prisma migrate deploy: https://www.prisma.io/docs/cli/migrate/deploy

# Atualização automática leve v1.4

- A tela aberta aciona uma sincronização real com a Tray a cada 3 minutos.
- O cron do servidor continua ativo como redundância.
- O Socket.IO envia somente total, variação e quantidade do dia.
- Na tela cheia, apenas o contador e a barra do dia são alterados.
- O componente da tela cheia não é mais remontado ao entrar pedido.
- Incrementos positivos exibem +1, +2 ou a diferença real.
- Os logs do Render mostram `[sync:auto]` e `[sync:browser]`.

Não há migration nem variável nova. Mantenha `SYNC_CRON=*/3 * * * *`.

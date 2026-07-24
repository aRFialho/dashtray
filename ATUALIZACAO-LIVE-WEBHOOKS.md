# Atualização 1.2.0: tela cheia e central de webhooks

## Recursos

- Botão **Atualizar agora** na tela cheia ao vivo.
- Projeção de fechamento mensal na tela cheia.
- Recados de incentivo conforme meta, projeção e ritmo necessário.
- Gráfico diário mantido na tela cheia.
- Nova subaba **Webhooks** dentro de **Integração Tray**.
- Indicadores de eventos recebidos, processados, em fila e com erro.
- Histórico com filtros por situação.
- Teste do pipeline interno.
- Reprocessamento individual e em lote de falhas.

## Deploy

Não há nova migration e não foram adicionadas dependências. Extraia o ZIP na raiz do projeto e substitua os arquivos. Depois:

```powershell
git add .
git commit -m "Adiciona projeção ao vivo e gestão de webhooks"
git push
```

Mantenha no Render:

```env
APP_URL=https://dashtray.onrender.com
SYNC_CRON=*/3 * * * *
TRAY_WEBHOOK_TOKEN=SEU_TOKEN_ATUAL
```

A aba de webhooks administra os eventos gravados pelo aplicativo. A ativação da URL na Tray permanece vinculada ao cadastro do aplicativo e ao chamado de integração.

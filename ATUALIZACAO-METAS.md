# Atualização 1.1.0: níveis de meta

## Recursos incluídos

- Até 8 níveis de meta por mês.
- Avanço automático para o próximo nível.
- Registro persistente de cada conquista no Neon.
- Confetes, alerta festivo e som curto ao atingir uma meta.
- Fila de celebrações quando vários níveis são ultrapassados juntos.
- Sincronização Tray a cada 3 minutos.
- Recarregamento de segurança do dashboard a cada 3 minutos.
- Tela cheia com a tag animada `AO VIVO`, sem os status monitorados.
- Gráfico da tela cheia com número de pedidos por dia.

## Aplicação

Extraia o ZIP de atualização na raiz do projeto, substituindo os arquivos existentes. Depois:

```powershell
git add .
git commit -m "Adiciona niveis de meta e refresh de 3 minutos"
git push
```

O Render executará automaticamente:

```text
prisma migrate deploy
```

A migration nova é:

```text
prisma/migrations/202607240002_goal_levels/migration.sql
```

## Variável obrigatória no Render

Altere a variável existente para:

```env
SYNC_CRON=*/3 * * * *
```

Como o serviço já existe, o valor antigo cadastrado no painel do Render pode continuar prevalecendo sobre o `render.yaml`. Salve a variável e faça um novo deploy.

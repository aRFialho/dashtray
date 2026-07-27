# Meta diária automática v1.7.2

- O ritmo diário necessário virou a meta diária automática.
- O alvo é calculado usando o acumulado até ontem, portanto não diminui quando pedidos entram hoje.
- Atingir a meta diária dispara uma celebração em tela cheia com confetes e som.
- A conquista é registrada no Neon e ocorre uma única vez por dia e por nível mensal.
- Se uma meta mensal for atingida e o painel avançar para outro nível no mesmo dia, o novo nível pode gerar uma nova meta diária.
- O card mostra pedidos de hoje, alvo diário e quantos faltam.

Esta versão inclui a migration `202607270001_daily_goal_achievement`, aplicada automaticamente por `prisma migrate deploy` durante a inicialização no Render.

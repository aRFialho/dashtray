# Sincronização otimizada v1.5

## Agenda automática

Fuso: `America/Sao_Paulo`.

- Segunda a sexta às 07:42: reconciliação do mês atual inteiro.
- Das 07:45 às 17:57: consulta somente os pedidos criados hoje, a cada 3 minutos.
- Segunda a sexta às 18:00: nova reconciliação do mês atual inteiro.
- Fora desse intervalo e aos fins de semana: nenhuma consulta automática à Tray.

Se o serviço iniciar durante o expediente e ainda não existir uma reconciliação mensal bem-sucedida naquele dia, ele executa a reconciliação mensal antes da consulta rápida.

## Status

Use uma lista explícita no ambiente:

```env
STATUS=A ENVIAR,ENVIADO,FINALIZADO
```

Não use `STATUS=*` quando pedidos cancelados ou em outros status não devam entrar no contador.

A sincronização rápida remove do banco pedidos de hoje que deixaram a lista. As reconciliações das 07:42 e 18:00 fazem a mesma limpeza em todo o mês.

## Interface

As atualizações automáticas usam o evento leve `orders:count-update`. O React altera somente o total, o ponto/barra do dia e a animação `+N`, sem recarregar o dashboard inteiro.

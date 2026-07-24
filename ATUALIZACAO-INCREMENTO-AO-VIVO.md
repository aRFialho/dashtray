# Incremento ao vivo +1 / +2

A tela cheia agora detecta a diferença entre o total anterior e o novo total de pedidos.

- Exibe `+1`, `+2` ou o incremento real sobre o contador.
- Exibe o mesmo incremento subindo sobre a barra do dia atual no gráfico.
- Incrementos recebidos em menos de 900 ms são agrupados.
- A animação é disparada por atualizações via Socket.IO, sincronização manual ou atualização automática quando o total realmente aumenta.
- Não exige migration nem nova variável de ambiente.

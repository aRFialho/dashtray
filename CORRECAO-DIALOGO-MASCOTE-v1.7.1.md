# Correção do diálogo da mascote v1.7.1

## Problema corrigido

A animação visual `+1/+2` era removida após 2,6 segundos. Ao desaparecer, o React executava a limpeza do efeito da mascote e cancelava também o cronômetro responsável por encerrar a mensagem de reação. O texto permanecia preso no balão.

## Novo comportamento

- A animação `+1/+2` continua curta e independente.
- A reação da mascote fica visível por 15 segundos.
- Depois dos 15 segundos, o balão avança imediatamente para o próximo incentivo normal.
- Um novo pedido durante esses 15 segundos substitui a reação anterior e reinicia o período de 15 segundos.
- O cronômetro da reação só é cancelado ao desmontar a mascote ou quando uma reação nova o substitui.

Não há migration, dependência ou variável de ambiente nova.

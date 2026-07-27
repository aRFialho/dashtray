# Correção Live Coach v1.6.2

## Causa identificada

O GIF estava presente em `client/public/mascot/drossi-live.gif`, mas o componente `LiveCoachMascot` não estava importado nem renderizado em `LiveMode.tsx`. O CSS da personagem também não existia no arquivo principal. Portanto, o navegador nunca criava o elemento da personagem.

Também havia duas renderizações idênticas do gráfico diário na tela cheia.

## Correções

- `LiveCoachMascot` importado e renderizado na tela cheia.
- CSS responsivo incluído em `client/styles.css`.
- Reações aos incrementos `+1`, `+2` ou valor real preservadas.
- Mensagens ligadas aos dados reais de meta, projeção, faltantes e progresso.
- Gráfico diário duplicado removido.
- GIF otimizado de 30 MB para aproximadamente 6 MB, mantendo animação contínua.
- URL pública gerada com `import.meta.env.BASE_URL`.
- Se o arquivo não carregar, aparece um diagnóstico visível em vez de ocultar silenciosamente o componente.

## Caminho do arquivo

```text
client/public/mascot/drossi-live.gif
```

No build de produção, o Vite copia esse arquivo para:

```text
dist/client/mascot/drossi-live.gif
```

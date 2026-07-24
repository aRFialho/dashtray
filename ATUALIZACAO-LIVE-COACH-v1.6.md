# Live Coach v1.6

## Instalação

1. Extraia este ZIP na raiz do projeto `volt-tray-dashboard`.
2. Execute `INSTALAR-LIVE-COACH-v1.6.bat` ou:

```powershell
node scripts/apply-live-coach-v1.6.mjs
```

3. Coloque o GIF manualmente em:

```text
client/public/mascot/drossi-live.gif
```

4. Valide:

```powershell
npm run typecheck
npm run build
```

## Comportamento

- A personagem aparece somente no painel de tela cheia.
- O GIF permanece em reprodução contínua.
- Balões alternam a cada sete segundos.
- Há saudação de bom dia, boa tarde e boa noite.
- As mensagens usam pedidos atuais, meta, faltantes, percentual e projeção.
- Quando chega novo pedido, a reação substitui temporariamente o incentivo normal:
  - `+1`: “Novo pedido entrou! Bora, time! 🎉” ou “Mais um pedido no placar! 🔥”.
  - `+2` ou mais: mensagem com o incremento real.
- A reação usa o mesmo objeto `increment` da animação existente no contador e no gráfico.
- Se o GIF ainda não estiver no caminho indicado, o componente se oculta sem quebrar o painel.

## Remoção ou restauração

O instalador cria backup em:

```text
.live-coach-v1.6-backup/
```

Não há migration, dependência ou variável de ambiente nova.

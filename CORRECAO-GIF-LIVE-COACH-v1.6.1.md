# Correção Live Coach v1.6.1

## O que foi corrigido

- A personagem não desaparece mais após o primeiro erro de imagem.
- O componente tenta automaticamente:
  1. `client/public/mascot/drossi-live.gif`
  2. `client/public/mascot/drossi-live.png`
  3. `client/public/mascot/download.gif`
  4. `client/public/mascot/download.png`
- O arquivo enviado foi incluído como `client/public/mascot/drossi-live.png`, porque o conteúdo real dele é PNG.
- Foi adicionado um aviso visual caso nenhuma imagem seja encontrada.
- A reação de `+1`, `+2` ou incremento real continua conectada à animação de novos pedidos.

## Aplicação

Extraia o ZIP na raiz do projeto e execute:

```powershell
.\APLICAR-HOTFIX-LIVE-COACH-v1.6.1.bat
```

ou:

```powershell
node scripts/apply-live-coach-v1.6.1.mjs
```

Depois:

```powershell
npm run build
git add .
git commit -m "Corrige carregamento da personagem no painel ao vivo"
git push
```

## GIF animado verdadeiro

O arquivo incluído nesta atualização é uma imagem PNG estática. Para usar animação contínua, substitua ou adicione um GIF animado verdadeiro em:

`client/public/mascot/drossi-live.gif`

O componente dará prioridade ao GIF automaticamente.

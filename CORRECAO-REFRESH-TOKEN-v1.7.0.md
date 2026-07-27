# Correção do refresh token Tray v1.7.0

## Causa encontrada

A sincronização paginada reutilizava um objeto antigo de `TrayStore`. Depois que uma página renovava e rotacionava os tokens, páginas seguintes, webhooks ou outra instância do Render ainda podiam tentar renovar usando o `refresh_token` anterior. A trava anterior existia apenas na memória de um processo e não cobria objetos antigos nem múltiplas instâncias.

## Correções

- Releitura dos tokens atuais no Neon antes de cada decisão de renovação.
- Renovação preventiva dez minutos antes da expiração do access token.
- Trava local para requests concorrentes dentro da mesma instância.
- Atualização otimista no Neon usando o refresh token efetivamente consumido.
- Recuperação automática quando outra instância renova primeiro.
- Uma resposta concorrente antiga não pode sobrescrever tokens mais recentes.
- A loja só é marcada como inativa após falha definitiva e após novas leituras do Neon.
- Detecção ampliada dos retornos 401, 403, código Tray 1000 e mensagens de token expirado/inválido.
- Validação dos campos obrigatórios retornados pelo endpoint `/auth`.
- Logs seguros de renovação, sem imprimir access token ou refresh token.
- Recuperação automática de registros marcados como inativos pelo defeito antigo, na inicialização e às 07:37 de segunda a sexta.
- O status da integração passa a retornar também a expiração do refresh token.

## Logs esperados

```text
[tray:token] renovado automaticamente para a loja 475075; access até ...; refresh até ....
```

Em corrida entre processos:

```text
[tray:token] renovação concorrente recuperada para a loja 475075.
```

## Deploy

Não há migration nem variável nova.

```powershell
npm run typecheck
npm test
npm run build
git add .
git commit -m "Corrige renovacao automatica dos tokens Tray"
git push
```

Após publicar esta versão, o servidor tentará reativar automaticamente uma loja que tenha sido marcada como inativa pelo defeito antigo, desde que o refresh token salvo ainda seja válido. Reconecte manualmente somente se o log informar que o refresh token expirou ou que a autorização foi revogada.

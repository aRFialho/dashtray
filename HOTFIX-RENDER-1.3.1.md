# Hotfix Render 1.3.1

Corrige o erro TypeScript em `server/routes/tray.ts` causado pelo tipo de `req.params.id` no Express 5.

O parâmetro agora é normalizado e validado como uma única string antes de ser enviado ao Prisma.

Não há migration, variável de ambiente ou dependência nova.

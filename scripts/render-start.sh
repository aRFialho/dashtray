#!/usr/bin/env bash
set -euo pipefail

npm run db:migrate:deploy
exec node dist/server/index.js

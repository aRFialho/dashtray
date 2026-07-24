#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" || -z "${DIRECT_URL:-}" ]]; then
  echo "Defina DATABASE_URL e DIRECT_URL antes de executar a migration." >&2
  exit 1
fi

npx prisma generate
npx prisma migrate deploy

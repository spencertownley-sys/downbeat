#!/bin/sh
set -e

echo "[start] applying migrations..."
npx drizzle-kit migrate

# Demo data is for local and preview environments only; never set this in production.
if [ "$SEED_DEMO" = "1" ]; then
  echo "[start] seeding demo data (no-op if data already exists)..."
  npx tsx src/db/seed.ts
fi

echo "[start] starting Next.js..."
exec npx next start -p "${PORT:-3000}"

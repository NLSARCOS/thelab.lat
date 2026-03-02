#!/bin/sh
# Initialize database if it doesn't exist
if [ ! -f /app/data/vibecheck.db ]; then
  echo "[INIT] Creating database..."
  DATABASE_URL="file:/app/data/vibecheck.db" npx prisma db push --skip-generate
fi
echo "[START] Launching VibeCheck SaaS..."
DATABASE_URL="file:/app/data/vibecheck.db" node dist/server.js

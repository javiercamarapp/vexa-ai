#!/bin/bash
# Aplica 0001..0051 (+stubs) en la base LOCAL indicada. Uso: aplicar-migraciones-local.sh <socket_dir> <puerto> <db>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)";MIG="$HERE/../../supabase/migrations"
S="$1";P="$2";DB="$3"
psql -X -q -h "$S" -p "$P" -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/pg-stub.sql"
for f in $(ls "$MIG" | grep -E '^00(0[1-9]|[1-4][0-9]|5[01])_' | sort); do
  psql -X -q -h "$S" -p "$P" -d "$DB" -v ON_ERROR_STOP=1 -f <(sed 's/^create extension if not exists vector with schema extensions;$/-- (stub local: sin pgvector)/' "$MIG/$f") >/dev/null 2>"$S/err.$f.txt" || { echo "FALLO $f"; head -5 "$S/err.$f.txt"; exit 1; }
done
echo "migraciones 0001..0051 aplicadas en $DB"

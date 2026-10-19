#!/bin/bash
# Comprueba 0052 en un Postgres LOCAL desechable (socket unix, sin red, sin Supabase). No toca ninguna base real.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)";REPO="$HERE/../..";D="$(mktemp -d /tmp/tracker-pg.XXXXXX)";PORT=54$((RANDOM%900+100))
trap 'pg_ctl -D "$D/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
initdb -D "$D/data" -A trust >/dev/null
pg_ctl -D "$D/data" -o "-c listen_addresses='' -k $D -p $PORT" -l "$D/log" -w start >/dev/null
createdb -h "$D" -p "$PORT" vexa_test
psql -X -q -h "$D" -p "$PORT" -d vexa_test -v ON_ERROR_STOP=1 -f "$HERE/sql-stub.sql"
psql -X -q -h "$D" -p "$PORT" -d vexa_test -v ON_ERROR_STOP=1 -f "$REPO/supabase/migrations/0052_tracker_ingestion.sql"
node "$HERE/sql-check.mjs" "$D" "$PORT"
node "$HERE/emit-check.mjs" "$D" "$PORT"

#!/bin/bash
# Prueba local de la migracion 0053 en un Postgres efimero (socket /tmp/vxa, puerto 59463).
# Requiere el servidor ya iniciado (boot.sh) y los stubs de Supabase (STUBS=ruta/stubs.sql).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; MIG="$HERE/../../supabase/migrations"
PGB=/opt/homebrew/opt/postgresql@17/bin; DB=t53_$$
: "${STUBS:?defina STUBS=ruta/stubs.sql}"
P="$PGB/psql -h /tmp/vxa -p 59463 -v ON_ERROR_STOP=1 -q"
for r in anon authenticated service_role vexa_backend; do $P postgres -c "drop role if exists $r" 2>/dev/null || true; done
$PGB/createdb -h /tmp/vxa -p 59463 "$DB"; trap '$PGB/dropdb -h /tmp/vxa -p 59463 "$DB"; for r in anon authenticated service_role vexa_backend; do $P postgres -c "drop role if exists $r" >/dev/null 2>&1 || true; done' EXIT
for f in "$STUBS" "$MIG"/0001_*.sql "$MIG"/0002_*.sql "$MIG"/0053_*.sql "$HERE/test_0053.sql"; do $P "$DB" -f "$f" >/dev/null; done
$P "$DB" -At -c "select 'OK: 0053 aplicada y probada (RLS, checks, inmutabilidad, FKs)'"

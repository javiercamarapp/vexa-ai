#!/bin/bash
# Levanta un Postgres 17 LOCAL desechable (solo socket unix, sin red) con el esquema real 0001..0051 sobre stubs de Supabase,
# como base plantilla "vexa". Uso: pg-local-up.sh <carpeta_datos> <carpeta_socket_corta> <puerto>
# Detener: pg_ctl -D <carpeta_datos> -m immediate stop
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)";D="$1";S="$2";P="$3"
export LANG=C LC_ALL=C
rm -rf "$D";mkdir -p "$D" "$S"
nice initdb -D "$D/data" -A trust --no-locale --encoding=UTF8 >/dev/null
nice pg_ctl -D "$D/data" -o "-c listen_addresses='' -k $S -p $P -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c shared_buffers=64MB -c max_connections=40" -l "$D/log" -w start >/dev/null
createdb -h "$S" -p "$P" vexa
"$HERE/aplicar-migraciones-local.sh" "$S" "$P" vexa

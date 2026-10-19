#!/bin/bash
# Biblioteca (se hace `source`): levanta un Postgres LOCAL desechable (socket unix, sin red) con stubs de Supabase y las
# migraciones REALES 0001..0053 (sin las de fecha; pgvector sustituido por el stub de supabase/tests/association-candidates/stubs.sql).
# Uso: source lib-pg-chain.sh; chain_up [hasta=0053]; ... $CH_PSQL -c '...'; (chain_down se llama sola al salir)
CH_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
chain_down(){ [ -n "${CH_DIR:-}" ] && { pg_ctl -D "$CH_DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$CH_DIR"; }; }
chain_up(){
 local upto="${1:-0053}" f
 CH_DIR="$(mktemp -d /tmp/chain-pg.XXXXXX)"; CH_PORT=$((54000+RANDOM%900)); CH_DB=vexa_chain
 trap chain_down EXIT
 initdb -D "$CH_DIR/data" -A trust >/dev/null
 pg_ctl -D "$CH_DIR/data" -o "-c listen_addresses='' -k $CH_DIR -p $CH_PORT" -l "$CH_DIR/log" -w start >/dev/null
 createdb -h "$CH_DIR" -p "$CH_PORT" "$CH_DB"
 CH_PSQL="psql -X -q -h $CH_DIR -p $CH_PORT -d $CH_DB -v ON_ERROR_STOP=1"
 $CH_PSQL -f "$CH_REPO/supabase/tests/association-candidates/stubs.sql" >/dev/null
 for f in "$CH_REPO"/supabase/migrations/0*.sql; do
  local n; n="$(basename "$f" | cut -c1-4)"; [[ "$n" > "$upto" ]] && continue
  sed 's/^create extension if not exists vector.*$//' "$f" | $CH_PSQL >/dev/null || { echo "CHAIN_FAIL $f" >&2; return 1; }
 done
}

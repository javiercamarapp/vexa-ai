#!/bin/sh
set -eu
# Explicit locale avoids Darwin postmaster locale/thread initialization failures.
LANG=C
LC_ALL=C
export LANG LC_ALL
# Never uses an existing server, PGHOST, shared DB, or Supabase configuration.
fixture_root=$(mktemp -d "${TMPDIR:-/tmp}/vexa-identity-pg.XXXXXX")
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cleanup() {
  fixture_exit=$?
  trap - EXIT HUP INT TERM
  pg_ctl -D "$fixture_root/data" -m immediate stop >"$fixture_root/stop.log" 2>&1 || true
  if [ "$fixture_exit" -eq 0 ]; then
    rm -rf "$fixture_root"
  else
    printf 'SQL fixture failed (exit %s); diagnostics preserved: %s\n' "$fixture_exit" "$fixture_root" >&2
  fi
  exit "$fixture_exit"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "$fixture_root/socket"
initdb -D "$fixture_root/data" -U vexa_fixture --auth=trust --no-locale --encoding=UTF8 > "$fixture_root/init.log" 2>&1
pg_ctl -D "$fixture_root/data" -l "$fixture_root/server.log" -o "-c listen_addresses='' -c unix_socket_directories='$fixture_root/socket' -p 57639" -w start > "$fixture_root/start.log" 2>&1
if psql -X -h "$fixture_root/socket" -p 57639 -U vexa_fixture -d postgres -v ON_ERROR_STOP=1 -f "$script_dir/identity.sql" > "$fixture_root/sql.log" 2>&1; then
  cat "$fixture_root/sql.log"
else
  fixture_sql_exit=$?
  cat "$fixture_root/sql.log" >&2
  exit "$fixture_sql_exit"
fi

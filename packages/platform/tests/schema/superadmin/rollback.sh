#!/bin/bash
set -euo pipefail
# Solo un cluster desechable por socket privado. No acepta URL de base remota.
D=$(mktemp -d); export LANG=C LC_ALL=C
cleanup(){ pg_ctl -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
initdb -D "$D/data" -U fx --auth=trust --no-locale --encoding=UTF8 >/dev/null
mkdir "$D/s"
pg_ctl -D "$D/data" -l "$D/log" -o "-c listen_addresses='' -c unix_socket_directories='$D/s' -p 57641" -w start >/dev/null
P=(psql -X -q -h "$D/s" -p 57641 -U fx -d postgres -v ON_ERROR_STOP=1)
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/../../../../../supabase/migrations" && pwd)
DOWN="$M/../operations/20261126000100_support_read_branch.rollback.sql"
"${P[@]}" -f "$S/fixture.sql"
"${P[@]}" -f "$M/20260930224057_platform_administration.sql"
"${P[@]}" -f "$M/20261126000000_platform_support_and_audited_reads.sql"
"${P[@]}" -f "$S/guard-fixtures/sql.sql"
before=$("${P[@]}" -t -A -c "select md5(pg_get_functiondef(oid)),coalesce(proacl::text,'NULL'),proowner from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure")
"${P[@]}" -f "$M/20261126000100_support_read_branch.sql"
"${P[@]}" -f "$DOWN"
after=$("${P[@]}" -t -A -c "select md5(pg_get_functiondef(oid)),coalesce(proacl::text,'NULL'),proowner from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure")
test "$before" = "$after"
test "$("${P[@]}" -t -A -c "select to_regprocedure('public.vexa_support_active(uuid)') is null")" = t
echo 'rollback: fuente SQL exacta, propietario y ACL conservados; helper ausente'
"${P[@]}" -f "$M/20261126000100_support_read_branch.sql"
echo 'rollback: reaplicacion acepta el cuerpo SQL restaurado'
"${P[@]}" -c 'alter function public.vexa_member(uuid,text[]) volatile'
if "${P[@]}" -f "$DOWN" >"$D/drift.log" 2>&1; then
 echo 'rollback acepto deriva inesperada' >&2; exit 1
fi
grep -q SUPPORT_ROLLBACK_SOURCE_DRIFT "$D/drift.log"
test "$("${P[@]}" -t -A -c "select to_regprocedure('public.vexa_support_active(uuid)') is not null and (select provolatile='v' from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure)")" = t
echo 'rollback: deriva rechazada sin restauracion ni eliminacion parcial'
echo ALL-OK

#!/bin/bash
set -euo pipefail
# Prueba SQL de las migraciones 20261125000000/100 contra un Postgres desechable (initdb propio, sin red, sin base ligada). Uso: ./run.sh
D=$(mktemp -d); export LANG=C LC_ALL=C
cleanup(){ pg_ctl -D $D/data -m immediate stop >/dev/null 2>&1 || true; rm -rf $D; }
trap cleanup EXIT
initdb -D $D/data -U fx --auth=trust --no-locale --encoding=UTF8 >/dev/null
mkdir $D/s
pg_ctl -D $D/data -l $D/log -o "-c listen_addresses='' -c unix_socket_directories='$D/s' -p 57641" -w start >/dev/null
P="psql -X -q -h $D/s -p 57641 -U fx -d postgres -v ON_ERROR_STOP=1"
M=$(cd "$(dirname "$0")/../../../../../supabase/migrations" && pwd)
S=$(cd "$(dirname "$0")" && pwd)
$P -f $S/fixture.sql
$P -f $M/20260930224057_platform_administration.sql
$P -f $M/20261125000000_platform_support_and_audited_reads.sql
$P -f $M/20261125000100_support_read_branch.sql
$P -f $M/20261125000200_team_my_invitations.sql
$P -t -A -f $S/test.sql | grep -v "^\s*$"
echo ALL-OK

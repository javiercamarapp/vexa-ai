#!/bin/bash
set -euo pipefail
# Prueba SQL de 20261127000000_pain_points_ia_semanal.sql (y su reversa) contra un Postgres desechable (initdb propio, sin red, sin base ligada). Uso: ./run.sh
D=$(mktemp -d); export LANG=C LC_ALL=C
cleanup(){ pg_ctl -D $D/data -m immediate stop >/dev/null 2>&1 || true; rm -rf $D; }
trap cleanup EXIT
initdb -D $D/data -U fx --auth=trust --no-locale --encoding=UTF8 >/dev/null
mkdir $D/s
pg_ctl -D $D/data -l $D/log -o "-c listen_addresses='' -c unix_socket_directories='$D/s' -p 57642" -w start >/dev/null
P="psql -X -q -h $D/s -p 57642 -U fx -d postgres -v ON_ERROR_STOP=1"
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/../../../../supabase/migrations" && pwd)
$P -f $S/fixture.sql
$P -f $M/20261127000000_pain_points_ia_semanal.sql
$P -f $M/20261127000000_pain_points_ia_semanal.sql   # idempotente al reaplicar (create if not exists / or replace)
$P -t -A -f $S/test.sql | grep -v "^\s*$"
$P -f $S/../20261127000000_pain_points_ia_semanal.down.sql
$P -t -A -c "select count(*) from pg_proc where proname like 'analysis_%' or proname like 'weekly_%'" | grep -qx 0
$P -f $M/20261127000000_pain_points_ia_semanal.sql   # reaplicable tras la reversa
echo ALL-OK

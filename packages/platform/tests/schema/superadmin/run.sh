#!/bin/bash
set -euo pipefail
# Prueba SQL de las migraciones 20261126000000/100/200 contra un Postgres desechable (initdb propio, sin red, sin base ligada). Uso: ./run.sh
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
$P -f $M/20261126000000_platform_support_and_audited_reads.sql
# Congelar el esquema previo a la rama de soporte; las variantes usan clones aislados.
$P -c "create database guard_baseline template postgres"
$P -f $M/20261126000100_support_read_branch.sql
$P -f $M/20261126000200_team_my_invitations.sql
$P -t -A -f $S/test.sql | grep -v "^\s*$"
echo 'guard/plpgsql: ACCEPT + suite completa'
# Cada variante parte del mismo esquema. Un rechazo debe revertir tambien el
# helper creado ANTES del guard; comprobarlo desde una conexion nueva.
for variant in sql malicious semantic security_definer volatile search_path; do
  db="guard_$variant"
  $P -c "create database $db template guard_baseline"
  Q="psql -X -q -h $D/s -p 57641 -U fx -d $db -v ON_ERROR_STOP=1"
  $Q -f "$S/guard-fixtures/$variant.sql"
  before=$($Q -t -A -c "select md5(pg_get_functiondef('public.vexa_member(uuid,text[])'::regprocedure))")
  if $Q -f "$M/20261126000100_support_read_branch.sql" >"$D/$variant.log" 2>&1; then
    if [ "$variant" != sql ]; then
      cat "$D/$variant.log"
      echo "guard/$variant: acepto deriva desconocida" >&2
      exit 1
    fi
    $Q -f "$M/20261126000200_team_my_invitations.sql"
    $Q -t -A -f "$S/test.sql" | grep -v "^\s*$"
    echo "guard/$variant: ACCEPT + suite completa"
  else
    if [ "$variant" = sql ] || ! grep -q VEXA_MEMBER_SOURCE_DRIFT "$D/$variant.log"; then
      cat "$D/$variant.log"
      echo "guard/$variant: fallo inesperado" >&2
      exit 1
    fi
    absent=$($Q -t -A -c "select to_regprocedure('public.vexa_support_active(uuid)') is null")
    if [ "$absent" != t ]; then
      echo "guard/$variant: helper parcial sobrevivio al rollback" >&2
      exit 1
    fi
    after=$($Q -t -A -c "select md5(pg_get_functiondef('public.vexa_member(uuid,text[])'::regprocedure))")
    if [ "$before" != "$after" ]; then
      echo "guard/$variant: vexa_member cambio pese al rechazo" >&2
      exit 1
    fi
    echo "guard/$variant: REJECT + rollback sin helper ni cambio de funcion"
  fi
  $P -c "drop database $db"
done
$P -c "drop database guard_baseline"
echo ALL-OK

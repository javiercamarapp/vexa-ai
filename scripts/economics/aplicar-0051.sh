#!/bin/bash
# Aplica la migración 0051 (importador económico por lotes) SOLO a vexa-ai (proyecto-ejemplo). LO CORRE JAVIER con `!`.
# 0051 solo CREA 4 funciones (no toca tablas, políticas RLS ni guardas). Antes de aplicar guarda un respaldo lógico del estado económico
# (conteos + hash de contenido de economic_source_versions/economic_ledger_entries) y un script de reversa (DROP de las 4 funciones).
# Seguro de repetir: si las funciones ya existen no las reaplica (no compara el cuerpo; la verificación final revisa privilegios y comportamiento puro). No imprime datos de clientes.
set -uo pipefail
umask 077
REF=proyecto-ejemplo
MIG=supabase/migrations/0051_economic_batch_import.sql
BASE="$HOME/.codex-work/rovaq-cierre-20261007/economico-carga-20261019"
OUT="$BASE/aplicar-0051-$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -p "$OUT"
cd "$HOME/vexa" || exit 1
exec > >(tee "$OUT/aplicar-0051.out") 2>&1
die() { echo "ABORTO: $*"; exit "${2:-1}"; }
rq() { supabase db query --linked "$1" 2>&1; }
command -v supabase >/dev/null || die "falta la CLI de Supabase"
[ -f "$MIG" ] || die "falta $MIG"
git ls-files --error-unmatch "$MIG" >/dev/null 2>&1 && git diff --quiet HEAD -- "$MIG" || die "0051 no está confirmada en git o tiene cambios locales"
[ -f supabase/.temp/project-ref ] || die "no hay proyecto enlazado (supabase link --project-ref $REF)" 2
[ "$(cat supabase/.temp/project-ref)" = "$REF" ] || die "el proyecto enlazado NO es $REF; sin cambios" 3
avail_kb=$(df -k / | awk 'NR==2{print $4}'); [ "${avail_kb:-0}" -ge $((10*1024*1024)) ] || die "disco libre < 10 GiB; sin cambios" 4

echo "== 1. Estado previo y respaldo (solo lectura)"
Q="select 'ECON_PRE fn='||(to_regprocedure('public.economic_batch_import(jsonb)') is not null)||' src='||(select count(*) from public.economic_source_versions)||' led='||(select count(*) from public.economic_ledger_entries)||' hled='||coalesce((select md5(string_agg(md5(concat_ws('|',tenant_id,entity_id,revision,source_id,external_id,kind,effective_at,currency,exponent,basis,coalesce(amount_minor::text,'null'),status,coalesce(order_id::text,''),report_hash)),',' order by tenant_id,entity_id,revision)) from public.economic_ledger_entries),'vacio')||' hsrc='||coalesce((select md5(string_agg(md5(concat_ws('|',tenant_id,source_id,version,name,evidence_type,active,complete,window_start,window_end,watermark,report_hash)),',' order by tenant_id,source_id,version)) from public.economic_source_versions),'vacio')||';' as r"
PRE=$(rq "$Q"); echo "$PRE" | grep -o 'ECON_PRE [^;]*' | head -1 | tee "$OUT/estado-previo.txt"
echo "$PRE" | grep -q "ECON_PRE" || die "no se pudo leer el estado previo (¿supabase login?)" 5
echo "$PRE" | grep -q "ECON_PRE fn=true" && { echo "Las funciones de 0051 ya existen en $REF (no se reaplica)."; }
cat > "$OUT/rollback-0051.sql" <<'SQL'
-- Reversa de 0051 (solo funciones; no toca datos). Ejecutar con: supabase db query --linked -f rollback-0051.sql
drop function if exists public.economic_batch_import(jsonb);
drop function if exists public.economic_batch_entry_error(jsonb);
drop function if exists public.economic_batch_entity_id(uuid,uuid,text,text);
drop function if exists public.economic_batch_instant(text);
SQL
echo "respaldo lógico (conteos + hashes) y reversa guardados en $OUT"

echo "== 2. Aplicar 0051 (una sola vez; la migración trae begin/commit)"
if echo "$PRE" | grep -q "ECON_PRE fn=true"; then
  echo "ya aplicada: se omite"
else
  supabase db query --linked -f "$MIG" 2>&1 | tail -5
fi

echo "== 3. Verificación (solo lectura; sin escribir filas)"
V=$(rq "select 'ECON_POST fn='||(to_regprocedure('public.economic_batch_import(jsonb)') is not null)||' fn2='||(to_regprocedure('public.economic_batch_entry_error(jsonb)') is not null)||' fn3='||(to_regprocedure('public.economic_batch_entity_id(uuid,uuid,text,text)') is not null)||' fn4='||(to_regprocedure('public.economic_batch_instant(text)') is not null)||' secdef='||(select prosecdef from pg_proc where oid='public.economic_batch_import(jsonb)'::regprocedure)||' cfg='||(select coalesce(proconfig::text,'') from pg_proc where oid='public.economic_batch_import(jsonb)'::regprocedure)||' exec_backend='||has_function_privilege('vexa_backend','public.economic_batch_import(jsonb)','execute')||' exec_anon='||has_function_privilege('anon','public.economic_batch_import(jsonb)','execute')||' exec_auth='||has_function_privilege('authenticated','public.economic_batch_import(jsonb)','execute')||' pure_ok='||(public.economic_batch_entity_id('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','order','x') is not null)||' err='||coalesce(public.economic_batch_entry_error('{}'::jsonb),'null')||' led='||(select count(*) from public.economic_ledger_entries)||' src='||(select count(*) from public.economic_source_versions)||';' as r")
echo "$V" | grep -o 'ECON_POST [^;]*' | head -1 | tee "$OUT/estado-posterior.txt"
echo "$V" | grep -q "ECON_POST fn=true fn2=true fn3=true fn4=true secdef=true" || die "verificación fallida: revise $OUT/aplicar-0051.out. Reversa: $OUT/rollback-0051.sql" 6
echo "$V" | grep -q "exec_backend=true exec_anon=false exec_auth=false" || die "privilegios inesperados: revise; reversa en $OUT/rollback-0051.sql" 7
pre_led=$(echo "$PRE" | grep -o 'led=[0-9]*' | head -1); post_led=$(echo "$V" | grep -o 'led=[0-9]*' | head -1)
[ "$pre_led" = "$post_led" ] || die "el conteo del ledger cambió ($pre_led -> $post_led)" 8
echo "OK: 0051 aplicada, privilegios correctos (solo vexa_backend), ledger intacto ($post_led)."
echo "Siguiente: scripts/economics/cargar-shopify.sh (reenvío, debe dar 0 insertadas) y luego cargar-marketplaces.sh --max-tandas 2."

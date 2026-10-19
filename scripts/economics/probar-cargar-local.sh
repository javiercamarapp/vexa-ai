#!/bin/bash
# Prueba LOCAL de la mecánica de los scripts de carga (guardas, parseo de resultados, reanudación, recibo) con una CLI «supabase»
# simulada que ejecuta contra un Postgres local desechable y datos SINTÉTICOS. No toca producción ni red.
# Uso: probar-cargar-local.sh <socket_dir> <puerto> <plantilla_db> <carpeta_trabajo>
set -uo pipefail
SOCK="$1"; PORT="$2"; TPL="$3"; W="$4"; HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$W"; mkdir -p "$W/bin" "$W/base"; chmod 700 "$W"
DB=econ_cli_test
psql -X -q -h "$SOCK" -p "$PORT" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB TEMPLATE $TPL" >/dev/null || exit 1
T=00000000-0000-4000-8000-000000000000; U=00000000-0000-4000-8000-0000000000a2
psql -X -q -h "$SOCK" -p "$PORT" -d $DB -c "insert into auth.users(id) values('$U')" -c "insert into organizations(id,name) values('$T','SYN')" -c "insert into memberships(tenant_id,user_id,role,status,permissions_version) values('$T','$U','owner','active',1)" >/dev/null || exit 1
# CLI simulada: `supabase db query --linked [-f archivo | "SQL"]` -> psql -c (cadena multi-sentencia = una transacción implícita; imprime la última sentencia), salida JSON estilo CLI.
cat > "$W/bin/supabase" <<SH
#!/bin/bash
[ "\$1" = db ] && [ "\$2" = query ] && [ "\$3" = --linked ] || { echo "shim: uso no soportado: \$*" >&2; exit 2; }
if [ "\$4" = -f ]; then SQL="\$(cat "\$5")"; else SQL="\$4"; fi
out=\$(psql -X -At -h "$SOCK" -p "$PORT" -d $DB -v ON_ERROR_STOP=1 -c "\$SQL" 2>&1); rc=\$?
if [ \$rc -ne 0 ]; then echo "\$out"; exit \$rc; fi
printf '{\n  "boundary": "x",\n  "rows": [{"r": "%s", "resultado": "%s"}]\n}\n' "\$out" "\$out"
SH
cat > "$W/bin/df" <<'SH'
#!/bin/bash
if [ "$1" = -k ]; then printf 'Filesystem 1024-blocks Used Available Capacity iused ifree %%iused Mounted\n/dev/x 482344960 100 50000000 1%% 1 1 1%% /\n'; else printf 'Filesystem Size Used Avail Capacity\n/dev/x 460Gi 17Gi 47Gi 1%% /\n'; fi
SH
chmod +x "$W/bin/supabase" "$W/bin/df"
export PATH="$W/bin:$PATH"
source "$HERE/lib-carga.sh"
BASE="$W/base"; TENANT="$T"; ACTOR=""
echo "== preparar (sintético)"; (cd "$HERE/../.." && node scripts/economics/preparar.mjs --modo marketplaces --tenant "$T" --out "$W/run/sql" --sintetico) || exit 1
echo "== guardas"; carga_guardas || exit 1
echo "== piloto: 2 tandas"; carga_ejecutar marketplaces "$W/run/sql" 2 | tail -4
echo "== reanudar el resto (salta lo hecho)"; carga_ejecutar marketplaces "$W/run/sql" 0 | tail -4
echo "== segunda pasada completa (borra done.list): todo debe ser repetido"; rm -f "$W/run/sql/done.list" "$W/run/sql/recibo.log"; carga_ejecutar marketplaces "$W/run/sql" 0 | tail -3
psql -X -At -h "$SOCK" -p "$PORT" -d $DB -c "select 'FILAS_EN_LEDGER='||count(*) from public.economic_ledger_entries"
psql -X -q -h "$SOCK" -p "$PORT" -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null

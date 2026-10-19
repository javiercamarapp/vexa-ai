#!/bin/bash
# Biblioteca común de cargar-marketplaces.sh y cargar-shopify.sh (se "source"-a, no se ejecuta sola).
# Garantías: aborta si el proyecto enlazado no es vexa-ai, si 0051 no está aplicada, si el disco libre es <10 GiB o si el actor/tenant no cuadran;
# ejecuta UNA tanda ≤250 por llamada (transacción propia, idempotente); se detiene en el primer error; reanudable; recibo local sin datos de clientes.
REF=proyecto-ejemplo
CLIENTEX_TENANT=00000000-0000-4000-8000-000000000000
BASE="$HOME/.codex-work/rovaq-cierre-20261007/economico-carga-20261019"
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$LIB_DIR/../.." && pwd)"

die() { echo "ABORTO: $*" >&2; exit "${2:-1}"; }
rq() { (cd "$REPO" && supabase db query --linked "$1" 2>&1); }
grab() { printf '%s' "$1" | sed -n "s/.*$2.*/\1/p" | head -1; }

carga_guardas() {
  command -v supabase >/dev/null || die "falta la CLI de Supabase"
  command -v node >/dev/null || die "falta node"
  local avail_kb; avail_kb=$(df -k / | awk 'NR==2{print $4}')
  [ "${avail_kb:-0}" -ge $((10*1024*1024)) ] || die "disco libre < 10 GiB ($(df -h / | awk 'NR==2{print $4}')); libere espacio o espere a que baje el swap" 4
  echo "carga: $(uptime | sed 's/.*load averages*: //')  | disco libre: $(df -h / | awk 'NR==2{print $4}')"
  [ -f "$REPO/supabase/.temp/project-ref" ] || die "no hay proyecto enlazado (supabase link --project-ref $REF)" 2
  [ "$(cat "$REPO/supabase/.temp/project-ref")" = "$REF" ] || die "el proyecto enlazado NO es $REF; sin cambios" 3
  local g; g=$(rq "select 'ECON_GUARD fn='||(to_regprocedure('public.economic_batch_import(jsonb)') is not null)||' fn2='||(to_regprocedure('public.economic_batch_entry_error(jsonb)') is not null)||' org='||(select count(*) from public.organizations where id='$TENANT')||' owners='||(select count(*) from public.memberships where tenant_id='$TENANT' and role='owner' and status='active')||';' as r")
  echo "$g" | grep -q "ECON_GUARD fn=true fn2=true" || die "la migración 0051 NO está aplicada en $REF (aplíquela primero: ver NOTAS.md, paso 1). Sin cambios." 5
  echo "$g" | grep -q "org=1" || die "el tenant $TENANT no existe en $REF" 6
  local owners; owners=$(grab "$g" 'owners=\([0-9]*\);')
  if [ -z "${ACTOR:-}" ] && [ "$owners" != "1" ]; then die "hay $owners owners activos; exporte VEXA_ACTOR=<uuid del owner que firma la carga> y reintente" 7; fi
  echo "guardas OK: proyecto $REF, 0051 aplicada, tenant presente, owners activos=$owners"
}

# carga_ejecutar <modo> <carpeta_sql> <max_tandas|0>
carga_ejecutar() {
  local modo="$1" dir="$2" max="${3:-0}" ran=0 tot_p=0 tot_i=0 tot_r=0 n=0
  [ -f "$dir/lista.tsv" ] || die "falta $dir/lista.tsv (¿se preparó?)"
  mkdir -p "$BASE/recibos"; chmod 700 "$BASE/recibos" 2>/dev/null
  local done_list="$dir/done.list" log="$dir/recibo.log"; touch "$done_list" "$log"
  local total; total=$(grep -c . "$dir/lista.tsv")
  while IFS=$'\t' read -r file entries kind sha; do
    n=$((n+1))
    if grep -qxF "$sha  $file" "$done_list"; then continue; fi
    if [ "$max" -gt 0 ] && [ "$kind" = "tanda" ] && [ "$ran" -ge "$max" ]; then echo "límite de $max tandas alcanzado; reanude sin --max-tandas"; break; fi
    local out; out=$(cd "$REPO" && supabase db query --linked -f "$dir/$file" 2>&1)
    local rc=$?
    if [ "$kind" = "fuentes" ]; then
      echo "$out" | grep -q "ECON_SOURCES_RESULT" || { echo "$out" | tail -5 | cut -c1-300; die "[$file] sin resultado de fuentes (rc=$rc); detenido. Nada más se ejecutó." 10; }
      echo "[$n/$total] $file -> $(echo "$out" | grep -o 'ECON_SOURCES_RESULT [^"│]*' | head -1 | sed 's/ *$//')"
      printf '%s  %s\n' "$sha" "$file" >> "$done_list"; printf '%s\t%s\tfuentes\n' "$(date -u +%FT%TZ)" "$file" >> "$log"; continue
    fi
    local res; res=$(echo "$out" | grep -o 'ECON_BATCH_RESULT [A-Za-z0-9_.:-]* [0-9]* [0-9]* [0-9]*' | head -1)
    [ -n "$res" ] || { echo "$out" | tail -8 | cut -c1-300; die "[$file] sin resultado (rc=$rc): la tanda NO se confirmó; detenido. Es seguro reintentar: la carga es idempotente." 11; }
    set -- $res; local p="$3" i="$4" r="$5"
    [ "$p" = "$entries" ] || die "[$file] procesadas $p != esperadas $entries; detenido." 12
    if [ "${EXPECT_NO_INSERT:-0}" = 1 ] && [ "$i" != 0 ]; then die "[$file] insertó $i filas y se esperaba 0 (reenvío de control): el ledger remoto NO coincidía con el paquete. Detenido; revise antes de seguir." 13; fi
    tot_p=$((tot_p+p)); tot_i=$((tot_i+i)); tot_r=$((tot_r+r)); ran=$((ran+1))
    printf '%s\t%s\ttanda\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$file" "$p" "$i" "$r" >> "$log"
    printf '%s  %s\n' "$sha" "$file" >> "$done_list"
    echo "[$n/$total] $file procesadas=$p insertadas=$i repetidas=$r"
  done < "$dir/lista.tsv"
  echo "RESUMEN $modo: tandas esta corrida=$ran procesadas=$tot_p insertadas=$tot_i repetidas=$tot_r"
  local rec="$BASE/recibos/recibo-$modo-$(date -u +%Y%m%dT%H%M%SZ).json"
  node -e '
    const fs=require("fs");const [dir,modo,rec,ref,tenant]=process.argv.slice(1);
    const rows=fs.readFileSync(dir+"/recibo.log","utf8").trim().split("\n").filter(Boolean).map(l=>l.split("\t"));
    const t=rows.filter(r=>r[2]==="tanda");const sum=i=>t.reduce((a,r)=>a+Number(r[i]),0);
    const m=JSON.parse(fs.readFileSync(dir+"/MANIFEST.json","utf8"));
    const doc={modo,proyecto:ref,tenant,fecha:new Date().toISOString(),manifest_tandas:m.tandas,manifest_entradas:m.entradas,tandas_registradas:t.length,procesadas:sum(3),insertadas:sum(4),repetidas:sum(5),completo:t.length===m.tandas,fuentes_ok:rows.some(r=>r[2]==="fuentes")||modo==="shopify",nota:"Recibo local sin datos de clientes. Verifique con VERIFICAR-solo-select.sql (MCP)."};
    fs.writeFileSync(rec,JSON.stringify(doc,null,1),{mode:0o600});console.log(JSON.stringify(doc));
  ' "$dir" "$modo" "$rec" "$REF" "$TENANT" || echo "(no se pudo escribir el recibo)"
  echo "recibo: $rec"
}

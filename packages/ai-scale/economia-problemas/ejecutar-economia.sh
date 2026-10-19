#!/bin/bash
# Exposición económica por problema (comandos `!` de Javier en Terminal.app). Desde ~/vexa/packages/ai-scale/economia-problemas
# ORDEN RECOMENDADO (cada paso es reversible o de solo lectura hasta "canario"):
#   1) ./ejecutar-economia.sh pares                  # LOCAL: construye pares ticket->libro (sin red, sin base). Imprime solo conteos.
#   2) ./ejecutar-economia.sh consultas              # LOCAL: escribe los SELECT de solo lectura (MCP) en consultas-solo-select/
#   3) ./ejecutar-economia.sh validos                # LEE la base (requiere VEXA_DB_URL): ids de problemas con evidencia vigente
#   4) ./ejecutar-economia.sh medir                  # LEE la base (supabase db query): cuántos problemas/pedidos se enlazarían (agregados)
#   5) ./ejecutar-economia.sh seco                   # LOCAL: escribe los .sql de vínculos a disco; NO toca la base
#   --- A PARTIR DE AQUÍ SE ESCRIBE (Javier atestigua como owner) ---
#   6) OWNER=<uuid> ATESTACION=<archivo.txt> ./ejecutar-economia.sh prueba    # INSERT real dentro de BEGIN..ROLLBACK de --max pares (no deja nada)
#   7) OWNER=<uuid> ATESTACION=<archivo.txt> ./ejecutar-economia.sh canario   # escribe de verdad MAX pares (por defecto 300)
#   8) OWNER=<uuid> ATESTACION=<archivo.txt> ./ejecutar-economia.sh todo      # todo (reanudable, idempotente)
#   9) ALCANCE=marketplaces-usd OWNER=<uuid> ./ejecutar-economia.sh snapshot-prueba   # prepara el snapshot en BEGIN..ROLLBACK
#  10) ALCANCE=marketplaces-usd OWNER=<uuid> ./ejecutar-economia.sh snapshot          # lo deja en borrador (visible solo a owners)
#  11) ALCANCE=... OWNER=<uuid> SNAPSHOT_ID=<uuid> CONTENT_HASH=<hash> ./ejecutar-economia.sh publicar
#      (opcional) ALCANCE=... OWNER=<uuid> COMPLETA=false REPORTE=<archivo.txt> ./ejecutar-economia.sh cobertura   # atestación de cobertura; NO la afirme como completa si no lo es
# ALCANCE: marketplaces-usd | marketplaces-cad | devoluciones-usd | shopify-usd.  Variables: MAX (canario), TOP (acota a los N problemas con más pedidos), TIPO (order|refund|all), DESDE (solo tickets con fecha efectiva >= YYYY-MM-DD; p. ej. 2026-07-01)
# La ATESTACIÓN es un texto TUYO (≥20 caracteres) que queda en el campo report de cada vínculo; este script no lo redacta por ti.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${OUT_DIR:-$HOME/.codex-work/rovaq-cierre-20261007/ia-escala-20261019/economia-problemas}"
REPO="$HOME/vexa"
FREE_GB=$(df -g / | awk 'NR==2{print $4}'); [ "$FREE_GB" -ge 4 ] || { echo "Disco libre ${FREE_GB} GiB < 4: abortado"; exit 1; }
need_owner() { [ -n "${OWNER:-}" ] || { echo "Defina OWNER=<uuid del owner activo que atestigua>"; exit 1; }; }
need_atest() { need_owner; [ -n "${ATESTACION:-}" ] && [ -f "$ATESTACION" ] || { echo "Defina ATESTACION=<archivo de texto con tu atestación (≥20 caracteres)>. El programa no la fabrica."; exit 1; }; }
need_alcance() { [ -n "${ALCANCE:-}" ] || { echo "Defina ALCANCE=marketplaces-usd|marketplaces-cad|devoluciones-usd|shopify-usd"; exit 1; }; }
need_db() { [ -n "${VEXA_DB_URL:-}" ] || { echo "Defina VEXA_DB_URL (cadena Postgres del pooler de Supabase; no se imprime)"; exit 1; }; }
COMUN=(--out "$OUT" --repo "$REPO" --tipo "${TIPO:-all}")
[ -n "${TOP:-}" ] && COMUN+=(--top-problemas "$TOP")
[ -n "${DESDE:-}" ] && COMUN+=(--desde "$DESDE")
case "${1:-}" in
  pares)     node puente.mjs --out "$OUT" ${ACEPTAR_SKU_DISTINTO:+--aceptar-sku-distinto} ;;
  consultas) node consultas.mjs --out "$OUT" --max "${MAX:-800}" ${DESDE:+--desde "$DESDE"} ;;
  validos)   need_db; need_owner; node snapshot.mjs problemas-validos --alcance "${ALCANCE:-marketplaces-usd}" --lector "$OWNER" --out "$OUT" ;;
  medir)     node vinculos.mjs "${COMUN[@]}" --medir ${MAX:+--max "$MAX"} ;;
  seco)      node vinculos.mjs "${COMUN[@]}" ${MAX:+--max "$MAX"} ;;
  prueba)    need_atest; node vinculos.mjs "${COMUN[@]}" --run --rollback-test --max "${MAX:-300}" --owner "$OWNER" --atestacion-archivo "$ATESTACION" ;;
  canario)   need_atest; node vinculos.mjs "${COMUN[@]}" --run --commit --max "${MAX:-300}" --owner "$OWNER" --atestacion-archivo "$ATESTACION" ;;
  todo)      need_atest; node vinculos.mjs "${COMUN[@]}" --run --commit --owner "$OWNER" --atestacion-archivo "$ATESTACION" ;;
  snapshot-prueba) need_db; need_alcance; need_owner; node snapshot.mjs preparar --alcance "$ALCANCE" --owner "$OWNER" --rollback-test --out "$OUT" ;;
  snapshot)  need_db; need_alcance; need_owner; node snapshot.mjs preparar --alcance "$ALCANCE" --owner "$OWNER" --commit --out "$OUT" ;;
  cobertura) need_db; need_alcance; need_owner; [ -n "${REPORTE:-}" ] && [ -f "$REPORTE" ] || { echo "Defina REPORTE=<archivo con tu reporte>"; exit 1; }
             node snapshot.mjs cobertura --alcance "$ALCANCE" --owner "$OWNER" --complete "${COMPLETA:-false}" --reporte-archivo "$REPORTE" --out "$OUT" ${CONFIRMAR:+--commit} ;;
  publicar)  need_db; need_owner; [ -n "${SNAPSHOT_ID:-}" ] && [ -n "${CONTENT_HASH:-}" ] || { echo "Defina SNAPSHOT_ID y CONTENT_HASH (del recibo del paso 10)"; exit 1; }
             node snapshot.mjs publicar --snapshot-id "$SNAPSHOT_ID" --content-hash "$CONTENT_HASH" --owner "$OWNER" --publicar --out "$OUT" ;;
  *) sed -n 2,19p "$0"; exit 2 ;;
esac

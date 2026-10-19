#!/bin/bash
# Reenvía/amplía Shopify (paquete 6-oct de 883 asientos, hash fijado) al ledger de vexa-ai por el importador por lotes.
# Hoy debe dar 883 repetidas y 0 insertadas (el script ABORTA si alguna tanda inserta) (comprueba que el ledger remoto coincide EXACTAMENTE con el paquete). Con
# --extra-normalized <json> añade pedidos nuevos (p. ej. anteriores al 6-ago) y amplía la ventana de la fuente (versión 2).
# LO CORRE JAVIER con `!`. Requiere 0051 aplicada. Uso: scripts/economics/cargar-shopify.sh [--solo-preparar] [--extra-normalized ruta.json] [--tenant UUID]
set -uo pipefail
umask 077
source "$(dirname "$0")/lib-carga.sh"
TENANT="$CLIENTEX_TENANT"; PREP_ONLY=0; EXTRA=""; ACTOR="${VEXA_ACTOR:-}"
while [ $# -gt 0 ]; do case "$1" in
  --solo-preparar) PREP_ONLY=1;; --extra-normalized) EXTRA="$2"; shift;; --tenant) TENANT="$2"; shift;; --actor) ACTOR="$2"; shift;;
  *) die "opción desconocida: $1";; esac; shift; done
[ "$TENANT" = "$CLIENTEX_TENANT" ] || die "--tenant solo puede ser $CLIENTEX_TENANT (CLIENTEX)"
[ -z "$EXTRA" ] && EXPECT_NO_INSERT=1
DIR="$BASE/ejecuciones/shopify"; mkdir -p "$DIR"; chmod 700 "$BASE/ejecuciones" "$DIR" 2>/dev/null
cd "$REPO"
[ -f "$BASE/insumos-shopify/clientex-shopify-economic-import-20261006.json" ] || die "faltan las copias fijadas en $BASE/insumos-shopify (ver NOTAS.md)"
echo "== 1. Preparar (sin red, sin base)"
nice node scripts/economics/preparar.mjs --modo shopify --tenant "$TENANT" --out "$DIR/sql" ${ACTOR:+--actor "$ACTOR"} ${EXTRA:+--extra-normalized "$EXTRA"} || die "falló la preparación"
[ "$PREP_ONLY" = 1 ] && { echo "preparado en $DIR/sql (no se ejecutó nada)"; exit 0; }
echo "== 2. Guardas"; carga_guardas
echo "== 3. Ejecutar tandas"; carga_ejecutar shopify "$DIR/sql" 0
echo "== 4. Esperado hoy sin --extra-normalized: insertadas=0 repetidas=883. Verificación: VERIFICAR-shopify-solo-select.sql (MCP)."

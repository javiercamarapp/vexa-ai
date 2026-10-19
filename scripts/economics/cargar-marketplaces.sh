#!/bin/bash
# Carga el histórico de marketplaces ([omitido: dato de cliente] filas: [omitido: dato de cliente] pedidos + [omitido: dato de cliente] devoluciones) al ledger económico de vexa-ai.
# LO CORRE JAVIER con `!` en Terminal. Requiere la migración 0051 aplicada. Idempotente y reanudable (done.list).
# Uso: scripts/economics/cargar-marketplaces.sh [--solo-preparar] [--max-tandas N] [--tenant UUID] [--moneda-desconocida rechazar|XXX]
#      (si hay más de un owner activo: VEXA_ACTOR=<uuid del owner> scripts/economics/cargar-marketplaces.sh)
# Recomendado: primero --max-tandas 2 (piloto de 500 filas), verificar con VERIFICAR-solo-select.sql, luego sin límite.
set -uo pipefail
umask 077
source "$(dirname "$0")/lib-carga.sh"
TENANT="$CLIENTEX_TENANT"; MAX=0; PREP_ONLY=0; MONEDA=rechazar; ACTOR="${VEXA_ACTOR:-}"
while [ $# -gt 0 ]; do case "$1" in
  --solo-preparar) PREP_ONLY=1;; --max-tandas) MAX="$2"; shift;; --tenant) TENANT="$2"; shift;; --moneda-desconocida) MONEDA="$2"; shift;; --actor) ACTOR="$2"; shift;;
  *) die "opción desconocida: $1";; esac; shift; done
DIR="$BASE/ejecuciones/marketplaces"; mkdir -p "$DIR"; chmod 700 "$BASE/ejecuciones" "$DIR" 2>/dev/null
cd "$REPO"
echo "== 1. Preparar (sin red, sin base)"
nice node scripts/economics/preparar.mjs --modo marketplaces --tenant "$TENANT" --out "$DIR/sql" ${ACTOR:+--actor "$ACTOR"} --moneda-desconocida "$MONEDA" || die "falló la preparación"
[ "$PREP_ONLY" = 1 ] && { echo "preparado en $DIR/sql (no se ejecutó nada)"; exit 0; }
echo "== 2. Guardas"; carga_guardas
echo "== 3. Ejecutar tandas"; carga_ejecutar marketplaces "$DIR/sql" "$MAX"
echo "== 4. Siguiente paso: correr $DIR/sql/VERIFICAR-solo-select.sql por MCP (solo SELECT) y comparar con NOTAS.md"

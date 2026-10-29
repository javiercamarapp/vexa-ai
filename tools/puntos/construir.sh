#!/bin/bash
# Reconstruye public/landing/pts desde los GLB de Higgsfield. Uso (desde ~/vexa-tools/puntos tras `npm ci`):
#   bash construir.sh <dir con nucleo.glb paso1.glb paso2.glb paso3.glb paso4.glb> <dir de salida, p. ej. .../apps/web/public/landing/pts>
set -e
node --max-old-space-size=8192 "$(dirname "$0")/muestrear.mjs" "$1" "$2"

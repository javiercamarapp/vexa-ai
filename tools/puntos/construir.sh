#!/bin/bash
# Reconstruye apps/web/public/s/pts desde los GLB de los objetos finales (renders/r3/final). Las dependencias viven en ~/vexa-tools/puntos (npm ci allí; nunca en el node_modules compartido).
#   bash tools/puntos/construir.sh <dir con hero.glb o1.glb ... o4.glb> <dir de salida> [--crudo]
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
# Las importaciones de paquetes se resuelven desde ~/vexa-tools/puntos: se copian allí de forma temporal.
HERR="$HOME/vexa-tools/puntos"
cp "$AQUI/muestrear.mjs" "$HERR/_muestrear.mjs"; cp "$AQUI/pts3.mjs" "$HERR/pts3.mjs"
trap 'rm -f "$HERR/_muestrear.mjs" "$HERR/pts3.mjs"' EXIT
(cd "$HERR" && node --max-old-space-size=4096 _muestrear.mjs "$1" "$2" $3)

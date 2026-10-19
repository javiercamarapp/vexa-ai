#!/bin/bash
# Etapa "embeddings -> problemas" (comandos `!` de Javier en Terminal.app). Requiere que persistir.mjs ya haya dejado las corridas de la cohorte en la base.
#   ./ejecutar-problemas.sh calibrar        # local: distribución de distancias y nº de problemas por umbral (sin base, sin red)
#   ./ejecutar-problemas.sh conteo          # local: filas, vectores faltantes y costo estimado (no llama a ninguna API)
#   ./ejecutar-problemas.sh embeber         # PASO 1 (solo si faltan vectores): pide escribir ENVIAR; tope US$0.20
#   THRESHOLD=0.xx ./ejecutar-problemas.sh seco       # PASO 2: dry-run (escribe SQL a disco, no toca la base)
#   THRESHOLD=0.xx ./ejecutar-problemas.sh prueba     # BEGIN..ROLLBACK de 5 conversaciones contra la base real (no deja nada)
#   THRESHOLD=0.xx ./ejecutar-problemas.sh canario    # escribe de verdad 5 conversaciones (+ sus problemas/versiones)
#   THRESHOLD=0.xx ./ejecutar-problemas.sh todo       # todo el resto (idempotente, reanudable)
#   ./ejecutar-problemas.sh verificar       # escribe verificacion.sql (SELECT de solo lectura) para pegar en MCP
set -euo pipefail
cd "$(dirname "$0")"
BASE="$HOME/.codex-work/rovaq-cierre-20261007/ia-escala-20261019/cohorte"
OUT="$HOME/.codex-work/rovaq-cierre-20261007/ia-escala-20261019/problemas"
COMMON=(--taxonomy "$BASE/taxonomia.json" --results "$BASE/resultados.jsonl" --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl")
TEXTO="${TEXTO:-mensaje}"   # mensaje (reusa vectores de cohorte, costo 0) | quote (idéntico al worker oficial, re-embebe, ~US$0.05)
FREE_GB=$(df -g / | awk 'NR==2{print $4}'); [ "$FREE_GB" -ge 4 ] || { echo "Disco libre ${FREE_GB} GiB < 4: abortado"; exit 1; }
need_threshold() { [ -n "${THRESHOLD:-}" ] || { echo "Defina THRESHOLD (distancia coseno 0..1; use ./ejecutar-problemas.sh calibrar)"; exit 1; }; }
case "${1:-}" in
  calibrar) node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --calibrar ;;
  conteo)   node embeber.mjs "${COMMON[@]}" --texto "$TEXTO" ;;
  embeber)  node embeber.mjs "${COMMON[@]}" --texto "$TEXTO" --send ;;      # la confirmación ENVIAR la pide el propio script
  seco)     need_threshold; node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --threshold "$THRESHOLD" ;;
  prueba)   need_threshold; node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --threshold "$THRESHOLD" --max 5 --run --rollback-test ;;
  canario)  need_threshold; node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --threshold "$THRESHOLD" --max 5 --run --commit ;;
  todo)     need_threshold; node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --threshold "$THRESHOLD" --run --commit ;;
  verificar) node agrupar.mjs "${COMMON[@]}" --texto "$TEXTO" --emit-verificacion "$OUT/verificacion.sql" ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac

#!/bin/bash
# Ejecución de la cohorte "últimos 3 meses" en el proceso de Javier (comando `!`). Uso:
#   ./ejecutar-cohorte.sh export    # 1) lee (SOLO LECTURA) taxonomía y mensajes de la cohorte; los guarda ya REDACTADOS en disco local
#   ./ejecutar-cohorte.sh piloto    # 2) PILOTO de 200 conversaciones (~US$0.1-0.3) + informe de calidad
#   ./ejecutar-cohorte.sh resto     # 3) resto de la cohorte, REANUDABLE (re-ejecútelo si se corta; no reenvía lo ya hecho)
#   ./ejecutar-cohorte.sh reintentar # reprocesa solo las fallidas por contenido
#   ./ejecutar-cohorte.sh agrupar   # 4) agrupación local de embeddings (barrido de umbral)
#   ./ejecutar-cohorte.sh persistir-prueba | persistir-canario | persistir-todo   # 5) escritura en producción (ver INFORME)
# Variables: FROM, TO, BASIS (first|last). Ningún paso imprime contenido de clientes.
set -euo pipefail
cd "$(dirname "$0")"
FROM="${FROM:-2026-07-01}"; TO="${TO:-2026-11-01}"; BASIS="${BASIS:-first}"
# Ventana EXPLÍCITA: por defecto 2026-07-01 a 2026-11-01 (exclusivo) = ~3.6 meses de datos (hay datos hasta 19-oct). Para 3 meses justos: FROM=2026-07-19.
echo "Ventana: mensaje $BASIS en [$FROM, $TO)  (cámbiala con FROM=, TO=, BASIS=first|last)"
BASE="$HOME/.codex-work/rovaq-cierre-20261007/ia-escala-20261019/cohorte"
NODE="${NODE:-node}"
# Confirmación interactiva obligatoria antes de ENVIAR texto a OpenRouter. Sin terminal interactiva no se envía.
confirmar() { # $1 = descripción, $2 = tope USD
  local total; total=$(cat "$BASE"/entrada*.jsonl 2>/dev/null | wc -l | tr -d ' ') || true
  echo "Se enviará a OpenRouter texto de clientes YA REDACTADO (emails, teléfonos, números largos, RFC/CURP, tokens). Provider fijo, data_collection:deny."
  echo "Nombres de personas y direcciones NO se redactan (riesgo residual aceptado en la autorización de Javier)."
  echo "Paso: $1 | conversaciones en la entrada: ${total:-0} | tope de gasto: US\$$2"
  [ -t 0 ] || { echo "No hay terminal interactiva: no se envía nada."; exit 1; }
  printf 'Escribe ENVIAR para confirmar: '; local ans; read -r ans
  [ "$ans" = "ENVIAR" ] || { echo "Cancelado: no se envió nada."; exit 1; }
  CONFIRM_FLAG="--yes-send-real-text"
}
CONFIRM_FLAG=""
FREE_GB=$(df -g / | awk 'NR==2{print $4}'); [ "$FREE_GB" -ge 6 ] || { echo "Disco libre ${FREE_GB} GiB < 6: abortado"; exit 1; }
case "${1:-}" in
  export)
    node exportar.mjs --taxonomia --out "$BASE"
    # fuente hubspot (SQL) + csv (texto en Storage; usa la llave de ~/.vexa-storage.env, solo GET). Cuenta lo no resoluble y lo deja fuera.
    node exportar.mjs --from "$FROM" --to "$TO" --basis "$BASIS" --out "$BASE" --fuente todas --run
    echo "Estadísticas medidas (sin contenido) para la proyección: $BASE/estadisticas-medidas-csv.json"
    echo "Proyección con la cohorte real: node cohorte.mjs --dry-count --stats $BASE/estadisticas-medidas-csv.json" ;;
  piloto)
    confirmar "piloto 200" 1
    $NODE cohorte.mjs --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --taxonomy "$BASE/taxonomia.json" --from "$FROM" --to "$TO" --basis "$BASIS" \
      --pilot 200 --batch piloto-200 --cap-batch 1 --cap-total 30 $CONFIRM_FLAG
    TOTAL=$(cat "$BASE"/entrada*.jsonl | wc -l | tr -d ' ') || true
    $NODE informe-piloto.mjs --dir "$BASE" --batch piloto-200 --total "$TOTAL" ;;
  resto)
    confirmar "resto de la cohorte" 30
    $NODE cohorte.mjs --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --taxonomy "$BASE/taxonomia.json" --from "$FROM" --to "$TO" --basis "$BASIS" \
      --batch resto --cap-batch 30 --cap-total 30 $CONFIRM_FLAG
    node informe-piloto.mjs --dir "$BASE" --batch resto ;;
  reintentar)   # reprocesa SOLO las fallidas por contenido (no repite lo ya extraído; respeta el libro de gasto)
    confirmar "reintentar fallidas por contenido" 30
    $NODE cohorte.mjs --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --taxonomy "$BASE/taxonomia.json" --from "$FROM" --to "$TO" --basis "$BASIS" \
      --batch reintento --cap-batch 30 --cap-total 30 --reintentar-fallidas $CONFIRM_FLAG ;;
  agrupar)
    node cluster.mjs --in "$BASE/embeddings.jsonl" --sweep ;;
  persistir-prueba)   # BEGIN..ROLLBACK de 5 conversaciones contra la base real (no deja nada)
    node persistir.mjs --taxonomy "$BASE/taxonomia.json" --results "$BASE/resultados.jsonl" --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --run --rollback-test --max 5 ;;
  persistir-canario)  # escribe de verdad 5 conversaciones
    node persistir.mjs --taxonomy "$BASE/taxonomia.json" --results "$BASE/resultados.jsonl" --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --run --commit --max 5 ;;
  persistir-todo)
    node persistir.mjs --taxonomy "$BASE/taxonomia.json" --results "$BASE/resultados.jsonl" --input "$BASE/entrada.jsonl,$BASE/entrada-csv.jsonl" --run --commit ;;
  *) sed -n 2,10p "$0"; exit 2 ;;
esac

#!/bin/bash
# Valida la ingesta del Tracker SIN escribir nada (ni base, ni red, ni archivos). Solo lectura de los XLSX y recibos.
# Uso: scripts/tracker/tracker-dry-run.sh [--root "/ruta/rovaq ai"] [--ticket-index ids.txt]
set -euo pipefail
cd "$(dirname "$0")"
exec node --max-old-space-size=2048 dry-run.mjs "$@"

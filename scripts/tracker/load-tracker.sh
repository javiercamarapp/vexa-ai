#!/bin/bash
# Envoltorio: sin argumentos de escritura es DRY-RUN. Carga real: añadir --execute (la corre Javier; ver NOTAS.md).
set -euo pipefail
cd "$(dirname "$0")"
exec nice node --max-old-space-size=3072 load-tracker.mjs "$@"

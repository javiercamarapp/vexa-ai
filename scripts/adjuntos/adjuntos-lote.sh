#!/bin/bash
# Envoltorio de adjuntos_lote.py. Dry-run por defecto; la carga real exige --execute.
# Uso: adjuntos-lote.sh --plan plan.json --receipts DIR [--batch N] [--execute --creds F --tenant UUID]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 -I "$HERE/adjuntos_lote.py" "$@"

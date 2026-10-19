#!/bin/bash
# Prueba del registro de blobs/links contra el esquema REAL 0001..0053 en Postgres local desechable (sin red, datos sinteticos).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../tracker/lib-pg-chain.sh"
chain_up 0053
python3 -W ignore -I "$HERE/test_registro_pg.py" "$CH_DIR" "$CH_PORT" "$CH_DB"

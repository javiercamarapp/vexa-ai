#!/bin/bash
# Prueba del cargador del Tracker contra el esquema REAL (0001..0053) en Postgres local desechable. Sin red, sin datos de clientes.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib-pg-chain.sh"
chain_up 0053
cd "$HERE"
node load-check.mjs "$CH_DIR" "$CH_PORT" "$CH_DB"

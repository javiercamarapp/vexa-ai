# Ejecuciones pendientes sobre el candidato integrado

Son comprobaciones locales separadas. Ningún recibo modifica el grafo ni acredita aceptación humana, proveedor real o producción. Ejecutar sólo con el slot pesado asignado y con un candidato limpio y distinto del control.

## F01-05: cuatro trabajos existentes

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH VEXA_CANDIDATE=/ruta/candidato-integrado node --test --test-reporter=tap /ruta/control-integrado/tests/acceptance/F01-05.test.mjs
```

El examen valida el workflow Node22.x y ejecuta `control-kernel`, `web-quality`, `sql-integration` y `auth-e2e` mediante `support/ci/run.py`. Cada comando conserva650s. Web incluye instalación/lint/tipos/build, canarios, dos pruebas TS de sesión/auth y F01-01; SQL incluye preflight y F01-03 completo; Auth ejecuta F01-02 y F01-04. El kernel incluye F00 y controlador. El examen agregado no añade un plazo exterior; cada comando mantiene el suyo. Los cuatro trabajos se intentan y su resultado se agrega. Conservar stdout y los cuatro recibos reales del runner; una salida parcial no es PASS.

Este agregado **no ejecuta los55 archivos `packages/**/*.test.mjs`** ni todos los tests de `apps/web`. El suite de paquetes de abajo es una ejecución adicional, no una sustitución de esos trabajos.

## Suite separada de55 archivos de paquetes

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH python3 -B /ruta/control/support/F06-final-base/packages-run.py --candidate /ruta/candidato-integrado --artifacts /ruta/privada/nueva-corrida-packages
```

`packages-tests.json` congela nombres y SHA256 de55 archivos desde356c391. El futuro candidato debe conservar exactamente ese inventario; cualquier cambio exige revisión de nuevos pins, nunca excluir un rojo. La copia utiliza `git archive` del HEAD limpio; coteja inventario, bytes y modos contra el árbol Git, y rechaza enlaces, archivos privados y `.env*` antes de extraer. Incluye migraciones y apoyos leídos por los tests; no reutiliza instalaciones antiguas.

Instala con `npm ci --offline --ignore-scripts --no-audit --no-fund` en copia nueva (150s). Ejecuta Node22 exacto registrado con `--experimental-strip-types --test --test-concurrency=1 --test-reporter=tap` (650s de envolvente; plazos originales internos intactos). Entorno reducido, sin credenciales, NODE_OPTIONS ni journal CI heredado; este último alteraría el oráculo negativo de chaos. El recibo exige TAP completo sin skipped/todo/cancelled, identidad HEAD/fuentes de candidato y control antes/después, y retirada del scratch.

El proxy Docker sólo añade `--cidfile` y etiqueta de propiedad a las cuatro invocaciones originales schema con imagen fijada, `--pull never` y `--network none`. Resto de argumentos/stdin/salidas se reenvía sin cambiar assertions ni SQL. Reserva el nombre antes de ejecutar; cleanup verifica ID capturado, nombre y etiqueta, confirma ausencia por ID y nombre, y nunca elimina un recurso ajeno. Ausencia de grupo de procesos se confirma antes de limpiar recursos; un fallo de permiso sólo es benigno con inventario independiente que confirme ausencia. PASS exige exactamente cuatro recursos propios verificados. Error, timeout, cancelación o limpieza incompleta mantienen FAIL y sus logs.

Calibración ligera: `python3 -B support/F06-final-base/packages-run.test.py -v`,7/7PASS. Cubre proxy exacto, rechazo de red/imagen/destino distintos, tar inseguro, pertenencia y ausencia por ID, recibo sin ID, EPERM y proceso local terminado. No se ha ejecutado Docker, instalación, build ni suite55 durante esta preparación. El recibo de corrida real sigue pendiente.

# Corrección de revisión independiente F02-03 — pendiente recheck

Producto inmutable, sin cambios desde revisión39. No aceptación ni incremento13/60.

Hallazgos conservados en private/logs/f0203-joint-final-review-1789925905930136000-review-review-result.json y /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0203-independent-th8wdovp/review-evidence.json. Originales de control/producto intactos.

- P1 cleanup: el launcher ahora crea las dos carpetas y conserva rutas/dev/inode en memoria mediante scratch.py. No lee scratch.json del hijo para eliminar nada. SSR sólo usa las carpetas asignadas y no las elimina; finalmente el launcher limpia exclusivamente sus asignaciones y rechaza cambios de identidad/symlink. No se afirma sandbox contra un proceso malicioso con todos los permisos del usuario.
- P2 reporter: el hijo recibe --test-reporter=tap explícito. Se conserva eliminación de NODE_TEST_CONTEXT y guardas COMPLETE/no-skips. El falso verde previo permanece documentado y no cuenta como evidencia de producto.
- P2 render: la paginación espera opciones renderizadas y número de reservas en DOM, no sólo llegada de Response; después comprueba cardinalidad/deduplicación/selección retenida. No sleeps arbitrarios.

Pruebas reales del principal:
- python3 -B tests/acceptance/support/F02-preview/scratch.test.py -v:3métodos verdes; manifiesto señuelo con salida0 y1 conserva directorio ajeno y retira asignaciones propias; reemplazo por symlink rechazado.
- Entrada directa Node22 y26 contra mismo producto:exit0 ambas,31casos internos sin fallos/skips, HTTP/Auth/Pg/Storage/Next/Chromium y M10, cleanup verificado.
- Recibos y comandos: private/f0203-fix-deterministic.json; logs private/logs/f0203-review-fix-node22.log y -node26.log. Pruebas previas del reviewer:96producto, F02-02real y3mutantes0→1assert→0; estos no se reinterpretan como una nueva ejecución.

Pendiente: recheck independiente de estas correcciones, freeze, adopción, regresión global y aceptación. No producción ni auditoría global enterprise.

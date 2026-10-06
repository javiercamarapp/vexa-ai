# Entrada a la publicación financiera

La entrada al resumen sin filtros abre la publicación más reciente de la organización autorizada. Antes se usaba el periodo por defecto, que podía no contener la publicación existente. Fechas, moneda, base, decimales e identificadores quedan fijados en la URL; filtros explícitos se conservan. Una publicación inaccesible o inconsistente produce un error, sin sustituirla por otra.

Un subtotal documentado puede ocupar la cifra principal si existen registros conocidos, manteniendo visibles «Total desconocido» y «Cobertura parcial». No cambia cálculos, importes, barras ni estados desconocidos. La pantalla de publicación enlaza al resumen con el alcance completo.

Validación del candidato sobre `9c9a92b073f47ab4b8cafa8cb295b9044188ab2a`: 37 pruebas focales y 10 regresiones de workspace; lint, typecheck y build aprobados. Revisión independiente detectó identificadores vacíos que impedían fijar correctamente la URL; corregidos con cinco controles focales de navegación (38 pruebas definidas). No se repitió la suite completa después de esa corrección limitada a JavaScript y su prueba. Patch revisado: `1620273178701cfaa85987fa1bb28293203c1a397d94a504a5f34bf3d44e4fb1`; doce fuentes cotejadas.

Comandos: `node --test packages/workspace-service/tests/initial-publication/run.mjs`; `VEXA_CANDIDATE="$PWD" node --test support/F06-workspace/independent.test.mjs`; lint, typecheck y build del workspace `@vexa/web`. Inventario de fuentes verificado separadamente mediante `packages/jobs/load/run.mjs --preflight`.

Estas pruebas usan datos sintéticos y no acreditan RLS real, QA de navegador, medición de capacidad ni aceptación formal nueva. La comprobación del despliegue y de datos reales se conserva en recibos privados. Continúan 59/60 técnicas y 28/60 aceptadas.

# Corrección del falso verde de ejecución — F02-04

El revisor independiente comprobó que un exam.mjs que sólo imprimía F02_04_COMPLETO salía0 en Node22/26. Se conserva el informe original; no era aprobación del dominio.

El launcher ahora verifica un inventario externo fijo de22casos más el padre, títulos completos sin duplicados,23tests/23pass, cero fail/cancelled/skipped/todo y marcador. Un diagnóstico no cuenta como resultado TAP. No se obtienen los nombres del código del producto ni del módulo de examen en ejecución.

Verificación principal: cinco métodos del checker, incluidas negativas para cada caso omitido, renombrado o duplicado; entrada real Node26 con23casos exit0. Copias TMP con sólo el marcador rechazadas exit1/FAKE_GREEN_INCOMPLETE en Node22 y26. Los fixtures TAP son pruebas del checker, no evidencia de negocio.

Producto04 no fue modificado. Se materializó sobre F02-03 ya aceptado, conservando sólo los95archivos de persistencia/supabase revisados previamente; no se reintrodujeron los dos componentes03 anteriores al fix de lint/navegación. Falta recheck independiente de este delta, congelación y aceptación oficial. Estado global14/60, no15.

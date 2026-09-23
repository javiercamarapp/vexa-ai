# F06-04 · gate280 antes de implementación

Base bb8789c7. Auth/PG/Storage/Chromium reales y transporte sintético rotulado; cero inferencia pagada. Puertos60520..25 propios.

## Oráculos independientes

101 IDs únicos, páginas exhaustivas sin límite silencioso100 y desempateID en títulos iguales. Búsqueda/filtros y cursor ligado a alcance, moneda, base, identidad vigente y tamaño de página. Inyección no admite SQL libre/herramienta de escritura ni modifica dinero, jobs, outbox o intervenciones. Pregunta ambigua solicita moneda/base/período; nunca inventa monto ni usa unknown como cero. Evidencia autorizada y cobertura visible.

UI comparte snapshot/scope, errores recuperables no son vacíos exitosos. Revocación actual elimina resultados en toda página y un200capturado anterior no los repone después de navegación/back. Barreras explícitas started/release/finished, no sleeps ciegos. Leer DOM antes de modificar selectores. Fixture101 usa agrupaciones sintéticas etiquetadas de evidencia real, con IDs y versiones de embedding únicos para evitar colisión de semilla.

SQL25 aceptado se reutiliza si permanece idéntico. Dominio281 revisa parser/allowlist/cursor y mutante semántico por separado. No aceptación formal desde el gate.

## Recuperación de fixtures283

La primera corrida completó101IDs/cursor, pero el control esperaba exposición total30000 sin declarar cobertura de relaciones. La proyección aceptada devuelve null con relation_coverage_unconfirmed; contar vínculos no acredita exhaustividad. Se añadió POST relationCoverage real con propietario, inputHash y expectedVersion antes del snapshot. La declaración es sólo sobre el fixture sintético íntegro: dos órdenes vinculadas y una conocida como no relacionada. Esa tercera orden conserva amount=null; no se infiere dinero de la cobertura.

La segunda corrida pasó ocho escenarios API/UI, incluida respuesta determinística, navegación y recuperaciónHTTP. Revocar fuente denegó API/tools y limpió DOM; falló únicamente restaurar status='connected', fuera del enum SQL. Se corrigió a 'active', como el harness aceptado F06-03. Los logs y fuentes previas permanecen privados; no se atribuyen esos rojos a producto ni se relajan aserciones financieras.

La referencia financiera devuelve /overview con el scope derivado exacto; el gate comprueba SKU-X10000 y base30000 mediante dataset subyacente y clic real. Navigation elimina filtros exclusivosExplorer al salir y conserva snapshot/scope.

## Resultado final283

Tercera corrida13/13 Node26 sobre la misma composición12 inmutable. Se verificó retirada de fuente, restauración válida, denegación tras revocar membership y liberación de200 tardío después de navegación/back, sin repoblar resultados. Cero intentos externos registrados y contadores financieros/jobs/outbox/recomendaciones/intervenciones inalterados. Dominio284 aporta10/10 Node22/26 y mutante causal; entry importa ese control sin duplicarSQL. La aceptación oficial y cleanNode22 corresponden al principal.

# F04-01 — contrato del examen externo local

Estado: examen preparado en worktree de control separado, pendiente de revisión/congelación por el principal. No acepta producto ni prueba proveedor real.

## Oráculos y límites

- La ausencia inicial se comprueba por aserción `F04_GATEWAY_IMPLEMENTATION_MISSING` contra la raíz canónica. No confundir un error de import/setup con rojo de comportamiento. El runner de mutantes comprueba existencia antes de crear temporales.
- Catálogo público versionado, con fetchedAt/expiresAt y TTL máximo24h, sólo acredita identificador/capacidad/contexto. El parser no convierte metadatos públicos en atestación de privacidad ni tarifa. Catálogo ausente, vacío, ilegible, caducado o futuro bloquea; fallo de fetch no permite allow-all.
- Modelo debe pertenecer simultáneamente a catálogo y allowedModels. `response_format` y contexto efectivo son restricciones observables. Runtime deshabilitado por defecto, sin reserva ni transporte. Habilitarlo requiere `runtime:'enabled'` explícito y no concede autorización real de gasto.
- Política y atestación privada del endpoint son distintas: colección deny no equivale a ZDR, y ZDR no prueba residencia. Fallback tiene la misma intersección de modelos/proveedores/residencia; se incluye un fallback compatible como control positivo.
- Catálogo, tarifa y privacidad deben seguir vigentes después de reserve/recordAttempt y antes de transporte. Sus caducidades del fixture son deliberadamente diferentes, para que una restricción no oculte la ausencia de otra. Se cubre expiración exacta, respuesta previa al fallback y extensión maliciosa del objeto del caller durante await.
- Configuración se copia: mutar política/catálogo/endpoint después de crear el gateway no altera la aprobación que se comprobó.
- Fetch de catálogo probado exclusivamente con transporte inyectado: GET al endpoint oficial, sin Authorization, redirect error, errores/status/JSON/empty, límite10MB, timeout incluso si transporte ignora abort y caducidad durante lectura.

## Ejecución y mutaciones

Entry: `tests/acceptance/F04-01.test.mjs`; soporte independiente en `support/F04-gateway/`. El presupuesto del fixture es un puerto sintético, no una afirmación de durabilidad F04-02. El resultado de extracción es abstención sintética; no mide calidad de inteligencia ni gold humano.

Cinco mutantes se aplican sólo a una copia temporal: habilitar runtime implícitamente, ignorar allowlist, omitir elegibilidad posterior al await, ignorar residencia y equiparar deny a ZDR. Cada uno exige baseline0→mutante1 por aserción concreta→restauración0; un error de sintaxis, import o proceso no cuenta. Se preservan hash fuente, logs, resultados y recibo de limpieza.

El subproceso elimina `NODE_TEST_CONTEXT` y recibe sólo PATH y selectores internos del examen. `VEXA_F04_MUTANT_CHILD=1` evita recursión exclusivamente en hijos lanzados por el propio examen. La ejecución oficial no debe recibir ese selector desde un candidato. El transporte nativo se reemplaza por una trampa local que falla si se ignora la inyección: ninguna prueba necesita red o API key real.

## Evidencia observada en construcción del gate

14/14 rojas por ausencia antes de correr producto; primera propuesta16/16 verde; extensión22/22 verde. Versión con mutaciones23/23 verde tanto Node22 como Node26, cinco mutantes0→1→0 por runtime, sin instalación/build, Docker, SQL, red, commits o publicación. Los recibos exactos y hashes son privados del supervisor, no se incrustan rutas privadas en controles públicos.

Pendiente antes de aceptación: revisión independiente y congelación, dependencias/grafo oficiales, aprobación legítima de inferencia y condiciones reales de proveedor. Estos fixtures no certifican residencia/ZDR contractual, tarifas reales, catálogo remoto actual, presupuesto durable ni producción.

## Correctivo de revisión: frontera síncrona de caducidad

La revisión independiente reprodujo un TypeError si el catálogo expiraba entre eligible y la segunda consulta de contexto; no había transporte/reserva, pero faltaba devolver policy_blocked. El producto ahora comprueba la fila vigente antes de leer contextTokens y conserva la revalidación posterior a los awaits. El examen incluye un reloj t,t,expiración que exige rechazo estructurado y cero transporte/reserva. Se preserva el manifiesto anterior; el nuevo gate tiene24pruebas.
El sexto mutante elimina únicamente el nuevo null guard y debe fallar por la aserción de frontera, seguido de restauración verde.

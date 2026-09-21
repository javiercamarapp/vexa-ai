# F04-02 — examen externo de presupuesto durable

Propuesta local de control. No acepta tarea, no acredita proveedor, facturación remota ni autorización de inferencia.

## Entorno y oráculos

Reutiliza los servicios aislados revisados F02 mediante infraestructura propia F04-budget, sin exigir conectores ni migraciones CRM: PostgreSQL17, Auth real local (/signup y /user), login NOSUPERUSER/NOBYPASSRLS, createDatabase compilado en copia TMP con npm offline. Puertos58920–58922, red/contenedores UUID, pull never, journal0600 y limpieza por IDs. No Next/browser porque el alcance de02 es el puerto durable del gateway; no se presenta una prueba UI.

- Dos procesos compiten por80+80 contra100; sólo uno reserva. Límites all/purpose y tenant B independientes.
- Fingerprint, ventana y monto de una taskKey son inmutables; el rechazo de una petición nueva no crea un cargo.
- SIGKILL después del commit conserva reserved; owner puede conciliar reserved/uncertain sólo con CAS y evidencia explícita, nunca por TTL. Una reserva histórica sintética sigue retenida.
- Intento started persiste antes de transporte; received no puede aparecer sin started ni cambiar uso previo. Retry suma su costo separado. Finalización y conciliación son idempotentes y no descartan unknown.
- Gateway real con transporte sintético que nunca responde produce timeout/uncertain en SQL. La revisión exige además que caducidad después de started registre not_sent explícito, sin inventar HTTP ni costo.
- Rol SQL actual vence a identidad cacheada. Tenant B, viewer, workerToken y job ajenos se rechazan. Contexto de token de sesión protege UPDATE directo; started con valores NULL no pasa por lógica ternaria CHECK.
- Inventario de cuatro tablas, FORCE RLS, grants negativos incluyendo service_role y metadata FK tenant-aware; lecturas reales scoped aun con owner de dos tenants, evidencia inmutable y tres mutantes SQL0→1→0.

El gate propio no sustituye la extensión y corrida de la matriz global F01-03 para0011 antes de aceptación oficial. Esa integración de control permanece a cargo del principal.

## Correcciones y evidencia preservada

Primera corrida:8subcasos verdes y2fallos. Se corrigió producto para distinguir monto distinto como idempotency_conflict. El fixture cross-job antes pedía80 con sólo20disponibles y alcanzaba quota antes que FK; se cambió a1 para probar la frontera correcta. Corrida ampliada14/14 y después16/16, con limpieza completa.

Revisión encontró P1 reproducido: reserved80 y received120 permitían reservar1 antes de finalize. El oráculo RECEIVED_OVERRUN_MUST_FREEZE_BEFORE_FINALIZE produjo true≠false; se preserva el rojo. El principal corrigió ambas comprobaciones, API y trigger, para contar uso conocido durable aunque falte finalize.

También se incorpora frontera started→eligibilidad caducada→not_sent→settled0. La corrección no presenta started como prueba de envío ni usa un HTTP falso. Las corridas finales posteriores a estas correcciones deben comprobarse en los recibos privados; las cifras históricas anteriores no se promueven automáticamente a verdes del código nuevo.

No se editó producto ni raíz desde este agente. Pruebas y revisión son independientes del autor del módulo. Al agotar la ventana de la invocación se conservan código, logs, hashes, PID y pendientes; no se renueva presupuesto ni se declara aceptación por vencimiento del plazo.

## Aislamiento de dependencias F04-02

El fixture usa `support/F04-budget/infrastructure.mjs` y servicios reales F02 (Auth/PostgreSQL/Storage). No importa el harness F03-sync ni carga código de conectores. La comprobación standalone parte de F04-01 y añade sólo presupuesto durable/SQL0011; no requiere SQL0008–0010. Se conservan los oráculos existentes, mutantes, procesos independientes, SIGKILL, fencing y limpieza por recursos propios.

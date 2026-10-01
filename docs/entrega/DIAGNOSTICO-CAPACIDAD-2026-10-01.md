# Diagnóstico de persistencia — 1 de octubre de 2026

## Último experimento — agrupación de escrituras 442

Propuesta no adoptada, SHA256 del archivo experimental `44d4727d4a482ac1ec29793fd7e548583a33271dd4f2258bee5f2f00d0892ba6`. Agrupa escrituras nuevas conservando fronteras de sentencia para la visibilidad de revisiones, RLS y retención. Pasó 23 pruebas canónicas de persistencia y 16 casos focales sobre esquema vigente: fallos SQL, rollback de bloque, versiones, recuperación, fence, revocación, deadline y borrado/replay. Revisión independiente 444 favorable para medir, no para integrar.

El primer control de fallo dentro del bloque usó un mapeo sintético incorrecto y quedó rojo. No permitió afirmar que se había alcanzado el fallo SQL. Se conservó y corrigió con el parser real; el siguiente ensayo sí observó el fallo después de la primera fila, reversión de nueve tablas/contadores/checkpoint y recuperación de las dos filas sin cambiar el deadline. Los casos ya comprobados se reutilizaron.

El ensayo de comparación único terminó con `DEFER_HOST_NOT_READY`: 90,9 segundos sin obtener tres muestras consecutivas bajo sus condiciones de preparación. Completó sólo dos calentamientos de 100 filas, cada uno con 98 aceptadas, una rechazada, una duplicada y cero pendientes. Confirmaron 2194→1900 consultas por bloque (13,40% menos). **Cero ventanas ABBA medidas: no acredita mejora temporal ni capacidad.** La presión observada del host explica el rechazo de su guarda de preparación, no demuestra la causa del fallo histórico de 50K.

Se conservaron todos los recibos y se comprobaron cinco recursos, 23 procesos y temporales ausentes. Dictamen 444: conservar experimental; sin integración ni reintento automático. Hace falta una condición de entorno verificablemente distinta para completar la comparación; una nueva serie de carga conserva los plazos y hashes exigidos. La composición publicada sigue sin esta propuesta.

Los experimentos siguientes son anteriores y conservan sus propias fuentes y alcance.


**Capacidad de 50K/150K pendiente.** Los dos experimentos iniciales se midieron localmente después del fallo de 50K. No son nuevos gates de carga, no modifican el producto y no acreditan producción. El estado continúa en 59/60 tareas de construcción técnica y 28 aceptadas formalmente.

## Qué se comprobó

El primer perfil recorrió Auth, API, Storage y el consumidor reales con las primeras 1000 filas del mismo CSV sintético utilizado en el ensayo fallido. Terminó en 22051 ms, con 980 aceptadas, 10 rechazadas, 10 duplicadas y cero pendientes. Los diez bloques quedaron confirmados, el checkpoint llegó a 1000/done=true y el job terminó en partial, como corresponde a las filas rechazadas de la prueba.

Registró 22240 llamadas SQL desde el cliente, con 20184 ms acumulados. Cada commitChunk ejecutó exactamente 2194 consultas, pero su duración varió entre 1253 y 3328 ms. Identidad y membresías sumaron 1412 ms; espera de conexión, 64 ms. Esta medición sitúa la mayor parte del tiempo dentro de las llamadas SQL, sin distinguir todavía todo el costo de protocolo, espera, planificación y ejecución.

El servidor registró 25475 llamadas y 4211 ms de ejecución. La planificación no estaba activada en ese primer perfil: su campo cero no significa costo cero. Los agregados de servidor y cliente tienen poblaciones distintas; restarlos no mide automáticamente la red. [Definición oficial de las métricas](https://www.postgresql.org/docs/17/pgstatstatements.html).

## Comparación exploratoria con planificación medida

Se ejecutaron cuatro ventanas en orden normal/preparadas/preparadas/normal. Cada una importó 300 filas con SQL, parámetros, permisos y código del producto conservados; sólo el wrapper privado de medición cambió el envío parametrizado en las ventanas preparadas. Se comprobó track_planning=on y plan_cache_mode=auto en cada conexión.

| Ventana | Tiempo de procesamiento | Planificación del servidor | Planes registrados |
|---|---:|---:|---:|
| Normal A1 | 7636 ms | 286 ms | 6178 |
| Preparadas B1 | 7024 ms | 43 ms | 282 |
| Preparadas B2 | 6666 ms | 41 ms | 282 |
| Normal A2 | 6170 ms | 239 ms | 6196 |

Las cuatro ventanas conservaron 294 aceptadas, 3 rechazadas, 3 duplicadas y cero pendientes, con checkpoint completo y estado terminal. Cada ventana preparada reutilizó 43 nombres de consulta; no se atribuye la diferencia a una preparación que no ocurrió.

La media de tiempo sólo difiere aproximadamente 0,84%; la última ventana normal fue más rápida que ambas preparadas. **No se demostró una mejora consistente del tiempo total y no se adoptaron consultas preparadas.** La reducción de planificación es real dentro del experimento, pero no explica por sí sola el problema de capacidad.

## Límites y decisión

Cada ventana usa un import y un espacio de identificadores SYN nuevos para evitar deduplicación entre ventanas. Las tablas físicas crecen entre ventanas y el host es compartido; no son snapshots iniciales idénticos ni una prueba causal definitiva. La instrumentación también añade costo. No se extrapola este volumen a 50K o 150K, ni a proveedores, nube, inferencia o costos monetarios.

El despliegue está documentado con pooler de transacciones. Supabase indica que ese modo no soporta consultas preparadas con nombre; el resultado local no autoriza cambiar el pooler ni activar esa opción en producción. [Compatibilidad documentada](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL).

El siguiente trabajo de capacidad requiere reducir o medir mejor los viajes secuenciales de persistencia, conservando contabilidad, identidad de revisiones, visibilidad transaccional y guardas. No se aumentó el deadline de 900000 ms, no se repitió 50K sin una corrección demostrada y no se inició 150K.

Ambos procesos terminaron con exit 0 y se volvió a comprobar la ausencia de sus cinco recursos locales respectivos. El producto y su SHA desplegado permanecieron intactos.

| Recibo privado | SHA256 |
|---|---|
| Perfil de 1000 filas | `0e5128640e800c547a147ac636179a49ef9cb57fcbb6514f0401568d9e193c69` |
| Comparación ABBA | `f4096fb56170879f3cbcd20219def8422c61e3bbd9c8190c28c8c2110ecf4baa` |

Los recibos originales permanecen en custodia privada. El fallo de 50K conserva su checkpoint real de 27200 filas; estos experimentos no lo convierten en PASS.


## Lecturas combinadas: propuesta conservada como experimental

Se ensayó unir únicamente las lecturas de retención y revisión de origen, después del bloqueo de concurrencia vigente. Se conservaron escrituras, cuarentena, contadores y plazos. La propuesta pasó 23/23 pruebas de persistencia real, lint y compilación; las 24 regresiones base también pasaron.

Cuatro ventanas de 1.000 filas completaron, cada una, 980 aceptadas, 10 rechazadas, 10 duplicadas y cero pendientes. Se midieron **22.240 → 20.270 consultas por ventana (8,86% menos)** y 2.194 → 1.997 por lote de 100 filas. El ensayo de interrupción conservó 100 filas y recuperó las 250 restantes; el ensayo de borrado y reimportación rechazó el dato eliminado sin resucitar contenido. Cinco recursos y seis procesos propios comprobados ausentes.

| Orden | Variante | Procesamiento de 1.000 filas |
|---|---|---:|
| 1 | Original | 15,132 s |
| 2 | Propuesta | 15,233 s |
| 3 | Propuesta | 15,473 s |
| 4 | Original | 24,291 s |

La media de la propuesta fue 22,1% menor, pero la primera ventana original fue más rápida que ambas propuestas. El host compartido y el crecimiento de las tablas impiden atribuir una mejora estable. **La revisión independiente recomienda conservarla experimental; no está integrada ni publicada como cambio de producto.** El inventario preparado coincide con 2.156 fuentes y cambia sólo el hash de persistencia; tampoco se adoptó.

## Transporte local: medición válida, causa inconclusa

El laboratorio conecta PostgreSQL mediante socket UNIX, un servidor Node y un proceso `docker exec nc` por conexión física. Se comparó ese canal con TCP a un puerto publicado exclusivamente en loopback del mismo contenedor sintético, manteniendo el mismo rol limitado, consultas parametrizadas sin nombre y conexiones calientes. La apertura se midió aparte. No se cambió el despliegue, TLS ni el pooler.

Las ocho ventanas completaron 2.000 respuestas correctas cada una: **16.000 SELECT**, con los mismos contadores de llamadas y filas en PostgreSQL. Limpieza de contenedor, red, dos procesos y directorio temporal comprobada.

| Ventana | Canal | Tiempo de 2.000 consultas |
|---|---|---:|
| 1 | Socket/pipes | 10.701 ms |
| 2 | TCP local | 7.133 ms |
| 3 | TCP local | 6.538 ms |
| 4 | Socket/pipes | 780 ms |
| 5 | TCP local | 356 ms |
| 6 | Socket/pipes | 514 ms |
| 7 | Socket/pipes | 501 ms |
| 8 | TCP local | 353 ms |

TCP fue 15,1% más lento en la media completa y 30,1% más rápido en el último bloque. No corresponde seleccionar sólo las ventanas favorables: **no se demuestra una ventaja estable ni la causa del fallo de 50K**. La ejecución del servidor también varió entre ventanas. No se sustituyó el transporte del gate ni se amplió su plazo.

Una observación posterior, sin pruebas VEXA activas, registró cuatro muestras con 0% de CPU libre, memoria física sin usar (`unused`) entre 90 y 1.324 MB y actividad de swap-in. El inventario no encontró contenedores efímeros VEXA abandonados; permanecía la instalación local persistente. No se detuvieron servicios compartidos ni proyectos ajenos. La presión observada no prueba por sí sola la causa de la corrida fallida anterior.

Antes de otra prueba grande se exige documentar una condición nueva del entorno. La observación de preparación usa tres muestras consecutivas con al menos 50% de CPU libre, 2 GiB de memoria física sin usar (`unused`) y cero swap-outs durante la muestra. Es un criterio operativo para iniciar un ensayo, no un SLO ni una aprobación de capacidad.

**Estado conservado: 59/60 técnicas, 28 formales, producción pendiente.** La prueba 50K fallida y la ausencia de 150K actual siguen explícitas; estos diagnósticos no equivalen a dejar pendientes únicamente APIs o datos históricos.


## Nueva prueba de 10.000 filas y límite del entorno

Después de tres muestras consecutivas de preparación del host, se ejecutó una nueva prueba canónica de 10.000 filas sobre `25f2eb0`, con las 2.156 fuentes del manifiesto vigente comprobadas. No se adoptó la propuesta de lecturas combinadas ni se cambió el deadline de 900.000 ms por job.

El proceso terminó con exit 0: **9.800 aceptadas + 100 rechazos esperados + 100 duplicadas + 0 pendientes = 10.000**. API y SQL coinciden; los 100 bloques quedaron confirmados, con offsets de 100 a 10.000 y `done=true` únicamente al final. El estado `partial` corresponde a los rechazos esperados del dataset sintético.

| Medición local | Resultado |
|---|---:|
| Procesamiento | 345.448 ms |
| Extremo a extremo | 346.163 ms |
| Filas de entrada por segundo | 28,95 |
| Commit p50 / p95 | 1.466 / 15.190 ms |
| Memoria máxima del consumidor | 174.992 KiB |

La revisión independiente confirmó contabilidad, offsets, fuentes, métricas y plazo. Se recogieron los procesos y se comprobó la ausencia de los cinco recursos temporales. Una inspección posterior no encontró procesos Node/Next con directorio de trabajo VEXA. El inventario Docker previo no mostraba contenedores efímeros VEXA abandonados y los cinco recursos de esta corrida quedaron eliminados. No se intervinieron servicios persistentes ni proyectos ajenos.

**La condición inicial de estabilidad no duró.** Durante la infraestructura se tomaron 25 muestras: 13 registraron 0% de CPU libre y el mínimo de memoria física sin usar (`unused`) fue 77 MiB. Durante la ingesta fueron 23 muestras, 13 de ellas con 0% de CPU libre. Estas observaciones no prueban causalidad ni equivalen a medir continuamente el host.

La revisión recomienda no repetir 50K a partir de este resultado: antes hace falta una condición de entorno suficientemente sostenida y verificable, o una corrección de producto con mejora demostrada. Se conserva la corrida 50K fallida, sin ampliar su plazo; 150K actual permanece sin ejecutar. Esta prueba de una escala no sustituye el gate completo de tres escalas, no aprueba un SLO y no mide capacidad de nube, proveedores ni inferencia.

| Recibo privado | SHA256 |
|---|---|
| Nueva prueba 10K | `1bbf9cd1f28d080ffddf7d7ab196cd8c01ef8d1eb63d28e10b8086bbfff4d6b0` |
| Revisión independiente 10K | `c644097c8d9deaa8b60719343e7c921a40bd93849ba16a1029e36e93bb423bb4` |

Se mantienen **59/60 técnicas, 28 aceptaciones formales y producción pendiente**. No queda una carga ejecutándose por este ensayo; mantener la Mac despierta no significa que exista un bucle autónomo activo.

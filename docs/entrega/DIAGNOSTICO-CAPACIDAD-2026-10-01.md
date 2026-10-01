# Diagnóstico de persistencia — 1 de octubre de 2026

**Capacidad de 50K/150K pendiente.** Se midieron dos experimentos locales después del fallo de 50K. No son nuevos gates de carga, no modifican el producto y no acreditan producción. El estado continúa en 59/60 tareas de construcción técnica y 28 aceptadas formalmente.

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

# Ensayo de importación con programación gestionada

El 1 de octubre de 2026 se comprobó el recorrido Supabase Cron → pg_net → worker de Vercel → importación durable, usando dos filas sintéticas propias y la versión desplegada `dbb834cc8041e7bc528fc6dbba27f07f09bbb3b0`.

**Resultado acotado aprobado; 59/60 técnicas y 28 aceptaciones formales, sin aprobación de producción.** No se habilitó operación permanente ni se usaron datos del cliente, CRM, inferencia pagada o transportes de correo/push.

## Evidencia real

- Dos ejecuciones del cron y dos respuestas HTTP 200 correlacionadas. El primer tick generó heartbeat; el segundo procesó el import admitido por las rutas de producto.
- Job terminado en `succeeded`, checkpoint 2: total 2, aceptadas 2, rechazadas 0, duplicadas 0, pendientes 0.
- Identidad propia de operador, delegación del worker y carga de archivo mediante Auth/API/Storage existentes. No se insertó un resultado terminal por SQL.
- Programación, secreto temporal de Vault y tabla de control retirados. Delegación deshabilitada, sesiones cerradas y cero solicitudes/imports abiertos. Una lectura MCP posterior volvió a comprobar la limpieza.
- Los cinco trabajos históricos de extracción conservaron el mismo resumen de identidad, estado, lease, fencing token y actualización antes y después.

La prueba tenía un máximo de tres encoladas y una ventana de 90 segundos fijada por el servidor. Terminó usando dos. La guarda esperó el vínculo del import sin consumir intentos; el decremento y la encolada compartieron transacción. La barrera persistente del controlador impide repetir el ensayo con la misma autorización.

## Revisión y correcciones del controlador

Antes del remoto, una prueba focal local pasó en 41,1 segundos: límite de tres, espera del vínculo, rechazo de trabajo no vinculado, vencimiento y retirada selectiva. Esa base tenía cron desactivado y red desconectada; sólo acredita la guarda SQL, no transporte ni producto gestionado.

La revisión independiente detectó dos defectos en la preparación del ensayo: podía confirmarse un import después de agotar la ventana y podía repetirse el coordinador completo tras limpiar el primer intento. Se corrigieron antes de ejecutar, con observación fresca inmediatamente antes de confirmar y una intención de ejecución que rechaza reuso. El controlador también recoge sus procesos antes de compensar y conserva recibos separados.

## Recibos en custodia privada

| Evidencia | SHA256 |
|---|---|
| Freeze revisado de SQL y controlador | `ef3edf1d6b172a5b9914b31213b4aca1ec05765b1f60f612b63ab2a0a7f3eb64` |
| Revisión previa a ejecución | `f398d48bf3efa0a5cd55e22b968015f0c713699378deb307bfa55c508a9d32ea` |
| Resultado remoto y limpieza | `4985458a26024ea5afc7b94ce012c427cda5409dc237135480c2d0e3a2ef336c` |
| Cron, HTTP y job correlacionados | `b7a75155b1724763fe943cbeabaa5a116453499153fff03488274fd484fa4345` |
| Contabilidad final consultada por API | `6369cce61cd0ea92e9b4fbd00d6585f8569eac1d82858ccff8c900c66274c999` |
| Revisión independiente del resultado | `afc382b68ce24513eff01ac93c939de552d0a7ac4cbd9f0cf91005ed076c2895` |

## Pendientes que este ensayo no cierra

No mide disponibilidad continua, capacidad 50K/150K, concurrencia sostenida, recuperación de un backup gestionado, costos productivos ni entrega por proveedores. Las invocaciones consumen cuota de los servicios existentes; no se afirma costo cero.

La programación permanente conserva sus decisiones de frecuencia, responsables, alertas y presupuesto. La recuperación gestionada necesita un destino y un procedimiento que cubra Auth, Storage y la autoridad vigente tras el respaldo. F07-01 y la auditoría integral siguen pendientes; este ensayo independiente no sustituye la revisión global bloqueada.

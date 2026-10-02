# Recuperación gestionada: preparación y condiciones pendientes

Corte: 1 de octubre de 2026. **59/60 técnicas, 28 aceptadas; producción pendiente.** El usuario autorizó el destino temporal adicional de USD 10/mes, sin extras, y ya fue creado. Hay pruebas reales de conexión TLS y Auth; el ensayo completo del destino y la restauración siguen pendientes.

| Parte | Implementación y verificación | Límite |
|---|---|---|
| Prueba de destino vacío | Cliente PostgreSQL dedicado, HTTPS ligado al proyecto, canarios Auth/RPC/Storage/GraphQL, cierre de conexiones, pruebas negativas y limpieza. 31/31 pruebas en Node 22 y 26 y revisión independiente del delta. | TLS y Auth tienen comprobaciones reales parciales; el ensayo completo de servicios y permisos del destino sigue pendiente. |
| Captura de la fuente | Sesión de sólo lectura, snapshot MVCC compartido con `pg_dump17`, inventario, conteos, verificación del archivo mediante `pg_restore --list` y credenciales temporales privadas. 13/13 pruebas Node 22/26 y revisión independiente. | No se exportaron datos reales; un archivo legible no demuestra una restauración. |
| Archivos Storage | El inventario vincula cada objeto con SHA256 y tamaño registrados dentro del mismo snapshot. La consulta exploratoria encontró referencias para los 13 objetos actuales. | Falta descargar y verificar todos los bytes contra el inventario de la ejecución; el diagnóstico anterior no sustituye ese snapshot. |

Las revisiones corrigieron tres fallos concretos: clasificación incompleta de datos del respaldo, pérdida del registro que podía interrumpir la limpieza y desconexión de PostgreSQL durante la exportación. Los ejecutores conservan los intentos fallidos y no los sobrescriben. Un error de transporte, un objeto ausente o una firma caducada no sustituye una prueba válida de aislamiento.

La captura incluye referencias de contenido de Storage porque sus bytes no forman parte de una transacción PostgreSQL. Sólo se puede demostrar correspondencia con el snapshot si cada descarga coincide con su hash y tamaño. Objetos nuevos sin referencia, referencias ambiguas o bytes diferentes bloquean la copia. Esta condición no demuestra por sí sola conservación de permisos, retención ni autoridad actual.

También se registran conteos y huellas del contenido de cada tabla de aplicación dentro del mismo snapshot. El algoritmo conserva duplicados y compara el contenido independientemente del orden físico. Cuatro casos sintéticos de sólo lectura en PostgreSQL 17 coincidieron con un cálculo independiente: vacío, duplicados, reordenamiento y contenido alterado. No se exportaron ni compararon tablas reales de la fuente y el destino.

## Ensayos reales y correcciones

- La conexión PostgreSQL dedicada pasó con certificado oficial y validación TLS activa. Se preservó el primer fallo sin CA; no se deshabilitó la verificación.
- El primer intento completo agotó diez segundos al conectar. Las comprobaciones posteriores observaron una conexión válida de 21,5 segundos; el ejecutor corregido limita la conexión a treinta segundos.
- El pooler no aplicó `statement_timeout` enviado como parámetro de arranque: se observaron dos minutos. La corrección exige `SET statement_timeout = '15s'` y verifica el valor en la misma sesión antes de continuar. 23/23 pruebas en Node 22/26 y revisión focal independiente.
- El segundo intento verificó la credencial de fuente, su rechazo en el destino y creación/login de una cuenta sintética. Se detuvo ante el 404 de una RPC recién creada. El diagnóstico posterior observó ocho respuestas `404/PGRST202`, seguidas de `200` con el marcador esperado dentro de una ventana de 6,740 segundos. El hash del 404 coincidió con el fallo anterior: acredita disponibilidad diferida en este ensayo, no una prueba completa de aislamiento. El diagnóstico dejó el destino vacío y cerrado, sin acceder a la fuente.
- El tercer intento falló antes de SQL: el pooler conectó TCP/TLS pero falló autenticación. La conexión administrativa directa pasó en 2,433 segundos con TLS verificado; encontró `pgbouncer` sin `CONNECT` y cero usuarios Auth, objetos, buckets y tablas públicas. El canal directo permite continuar sin devolver acceso al pooler. No acredita por sí solo el ensayo completo.
- La limpieza del segundo intento comprobó usuario/RPC retirados, destino vacío y conexiones de servicio cerradas. Las cinco sesiones sintéticas preparadas para recuperación en la fuente se cerraron individualmente; se conservaron las otras sesiones. Esas preparaciones modificaron metadatos Auth, no datos de negocio.

La comparación local de capacidad consiguió un preflight válido, pero se detuvo por una dependencia ausente de la caché. Se completaron y verificaron por integridad los 396 paquetes aplicables del lockfile, sin cambiar versiones. El siguiente intento se detuvo antes de instalar o crear infraestructura: CPU libre 29,19% / 0% / 34,29% y presión de memoria WARN. Ambos intentos conservaron cero ventanas medidas y limpieza verificada. No acreditan 50K/150K.

El quinto ensayo confirmó el token de fuente con las cabeceras exactas, su rechazo en el destino y creación/login de la cuenta sintética. La RPC conservó `404/PGRST202` en quince observaciones; no produjo el marcador esperado dentro de diez segundos. Se retiraron usuario y RPC y se comprobaron destino vacío, cuarentena y cierre individual de la sesión fuente. La recuperación de la conexión de PostgREST tras la cuarentena requiere diagnóstico adicional; no se aprobó el ensayo completo.

## Evidencia revisada

Los recibos y programas operativos conservan identificadores/configuración privados y no se publican. Estas huellas identifican el material revisado; no son recibos de nube:

| Material | SHA256 |
|---|---|
| Ejecutor de prueba de destino, versión 3 | `e59290978a770a7313b8e3f66af55d0deb5b1764eb98225a4225d3c6db80175a` |
| Revisión independiente del destino | `1094098b7113cf219c0b831dfb131a3ed18865cf31437c3d85818c3d240c58a3` |
| Delta de conexión/readiness del ejecutor | `1adebd8de749c0884c5e84ea9314f3b22f69ee9692283841a386b4e4f758bede` |
| Revisión focal del delta | `2208bf891a4ed114db525113b46e2be159c08f5a67788ecb764bde7ff4bc87ca` |
| Capturador de fuente, versión 4 | `22207c3bc9dd6b010502b77f2eb735bfbfdb08b3e3e824c9205d7f9d2b62640b` |
| Revisión independiente del capturador, versión 4 | `87673ddfe07cfba432810283787ff784cf22d2488542a6ff5ecee65a26e9ce70` |

## Qué falta para cerrar

1. Completar la prueba real de permisos/servicios del destino temporal ya autorizado y creado. El delta revisado ya se ejecutó con configuración vigente y no logró disponibilidad RPC en diez segundos. Falta diagnosticar la recuperación de PostgREST y aplicar una corrección verificable antes de otro ensayo, sin convertir un 404 en aprobación. Mantener la retirada del proyecto al cerrar la prueba.
2. Adaptar y revisar el acceso temporal de captura: la conexión disponible usa un rol restringido y no acredita exportación completa de Auth. Completar la composición de importación/restauración, copiar todos los bytes verificados y reconciliar Auth, esquemas gestionados, migraciones, autoridad y retención. Este trabajo técnico no se reduce a introducir una API.
3. Ejecutar captura y restauración reales, comparar cobertura/conteos/contenido y comprobar que los permisos revocados y los borrados posteriores al respaldo se conservan. Registrar tiempos, resultado y retirada del destino.

Capacidad y operación permanente siguen separadas. La comparación de capacidad 451 se detuvo antes de crear infraestructura: tres muestras de CPU no cumplieron la condición previa; cero ventanas medidas. Se conservaron recibos, se recogieron los procesos y se detuvieron nueve contenedores locales antiguos de VEXA sin borrar sus volúmenes. Una observación posterior siguió sin cumplir la condición. No hay nueva medición 50K/150K.

La continuidad gestionada de importaciones ya tiene su [ensayo acotado aprobado](CONTINUIDAD-IMPORTACIONES-2026-10-01.md). Mantener los seis consumidores a intervalos de 30 segundos supondría 17.280 invocaciones diarias; faltan activación con presupuesto, alertas y operación verificadas. El rechazo de plataforma de la revisión global F07-01 permanece pendiente y estos ensayos no lo sustituyen. Véase el [backlog de entrega](BACKLOG.md).

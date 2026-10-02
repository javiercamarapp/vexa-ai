# Recuperación gestionada: preparación y condiciones pendientes

Corte: 1 de octubre de 2026. **59/60 técnicas, 28 aceptadas; producción pendiente.** Se implementaron y revisaron dos ejecutores operativos privados. Aún no se ejecutaron contra un destino gestionado ni acreditan restauración completa.

| Parte | Implementación y verificación | Límite |
|---|---|---|
| Prueba de destino vacío | Cliente PostgreSQL dedicado, HTTPS ligado al proyecto, canarios Auth/RPC/Storage/GraphQL, cierre de conexiones, pruebas negativas y limpieza. 14/14 pruebas en Node 22 y 26 y revisión independiente. | Pruebas con transportes sintéticos; falta comprobar permisos y servicios reales del destino. |
| Captura de la fuente | Sesión de sólo lectura, snapshot MVCC compartido con `pg_dump17`, inventario, conteos, verificación del archivo mediante `pg_restore --list` y credenciales temporales privadas. 13/13 pruebas Node 22/26 y revisión independiente. | No se exportaron datos reales; un archivo legible no demuestra una restauración. |
| Archivos Storage | El inventario vincula cada objeto con SHA256 y tamaño registrados dentro del mismo snapshot. La consulta exploratoria encontró referencias para los 13 objetos actuales. | Falta descargar y verificar todos los bytes contra el inventario de la ejecución; el diagnóstico anterior no sustituye ese snapshot. |

Las revisiones corrigieron tres fallos concretos: clasificación incompleta de datos del respaldo, pérdida del registro que podía interrumpir la limpieza y desconexión de PostgreSQL durante la exportación. Los ejecutores conservan los intentos fallidos y no los sobrescriben. Un error de transporte, un objeto ausente o una firma caducada no sustituye una prueba válida de aislamiento.

La captura incluye referencias de contenido de Storage porque sus bytes no forman parte de una transacción PostgreSQL. Sólo se puede demostrar correspondencia con el snapshot si cada descarga coincide con su hash y tamaño. Objetos nuevos sin referencia, referencias ambiguas o bytes diferentes bloquean la copia. Esta condición no demuestra por sí sola conservación de permisos, retención ni autoridad actual.

También se registran conteos y huellas del contenido de cada tabla de aplicación dentro del mismo snapshot. El algoritmo conserva duplicados y compara el contenido independientemente del orden físico. Cuatro casos sintéticos de sólo lectura en PostgreSQL 17 coincidieron con un cálculo independiente: vacío, duplicados, reordenamiento y contenido alterado. No se exportaron ni compararon tablas reales de la fuente y el destino.

## Evidencia revisada

Los recibos y programas operativos conservan identificadores/configuración privados y no se publican. Estas huellas identifican el material revisado; no son recibos de nube:

| Material | SHA256 |
|---|---|
| Ejecutor de prueba de destino, versión 3 | `e59290978a770a7313b8e3f66af55d0deb5b1764eb98225a4225d3c6db80175a` |
| Revisión independiente del destino | `1094098b7113cf219c0b831dfb131a3ed18865cf31437c3d85818c3d240c58a3` |
| Capturador de fuente, versión 4 | `22207c3bc9dd6b010502b77f2eb735bfbfdb08b3e3e824c9205d7f9d2b62640b` |
| Revisión independiente del capturador, versión 4 | `87673ddfe07cfba432810283787ff784cf22d2488542a6ff5ecee65a26e9ce70` |

## Qué falta para cerrar

1. Crear un destino aislado autorizado y ejecutar la prueba de sus permisos/servicios. Se solicitó confirmación para un proyecto temporal adicional: Supabase informó USD 10/mes, sin extras. No se creó ni se autorizó por el mero hecho de preparar estos ejecutores.
2. Completar y revisar la composición de importación/restauración, copiar todos los bytes verificados y reconciliar Auth, esquemas gestionados, migraciones, autoridad y retención. Este trabajo técnico no se reduce a introducir una API.
3. Ejecutar captura y restauración reales, comparar cobertura/conteos/contenido y comprobar que los permisos revocados y los borrados posteriores al respaldo se conservan. Registrar tiempos, resultado y retirada del destino.

Capacidad y operación permanente siguen separadas. La comparación de capacidad 451 se detuvo antes de crear infraestructura: tres muestras de CPU no cumplieron la condición previa; cero ventanas medidas. Se conservaron recibos, se recogieron los procesos y se detuvieron nueve contenedores locales antiguos de VEXA sin borrar sus volúmenes. Una observación posterior siguió sin cumplir la condición. No hay nueva medición 50K/150K.

La continuidad gestionada de importaciones ya tiene su [ensayo acotado aprobado](CONTINUIDAD-IMPORTACIONES-2026-10-01.md). Mantener los seis consumidores a intervalos de 30 segundos supondría 17.280 invocaciones diarias; faltan activación con presupuesto, alertas y operación verificadas. El rechazo de plataforma de la revisión global F07-01 permanece pendiente y estos ensayos no lo sustituyen. Véase el [backlog de entrega](BACKLOG.md).

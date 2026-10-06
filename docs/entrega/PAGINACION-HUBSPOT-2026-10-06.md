# Paginación de notas de HubSpot — 6 de octubre de 2026

Un ticket con más de cien notas podía detener el conector con `UNSAFE_NEXT`. HubSpot devolvía el enlace siguiente bajo `/crm/objects/v4/tickets/{id}/associations/notes`, mientras la petición original usaba `/crm/v4/objects/tickets/{id}/associations/notes`.

El adaptador reconoce únicamente ese alias para el mismo ticket y relación de notas. Conserva la validación de origen, credenciales, fragmento, cursor y parámetros. La petición siguiente se construye con la ruta original; nunca se sigue directamente el enlace recibido.

La regresión reprodujo el fallo antes del cambio. Después pasaron 50 pruebas focales en Node 22 y 26, incluidas once variantes de enlace inválido. Una revisión independiente aprobó el delta sin hallazgos P0/P1/P2. La observación autorizada con el adaptador real completó veinte hilos, 27 mensajes, 62 eventos administrativos, trece lecturas de tickets y 324 notas: cero errores, cero cuerpos de mensaje faltantes y cero diferencias de texto o tipo entre los mensajes observados y la copia previa comparada. La selección fue acotada; no es una evaluación representativa de precisión ni una conciliación independiente de UI/export para S01.

El inventario de capacidad verifica 2.186 archivos sin iniciar infraestructura. Las mediciones antiguas conservan sus hashes; esta corrección no acredita capacidad nueva. Los datos y recibos de proveedor permanecen privados, fuera de Git.

Se mantienen 59/60 tareas técnicas y 28/60 aceptadas formalmente. Este cambio no realiza importaciones productivas, no valida toda la operación remota ni cierra F03-01 o F07-01.

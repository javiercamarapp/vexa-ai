# Visibilidad de importaciones delegadas

Cuando otra cuenta cargaba archivos del mismo espacio, el propietario veía una lista vacía porque Importaciones sólo enumeraba sus reservas propias. Ahora los propietarios disponen de una tabla separada de trabajos del espacio con estado, filas aceptadas/rechazadas/duplicadas y enlace al detalle existente. Las reservas propias conservan su flujo.

La consulta usa la organización y el rol de la sesión autorizada, acota todos los joins al mismo tenant y pagina 50 trabajos. No entrega rutas de Storage, bytes, tokens ni acceso a mapping ajeno. Ante carga o error se muestra ese estado, sin convertirlo en ausencia de trabajos.

Comprobaciones: 33 pruebas focales Node22; lint, typecheck y build en copia aislada; revisión independiente del delta y corrección de un estado vacío incorrecto tras errores. Se conserva la autorización existente de propietarios para consultar trabajos. La revisión no acredita una nueva medición de capacidad ni aceptación formal; siguen 59/60 técnicas y 28/60 aceptadas.

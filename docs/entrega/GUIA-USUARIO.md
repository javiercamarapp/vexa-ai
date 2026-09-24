# Guía de uso

Pendiente de ensayo por un usuario independiente siguiendo sólo esta guía. Cuentas, datos y permisos del piloto deben ser reales y autorizados.

## Acceso

Abra /login, use el método habilitado y seleccione una organización de su membresía. Seleccionar una organización no concede acceso nuevo. Owner configura conexiones, presupuesto, delegaciones y aprobaciones; analyst importa/analiza; operator participa en acciones autorizadas; viewer consulta. Cada operación verifica permisos actuales en servidor. No existe aún una invitación general a nuevas cuentas conectada: aprovisionamiento y membresías se coordinan con el administrador.

## Histórico e importación

En /connections, owner registra proveedor, cuenta, referencia de la credencial del servidor y comienzo histórico. No pegue tokens en campos libres. Activar no demuestra scopes ni cobertura: revise salud y primera sincronización. Pausar conserva lo importado; otra cuenta exige otra conexión; cambiar comienzo crea generación de cursores conservando deduplicación. /migrations gestiona equivalencias revisadas; no fuerce comparabilidad. HubSpot sólo ofrece los registros disponibles en su API, no snapshots históricos inexistentes.

En /imports seleccione conexión y CSV/XLSX (hasta 20 MiB), reserve/suba, asigne columnas, zona horaria/formato/moneda, valide y guarde mapping. Fecha, rol y conversación son necesarios para mensajes. Confirme envío a cola y abra el progreso real del job. La muestra no es cobertura final: espere el estado terminal y concilie aceptadas/rechazadas/duplicadas/pendientes. Descargue errores del mapping guardado para corregir el origen; no modifique silenciosamente una importación confirmada.

## Análisis y evidencia

En /analysis, owner configura límites y owner/analyst solicita extracción de conversación autorizada. Worker redacta, llama al proveedor habilitado y valida. Sin política/proveedor/presupuesto no se simula éxito. Costo incierto requiere conciliación; reenviar puede generar otro costo.

En /history, owner confirma el procesamiento de una conexión con los runtimes y presupuestos configurados. El lote continúa con la interfaz cerrada, muestra progreso por conversación y permite cancelar; requiere los consumidores de histórico, extracción y agrupación activos. Procesar el histórico no publica cifras ni mide por sí solo la calidad del modelo.

Use /problems para lista y detalle, y /problems/manage para agrupación. /overview muestra prioridades/cobertura; el historial de cliente se abre desde una identidad conocida. /explorer consulta evidencia autorizada. Revise fuente, versión, fechas y límites; una cita válida no prueba causalidad.

## Dinero, acción y brief

/economics registra fuentes operacionales y componentes con aprobación/procedencia. Declare moneda/ventana. Desconocido no es cero; subtotal no es total; exposición no es pérdida ni es aditiva entre problemas solapados. Escenarios y costos modelados conservan supuestos separados. Prepare/publique un snapshot revisado y compare UI/API/export CSV/JSON del mismo corte.

/recommendations permite proponer intervención con responsable. En /interventions complete hipótesis, baseline, población, control y métrica; owner aprueba cuando corresponde. Cerrar necesita referencia de medición. Aprobación o antes/después no demuestra ahorro causal. /briefs genera un brief del snapshot y permite revisar detalle/export; generarlo no envía correo al cliente.

## Avisos y errores

/notifications contiene avisos; /settings/notifications sus preferencias. Con propuestas F06-10..12 integradas, owner configura /settings/notification-delivery y cada persona registra Push en /notifications/push. Canales requieren configuración, consentimiento y consumidor activo. accepted no significa delivered; invitación no conectada sigue rotulada.

403 requiere revisar permiso;409 exige recargar versión y revisar antes de confirmar otra vez. Servicio no disponible no equivale a cero resultados. No repita imports/inferencia/envíos inciertos para ocultar un error. Cerrar sesión invalida Auth; con F06-11 revoca dispositivos de esa sesión y conserva historial de intentos.

## Retención y borrado

En /settings/retention, un owner activo configura el plazo de las nuevas copias registradas; las existentes conservan su vencimiento. Seleccione conexión, tipo e identidad, previsualice y revise todo el alcance. La eliminación de un archivo fuente afecta también las otras filas que contenga: la pantalla enumera estos archivos antes de pedir confirmación irreversible. Un cambio de alcance o política requiere otra previsualización.

Tras confirmar, el borrado lógico queda registrado. Use la acción de eliminar o reintentar archivos pendientes hasta terminar las tandas de 25. Un fallo de Storage mantiene el estado pendiente; no indica que el objeto haya desaparecido. Descargue y custodie el registro firmado fuera del backup junto al procedimiento de recuperación. La clave de firma permanece en servidor. Esta interfaz no restaura producción ni elimina copias de un CRM externo.

## Evaluación del histórico

Tras completar análisis del histórico, un owner puede abrir Evaluación histórica, elegir conexión y taxonomía exacta y fijar la ventana de disponibilidad y su corte exclusivo. Una cohorte conserva los IDs y hashes de hasta500 resultados; las páginas muestran25 casos. Las fechas provienen de las revisiones originales utilizadas: una corrección posterior del CRM no cambia retrospectivamente el momento del evento evaluado.

Revise la evidencia autorizada antes de confirmar etiquetas y valoraciones. Guardar añade una versión de feedback ligada al resultado; una versión obsoleta requiere actualizar. La descarga incluye casos elegibles, exclusiones con razón y procedencia. Un cliente sin identidad canónica o una fuente fuera del corte se excluyen explícitamente. Revocar acceso o borrar una fuente impide posteriores lecturas y descargas de su contenido.

El conjunto descargado sirve para desarrollo y es compatible con el evaluador local. El feedback de un owner no sustituye gold humano independiente. Esta pantalla no ejecuta nuevos modelos ni entrena o promueve candidatos. La evaluación de calidad, la ejecución externa de candidatos y cualquier aprobación de cambio conservan sus controles específicos; las métricas sintéticas no acreditan precisión real.

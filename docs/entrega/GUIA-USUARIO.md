# Guía de uso

Pendiente de ensayo por un usuario independiente siguiendo sólo esta guía. Cuentas, datos y permisos del piloto deben ser reales y autorizados.

## Acceso

Abra /login, use el método habilitado y seleccione una organización de su membresía. Seleccionar una organización no concede acceso nuevo. Owner configura conexiones, presupuesto, delegaciones y aprobaciones; analyst importa/analiza; operator participa en acciones autorizadas; viewer consulta. Cada operación verifica permisos actuales en servidor. No existe aún una invitación general a nuevas cuentas conectada: aprovisionamiento y membresías se coordinan con el administrador.

## Histórico e importación

En /connections, owner registra proveedor, cuenta, referencia de la credencial del servidor y comienzo histórico. No pegue tokens en campos libres. Activar no demuestra scopes ni cobertura: revise salud y primera sincronización. Pausar conserva lo importado; otra cuenta exige otra conexión; cambiar comienzo crea generación de cursores conservando deduplicación. /migrations gestiona equivalencias revisadas; no fuerce comparabilidad. HubSpot sólo ofrece los registros disponibles en su API, no snapshots históricos inexistentes.

En /imports seleccione conexión y CSV/XLSX (hasta 20 MiB), reserve/suba, asigne columnas, zona horaria/formato/moneda, valide y guarde mapping. Fecha, rol y conversación son necesarios para mensajes. Confirme envío a cola y abra el progreso real del job. La muestra no es cobertura final: espere el estado terminal y concilie aceptadas/rechazadas/duplicadas/pendientes. Descargue errores del mapping guardado para corregir el origen; no modifique silenciosamente una importación confirmada.

## Análisis y evidencia

En /analysis, owner configura límites y owner/analyst solicita extracción de conversación autorizada. Worker redacta, llama al proveedor habilitado y valida. Sin política/proveedor/presupuesto no se simula éxito. Costo incierto requiere conciliación; reenviar puede generar otro costo.

Use /problems para lista y detalle, y /problems/manage para agrupación. /overview muestra prioridades/cobertura; el historial de cliente se abre desde una identidad conocida. /explorer consulta evidencia autorizada. Revise fuente, versión, fechas y límites; una cita válida no prueba causalidad.

## Dinero, acción y brief

/economics registra fuentes operacionales y componentes con aprobación/procedencia. Declare moneda/ventana. Desconocido no es cero; subtotal no es total; exposición no es pérdida ni es aditiva entre problemas solapados. Escenarios y costos modelados conservan supuestos separados. Prepare/publique un snapshot revisado y compare UI/API/export CSV/JSON del mismo corte.

/recommendations permite proponer intervención con responsable. En /interventions complete hipótesis, baseline, población, control y métrica; owner aprueba cuando corresponde. Cerrar necesita referencia de medición. Aprobación o antes/después no demuestra ahorro causal. /briefs genera un brief del snapshot y permite revisar detalle/export; generarlo no envía correo al cliente.

## Avisos y errores

/notifications contiene avisos; /settings/notifications sus preferencias. Con propuestas F06-10..12 integradas, owner configura /settings/notification-delivery y cada persona registra Push en /notifications/push. Canales requieren configuración, consentimiento y consumidor activo. accepted no significa delivered; invitación no conectada sigue rotulada.

403 requiere revisar permiso;409 exige recargar versión y revisar antes de confirmar otra vez. Servicio no disponible no equivale a cero resultados. No repita imports/inferencia/envíos inciertos para ocultar un error. Cerrar sesión invalida Auth; con F06-11 revoca dispositivos de esa sesión y conserva historial de intentos.

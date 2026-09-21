# Citas autorizadas y revisión histórica — propuesta F04-04

`createEvidenceRepository({database}).get(runId)` consulta un run terminal del tenant autenticado. Reconstruye las revisiones redactadas del manifiesto de entrada inmutable, verifica el hash de cada texto y el hash global de entrada y reutiliza validateExtraction/validateEvidence del banco. No consulta mapas privados de redacción ni entrega nombres originales, payloads, URLs de Storage o credenciales.

El rol de cada cita se contrasta con el snapshot de mensaje original. Una nota interna permanece rotulada como interna; no puede convertirse en cita de cliente. Los offsets son Unicode code points y la cita conserva exactamente emoji, acentos y normalización originales. Los hashes de cita se recalculan determinísticamente en el gateway, no los genera el modelo.

El lector revalida conversación, mensaje, revisiones, conexión, identidad y tombstones. Un cambio de revisión no elimina el historial todavía autorizado: la pantalla lo rotula histórico. Tampoco permite publicar una nueva extracción contra una revisión que dejó de ser la seleccionada. Una fuente eliminada, conexión inactiva, cabeza canónica ausente o revocación de membresía bloquean la lectura incluso cuando el texto de la cita coincide.

La pantalla `/analysis` enlaza a `/analysis/{runId}` y obtiene el resultado por `/api/extraction/{runId}/evidence`, con sesión/RLS y sin caché pública. Se revalida periódicamente y al recargar; un error retira las citas de la vista. El navegador no elige el tenant. Los viewers autorizados pueden leer la evidencia redactada sin acceso a los mapas privados.

Los runs nuevos conservan input_manifest en su provenance antes de llamar al gateway. Un prototipo anterior sin ese manifiesto no se muestra por suposición ni provoca inferencia automática. No hay datos de cliente migrados ni runs de producción anteriores en esta propuesta. La migración de históricos originales importados sigue el recorrido normal de ingesta y crea sus extracciones con el manifiesto actual.

Validar el texto y la procedencia de una cita no demuestra que respalde una causa; esa evaluación pertenece a las fases siguientes y al conjunto humano. Sin revisión independiente, aceptación ni producción remota acreditadas.

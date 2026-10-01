# Entradas formales de piloto, ensayo y entrega

Estos controles completan las entradas F07-05, F08-03 y F08-05; no sustituyen sus actos humanos ni su cadena de dependencias. Ningún archivo de prueba es autorización, entrevista, consentimiento o recepción real. La ruta oficial no tiene opción para aceptar fixtures.

El supervisor primero coteja los documentos y actos legítimos. Conserva fuera del candidato, en archivos regulares privados 0600 dentro de un directorio 0700, sin alias de ruta ni symlinks (salvo los alias de sistema macOS `/var`→`/private/var` y `/tmp`→`/private/tmp`), un manifiesto de evidencia y una revisión independiente. Después fija el SHA256 exacto de esa revisión en su entorno de control. Ese pin verifica integridad; no autentica por sí solo al emisor. El supervisor debe comprobar identidad, autoridad vigente, autenticidad y alcance antes de proporcionar estas entradas. No emitir una revisión aprobada para datos pendientes o sintéticos.

Variables, sólo para aceptación interactiva autorizada:

```
VEXA_CANDIDATE=/checkout/limpio
VEXA_HUMAN_WORKFLOW_MANIFEST=/privado/manifest.json
VEXA_HUMAN_WORKFLOW_REVIEW=/privado/review.json
VEXA_HUMAN_WORKFLOW_REVIEW_SHA256=<hash cotejado por el supervisor>
VEXA_HUMAN_WORKFLOW_APPROVAL_REFERENCE=<decisión legítima>
```

El runner obtiene la última variable de su `approval_note` guardada, conserva `requires_approval` y dependencias, y no entrega las entradas a workers ni al auto-run. El gate directo sólo comprueba el expediente: nunca cambia estado de aceptación, no concede permisos y devuelve `formalAcceptance:false` y `productionValidated:false`.

El manifiesto `vexa-human-workflow-v1` contiene `task`, `candidateSha`, `sources:[{path,sha256}]` y `artifacts:[{name,file,sha256}]`. Las fuentes obligatorias están fijadas por ficha en `control.mjs`; los artefactos permanecen fuera del checkout. El árbol Git debe estar limpio. Se comprueban fuentes, recibos, bytes y vigencia otra vez antes de terminar.

La revisión `vexa-human-workflow-review-v1` liga tarea, revisión Git, `manifestSha256`, `controlSha256` (del control confiable), `humanActSha256`, `approvalReference`, `operation:verify_human_workflow`, `operator` y `reviewer` distintos. Exige decisión `approved`, `authenticityReviewed:true`, `authorityCurrent:true`, `syntheticEvidenceAcceptedAsHuman:false`, `reviewedAt` y `expiresAt` (máximo 24 horas). Las fechas son ISO UTC; el acto debe terminar antes de la revisión, y en el piloto el estudio debe estar revisado antes del acto final. Estos campos registran un cotejo real previo; rellenarlos no convierte una declaración en un hecho.

- **F07-05:** artefactos `act`, `study`, `protocol`, `dataset`, `predictions`, `evaluation`, `evaluationReceipt`, `pilot`, `pilotReceipt`. Recalcula F04 y el piloto usando los evaluadores confiables, exige fuentes iguales, encadena recibos y bytes y rechaza datos SYN o sin gold humano. Requiere observación de comprensión humana menor de 300 segundos y acción con sponsor. El acto debe registrar revisión de custodia del gold, doble anotación, consentimientos y representatividad; la revisión confirma criterios de aceptación. El resultado técnico `requires_human_review` sólo puede acompañar un acto humano posterior, legítimo y revisado; jamás basta por sí solo. No establece ahorro causal ni ingresos contratados.
- **F08-03:** acto humano cronometrado de máximo 300 segundos con comprensión, respaldo offline sin solicitudes, rotulado visible y portabilidad observada. Coteja video y manifest por bytes, exposición USD300 y refund USD15 separados. Esta primera ruta admite únicamente materiales VEXA sintéticos; los materiales identificables requieren primero la autorización específica de F08-04 y una ampliación revisada del contrato. No sustituir cronómetro humano por duración del video.
- **F08-05:** acto de recorrido siguiendo la guía, importación terminal y deduplicación, vistas/evidencia/export, reingreso y revocación observada; recepción por una persona distinta del observador, mediante OAuth o gestor de secretos. Exige responsables, suplente, ruta de incidente, revisión futura y pendientes explícitos. El artefacto `backlog` liga `sourceSha256` al BACKLOG.md, contiene exactamente sus IDs ENT en `rows:[{id,status:open|closed,evidenceReference}]` y requiere `backlogScopeReviewed:true` en la revisión. Los pendientes corresponden exactamente a las filas abiertas y exigen ID, responsable, criterio de aceptación, reproducción, severidad P0–P3 y vencimiento ISO UTC. El operador coteja la veracidad del alcance; el control verifica su integridad y estructura. No incluir contraseñas ni tokens en el expediente.

Los actos usan `kind:human_observation`, `status:completed`, `observer` y `evidenceReference`. El observador coincide con el revisor del expediente. Las observaciones exactas de cada ficha están en los oráculos exportados del control. No hay credenciales, red, inferencia ni mutaciones del producto en este examinador. La autenticidad y la aceptación final siguen siendo responsabilidad del supervisor y de las personas autorizadas.

Calibrar el controlador, sin aceptar fichas reales:

```sh
node --test support/human-workflows/control.test.mjs
python3 -m unittest discover -s tests/controller -p 'test_human_workflow_environment.py' -v
```

Sin entradas legítimas, los tres entrypoints deben fallar con `HUMAN_WORKFLOW_EXTERNAL_INPUTS_REQUIRED`. Ese resultado es un bloqueo externo esperado, no un gate de producto aprobado.

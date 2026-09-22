# Recomendaciones condicionadas

El generador `conditioned-rules-v1` adapta el recomendador del laboratorio a snapshots, versiones de problemas y citas persistidas. Es una propuesta determinista de investigación, rotulada como tal; no se presenta como inferencia de un modelo ni calidad validada por clientes. Distingue transporte, pagos, calidad y otros síntomas. Un riesgo crítico solicita revisión humana urgente aun sin impacto monetario conocido. La evaluación causal operacional autorizada aporta estado, versión y evidencia; una hipótesis no se convierte en causa confirmada por el texto de la recomendación.

La propuesta fija `problemVersionId`, snapshot, scope, detailHash y citas verificadas por el servidor. El cliente no suministra importes, citas arbitrarias ni probabilidades. Las precondiciones requieren responsable, baseline y plan de medición antes de ejecutar cambios. Esfuerzo significa revisión diagnóstica, no una estimación medida de horas o costo.

Propietario, analista y operador pueden proponer, editar acción/precondiciones/razonamiento, asignar una persona autorizada, descartar y reabrir con razón. Viewer sólo lee. Cada cambio requiere versión esperada y produce una entrada de historial inmutable. Una versión posterior del problema o de su evaluación causal marca la recomendación anterior como desactualizada e impide nuevas mutaciones; se debe generar otra propuesta sobre el nuevo corte. Retirar permisos, fuente o evidencia impide acceso al contenido afectado.

`createDraft` guarda únicamente una intervención en estado draft, con referencia a la versión exacta de recomendación y su baseline. La clave de idempotencia debe conservarse al reintentar; un doble clic concurrente con la misma clave produce el mismo borrador, mientras una intención distinta con esa clave falla. La base de datos captura la definición histórica del borrador. No hay llamadas CRM, reembolsos, recalls, aprobaciones ni ejecución de herramientas. El plan completo y la máquina de intervención corresponden a F06-05 y no se declaran implementados aquí.

## Persistencia y autorización

SQL0025 extiende las tablas canónicas `recommendations` e `interventions`, y añade `recommendation_versions`. Los cambios managed son independientes de las filas legacy. Historial, referencias y definición del borrador son inmutables. La extensión de policy permite sólo proposed/dismissed para recomendaciones de este esquema; no amplía las acciones globales.

Las filas managed se consultan mediante API de servidor, no mediante SELECT de usuarios authenticated. SQL comprueba tenant, actor, rol, CAS, versión actual del problema, binding, snapshot publicado, integridad estructural de citas/roles/hash y referencias, conexión activa, revisiones no retiradas, tombstones y fuentes/catálogos financieros vigentes antes de certificar una propuesta o borrador. Los repositorios canónicos de evidencia, detalle y snapshot revalidan conexiones, borrados, revisiones redactadas y autorización actual en cada consulta y operación; el guard SQL de certificación no sustituye la validación semántica completa de esos repositorios.

## Operación

- Resolver snapshot y alcance con el workspace compartido; listar con `GET /api/recommendations` y esos filtros fijados.
- Proponer mediante `POST /api/recommendations`, `operation:generate`, query de alcance, problemId y requestKey.
- Editar o cambiar estado mediante `POST /api/recommendations/:id`, operation revise/state y expectedVersion. Descartar siempre requiere razón.
- Crear borrador con `POST /api/recommendations/:id/interventions`, expectedVersion y requestKey.
- `GET /api/recommendations/:id` devuelve definición, historia y borradores autorizados, con el contrato `f06-recommendations-v1` y trace_id.

Se reutilizan Auth y PostgreSQL existentes. No se añaden credenciales o proveedores pagados. Una falta de configuración devuelve configuration_required; un error operativo no se transforma en lista vacía. UI debe conservar la intención fallida y reintentar la misma clave, sin aparentar que se guardó.

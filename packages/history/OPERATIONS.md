# Lotes históricos autorizados

El owner autoriza en `/history` una conexión activa y la combinación vigente de configuraciones de extracción y agrupación. Ambos runtimes deben estar habilitados explícitamente. Configurar una conexión CRM no autoriza por sí solo inferencia; tampoco crear un presupuesto.

El lote guarda owner, consentimiento, conexión, hashes de configuración y corte temporal. Un worker autenticado real con rol analyst y delegación vigente avanza un máximo25 fuentes/ítems por transacción. La selección por ID es estable, reanudable y limitada al corte; sólo admite conversaciones canónicas de la conexión. Usa las colas existentes para extracción y problemas y sus comprobaciones de evidencia, gateway y presupuesto durable. No publica snapshots ni inventa finanzas.

Los hijos tienen como actor al worker real. La autorización del owner del lote permanece como condición adicional en SQL34. Cancelación del lote, pérdida de owner o desconexión impiden ejecución/escrituras posteriores aunque el worker siga activo. Una llamada de proveedor ya iniciada no se puede retirar; su coste incierto conserva el contrato de conciliación. Ningún fallo financiero se convierte a cero.

El cursor, los ítems y las solicitudes se confirman juntos. Una caída antes del commit revierte el chunk; después del commit conserva identidades e idempotencia. Los fallos terminales de extracción/agrupación no se reintentan automáticamente. Una extracción abstained se marca omitida. Una configuración distinta o runtime deshabilitado pausa el lote; sólo el owner original puede reautorizar con la configuración original restaurada. Un lote nuevo requiere consentimiento nuevo.

API: GET `/api/history`; POST `start` con connectionId/requestKey/confirmed=true; `cancel` con batchId/expectedVersion; `resume` añade confirmed=true. El tenant nunca se recibe en body. Los cambios comparan versión; el lector muestra hasta100 lotes recientes.

Segundo plano: POST `/api/internal/history` con Bearer `VEXA_WORKER_TRIGGER_SECRET`, cuerpo vacío o `{}`, sin tenant. Se programa con el scheduler HTTP existente (`packages/jobs/durable/scheduler.mjs`) apuntado a ese endpoint. Alternativa CLI `packages/history/daemon.mjs` con `--once` o bucle. Reutiliza variables Auth/DB del worker y `VEXA_WORKER_DISPATCHER=enabled`; necesita SQL0034. Mantener también los consumidores de extracción y problemas existentes: history admite solicitudes, esos workers ejecutan inferencia. La página sólo consulta progreso, no impulsa trabajo.

SQL0034 depende de contratos0014/0016, añade ledger/RLS y condición adicional de autoridad sólo para hijos vinculados. Los demás jobs conservan el comportamiento original. No requiere módulos09 ni modificaSQL33. Revisión independiente331:9/9 controles sobre las veinte fuentes originales. La integración con la rama publicada pasó lint/build y ocho regresiones del consumidor durable; la composición con otras propuestas sigue pendiente.

Prueba de autor: `VEXA_CANDIDATE=<checkout> node packages/history/tests/functional.mjs`. Auth/PG/CRM API/worker/browser reales con102 conversaciones SYN. El preload intercepta proveedores SYN dentro del proceso y rechaza toda red externa; no utiliza credenciales reales. Se conserva evidencia y cleanup por corrida, además del diagnóstico CDP response.json de la primera prueba. No es validación de precisión del modelo ni de capacidad comercial.

El detalle GET `/api/history?batch=<id>&cursor=<conversationId>` muestra25 conversaciones por página, IDs de trabajos, motivo y enlace al análisis. El cursor se valida dentro del mismo lote y tenant. UI ofrece anterior/siguiente. El listado de lotes resume hasta100 recientes; este límite no limita el procesamiento de conversaciones de un lote.

Build CLI: `node packages/history/build.mjs /ruta/temporal/fuera-del-checkout`, con dependencias del workspace disponibles para el artefacto. Reutiliza el compilador de plataforma y copia únicamente módulos necesarios. SQL y JavaScript calculan la clave de solicitud como primeros128bits de SHA256 de `batch:conversation:config:purpose`, formateados UUID; es identidad idempotente, no credencial.

La versión CAS cambia al cambiar el ciclo de vida, no por cada avance de cursor. Así un worker activo no invalida continuamente la decisión de cancelar del owner.

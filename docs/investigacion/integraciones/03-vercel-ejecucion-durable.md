# 03 · Vercel y ejecución durable

## Recomendación condicionada

Para los 30 días, usar Vercel para UI/API y ejecuciones cortas; Postgres conserva jobs/checkpoints y Supabase Queues es el candidato inicial para repartir lotes. Un disparador autenticado deberá despertar workers de forma repetible. **Una cola sin consumidor activo no constituye un pipeline.** Cuenta, plan, frecuencia del disparador, duración y costo deben cerrarse en S04/S05 antes de elegir la implementación productiva.

Comparar Vercel Workflow con esta base mediante el mismo ensayo de recuperación. Workflow puede simplificar coordinación, reanudación y esperas; no está probado en VEXA. Elegirlo si reduce complejidad total y supera los mismos criterios de aislamiento, costo, cancelación y despliegue. No mantener dos orquestadores para las mismas etapas en el MVP.

La preferencia inicial por colas responde a backfill paginado, lotes independientes y estado analítico ya alojado en Postgres. Es una inferencia arquitectónica, no un benchmark ni afirmación de menor precio. El alcance deriva del [contexto canónico](../../CONTEXTO-CANONICO.md).

## Evidencia y límites de los contratos

| Evidencia con URL y archivo local | Lectura aplicable |
|---|---|
| [Vercel Academy](https://vercel.com/academy/llms-full.txt), [vercel-workflow.md](../fuentes/vercel-workflow.md), [JSON](../fuentes/vercel-workflow.json) | Documenta steps con tres reintentos por defecto, cuatro intentos totales, `maxRetries = 0`, `FatalError`, `RetryableError` y sleep. El comportamiento local del sleep no sustituye el ensayo desplegado. |
| [Comparativa oficial fijada a commit](https://github.com/vercel/workflow/blob/20ad2b358240819c6e590fd4752b97da1c64b390/docs/content/docs/v5/comparisons/workflow-sdk-vs-aws-step-functions.mdx), [vercel-functions.md](../fuentes/vercel-functions.md), [JSON](../fuentes/vercel-functions.json) | Menciona 50 MB por payload y 2 GB por run en Vercel World, y ausencia de límite de duración del workflow. Esos valores no son límites de una Function ni demuestran el plan contratado. |
| [Functions](https://vercel.com/docs/functions), mismos archivos | El pasaje solo señala que existen límites; no contiene la tabla necesaria para cerrar memoria, payload y duración. |
| [Cambio propuesto en plugin](https://github.com/vercel/vercel-plugin/issues/177), mismos archivos | Menciona Hobby 300 s y diferencias entre streaming/paquetes. Es un PR de documentación, no evidencia suficiente para fijar límites productivos. |
| [Supabase Queues](https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/www/content/md/modules/queues.md), [supabase-queue.md](../fuentes/supabase-queue.md), [JSON](../fuentes/supabase-queue.json) | Durabilidad y visibilidad temporal; faltan scheduler y consumidor del proyecto. |

No trasladar la ausencia de límite global de un workflow a la duración de sus steps. No interpretar streaming, una respuesta HTTP enviada o una tarea lanzada en memoria como garantía de terminación durable.

## Comparación de operación

| Criterio | Colas Postgres + workers cortos | Vercel Workflow |
|---|---|---|
| Estado/reanudación | Jobs, leases y checkpoints implementados en VEXA | Runtime documenta reanudación por steps; VEXA aún conserva resultados y versiones |
| Disparo | Requiere mecanismo periódico/eventual comprobado, autenticado y monitorizado | Requiere inicio durable comprobado y vínculo run↔tenant/job |
| Backpressure | Control explícito por cuenta, tenant y presupuesto | Concurrencia debe limitarse; `Promise.all` sin cota no es diseño aceptable |
| Reintentos | Política VEXA única | Defaults pueden repetir efectos; fijar política por step y eliminar reintentos multiplicados entre SDK/gateway/step |
| Esperas largas | Job con próxima fecha; liberar worker | Sleep durable candidato a simplificarlo; probar en despliegue |
| Atomicidad con datos | Posible misma DB, firmas/grants pendientes | Inicio de workflow y commit DB pueden separarse; usar outbox/idempotencia |
| Cambio de código | Versionar payload/handler; drenar o conservar compatibilidad | Probar reanudación de runs antiguos tras deploy y rollback |
| Observabilidad | Métricas/tablas propias | Inspección de runs candidata; comprobar permisos y redacción de payloads |
| Costos | DB, almacenamiento, ejecución, invocaciones del disparador | Ejecución, estado y condiciones de facturación pendientes |

## Fronteras de ejecución propuestas

1. Carga CSV al almacenamiento privado con autorización y límite acordado. API registra import durable y devuelve identificador para consultar progreso; no analiza todo el archivo en la petición. La URL de carga y sus permisos se validan en S03.
2. Lectura del archivo o página CRM produce unidades pequeñas con referencias a objetos. No mover todo el dataset por payloads de Function o Workflow. Comprobar integridad del objeto y tenant antes de leer.
3. Etapas: ingestión → normalización → extracción → agrupación/revisión → cálculo determinista → publicación del snapshot. Cada etapa consume versiones y produce referencias persistidas.
4. Cada invocación respeta deadline interno menor al límite confirmado; deja de reclamar trabajo con tiempo suficiente para persistir. Los tamaños se derivan de mediciones de memoria, tokens, latencia y límite más restrictivo, no de un número documental aislado.
5. LLM fuera de transacciones SQL largas. Preparar reserva de presupuesto/intento antes de enviar y persistir respuesta antes de publicar análisis. Timeout y cancelación no garantizan ausencia de consumo.
6. UI muestra etapa, cobertura, último avance, errores y datos parciales identificados. «Listo» exige etapas requeridas terminadas para ese snapshot; 202/HTTP exitoso solo significa aceptación si el job quedó durable.
7. Límite global y por tenant impide que un backfill bloquee a todos. Pausar conexión/modelo no debe bloquear la lectura del último snapshot válido; indicar antigüedad.

No se prescribe un endpoint de cron, frecuencia, `maxDuration` o firma de Workflow SDK: estos contratos faltan en el corpus. El agente implementador debe fijarlos con versión de SDK, runtime, plan y evidencia real.

## S05: experimento de selección

**Estado: diseñado, no ejecutado.** Misma carga sintética de 100 unidades en ambas alternativas, dos tenants y simulador de CRM/LLM sin gasto. Inyectar crash tras aceptación, caída después de guardar resultado antes de ack, 429, timeout ambiguo, lease vencido, cancelación, mensaje inválido, despliegue durante ejecución y caída temporal del disparador. En Workflow probar también step completado antes de caída y timeout que compite con trabajo aún vivo: terminar la espera no prueba cancelación del perdedor.

Medir por alternativa: unidades perdidas/duplicadas, recuperación al restaurar servicio, llamadas externas repetidas, pasos de operación manual, latencia p50/p95, memoria, invocaciones y almacenamiento. Costos se proyectan solo con tarifas y unidades verificadas; si falta alguna, anotar «desconocido» y bloquear conclusión económica.

Aceptación: 100 unidades aceptadas quedan con resultado único por versión o fallo explícito; ninguna se pierde; cero cruces de tenant; reanudar no republica efectos; cancelación impide nuevos envíos tras hacerse efectiva; cada llamada duplicada al simulador aparece en telemetría; un deploy no vuelve ilegibles los jobs previos. El tiempo objetivo de recuperación y volumen real del piloto deben acordarse antes de medir; no están dados por las fuentes.

La prueba local valida diseño, no comportamiento alojado. Una segunda prueba desplegada requiere cuentas, presupuesto y autorización de despliegue; no se ejecutó ni está autorizada por este dossier. Si ninguna alternativa supera recuperación y disparo, no declarar pipeline operativo ni esconderlo detrás de un demo CSV manual.

## Pasos concretos e incertidumbres

Agente implementador: cerrar plan/región y límites efectivos; obtener volumen de piloto; diseñar disparador verificable y alerta de ausencia de consumo; construir runner común y simuladores; ejecutar comparación; registrar decisión en S05; implementar solo ganador; ensayar deploy/rollback y restore de jobs. Guardar reporte con SDK/runtime, configuración, métricas y costos pendientes.

Faltan límites reales de Functions, cuotas del scheduler, soporte/estado del SDK, compatibilidad con Next.js del proyecto, retención de runs, disponibilidad regional y costos. Usar regiones cercanas a DB es una propuesta de latencia; no resuelve por sí sola residencia de todos los datos ni tránsito hacia proveedores LLM.

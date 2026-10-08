# CRM acotado: corrección y verificación local

El consumidor alojado permite hasta 100 unidades dentro del plazo existente de 15 segundos. Antes imponía una sola unidad por llamada. Cada commit conserva su checkpoint y vuelve a comprobar la autorización; no se amplían el lease, los plazos del worker ni los parámetros aceptados por HTTP.

Un `Retry-After` válido de un 429 o 5xx reintentable fija el mínimo de espera durable, incluso si supera 300 o 900 segundos. Un valor inválido detiene los reintentos hasta que el propietario revise y guarde la configuración. La fecha sigue siendo serializable por la pantalla de conexiones.

## Evidencia

| Verificación | Resultado |
|---|---|
| Pruebas de autoría Node 22 | 101/101 PASS; rojo previo conservado |
| Control externo puro | 6/6 PASS; baseline anterior falla tres oráculos |
| HTTP local y SQL real con RLS | 9/9 PASS, incluidos ocho casos y contenedor; 47,89 segundos |
| Lint, tipos y build Next | PASS en copia aislada |
| Revisión del control y cotejo de integración | Sin hallazgos bloqueantes; ocho archivos de producto idénticos a los examinados |
| Limpieza | Cinco recursos propios ausentes, comprobados por identidad también por root |

El examen cubre continuación y reanudación, timeout antes y después de un commit, 401, espera de 600 segundos ante 429, valor desbordado con recuperación por propietario, revocación durante la segunda consulta y rollback del segundo commit.

En un fixture SYN de un hilo y cuatro mensajes, el handler anterior necesitó cinco llamadas para cinco unidades (749,29 ms HTTP acumulados); el nuevo, una llamada (355,63 ms). Ambos usan el runtime nuevo y cinco consultas al proveedor simulado. Se excluyen las esperas del cron; no se extrapola una aceleración productiva ni una capacidad remota. PostgreSQL, RLS y HTTP local son reales; la identidad y el proveedor son sintéticos. No prueba login HTTP, Next remoto ni cron gestionado.

## Identidad y reproducción

- Producto: `cbeba0d`; control: `aff0517`.
- Candidato inmóvil: `/private/tmp/rovaq-fase5-candidate-20261008`.
- Manifiesto de capacidad: 2.217 fuentes, SHA256 `63601c98b8b2dd22ef11390d2ab156b612ce860f8cc9832a9e6727dfed6046aa`.
- Control y comandos: [support/F03-crm-bounded/README.md](../../support/F03-crm-bounded/README.md).
- Recibos privados durables: `~/.codex-work/rovaq-cierre-20261007/receipts/crm-bounded-20261008/`, `crm-quality-*.log` y `crm-integrated-independent-review.json`.

La modificación invalida el uso de la serie anterior para esta composición. Una nueva serie comenzó desde 10K: pasó con 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas, cero pendientes y cinco recursos propios ausentes. 50K también pasó: 49.000 aceptadas, 500 rechazos esperados, 500 duplicadas y cero pendientes, con cinco recursos propios ausentes. 150K y la revisión de serie completa siguen pendientes; antes se consolidan los cambios de controles de fase 6. Estas dos mediciones sólo acreditan aff0517 y no se reutilizarán para escalar un manifiesto diferente. No contar el preflight como medición. El verificador histórico `verify-report.py` exige las tres escalas en un solo informe y no sirve para certificar el informe individual de 10K; el cierre de esta serie utiliza `verify-series.py` sobre los tres informes originales.

Sin publicación, despliegue, cambios de programación ni nuevos datos productivos. La lectura del entorno actual confirmó 288 unidades CRM en 24 horas; esa observación corresponde al código desplegado anterior. Las aceptaciones formales permanecen en 28/60.

[Recibo de las dos escalas y hashes originales](CRM-CAPACIDAD-PARCIAL-2026-10-08.json). Procesamiento: 131,997 s en 10K y 610,806 s en 50K. La recopilación conserva `reportStatus: measured` y `scaleStatus: pass`; no transforma dos escalas en una serie completa.

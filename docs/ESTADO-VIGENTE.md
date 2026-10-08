# Estado vigente — Rovaq AI / VEXA

Corte: 8 de octubre de 2026. Fuente única de estado de la ejecución por fases.

**60/60 fichas con trabajo técnico integrado; 28/60 aceptadas formalmente (46,7 %).** La reconciliación incorpora el cierre local F07-01, probado con 17 componentes; no concede aceptación ni valida producción. Fases 1–3 cerradas localmente para sus versiones. Fase 4: recuperación local aprobada; recuperación gestionada y operación permanente pendientes. Fase 5: corrección CRM integrada y comprobada; histórico y nueva serie de capacidad en curso. El cambio de fuentes exige 10K → 50K → 150K de nuevo: 10K pasó y 50K está ejecutándose. Cinco alertas altas de desarrollo por braces siguen abiertas. Sin publicación ni despliegue de estos cambios. [Corrección CRM y evidencia](entrega/CRM-ACOTADO-2026-10-08.md).

| Indicador | Estado |
|---|---|
| Fichas con trabajo técnico integrado | 60/60; incluye F07-01 local. No significa entrega completa. |
| Aceptación formal en el grafo | 28/60 (46,7 %); sin cambios. |
| Producción validada | No. |
| Corrección CRM local | `cbeba0d`, control `aff0517`; 101 pruebas de autoría, seis controles y nueve pruebas SQL/HTTP aprobados. |
| Nueva capacidad de esta composición | 10K PASS; 50K en ejecución y 150K pendiente. Una corrección del control F03-01 en preparación requerirá nueva identidad de fuentes antes del cierre definitivo. |
| Publicación y operación gestionada | Pendientes de autorización específica y evidencia. |
| Validación humana y cierre real | Pendientes; no se sustituyen con fixtures. |

Los porcentajes recibidos de ≈95 % de código y ≈55 % de entrega eran estimaciones sin rúbrica reproducible. No se convierten en una nueva cifra de preparación comercial.

La continuación de aceptación terminó con 1.598/1.627 y los paquetes con 537/542; todos los fallos están identificados. El controlador pasó 137/137; la corrección SQL, 29/29 del gate original y 12/12 unidades afectadas. La selección de conexión pasó 5/5 unidades, scaffold y 31/31 del diagnóstico de navegador. Las cinco pruebas de paquetes no fallan por falta de Docker: cuatro usan un fixture incompleto de Storage y una importa un runtime antiguo. Los originales conservan FAIL. Los diagnósticos complementarios de interfaz quedan separados de la aceptación formal.

[Informe completo, comandos y clasificación](entrega/FASE-1-LINEA-BASE-2026-10-07.md) · [Recibo verificable](entrega/FASE-1-CIERRE-2026-10-07.json) · [Corrección SQL](entrega/CORRECCION-RECUPERACION-2026-10-07.json) · [Selección de conexión](entrega/CORRECCION-SELECCION-IMPORTACION-2026-10-07.json).

| Fase del plan de Claude | Estado y trabajo restante |
|---|---|
| 1. Línea base y limpieza | Cerrada con fallos explicados y deuda del arnés declarada. |
| 2. Seguridad global F07-01 | Completada localmente: 100 %. Gate PASS 17/17, fuentes invariantes y 78 recursos ausentes. [Informe](entrega/SEGURIDAD-GLOBAL-2026-10-07.md) y [recibo](entrega/FASE-2-SEGURIDAD-2026-10-07.json). Producción npm sin alertas; cinco alertas de desarrollo abiertas. |
| 3. Capacidad 10K → 50K → 150K | Completada localmente: 100 %. Tres escalas PASS sobre `504a6b6`, 210.000 filas SYN, cero pendientes, 15 recursos ausentes. [Informe](entrega/CAPACIDAD-FASE-3-2026-10-07.md) y [recibo](entrega/FASE-3-CAPACIDAD-2026-10-07.json). |
| 4. Recuperación y operación | En curso: restore local 5/5 y retorno financiero/regreso PASS sobre `c2d03e2`, 8 recursos ausentes. Runbook y propuesta de protección preparados; recuperación gestionada y operación permanente pendientes. [Recibo](entrega/FASE-4-RECUPERACION-2026-10-07.json). |
| 5. Conexiones e histórico completo | Carga real previa reportada; fuentes adicionales, reconciliación y rendimiento real del conector pendientes. |
| 6. Validación y entrega | Personas reales, smoke remoto final y acta pendientes. |

El 10K de la línea base pasó; 50K quedó contaminado por suspensión del Mac y 150K no comenzó. No se presenta como prueba de capacidad vigente ni se atribuye el timeout al producto. La nueva serie de fase 3 sobre `504a6b6` sí completó las tres escalas, con contabilidad y limpieza verificadas.

Para cerrar Fase 1 no falta una acción de Javier. Las autorizaciones/configuraciones externas se pedirán concretamente cuando corresponda, conservando las ya concedidas. La fase 2 avanzó en mantenimiento independiente de dependencias; no se ejecutó IA de pago.

## Histórico real — corrección posterior del usuario

La actualización posterior sustituye la afirmación anterior de que nunca se había cargado histórico real. Javier reporta una consulta de sólo lectura del 7-oct: **136.956 mensajes y 138.022 import_rows** en la organización objetivo, además de carga económica Shopify previamente comprobada (883 entradas). Esta sesión no ha consultado producción ni revalidado esos conteos; no se equiparan mensajes, filas de importación y entradas económicas.

| Rechazo reportado | Filas | Tratamiento pendiente |
|---|---:|---|
| REFERENCE_MISSING | 362 | Cargar padres primero y comprobar enlaces `:linked-v1`, conservando identidades y lo ya aceptado. |
| ENTITY_METADATA_ONLY | 97 | Mantener en cuarentena. |
| BODY_INCOMPLETE | 3 | Mantener en cuarentena. |
| REVISION_AMBIGUOUS | 5 | Preparar decisiones del propietario sin contenido de clientes; no fusionar revisiones automáticamente. |
| ROLE_AMBIGUOUS | 2 | Preparar decisiones del propietario sin inventar roles. |

Jobs de la organización objetivo reportados: dos `partial` y dos `cancelled`. También se reportan cinco `running` en otras organizaciones: no tocados por esta sesión y fuera del alcance de reparación/carga.

Meta añadida: incorporar todo el histórico disponible. Pendientes de carga reportados: 435.666 notas HubSpot, 20.662 correos, 19.909 conversaciones/28.982 mensajes nativos, contactos, 8.807 adjuntos, 81.891 pedidos y 6.775 devoluciones de retailers, Tracker (16 hojas, USD) y Shopify ampliado. Las cifras corresponden a categorías distintas y no deben sumarse como mensajes únicos ni importarse sin reconciliación.

CSV para volumen; API para incremental/webhooks. Chunks reales por invocación todavía no medidos; 288 chunks/día no equivale a 288 conversaciones/día. Antes de nuevas cargas reales se conservan los requisitos de capacidad, consentimiento y autorización expresa del lote en este chat. Extracción IA no autorizada: requiere presupuesto/tope aparte. No se piden otra vez Tracker, API HubSpot, permisos de correo/archivos, febrero, los 20 casos ni costos/márgenes declarados inexistentes.

[Lista para David, preparada y sin enviar](entrega/PERMISOS-PARA-DAVID.md). Sólo se solicitarán nuevos scopes si un bloqueo concreto demuestra que hacen falta. La consulta del correo para comprobar el export completo Shopify no pudo ejecutarse porque el conector Gmail requiere reautenticación; su recepción sigue sin comprobar.


## Límites y próximo paso

La fase 2 de seguridad global F07-01 está completada localmente, con 17 componentes aprobados y revisión de recibos por dos agentes. [Cierre, evidencia y límites](entrega/SEGURIDAD-GLOBAL-2026-10-07.md). El parche de dependencias pasó lint/tipos/build y dos revisiones focales sin hallazgos. La auditoría completa sigue roja por braces de desarrollo; Javier retiró la restricción documental histórica para continuar las pruebas locales; no se ha comprobado un bloqueo activo de plataforma. Fase 3 completada localmente; fase 4 en curso, con nueva recuperación local verificada. La deuda del control queda visible: conflicto Node 22/26.7, expectativas antiguas de interfaz/marca/catálogo, un fixture vencido y cinco arneses de paquetes. No se modificaron gates para forzar verde y no se aumentó el conteo formal.

Los tiempos originales del plan para las seis fases sumaban aproximadamente 7–9 días de trabajo, sin esperas externas. No constituyen una fecha comprometida ni una estimación actualizada de lo pendiente.

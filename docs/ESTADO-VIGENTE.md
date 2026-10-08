# Estado vigente — Rovaq AI / VEXA

Corte: 8 de octubre de 2026. Fuente única de estado de la ejecución por fases.

**60/60 fichas con trabajo técnico integrado; 28/60 aceptadas formalmente (46,7 %).** La reconciliación incorpora el cierre local F07-01, probado con 17 componentes; no concede aceptación ni valida producción. Fases 1–3 cerradas localmente para sus versiones. Fase 4: recuperación local aprobada; recuperación gestionada y operación permanente pendientes. Fase 5: corrección CRM integrada y comprobada; histórico reconciliado en lectura, con pasos productivos pendientes. Fase 6: controles Auth/UI/SQL integrados, navegación corregida y regresiones UI aprobadas; CI agregado4/4, paquetes586/586 y capacidad final10K→50K→150K aprobados sobre6e8b2b4, con revisión independiente. 60unidades adicionales y2casosHTTP aprobados con control externo revisado; validación externa pendiente. Cinco alertas altas de desarrollo por braces siguen abiertas. Sin publicación ni despliegue de estos cambios. [Corrección CRM y evidencia](entrega/CRM-ACOTADO-2026-10-08.md).

| Indicador | Estado |
|---|---|
| Fichas con trabajo técnico integrado | 60/60; incluye F07-01 local. No significa entrega completa. |
| Aceptación formal en el grafo | 28/60 (46,7 %); sin cambios. |
| Producción validada | No. |
| Corrección CRM local | `cbeba0d`, control `aff0517`; 101 pruebas de autoría, seis controles y nueve pruebas SQL/HTTP aprobados. |
| Nueva capacidad de esta composición | Serie final10K/50K/150K PASS sobre6e8b2b4:210.000filasSYN, cero pendientes y15recursos ausentes; revisión independiente aprobada. |
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
| 5. Conexiones e histórico completo | CRM corregido y verificado localmente; lecturas reales e histórico reconciliados. Referencia independiente CRM, autorización de nuevas cargas y padres/vínculos pendientes. |
| 6. Validación y entrega | En curso: controles actuales y navegación integrados, seis UI83/83 y notificaciones30/30 aprobadas. CI4/4, paquetes586/586 y capacidad final aprobados; 60unidades adicionales y2casosHTTP aprobados. Faltan actos humanos, smoke remoto y recepción. |

El 10K de la línea base pasó; 50K quedó contaminado por suspensión del Mac y 150K no comenzó. No se presenta como prueba de capacidad vigente ni se atribuye el timeout al producto. La nueva serie de fase 3 sobre `504a6b6` sí completó las tres escalas, con contabilidad y limpieza verificadas.

Para cerrar Fase 1 no falta una acción de Javier. Las autorizaciones/configuraciones externas se pedirán concretamente cuando corresponda, conservando las ya concedidas. La fase 2 avanzó en mantenimiento independiente de dependencias; no se ejecutó IA de pago.

## Histórico real — comprobación del 8 de octubre

Lectura de sólo lectura a las 05:35 UTC: 136.992 mensajes y 137.596 filas de importación; no son categorías equivalentes. La diferencia con el conteo de import_rows reportado el 7-oct aún no tiene causa comprobada. CRM habilitado, sin fallos registrados y 288 unidades en 24 horas en el despliegue anterior. No se modificaron las tareas de otras organizaciones.

Los 362 mensajes de rechazos históricos por referencias ya existen con una sola revisión; faltan padres y vínculos en 251 filas con cliente, 269 con pedido y 211 con SKU (categorías solapadas). No reimportar esos mensajes. `:linked-v1` es un recibo de recuperación nativa, no una API de relink CSV. Cinco decisiones de revisión y dos de rol siguen reservadas al propietario. El corte posterior registra 164 metadatos y tres cuerpos incompletos, conservados en cuarentena.

Un piloto de 100 mensajes nativos y su ejecutor v6 están preparados: 44 pruebas ligeras y ocho integradas aprobadas con servicios locales y datos sintéticos, más cotejo independiente de fuentes y limpieza. El arranque temporal requiere autorización específica; se conservan cinco pares de contenido igual con IDs distintos para decisión expresa. No hay nueva carga real. [Detalle, comando y recibos](entrega/PILOTO-HISTORICO-100-2026-10-08.md). La mejora local del CRM superó sus pruebas y medición sintética; rendimiento real tras despliegue sigue pendiente. Fuentes, límites y autorización por lote en [CRM acotado](entrega/CRM-ACOTADO-2026-10-08.md).

### Corte reportado por el usuario el 7 de octubre — histórico

La actualización posterior sustituye la afirmación anterior de que nunca se había cargado histórico real. Javier reporta una consulta de sólo lectura del 7-oct: **136.956 mensajes y 138.022 import_rows** en la organización objetivo, además de carga económica Shopify previamente comprobada (883 entradas). En ese corte inicial aún no se había consultado producción ni revalidado esos conteos; no se equiparan mensajes, filas de importación y entradas económicas.

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

La fase 2 de seguridad global F07-01 está completada localmente, con 17 componentes aprobados y revisión de recibos por dos agentes. [Cierre, evidencia y límites](entrega/SEGURIDAD-GLOBAL-2026-10-07.md). El parche de dependencias pasó lint/tipos/build y dos revisiones focales sin hallazgos. La auditoría completa sigue roja por braces de desarrollo; Javier retiró la restricción documental histórica para continuar las pruebas locales; no se ha comprobado un bloqueo activo de plataforma. Fase 3 completada localmente para su candidato; fases 4/5 conservan condiciones externas. Fase 6 repara y verifica controles antiguos de Node, interfaz, marca, catálogo y fixtures SQL, con revisión independiente y sin bajar umbrales. La consolidación y la nueva serie completa de capacidad están comprobadas; pruebas residuales y reconciliación de auditoría local cerradas en sus alcances. El contador formal permanece en 28/60: sólo F03-01 es elegible y necesita evidencia independiente real.

Los tiempos originales del plan para las seis fases sumaban aproximadamente 7–9 días de trabajo, sin esperas externas. No constituyen una fecha comprometida ni una estimación actualizada de lo pendiente.

## Comprobación remota de sólo lectura, 8 de octubre

La web sigue sirviendo `b0be6df86a2aad53f46bb6054e192c94d62b13e3`: health/version200 aún devuelve el estado antiguo under_construction/scaffold; la corrección local no está desplegada. Login200, overview303 hacia login y API workspace401 sin sesión; sin escrituras. [Recibo](entrega/FASE-6-LECTURA-REMOTA-2026-10-08.json). No sustituye el smoke autenticado final ni valida el release local. Un segundo intento de inspección del navegador sigue sin superficies disponibles por fallo del pipe nativo; la referencia independiente HubSpot no se pudo obtener por esa vía.


## Navegación corregida y controles locales integrados

Una respuesta financiera tardía podía cancelar la transición a notificaciones. Corrección510028a, controles6036597; regresiones afectadas83/83 y entrada compuesta30/30 aprobadas, incluida recuperación RSC500→documento200 y vuelta atrás. SQL compuesto493/493, schema21/21, Auth7/7, navegación de roles3/3, email39/39 y push51/51 conservan sus SHA y alcances originales. [Causa y recibos](entrega/CORRECCION-NAVEGACION-2026-10-08.md). La verificación conjunta actual aprobó CI4/4 y55archivos de paquetes586/586 sobre6e8b2b4. Capacidad final aprobada con revisión independiente. [Recibos](entrega/FASE-6-CI-2026-10-08.json).


## Capacidad final comprobada

Serie fresca contra6e8b2b4:10.000en96,38s;50.000en682,32s;150.000en1.521,95s de procesamiento. Los tres archivos de50.000de la escala mayor cumplieron sus propios plazos de900s. Total210.000SYN,205.800aceptadas,2.100rechazos previstos,2.100duplicadas y cero pendientes. API/SQL/CSV/hashes/bloques/plazos cotejados;15IDs y tres workers ausentes. [Informe](entrega/CAPACIDAD-FINAL-2026-10-08.md) y [recibo](entrega/FASE-6-CAPACIDAD-2026-10-08.json). No mide inferencia, costo ni capacidad comercial.


Cierre de cobertura residual:60unidades aprobadas y2casosHTTP aprobados tras revisar el control anónimo. El intento original1/2 permaneceFAIL; no se cambió el producto. El control vigente verifica elPOST de Google en su propio formulario y ausencia de logout sin sesión; logout autenticado conserva su evidencia de navegador/Auth real. [Recibo y límites](entrega/FASE-6-COBERTURA-RESIDUAL-2026-10-08.json). [Resumen local y pendientes para el100%](entrega/CIERRE-LOCAL-2026-10-08.md).


## Publicación preparada — corte 11:23 UTC

Historial de 351 commits inspeccionado con las guardas existentes; exportación pública de 3.297 archivos del SHA73fb9f3 preparada. La revisión detectó dos migraciones omitidas del manifiesto: corrección integrada, 43 inventariadas y 7/7 pruebas aprobadas, sin cambiar aplicación ni SQL. GitHub sigue en b0be6df, Actions desactivado y main sin protección. Vercel permite crear despliegues y conserva el cron CRM cada cinco minutos; la respuesta no acredita una conexión Git ni una exclusión de rama. No hubo publicación. El manifiesto conserva bloqueos por evidencias y autorizaciones reales pendientes. [Preparación, límites y secuencia](entrega/PUBLICACION-PREPARADA-2026-10-08.md).

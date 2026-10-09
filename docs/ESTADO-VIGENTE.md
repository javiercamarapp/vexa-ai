# Estado vigente — Rovaq AI / VEXA

## Histórico — 9 de octubre, 00:42 UTC

**200 mensajes de la nueva carga persistidos y verificados.** El segundo lote100 terminó sin timeout en 14,532 s: 100 aceptados, 0 rechazos, 0 duplicados y 0 pendientes; identidad, contenido, procedencia y cuatro estados terminales comprobados. Los 3.158 originales faltantes se localizaron en el respaldo verificado; 151.715 candidatos pasaron validación completa y cruce de seis predicados al corte. Después del segundo lote quedan 151.615 candidatos para carga o conciliación posterior, no un porcentaje de todo SENIX.

Conteo real: 137.246 mensajes, 137.980 filas de importación y 518 objetos CRM; universos solapados. Temporal retirado, sin IA ni nuevo despliegue. El timeout del primer piloto permanece. **29/60 aceptadas; producción pendiente.** [Evidencia](entrega/HISTORICO-ORIGINALES-Y-CARGA-200-2026-10-09.json).

## Actualización — 8 de octubre, 23:58 UTC: piloto histórico persistido y conciliado

**100/100 mensajes históricos cargados y cotejados por identidad, contenido y procedencia; cero rechazados, duplicados o pendientes.** Trabajo, importación e intento completados; registro de salida publicado y checkpoint100 terminado. La lectura independiente tardó1,161s. El intento en DB duró8,308s, pero el ejecutor excedió su límite durante el cierre: su timeout permanece registrado y no acredita SLA global. No se reconsumió el lote.

El entorno temporal y sus datos privados fueron retirados; recibos y marcador del intento preservados. Sin inferencia ni despliegue nuevo. La consulta real posterior del9-oct00:03UTC contó137.145mensajes,137.874filas de importación y512objetos CRM; estos universos se solapan. **La aceptación formal sigue en29/60** y el histórico completo aún requiere inventario neto y carga reconciliada. Evidencia: `docs/entrega/PILOTO-HISTORICO-100-PERSISTIDO-2026-10-08.json`.

## Actualización — 8 de octubre: HubSpot aceptado oficialmente

**29/60 aceptadas formalmente (48,3 %); 31 pendientes.** F03-01 pasó `verify` y `accept` limpio sobre `0437a27`, con revisión independiente: 29/29 pruebas en cada corrida,20hilos/28mensajes,57eventos y105registros verificados;44GET más una introspección de cuenta/app/scopes vigente por corrida. Los dos oráculos —referencia independiente UI de contenido/acciones y fidelidad exacta de texto/payload del proveedor— coinciden. Las20páginas quedan cerradas y la limpieza está comprobada.

Se conserva el primer rechazo de materialización: un archivo local tenía modo0600 frente a0644 en Git, con bytes idénticos. Se corrigió únicamente ese modo mediante recuperación canónica y se repitió el ciclo. El grafo fue actualizado por el runner, sin editar estados a mano. Evidencia: `docs/entrega/HUBSPOT-S01-ACEPTADO-2026-10-08.json`.

El cierre es de la muestra HubSpot; todavía faltan carga y reconciliación histórica, procesamiento/evaluación del agente, recuperación y operación de producción. **Fases4–6 abiertas.** Zendesk es la siguiente dependencia formal; su estado de migración/acceso se consulta a Javier mientras continúa el trabajo operativo autorizado. No hubo inferencia, escritura CRM/DB ni despliegue en estas corridas. Límite de IA:US$50 TOTAL.

## Actualización — 8 de octubre, 23:01 UTC: censo completo y doble cotejo revisado

Censo independiente de interfaz completo para **20/20 hilos**: trece recorridos segmentados, uno con extensión completa y seis vistas vacías explícitas. No se observaron tarjetas COMMENT en ese alcance. Las notas CRM se mantienen aparte: los hilos 2–14 comparten 27 identificadores; con el primer hilo son 29 identificadores UI únicos, no 353 mensajes nuevos. Recibo maestro privado SHA256 `8d507e72a264189c5f399d879766aa8d2e621d49e0642d8a4d6f847aad6bf2c2`.

El nuevo perfil de contenido y acciones obtiene **28/28 coincidencias**, con 109 pruebas sintéticas de autoría y 13 controles independientes del perfil y su unión con la fidelidad al proveedor. Conserva por separado los resultados anteriores, sin afirmar igualdad HTML/visual. El ensayo real previo verificó 105 registros, incluidos los 28 mensajes, sin errores ni escrituras. La referencia semántica UI está preparada; su firma y la integración del examen oficial siguen pendientes de revisión.

**28/60 aceptadas; fases 4–6 y producción siguen abiertas.** Sin nuevas cargas, inferencia pagada, publicación ni despliegue. Siguiente: congelar el control revisado, verificar y aceptar F03-01 por el runner; después continuar la cola autorizada de histórico y producción.

## Actualización — 8 de octubre, 22:32 UTC: fidelidad real verificada

La lectura real con el observador nativo externo verificó exactamente el texto NFC y el payload de 28 mensajes, 20 hilos y 57 eventos: 105 registros, 44 GET, 20 páginas cerradas y cero errores. El ensayo duró aproximadamente 11 segundos, no escribió en CRM/base de datos ni usó IA. Recibo privado `provider-fidelity-live-v2/receipt-private.json`; conserva el límite de que la introspección de permisos utilizada es previa. Este resultado no sustituye el cotejo UI ni la aceptación oficial.

Los 28 cuerpos de 20 hilos y las cuatro citas siguen capturados y revisados. El recorrido segmentado adicional de notas/comentarios cerró los hilos 2–10; los recibos nuevos se revisan por separado. Cada recorrido conserva continuidad de IDs y extremos Home/End. No se confunden las 27 tarjetas CRM Note de esas vistas con COMMENT de Conversations. Hilo 1 y los seis últimos tienen evidencia de extensión/estado vacío ya revisada. Restan los hilos 11–14 para completar el censo.

El perfil externo SOURCE_DOM con contexto de exportación prefijado obtiene 20 coincidencias y 8 diferencias. Se conserva ese resultado; una propuesta distinta de contenido/acciones sigue en revisión y no declara igualdad HTML, visual ni atribución de citas. Ningún perfil nuevo está adoptado por el gate oficial.

Autorización consolidada: histórico disponible completo de SENIX, piloto 100 previo y US$50 TOTAL para IA, procesamiento, evaluaciones y reintentos. OpenRouter está activo según la lectura de las 21:41 UTC. **Aceptación formal: 28/60; fases 4–6 y producción aún pendientes.**

## Actualización — 8 de octubre, 21:45 UTC: OpenRouter y referencia CRM

OpenRouter ya tiene clave configurada en producción. Una consulta autenticada de sólo lectura con la clave privada existente respondió HTTP 200: límite mensual US$50, disponible US$49,85407606 y consumo previo US$0,14592394. No se ejecutó inferencia en este tramo. El export de variables de Vercel contiene un marcador de secreto oculto; un intento con ese marcador dio401 y no acredita fallo de la clave real. Metadata actual de Vercel confirma ambas variables de clave y ausencia de las configuraciones/activadores de extracción y problemas. El límite mensual del proveedor no sustituye el tope total autorizado por Javier.

Consulta de la organización a las21:32UTC: cero extracciones y cero lotes de análisis histórico; límites y reservas de IA vacíos. Los137.036 mensajes cargados no están acreditados como analizados. Sigue pendiente configurar presupuesto durable, política y modelos, ejecutar el piloto corregido, reconciliar/cargar el histórico faltante y comprobar resultados antes de activar producción completa. [Plan de cierre y alcance autorizado](entrega/PLAN-CIERRE-SENIX-2026-10-11.md): histórico completo, US$50 totales y objetivo de cierre11-oct/pitch12-oct; no es garantía de fecha.

La referencia UI alcanza28/28 mensajes,20/20 hilos y4/4 citas expandidas en43 archivos revisados. Roles, visibilidad y asociaciones TICKET cuentan con revisión independiente. El censo de comentarios sigue abierto. La revisión del nuevo observador detectó tres defectos de plazos/reintento: versión2 corregida,63 pruebas de autor y tres negativos independientes aprobados; esto no concede aceptación del gate. El proyector rico conserva tres defectos a corregir y requiere una definición de contexto verificable. Se obtuvieron22 capturas CSS offline con atributos completos, sin red ni scripts, cero fallos de estilos; su existencia no prueba equivalencia visual.

**Aceptación formal28/60,32 pendientes; fases4–6 sin cierre final.** No hay nuevo despliegue ni producción validada. Recibos privados: `openrouter-connection-checkpoint-v1.json`, `ai-budget-preflight-20261008T213233Z.json`, `coverage-quotes-standards-v4.json` y `review-observer-standards-v2.json`.

## Actualización — 8 de octubre, 20:48 UTC: inventario UI completo

La revisión independiente verificó 41 MHTML: están presentes los **28 cuerpos previstos en los 20 hilos**. Contraer cuatro cuerpos largos conserva exactamente su texto y enlaces en DOM y hace aparecer los correos fallidos antes virtualizados. Esto cierra el inventario de la muestra, no acredita aún contenido/citas completos, rol, visibilidad, censo COMMENT ni aceptación. Dos citas siguen pendientes. Los encabezados de cinco correos fallidos permiten corroborar al autor con otra captura UI; el nombre mostrado por sí solo no se trata como prueba definitiva del rol.

Mapa privado `coverage-standards-v3.json`, SHA256 `4e0e550b133edda76f40e5e596a08ac0e999140b482d4d2a91adda4530e8c9aa`. La propuesta v5 revisión 2 preserva por separado la comparación UI/HTML y la fidelidad exacta del texto del proveedor; sigue sin implementar ni congelar. **Aceptación formal 28/60; fases 4–6 todavía sin cierre final.** Último conteo real de histórico: 137.036 mensajes. No existe todavía un total neto pendiente ni porcentaje de carga deduplicado.

## Actualización — 8 de octubre, 20:32 UTC y cotejo posterior

Consulta real de sólo lectura, acotada a la organización autorizada: **137.036 mensajes, 137.743 filas de importación y 481 objetos crudos de sincronización**. Hay 44 mensajes más que en el corte previo. No sumar estas categorías ni inferir un porcentaje de histórico cargado; falta reconciliar por identidad los inventarios de origen. Recibo privado `history-reconciliation/counts-20261008T203232Z.json`.

Javier autorizó continuar ante la pregunta concreta sobre AppleScript. El guardado dirigido a la ventana propia funciona. La revisión independiente de 32 MHTML acredita integridad y presencia de **20 hilos / 23 de 28 mensajes**; quince hilos contienen todos los mensajes previstos. Faltan el mensaje más reciente del primer hilo y cuatro mensajes salientes fallidos/rebotados de otros cuatro hilos. También siguen pendientes dos citas, detalles de rol, censo de comentarios internos y asociaciones completas. El filtro Communication facilita la captura, pero no certifica ausencia de comentarios.

Mapa privado revisado `coverage-standards-v2.json`, SHA256 `633de8e21cad25f2466d80bcd3239b075a055465b37b1eed55d77a826ec0d6c6`. **F03-01 abierta, aceptación 28/60 y fases 4–6 sin cierre final.** La propuesta v5 continúa sin implementar ni congelar; no se generó una referencia favorable a partir del adaptador.

## Actualización — 8 de octubre, reconexión Computer Use

Computer Use volvió a enumerar aplicaciones, leer HubSpot autenticado y ejecutar filtros del historial. El fallo de arranque del pipe ya no describe esta reconexión. El filtro Communication permitió observar un correo previamente oculto entre notas del ticket combinado; no acredita ausencia de comentarios internos. El guardado nuevo no quedó verificado y hubo cambios de ventana durante las acciones, por lo que se detuvo la entrada para evitar actuar sobre otra pestaña.

La cobertura persistida conserva ocho cuerpos de cinco hilos. La propuesta de doble comparación UI/representación rica y fidelidad exacta del texto del proveedor fue revisada conceptualmente; falta especificación, implementación, negativos y referencia completa. No equivale a texto plano cotejado independientemente en UI. **F03-01 pendiente y aceptación formal 28/60, sin nuevas aceptaciones ni publicación.** Recibo privado: `cua-reconnect-and-filter-checkpoint-v1.json`.

## Actualización — 8 de octubre, 16:05 UTC

Se recuperaron trece archivos MHTML de la interfaz autenticada de HubSpot. La comprobación offline verifica MIME sin defectos y coincidencia byte a byte de los trece HTML extraídos. Contienen cuerpos identificables de ocho mensajes pertenecientes a cinco de los veinte hilos objetivo; esta cobertura no acredita todavía cuerpos completos, citas expandidas ni aceptación. El historial de tickets combinados se carga por tramos, por lo que la ausencia en una captura no demuestra que falte el mensaje.

El cotejo detectó una diferencia real de representación: HubSpot muestra HTML con firmas, enlaces y citas que puede diferir del campo de texto plano de la API. El gate vigente exige texto NFC exacto. No se borran diferencias ni se copian expectativas desde el adaptador para producir un PASS. Sigue pendiente completar la referencia independiente y resolver el contrato de comparación mediante control externo revisado.

Computer Use volvió a fallar al iniciar el pipe nativo, también tras reiniciar su sesión. En este corte no se ejecutaron nuevas acciones UI. Evidencia preservada: `ui-evidence-integrity-checkpoint-v1.json`, SHA256 `2e960290adbbadf1924a21b646623ab84ef5d6037f0b18d04d8b0e65176d00a1`, dentro del directorio privado del cotejo. **Aceptación formal: 28/60; F03-01 sigue abierta.** No hubo publicación, despliegue ni escritura CRM.


## Actualización — 8 de octubre, 15:15 UTC

La carpeta y los PDF ya entregados permiten avanzar sin pedir a David otra clave ni otros veinte casos. Los casos 18–20 de `casos-contraste.csv` se vinculan con veinte hilos nativos y veintiocho mensajes; la muestra anterior no coincidía con esos hilos. Los veinticinco correos CRM del CSV coinciden con su formato de exportación y prefijo de mil caracteres, pero los cuerpos están truncados. Dieciocho mensajes quedan enlazados inequívocamente; diez requieren cotejo individual adicional.

La consulta actual de permisos confirmó la cuenta y aplicación previstas. El adaptador del producto leyó los veinte hilos a las 14:52 UTC: 44 solicitudes GET con respuesta 200, veintiocho cuerpos completos y cero cuarentenas. Esto demuestra lectura real, no referencia independiente ni aceptación. Javier abrió la sesión de HubSpot en Chrome; el control Computer Use falla al iniciar y la lectura automatizada mediante AppleScript sigue sin habilitación comprobada. Se prepara el cotejo de texto completo, rol, visibilidad y asociaciones en la interfaz autorizada.

**Aceptación formal sin cambios: 28/60.** La siguiente ficha sigue siendo F03-01. No se han creado resultados esperados a partir de la salida del adaptador ni declarado revisión UI completada. Evidencia privada conservada en `~/.codex-work/rovaq-cierre-20261007/received-reference-review-20261008/`.


## Actualización — 8 de octubre, 14:32 UTC

Javier autorizó expresamente el piloto de 100 mensajes, la referencia CRM y revisión legítima, la recuperación gestionada, publicación y validación humana. Esos permisos ya no están pendientes; faltan resultados y evidencia de ejecución. Se conservan los límites del piloto y el presupuesto de IA separado.

El piloto real arrancó a las 13:59 UTC: autenticación, carga, confirmación y un arranque temporal completados. El consumidor agotó sus 20 segundos; el supervisor terminó el intento a las 14:00:04 UTC sin éxito verificado. La conciliación de identidades de las 14:12 encontró cero coincidencias para los 100 mensajes; la lectura de las 14:18 confirmó cero filas de importación, cero checkpoints y el plazo original vencido. La reserva, el job y sus eventos sí existen. No se declara importación exitosa. El cierre canónico quedó verificado a las14:32UTC: job/importación/intento/outbox cancelados, cero filas/checkpoints y plazo original intacto. No se cargó otro lote.

El diagnóstico midió aproximadamente 48 ms por consulta desde el Mac; el bloque requiere más de 1.200 consultas secuenciales. La ejecución cercana a la base es una alternativa por comprobar, no una solución ya validada.

**Aceptación formal: 28/60; quedan 32.** F03-01 sigue siendo la siguiente ficha elegible: exige cotejar veinte hilos de HubSpot con una referencia independiente UI/export y revisión legítima. La autorización permite hacerlo, pero no sustituye ese cotejo. El acceso al navegador volvió a fallar por el pipe nativo; el navegador alternativo abre HubSpot sin sesión. No se obtuvo una nueva referencia por esas vías. Recuperación gestionada, despliegue del release actual y validación humana siguen sin completar. Los cortes anteriores de este documento conservan su fecha; sus menciones a autorización pendiente quedan sustituidas por esta actualización.


**60/60 fichas con trabajo técnico integrado; 28/60 aceptadas formalmente (46,7 %).** La reconciliación incorpora el cierre local F07-01, probado con 17 componentes; no concede aceptación ni valida producción. Fases 1–3 cerradas localmente para sus versiones. Fase 4: recuperación local aprobada; recuperación gestionada y operación permanente pendientes. Fase 5: corrección CRM integrada y comprobada; histórico reconciliado en lectura, con pasos productivos pendientes. Fase 6: controles Auth/UI/SQL integrados, navegación corregida y regresiones UI aprobadas; CI agregado4/4, paquetes586/586 y capacidad final10K→50K→150K aprobados sobre6e8b2b4, con revisión independiente. 60unidades adicionales y2casosHTTP aprobados con control externo revisado; validación externa pendiente. Cinco alertas altas de desarrollo por braces siguen abiertas. Sin publicación ni despliegue de estos cambios. [Corrección CRM y evidencia](entrega/CRM-ACOTADO-2026-10-08.md).

| Indicador | Estado |
|---|---|
| Fichas con trabajo técnico integrado | 60/60; incluye F07-01 local. No significa entrega completa. |
| Aceptación formal en el grafo | 28/60 (46,7 %); sin cambios. |
| Producción validada | No. |
| Corrección CRM local | `cbeba0d`, control `aff0517`; 101 pruebas de autoría, seis controles y nueve pruebas SQL/HTTP aprobados. |
| Nueva capacidad de esta composición | Serie final10K/50K/150K PASS sobre6e8b2b4:210.000filasSYN, cero pendientes y15recursos ausentes; revisión independiente aprobada. |
| Publicación y operación gestionada | Autorizadas en esta conversación; ejecución y evidencia pendientes. |
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
| 5. Conexiones e histórico completo | CRM corregido y verificado localmente; lecturas reales e histórico reconciliados. Referencia independiente CRM y padres/vínculos pendientes. Piloto100 autorizado, intento con timeout; cargas adicionales fuera de ese lote requieren alcance definido. |
| 6. Validación y entrega | En curso: controles actuales y navegación integrados, seis UI83/83 y notificaciones30/30 aprobadas. CI4/4, paquetes586/586 y capacidad final aprobados; 60unidades adicionales y2casosHTTP aprobados. Faltan actos humanos, smoke remoto y recepción. |

El 10K de la línea base pasó; 50K quedó contaminado por suspensión del Mac y 150K no comenzó. No se presenta como prueba de capacidad vigente ni se atribuye el timeout al producto. La nueva serie de fase 3 sobre `504a6b6` sí completó las tres escalas, con contabilidad y limpieza verificadas.

Para cerrar Fase 1 no falta una acción de Javier. Las autorizaciones/configuraciones externas se pedirán concretamente cuando corresponda, conservando las ya concedidas. La fase 2 avanzó en mantenimiento independiente de dependencias; no se ejecutó IA de pago.

## Histórico real — comprobación del 8 de octubre

Lectura de sólo lectura a las 05:35 UTC: 136.992 mensajes y 137.596 filas de importación; no son categorías equivalentes. La diferencia con el conteo de import_rows reportado el 7-oct aún no tiene causa comprobada. CRM habilitado, sin fallos registrados y 288 unidades en 24 horas en el despliegue anterior. No se modificaron las tareas de otras organizaciones.

Los 362 mensajes de rechazos históricos por referencias ya existen con una sola revisión; faltan padres y vínculos en 251 filas con cliente, 269 con pedido y 211 con SKU (categorías solapadas). No reimportar esos mensajes. `:linked-v1` es un recibo de recuperación nativa, no una API de relink CSV. Cinco decisiones de revisión y dos de rol siguen reservadas al propietario. El corte posterior registra 164 metadatos y tres cuerpos incompletos, conservados en cuarentena.

La preparación del piloto de100 mensajes aprobó44 pruebas ligeras y ocho integradas con servicios locales y datos sintéticos. Javier autorizó el lote y el arranque temporal, conservando los cinco pares con contenido igual e IDs distintos. El intento real posterior alcanzó la confirmación, pero agotó el límite del consumidor; no se verificó importación exitosa. Véase el corte14:18UTC de este documento. [Detalle, comando y recibos](entrega/PILOTO-HISTORICO-100-2026-10-08.md). La mejora local del CRM superó sus pruebas y medición sintética; rendimiento real tras despliegue sigue pendiente. Fuentes, límites y autorización por lote en [CRM acotado](entrega/CRM-ACOTADO-2026-10-08.md).

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

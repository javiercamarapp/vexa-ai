# Fase 1 — línea base y cierre del 7 de octubre de 2026

**Cerrada con fallos explicados, conforme al criterio del plan.** Avance del trabajo de esta fase: 100 %. Esto no significa todos los tests verdes ni producto listo para producción. Fase 2 no iniciada. Estado común: [ESTADO-VIGENTE](../ESTADO-VIGENTE.md).

Fuente congelada: `b0be6df86a2aad53f46bb6054e192c94d62b13e3`; correcciones locales: `ed9f06d` y `9399246`. Node 22.23.2, Docker 29.7.2. Control, baseline y propuesta separados; datos sintéticos y una sola suite pesada a la vez. No se modificaron gates, umbrales ni aceptaciones formales.

## Resultado y alcance

| Trabajo | Resultado comprobado |
|---|---|
| Línea base inicial, interrumpida | 234 controles principales completados: 220 PASS / 14 FAIL; sin resumen final. |
| Continuación desde F06-01 hasta F08 y controles adicionales | 1.627 tests: 1.598 PASS / 29 FAIL / 0 cancelados. |
| Todos los paquetes | 542 tests: 537 PASS / 5 FAIL por arneses antiguos; Docker sí funciona. |
| Controlador | 137/137 PASS. |
| Matriz compartida de autorización | 444/444 PASS en repeticiones completas; conserva timeouts iniciales; no sustituye F07-01. |
| Corrección de recuperación SQL | Gate F03-03 original 29/29 PASS; unidades afectadas 12/12 PASS. |
| Corrección de selección de conexión | Unidades 5/5, scaffold PASS y navegador complementario 31/31; no aceptación formal. |
| SQL focal tras interrupciones | F05-03: 15/15; F05-06: 22/22 PASS. |
| Recuperación local | Restore original terminado y rollback focal posterior PASS; wrapper original sigue FAIL. |

Se recorrieron los 68 archivos de entrada disponibles en dos tramos. Los conteos principales y anidados no son directamente comparables ni se suman como un único total. F07-01 no está escrito: se conserva pendiente de Fase 2.

El plan suponía que cinco pruebas de paquetes pasarían al encender Docker. La ejecución demostró que cuatro tienen un esquema de Storage incompleto y una importa un runtime histórico absoluto. Se declara esta excepción y su causa; **no se afirma 542/542 ni se ocultan esos fallos**.

## Correcciones integradas

`ed9f06d — fix(connectors): avoid repeated RLS scans during pending recovery`.

El caso de 1.001 mensajes pendientes reproducía `SQL57014` con el límite original de 10 s. La consulta repetía la lectura protegida por RLS para cada mensaje. Ahora materializa pendientes y las identidades autorizadas de los imports elegibles. Mantiene tenant, conexión, RLS, rechazo inmutable, `linked-v1`, transacción y recuperación completa.

Dos consultas medidas: 18,318 y 114,600 ms; caso completo: 11,433 s. Dos revisiones estáticas focales sin hallazgos. No es una medición comercial ni una auditoría global. El manifiesto de capacidad se regeneró y su preflight verificó 2.208 archivos: las mediciones anteriores no se heredan; Fase 3 empieza de nuevo en 10K. [Recibo de corrección](CORRECCION-RECUPERACION-2026-10-07.json).

`9399246 — fix(imports): preserve authorized connection selection on reload`.

Se corrigió una segunda pérdida de estado real: una conexión válida de la segunda página desaparecía al recargar reservas. Se revalida contra páginas autorizadas actuales, conserva sus metadatos o limpia la selección si ya no existe. Cinco unidades y el scaffold original pasan; navegador complementario 31/31, incluida conexión deshabilitada. Dos revisiones focales sin hallazgos. El manifiesto vigente contiene 2.210 archivos y pasó preflight. [Recibo de selección](CORRECCION-SELECCION-IMPORTACION-2026-10-07.json).

## Clasificación completa

El [recibo JSON de cierre](FASE-1-CIERRE-2026-10-07.json) contiene los 65 resultados fallidos observados (incluye subtests y sus padres), cada uno ligado a su clasificación, hashes de logs, conteos y variables exactas de configuración externa. Ningún resultado original se convirtió en PASS por un diagnóstico complementario.

| Control | Causa y estado |
|---|---|
| F01-02 | **Control desactualizado**. Dos esperas de networkidle no terminan por prefetch y notificaciones. Ambos cambios de organización se comprobaron correctos; cookie nueva: / responde 307 hacia /overview y el destino responde 200. No se reproduce rechazo de sesión. |
| F01-03 | **Entorno / plazo intermitente**. La matriz inicial agotó el plazo; otras importaciones durante suspensión fallaron en docker exec. La misma matriz completa pasó 444/444 sobre el mismo SHA. Se conservan los fallos iniciales y no se atribuyen todos a la suspensión posterior. No equivale a F07-01. |
| F01-04 | **Control desactualizado**. Espera Espacio de trabajo, selector Organización activa y seis enlaces. El shell vigente usa Navegación principal, grupos y contexto estático si sólo hay una organización; los recorridos complementarios de F06 verifican navegación, alcance y revocación. |
| F01-05 | **Conflicto de herramientas**. Cuatro jobs del contrato congelado exigen Node 26.7.0; engines y el plan exigen Node 22.x. Rechazo NODE_VERSION. No se alteraron contrato, workflow ni runtime requerido. |
| F02-03 | **Control desactualizado y defecto de producto corregido**. Fallback de Playwright apuntaba a un temporal ausente: configurado módulo fijado del control. Después falló la navegación antigua y la regex fetch/error/fall ante el texto actual No se pudo recibir la respuesta; dejó un interceptor abort activo y causó un segundo error en cascada. Diagnóstico actual cambia sólo esos textos. El perfil de 20 MiB obtuvo GET 200 en 2,155 s sin cambiar 12 s de espera. Al continuar descubrió pérdida real de selección en segunda página al recargar reservas; corregida en 9399246 con páginas autorizadas actuales. Unidades 5/5, scaffold PASS y navegador complementario 31/31, incluida retirada de conexión deshabilitada. |
| F02-05 | **Plazo intermitente, comportamiento reverificado**. Barrera postcommit inicial excedió 300 s. F02-06 original pasó el caso SIGKILL/replay; diagnóstico posterior: 110,564 s, 10.000 filas, offset 10000 y done=true, cero errores SQL. No se subió el plazo. La causa precisa del timeout antiguo no quedó aislada; queda como incidencia intermitente de ejecución, con reproducción posterior verde. |
| F03-01 | **Configuración y autorización externas**. Transporte local aprobado; S01 live requiere configuración privada de cuenta/app, autorización y referencia independiente reconciliada. API HubSpot y 20 casos ya disponibles según Javier; no pedirlos otra vez. |
| F03-02 | **Configuración y autorización externas**. Transporte local aprobado; S02 live requiere cuenta/subdominio/token Zendesk autorizados y reconciliación independiente. Variables exactas en externalPrerequisites. |
| F03-03 | **Defecto de producto corregido**. SQL57014 con 1.001 pendientes reproducido antes del cambio. Commit ed9f06d materializa pendientes y las identidades autorizadas de sus imports para evitar repetir lectura RLS. Consultas 18,318 y 114,600 ms; gate original 29/29, unidades afectadas 12/12. |
| F05-02 | **Fixture caducado**. El supuesto futuro venció el 1-oct pero el test sigue esperando 1000. Producto devuelve null y assumption_not_valid_as_of correctamente. Diagnóstico con supuesto vigente pasó 10/10; original continúa fallido. |
| F05-03 | **Entorno interrumpido, reverificado**. Fallos Docker/SQL durante suspensión del host; repetición focal del control SQL original pasó 15/15. |
| F05-06 | **Entorno interrumpido, reverificado**. Docker se detuvo sin veredicto SQL; repetición focal del control original pasó 22/22. |
| F06-01 | **Control desactualizado**. Overview usa Exportar JSON/CSV, filtros dentro de dos details, Aplicar filtros y Actualizar. Copia complementaria conserva las comprobaciones financieras, scope, respuestas tardías y revocación usando los controles vigentes. Estados visibles actuales: Sin cifras publicadas, Cobertura parcial y Corte desactualizado. Se verifica el subtotal y el total desconocido en la misma fila de la tabla; ausencia de artículos y exports tras revocación. |
| F06-02 | **Selector no acotado a la publicación financiera**. El selector original puede pulsar primero el catálogo de problemas, sin snapshot/scope por diseño. Copia complementaria apunta a la tarjeta financiera en entrada y regreso; 11/11 comprobaciones pasan. |
| F06-03 | **Selector financiero y navegación desactualizados**. Mismo acceso al catálogo antes de resolver la publicación; selector de tarjeta y navegación actual: 14/14. Oráculos financieros sin alterar. |
| F06-04 | **Control desactualizado**. Navegación renombrada, etiqueta Tu pregunta y fuentes dentro de Ver fuentes. Se sincroniza la aserción de 25 filas con el render posterior al HTTP 200. Preparación medida aparte del plazo funcional de 480 s; límites por operación intactos. Oráculos de dinero, referencias, paginación, scope, errores y revocación conservados; no es PASS del gate original. |
| F06-05 | **Control desactualizado**. Navegación renombrada. Copia complementaria pasó 14/14, incluida revocación con respuesta tardía. |
| F06-06 | **Control desactualizado**. Navegación renombrada, SKU en Más filtros y alcance y botón Aplicar filtros. Complementario: 15/15 con generación durable, descarga y revocación. |
| F06-07 | **Prerequisitos de evaluación externa**. PRIVATE_EVIDENCE_DIRECTORY_REQUIRED: herramientas fijadas, evidencia heredada ligada a hashes y ledger adjudicado. No se inventó revisión humana, herencia ni aprobación. |
| F06-08 | **Expectativa anterior a F06-12**. Dos controles esperan todos los eventos desconectados; F06-12 ya conecta productores de cinco eventos. membership.invited sigue desconectado. F06-12 y controles de transporte actuales pasan; no se confunde conexión local con proveedor externo. |
| F06-10 | **Marca antigua en el control**. La única causa en 35/36 funcionales y 24/25 puros es /VEXA/ frente a Rovaq AI en HTML construido. Diagnóstico de marca actual: 1/1. |
| F06-11 | **Marca antigua en el control**. Título/cuerpo del service worker esperan VEXA. Copia complementaria de marca actual: 51/51 conservando handlers, autorización y destinos. |
| F07-04 | **Host suspendido; capacidad no acreditada**. 10K pasó en 106,306 s. 50K: LOAD_WORKER_CALL_TIMEOUT:consume a 960 s, checkpoint 34200; último progreso 13:29:52 coincide con Clamshell Sleep 13:29:46. 150K no inició. No acredita cuello de producto; nuevo manifiesto exige empezar 10K en Fase 3. |
| F07-06 | **Host suspendido; componentes reverificados**. Restore local terminó con siete tablas iguales y limpieza; rollback original expiró durante suspensión. Repetición despierta PASS: igualdad financiera antes/después, foreign404 y roll-forward idéntico. El wrapper original sigue fallido; recuperación gestionada sigue pendiente en Fase 4. |
| F07-05 | **Validación humana externa**. Piloto real, manifiesto y revisión legítima no presentes en el entorno aislado. Fase 6. |
| F08-01 | **Autorización y evidencia externas**. Manifiesto de release, evidencia de revisión servida y aprobación legítima no suministrados. |
| F08-02 | **Autorización y evidencia externas**. VEXA_SMOKE_GATE_INPUT ausente provoca path undefined; falta recibo de ejecución remota autorizada. No sustituir con localhost. |
| F08-03 | **Validación humana externa**. Ensayo real cronometrado y manifiesto/revisión legítimos no suministrados. |
| F08-04 | **Autorización y evidencia externas**. Inventario final de materiales y permisos revisados no suministrados. |
| F08-05 | **Validación humana externa**. Entrega y guía confirmadas por una persona real, manifiesto y revisión no suministrados. |
| F08-06 | **Autorización y evidencia externas**. Dossier de cierre por capas y aprobación legítima pendientes. |
| PKG-SCHEMA | **Fixture de Storage incompleto**. Cuatro pruebas crean storage.objects sin owner_id ni metadata, exigidos por migración 0005: error 42703 antes de sus oráculos. Docker sí funciona. La suposición inicial de que sólo faltaba Docker era incorrecta. Se mantienen fallidas; matrices actuales con Storage real pasan. |
| PKG-CAS | **Referencia absoluta a runtime histórico**. service-cas.test.mjs importa cuatro módulos de .runtime/renewed-app-integration-1789837609558767000; falla resolver @vexa/platform y no prueba el checkout vigente. Se mantiene fallida como deuda del arnés. |

## Diagnósticos complementarios

Copias fuera de `tests/acceptance`, con nombres, controles desplegables o fixture vigente de la interfaz actual. Conservan los oráculos financieros, de privacidad, revocación y durabilidad aplicables. Sus resultados no son aceptación formal ni reemplazan los gates congelados. Las copias y su manifiesto con hashes se conservan en el directorio local de evidencias.

| Diagnóstico | PASS / total |
|---|---|
| preview-selection-fix | 31 / 31 |
| workspace-current-refresh | 16 / 16 |
| detail-financial-return | 11 / 11 |
| recommendations-financial-card | 14 / 14 |
| explorer-rendered-page | 13 / 13 |
| interventions-current-label | 14 / 14 |
| briefs-expanded-filters | 15 / 15 |
| ledger-current-fixture | 10 / 10 |
| email-current-brand | 1 / 1 |
| push-current-brand | 51 / 51 |

La suspensión de macOS está registrada en `power-events-afternoon.txt`: cierre de tapa a las 13:29:46 y regreso completo a las 15:05:56, con periodos de DarkWake intermedios. Contaminó 50K y varios diagnósticos; sus fallos se conservaron y sólo se repitieron casos focales justificados con el host despierto. `caffeinate -i` no evita suspensión por cerrar la tapa. El timeout temprano de la barrera no se atribuye retrospectivamente a ese evento.

## Comandos y evidencia

Ejecutados desde control separado y con Node 22 en PATH. `<baseline>`, `<fixes>` y `<recibos>` son los directorios locales de esta fase; ningún comando contiene credenciales.

```sh
VEXA_CANDIDATE=<baseline> node --test --test-concurrency=1 --test-reporter=tap tests/acceptance/*.test.mjs
# Tras la interrupción: mismos argumentos, sólo archivos ordenados desde F06-01.
# Paquetes: lista completa obtenida con rg --files packages -g '*.test.mjs'.
node --test --test-concurrency=1 --test-reporter=tap <lista-completa-de-paquetes>
npm run test:controller
VEXA_CANDIDATE=<fixes> node --test --test-concurrency=1 tests/acceptance/F03-03.test.mjs
node --test packages/connectors/sync.test.mjs packages/connectors/sync-visibility.test.mjs
node --check packages/connectors/sync.mjs
VEXA_CANDIDATE=<fixes> node packages/jobs/load/run.mjs --preflight
```

Los comandos exactos expandidos, sus tiempos y salidas permanecen en `/private/tmp/rovaq-fase1-receipts-20261007`; los hashes y extractos sin secretos están en el recibo JSON. Los archivos de aceptación y orchestration siguen idénticos al baseline. Preparación y reproducción roja: [preflight](FASE-1-PREFLIGHT-2026-10-07.json), [reanudación](REANUDACION-FASE-1-2026-10-07.json).

## Pendientes y entrega a la fase siguiente

Fase 2: escribir/revisar F07-01 y cerrar seguridad global, sin repetir como verde una revisión anteriormente rechazada. Fase 3: health/version y nueva serie 10K→50K→150K. Fase 4: recuperación gestionada y operación permanente. Fase 5: cuentas autorizadas y todo el histórico reconciliado. Fase 6: validación humana y acta final.

Además queda deuda explícita del control: versión Node del contrato, selectores/marca/catálogo/fixture vencido y los cinco arneses de paquetes. Su reparación requiere una revisión del control correspondiente; no se debilitó el producto ni el examen para fabricar un resultado verde.

Para este cierre no hace falta una nueva credencial de Javier. Los insumos externos exactos están registrados para las fases que los utilizan. No volver a pedir accesos/casos ya resueltos. [Permisos para David, preparado sin enviar](PERMISOS-PARA-DAVID.md).

Sin push, despliegue, cambios de configuración externa, nueva carga real ni gasto de IA. Se mantienen 59/60 fichas técnicas y 28/60 formales; producción pendiente.

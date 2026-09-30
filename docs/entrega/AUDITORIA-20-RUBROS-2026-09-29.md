# Reauditoría de20 rubros —29 de septiembre

Corte histórico del29-sep. El hueco de receptorCRM tiene [implementación y revisión posteriores,30-sep](WEBHOOKS-CRM-2026-09-30.md); no reatribuir las pruebas de este informe al cambio posterior.

**Dictamen: bloqueada para producción. 54/60 fichas técnicamente preparadas; 25 aceptadas formalmente.** Esta revisión consolida las veinte áreas contra el árbol publicado y agrega comprobaciones actuales; no es la auditoría final aprobada después de 60/60. La revisión de entrega excluida impide evaluar el producto completo. No se modifican contadores por emitir este informe.

Código revisado: `94db0848a6c61538508a354ff0715f377364af6d`. Web observada: `78b524ded807623df410d5b199a5b0df8687e002`. Último smoke completo 8/8: `b9ed3db5ef4df825c27ed208722ad2faad4ee9c3`. Sus evidencias son distintas; el evaluador del piloto es offline y no requiere desplegar la web.

## Comprobaciones nuevas

- 32 solicitudes GET anónimas, sin tokens, cookies, escrituras, SQL, inferencia ni envíos.24 APIs protegidas rechazaron el acceso y entregaron `private, no-store`. Seis respuestas iniciales 400 sólo demostraban validación de parámetros; después se probaron únicamente esas seis con alcanceSYN válido y las seis devolvieron 401. No se cuentan los 400 como pruebas de autorización.
- `/api/health/version` devolvió 200 con SHA 78b524d; `/login` 200, contenido privado/no-store y HSTS. La observación no demuestra disponibilidad continua ni cubre todos los headers de seguridad. No se ensayó aquí incrustación en frames; no se deduce de los headers una vulnerabilidad explotada.
- `npm audit --package-lock-only --json`, Node 22: cero avisos de vulnerabilidades en la respuesta actual del registro. No equivale a ausencia de vulnerabilidades desconocidas, fallos propios ni auditoría transitiva manual. Lockfile SHA256: `dffda51f6a7ac993abc5edd41c033e1d942cfc2d20fa865df9ced6085e98b9cf`.
- Se verificaron los hashes de609 artefactos de siete manifiestos de revisión: operaciones355, seguridad 356, producto 357, carga 358, interfaz 381, ciclo 390 y piloto 400. Son artefactos conservados, no609 pruebas nuevas.
- Comparación de fuentes:18/21 del inventario operacional355 coinciden; cambiaron entorno documentado, versión Node declarada y adaptador de conexiónPostgreSQL.528/560 fuentes del recibo de producto357 coinciden;32 cambios se mantienen identificados, sin trasladar automáticamente los resultados anteriores. Los deltas posteriores y sus recibos figuran en los informes enlazados.
- Frente al smoke b9ed3db, el árbol actual cambia cuatro fuentes de interfaz, dosREADME del ciclo, tres archivos del piloto offline y el inventario de carga. No hay cambio posterior en el backendweb o SQL en esa comparación; las correcciones visuales tienen sus verificaciones focales separadas.

Las24 rutas consultadas: equipo, notificaciones de lectura y preferencias, conexiones/configuración, histórico, evaluación/candidatos, imports, economía, workspace/mappings/customer-bindings, migración/aliases, problemas, extracción, briefs, recomendaciones, intervenciones, explorador, snapshots, prioridad y recuperación. Esto no sustituye aislamiento autenticadoA/B, mutaciones, permisos por rol ni pruebas de todos los endpoints.

## Cobertura de los veinte rubros

| Rubro | Evidencia aplicable | Pendiente y conclusión |
|---|---|---|
|1 Diseño y negocio|Ocho vistas y flujo SYN remoto; piloto técnico399/400.|Datos financieros, piloto, comprensión y resultados comerciales reales. Sin PMF ni ahorro causal acreditados.|
|2 Arquitectura|Contratos de ingesta, jobs, gateway, métricas y workspace; revisión 357 y conciliación 390.|No hay certificación de escalabilidad por modularidad. Alcance de entrega excluido.|
|3 Resiliencia/recuperación|Replay, fences, pausa/reanudación remota y restore local con autoridad reconciliada.|Restore gestionado, RPO/RTO y procedimiento con responsables reales. No nueva corrida de restore.|
|4 Capacidad/costo|Carga local210K/2100 chunks revisada 358; defecto de latencia corregido y smoke8/8 posterior.|No throughput completo con LLM ni capacidad/costo/SLO comerciales aprobados. La carga conserva su fuente medida.|
|5 Frontend|Revisión 381; checks 388/389; contraste/estados 391–393 y acciones 394–398.|No todos los sitios de controles ni seis estados por ruta están ejecutados. Lector de pantalla/dispositivo y juicio humano pendientes. ErroresRSC conservados.|
|6 API/backend|Contratos/CAS y aislamiento del smoke previo;24 rechazos anónimos nuevos.|GET anónimo no prueba mutaciones ni todos los roles/tenants. Ámbito de entrega no evaluado.|
|7 Dinero|BigInt, unknown≠zero, moneda/alcance y mutantes previos; piloto añade WTP exacta y separada.|Fuentes/decisiones financieras del cliente. Intención de pago no es ingreso contratado ni ahorro causal.|
|8 Datos/Storage|Matrices locales;35 migraciones remotas autorizadas y smoke con Auth/Storage/PostgreSQL realesSYN.|SQL 0029–0032 excluido, restauración gestionada y datos reales pendientes. Configuración previa conserva su fecha.|
|9 Caché/CDN|24 rechazos actuales privados/no-store; pruebaA/B/anónimo/A previa del mismo recurso.|Sin prueba exhaustiva de cada ruta, edge/caché y contexto autenticado.|
|10 Límites/abuso|Backpressure por proceso de correoAuth y pruebas de fallo 503 previas.|No cuota distribuida acreditada ni saturación/servicio Auth real. No se hicieron envíos ni pruebas de carga remotas.|
|11 Auth/permisos|Sesiones, invitaciones, roles y revocación previos;24 rutas deniegan anónimo actualmente.|Google/magic link con configuración y usuarios reales; no reemplazar con fixtures.|
|12 Seguridad/dependencias|Revisión 356 íntegra, guardas de input/origen y firma compilada; npm audit actual sin avisos.|No pentest completo ni aprobación global. Entrega excluida y configuración de headers no ensayada completamente.|
|13 Privacidad/retención|Redacción, retiro de fuentes, exports y control de retención previos; agregados de piloto sin identidades.|Consentimiento/custodia y verificación de borrado real autorizados. No dictamen legal.|
|14 Infraestructura|Vercel sirve78b524d; Git94db084; configuración y SQL propios comprobados previamente.|Ambientes, backup gestionado y alta disponibilidad no certificados; no compras ni cambios de configuración en esta revisión.|
|15 CI/CD/Git|Commits reales, publisher, main y autoría verificados; reglas/configuración revisadas antes de cada publicación.|Actions desactivadas, sin checks hospedados ejecutados ni protección de main configurada. No se habilita para sumar actividad.|
|16 Errores/logs|Errores HTTP saneados; trazas de fallos y timeouts preservadas.|No ausencia global de errores ni retención/alertas productivas acreditadas. El API de logs había fallado; muestras CLI previas conservan alcance.|
|17 Operación/alertas|Consumidordurable, heartbeat, pausa/alarma/reanudación y runbooks previos.|Programación continua y entrega de alertas reales pendientes. Caffeinate no es un worker ni un supervisor persistente.|
|18 Pruebas/arneses|Manifiestos íntegros609; oráculos/mutantes/controles reales previos;25+21 del piloto y regresiones12+12 del cierre anterior.|Integridad no equivale a ejecución nueva. No full-suite global verde mientras existan ámbitos excluidos.|
|19 Integraciones/tools|Histórico/backfill/incremental por polling, checkpoints y tools de lectura restringida, revisión390.|Cuentas/scopes y conciliación con proveedor reales. No existe receptorwebhook CRM publicado: no puede declararse probado ni atribuir su ausencia a una API faltante.|
|20 Agentes/supervisión|Prompt efectivo, datos redactados, evidencias/abstención, selección/rollback y evaluación offline con custodia.|Gold y semántica de proveedor real pendientes. No entrenamiento ni promoción autónomos; histórico no perfecciona el software por sí solo.|

Todos los rubros son aplicables. La tabla describe evidencia y límites por área; ninguno se convierte por este documento en aprobación global de producción.

## Bloqueos deduplicados y responsables

| Bloqueo | Estado y efecto | Siguiente condición legítima |
|---|---|---|
|Revisión de entrega F06-09|Automática interrumpida por aviso genérico; sin dictamen final. Impide cerrar09/10/11/12 y cobertura global07/F07-01.|Resolución legítima de esa revisión. No reintentar, transferir ni reconstruir la propuesta para eludirla. No es un defecto concreto diagnosticado.|
|Cobertura global de UI/seguridad|Parcialmente comprobada; rutas/estados/tecnologías asistivas y ámbito excluido pendientes.|Completar pruebas faltantes y revisión humana; no contar sitios de código como clics ejecutados.|
|Activación y operación reales|Requiere cuentas, políticas y permisos; cron/consumidores y restore gestionado no están validados como operación continua.|Titulares aportan accesos/scopes/presupuestos legítimos y operador ejecuta los ensayos y programación autorizados. No es sólo pegar una API.|
|Alcance webhook y automatización|CRM publicado usa polling; no hay receptorwebhook demostrado. La mejora de agentes es evaluación/selección supervisada.|Conservar la distinción de capacidades; si se exige recepción webhook, necesita implementación/revisión propia, no una casilla de configuración ni aprobar notificaciones.|
|Piloto/pitch|Software del piloto listo, investigación humana `not_run` y permisos de materiales pendientes.|Consentimientos, gold/holdout, participantes/sponsor y resultados reales con revisión humana.|

No se confirmó una nueva fuga de datos en estas comprobaciones. Tampoco se concluye que no existan vulnerabilidades fuera de lo probado. Las restricciones de frame/CSP, cuotas distribuidas, monitorización y CI protegido no se presentan como certificaciones inexistentes.

## Trazabilidad y límites operativos

Manifiesto privado de esta revisión SHA256: `b921580ca64454bd67850d2c52a9b94c408768900c2ed2d5838105687a026e1f`. Contiene comandos, respuestas resumidas sin credenciales, resultados del registro, inventarios comparados y resumen. No se publican fuentes ni logs privados. Se usaron los revisores ya registrados y sus artefactos; **cero nuevas invocaciones de agentes**,400/400 acumuladas sin reiniciar ni ampliar el límite.

La auditoría final solicitada después de 60/60 continúa pendiente. No hay un loop de construcción vivo por tener un informe ni por mantener la laptop despierta. No se dejaron pruebas, servidores o consumidores nuevos en segundo plano.

Referencias: [auditoría acumulada](AUDITORIA-20-RUBROS.md), [estado y seis fichas](PILOTO-TECNICO-2026-09-29.md), [smoke remoto](SMOKE-REMOTO-2026-09-28.md), [ciclo histórico/agentes](CICLO-AGENTES-2026-09-28.md), [consentimiento económico](CONSENTIMIENTO-ECONOMICO-2026-09-29.md), [aportes externos](PENDIENTES-PARA-CONECTAR.md).

# Auditoría integral de20 rubros

**Estado: auditoría consolidada del ámbito disponible, con bloqueos explícitos; no aprobación de producción ni60/60.** Las tres revisiones independientes cubrieron los20 rubros definidos. Sus conclusiones tienen límites explícitos: código publicado, infraestructura local y datosSYN. El examen rechazado de F06-09 y sus propuestas de notificaciones permanecen excluidos; esto impide una conclusión global favorable sobre todo el producto.

Corte de producto revisado:3f7f47a y deltas publicados d5fd99e (importación/navegación), d1956d9 (sesiones, correo y Next), d723cc2 (paginación de candidatos).728d99b integra el control puro de robustez, sin alterar el runtime. La carga210K y recuperación actuales tienen revisión independiente y controles externos integrados; se conservan por separado las fuentes medidas y los deltas de integración. No se trasladan resultados de composiciones privadas anteriores a la versión pública.

| Rubro | Evidencia local revisada | Límite o pendiente |
|---|---|---|
| 1 Diseño y negocio | Flujos, estados, dinero observado, recomendaciones y acciones humanas; prueba de ocho vistas/importación357. | Datos y resultados del cliente; no PMF ni causalidad inferidos. |
| 2 Arquitectura | Límites de ingesta, plataforma, gateway, análisis, métricas y workspace; versiones/configuración activas revisadas. | No certificación de escalabilidad por estructura del código. |
| 3 Resiliencia | Fences, replay, deadlines, restore352/portable con SQL0038 y binario anterior real conservando el snapshot financiero. | Ensayo359 integrado:33autor, dos casos del principal y gate externo33Node22 con controles candidatos trampa. Restore gestionado y autoridad posterior al backup. |
| 4 Capacidad y costo | Ejecutor de carga358, semilla/hash/contabilidad y recursos medidos. | 210Kfilas/2100chunks/cero pendientes; costo monetario no medido y SLO comercial no aprobado. |
| 5 Frontend | Ocho vistas, importación/exportación/revocación354/357; landmarks350 y revisiones móviles previas por hashes. | Revisión visual humana y accesibilidad global F06-07 pendientes. |
| 6 APIs y backend | Validación, CAS, transacciones y controles por tenant; paginación201recibos/102versiones y rollback103. | Smoke contra destino real. |
| 7 Dinero | BigInt/moneda/scope/unknown, oráculos independientes y mutantesF07-02; aliasCRMsin doble conteo. | Validación financiera con fuentes reales; no ahorro causal. |
| 8 Datos y Storage | RLS/grants, retención0035, migraciones hasta0038 y restore de siete tablas/historiales. | SQL remoto necesita aprobación; destino restaurado permanece cerrado hasta reconciliar autoridad. |
| 9 Caché y CDN | Seis APIs privadas con private,no-store; política y claves inspeccionadas. | CDN remota no ensayada. |
| 10 Límites y abuso | Cinco solicitudes de correo ante503→un intento; admisión por proceso y recuperación explícita. | No cuota distribuida ni medición de saturación/GoTrue real. |
| 11 Auth y permisos | Cookies rechazadas corregidas; identidad final, aceptación explícita, último owner, CAS y revocación. | OAuth/correo/usuarios reales y configuración de destino. |
| 12 Seguridad y dependencias | Firma ligada al código compilado, entradas, orígenes y Next16.3.6; revisión356. | Avisos dirigidos, no escaneo transitivo exhaustivo; ámbito F06-09 excluido. |
| 13 Privacidad y retención | Redacción, export/desarrollo sin fuentes borradas, guardas de artefactos y ledger de borrado. | Derechos/consentimientos/custodia reales; no dictamen legal. |
| 14 Infraestructura | Manifiesto y SHA compilado; [metadatos Supabase](infra-observacion.json) observados ACTIVE_HEALTHY por MCP por el principal, fuera de la revisión355. | No despliegue validado: sólo metadatos de proyecto. Configuración, SQL y backup gestionados pendientes. |
| 15 CI/CD y Git | Builds locales, controles de índice limpio, publisher y SHA remoto; autoría conservada. | Actions desactivadas; no CI hospedado aprobado ni protecciones configuradas. |
| 16 Errores y logs | Respuestas saneadas y correlación; errores reales y fallos de harness preservados. | Destino/retención de logs productivos no observados. |
| 17 Operación y alertas | Heartbeat, caída/reanudación del mismo consumidor y runbooks. | Cron/Vault y entrega de alarmas reales, responsables nominales. |
| 18 Pruebas y arneses | Manifiestos inmutables, oráculos independientes, fallos conservados y limpieza porID. | Carga/caos y recuperación portables integrados; no recontar pruebas antiguas como nuevas. |
| 19 Integraciones y herramientas | Backfill→incremental durable, cuentas/orígenes restringidos, redirects denegados y herramienta de lectura con esquema cerrado. | CRM publicado usa polling; no existe receptor webhookCRM que pueda declararse probado. Cuentas reales pendientes. |
| 20 Agentes y supervisión | Prompt SYSTEM realmente activo; sólo entradas redactadas/citas, tool_calls rechazados; configuración efectiva y firma versionada. | Gold humano, inferencia autorizada y calidad semántica reales; no entrenamiento/promoción automáticos. |

## Actualización de infraestructura comprobada —25-sep

El corte remoto posterior sirve `1ccec37fafe5ff2db0dbad10ffb103b31f43f62a` en https://vexa-ai.vercel.app. No se atribuyen a ese SHA los benchmarks históricos de esta tabla. Supabase gestionado recibió las35migraciones autorizadas (0001–0028 y0033–0039) y bootstrap del rol restringido;99tablas públicas conRLS. El pooler mantiene verificación TLS/CA y hostname. El ámbito SQL0029–0032 sigue excluido.

Siete controles focales reales pasaron: revisión servida, dos organizaciones SYN autenticadas/aisladas, delegación, consumidor HTTP/heartbeat, CSV→Storage→trabajo terminal3/3 aceptadas, acceso ajeno denegado y pausa→alarma/admisión503→recuperación del mismo trabajo sin duplicados. Tres comprobaciones posteriores de navegador verificaron estado/actualizar/descarga de errores y rechazo ajeno en escritorio/móvil. Delegación deshabilitada al terminar y sin cron continuo. Recibos privados conservan SHA y alcance; [detalle publicado](VERCEL-ESTADO-2026-09-25.md).

Esto actualiza los rubros3,6,8,11,14 y17 del corte histórico: el despliegue, SQL autorizado y consumidor remoto ya no son meros metadatos. Siguen pendientes el smoke remoto completo de ocho fases, restore gestionado, programación continua, Google/SMTP propios, CRM/modelos reales y los bloqueos descritos. La revisión visual posterior de Atiende se registra por separado; estos controles no aprueban los20rubros ni producción.

## Actualización de frontend comprobada —25-sep

Revisiones379/381: estructura Atiende, navegación móvil/compacta, confirmaciones, tablas y movimiento reducido integrados;37fuentes finales, compilaciónNode22, F01-04 intacto y controles reales locales de Auth/SQL/Storage. La matriz diferencia29rutas de582sitios de controles: no son582acciones ejecutadas. Se corrigieron grupos inaccesibles al contraer, una tabla sin región propia y contraste de placeholders. [Informe delimitado y huellas](INTERFAZ-ATIENDE-2026-09-25.md). Chrome comprobado; revisión humana, accesibilidad global y validación del nuevo despliegue siguen separadas.

## Reparaciones verificadas

- Una invitación rechazada emitía cookie: el mismo403 ahora deja cero cookies y workspace401; el caso válido conserva identidad final y aceptación.
- Solicitudes repetidas de correo ante fallo de Auth repetían intentos: límite/circuito local probado, sin afirmar cinco correos ni eludir GoTrue.
- Dependencia Next actualizada16.3.5→16.3.6, lint/build y flujos reales locales verificados.
- Errores de transporte de importación saneados y reintento del mismo archivo con una reserva/un job.
- Navegación detalle→resumen conserva el corte financiero sin arrastrar parámetros incompatibles.
- El recibo101 bloqueaba toda la lista de candidatos: paginación acotada y rollback antiguo verificados con201recibos y103versiones finales.
- El preflight de carga admitía archivos adicionales: inventario completo y rechazo de añadidos, faltantes, cambios y symlinks verificados antes de infraestructura.
- El timeout del launcher podía dejar procesos activos: grupo propioTERM/KILL, error/cancelación y rechazo de salida0tardía probados en22/26.
- El control de restore carecía de handler de señales: cleanup idempotente y SIGTERM real→exit1/contenedores y red eliminados.

El informe original que contenía un error de oráculo401/403, el fallo de selector de Next y los fallos de setup no se reetiquetan como aprobaciones. Las correcciones se prueban por separado. Mailpit es correo local y el gateway sintético no constituye una llamada ni una factura de proveedor.

## Referencias independientes

| Revisión | Ámbito | SHA256 del manifiesto |
|---|---|---|
| 355 | 3,4,14,15,16,17,18 | 7fbc8d6733e7fd77b3d41770d58d011b593ab15b838cbfff0333dde836f3a55d |
| 356 | 6,8,9,10,11,12,13 | fc6b7673222408ab4181091d90377605649d4e7d44931de2828f4c2b83e5ec48 |
| 357 | 1,2,5,7,19,20 | fa6804b9c998e4e8fc7960c1caded1152cab39fd3b3eb68882dbfc97491e6c68 |

Los recibos completos permanecen privados; los hashes permiten vincular la revisión sin publicar sesiones o credenciales. Cada conclusión debe conservar el corte y alcance de su evidencia. [Estado por capas](acta-cierre.json) y [pendientes para conexión](PENDIENTES-PARA-CONECTAR.md).

## Mediciones y cierre de controles

La serie358 midió10K/50K/150K con205800filas aceptadas,2100rechazadas y2100duplicadas intencionales:210000procesadas y cero pendientes. Tiempos extremo a extremo119.31/625.22/1842.32s; p95 de commit de bloques1223.17/1510.81/1379.04ms. AppleM3,24GiB, Docker con unos8GiB, host compartido, un consumidor. No mide modelos, embeddings ni snapshot utilizable de extremo a extremo; no usar el p95 de commit como latencia completa.

El informe conserva d723 más freeze3 como fuente medida. La metadata posterior añade nueve helpers de caos con2046fuentes originales iguales; no mueve la medición a otro hash ni permite escalar con un informe antiguo. El wrapper fue probado mediante su CLI real, checker completo y deltas focales; no se ejecutó otra serie210K completa.

Caos:33casos autoresNode26, guardas posteriores en22/26, dos casos independientes del principal y gate completo33Node22. Recuperación: cinco controles del restore actual y binario anterior real; el nuevo handler se probó aparte con SIGTERM. El binariod195 tiene un defecto conocido al listar más de100candidatos; sólo se acreditó continuidad financiera, no una recomendación general de usarlo.

| Evidencia adicional | SHA256 del manifiesto |
|---|---|
| Carga358,86archivos | e0e2a215b2b5be65d4ccb2d6a5fa5c0e9599188ea0a5cef1312507e1071b6d74 |
| Revisión360 del gate de caos | 8ead7834dc27027f71b2c7e26a1f268e345c456a6aa373f3d7fb7164dab6bd05 |
| Revisión360 del control de recuperación | c4ed21ea4af87eafb2b6e2a1c563ec3a775d98b0e925f553d3d7a20141fde08b |

Los20rubros tienen conclusiones delimitadas. El ámbito excluido, las validaciones humanas y el smoke remoto completo pendiente impiden declarar auditoría global aprobada o software listo para producción.

# Hallazgos del cierre

## Inicio, 7-oct-2026
- Fase3 completa: serie210K filas SYN,0 pendientes,15 recursos ausentes; c2d03e2.
- El grafo real conserva28 aceptadas de60. Próxima ficha elegibleF03-01 requiere pruebas live de mensajes/scopes; fixture no cierra ese requisito.
- Fase4 tiene gate local F07-06 y procedimiento gestionado previo. El sexto ensayo gestionado falló denegación de URL firmada; no se convierte en PASS por el cierre local.
- Documentos históricos PLAN/construccion README contienen estado anterior; ESTADO-VIGENTE es fuente actual. Se reconciliarán los encabezados al cierre.

## Fase4, diagnóstico y preparación
- Destino temporal Supabase existente comprobado por MCP read-only: cero tablas públicas/usuarios Auth/buckets/objetos; CONNECT denegado a roles de aplicación. No se modificó configuración.
- Captura histórica conservada: dump/inventario/recibos con hashes originales y13/13 objetos (76.854bytes) revalidados. Se extrajo SQL completo offline para revisión, sin conectar DB; no es restore.
- Bootstrap local antiguo carecía de funciones oficiales Storage requeridas por0041. Control907eb8b añade helpers exactos de imagen; calibración SQL2/2PASS con rechazo previo reproducido y firmas privadas denegadas.
- Ensayo F07-06 v1 falló antes del restore por ENOTCACHED de zod-validation-error4.0.2. Tres recursos propios retirados. Fallo conservado: recovery-full-v1.log. Se repone únicamente esa dependencia del lock en caché antes de reintentar.
- Recuperación gestionada conserva pendiente barrera origen/CDN frente a firmas antiguas; documentación oficial actual sigue remitiendo revocación a soporte. No equivale a la protección0041 contra creación de nuevas firmas.

## Preparación fase4 integrada, continuación independiente fase5
- Restore local F07-06v2 PASS80,7s,5/5restore+rollbackfinanciero+rollforward,8recursosausentes. Literal histórico through0038 delreciborollback no sustituye inventarioactual0041; no editarrecibo.
- Adaptador source-only18/18PASS y captura real13/76854 verificada. Metadata14campos/13objetos confirmada independientemente por COPYrealPostgreSQL; bucketprivado y MIME exacto text/csv. Bundle conservarestorationfalse.
- Main sinprotección ni rulesets; Actionsdesactivado comprobadoAPI. PropuestaPR+CI preparada; requiereadaptarpublisher/CI y autorizaciónespecífica antesaplicar.
- Recuperación gestionadapendiente proveedor/cuarentena y ejecuciónautorizada; consulta lista no enviada mientrasrespuestaasíncrona pendiente. No declarar fase4terminada100%.
- Se continúa fase5 enpartesindependientes porencargo explícito de completartodaslasfases; contadorformal no cambia. LecturaSenix8-oct05:35UTC:136992mensajes,137596import_rows,288sync_pagesen24h. Diferenciaconconteosreportadosanteriormente aún sinreconciliar; no atribuircausa. CRMhabilitado failure_count0.

## Fase 5: diagnóstico de referencias, 8 de octubre de 2026 UTC
- Consulta SQL de sólo lectura cotejó los primeros 400 registros del CSV original con SHA256 `69ca61fc56e8e8e5b3037a7d0f6a2537168bfbb85f0a5e17aa20946f96f4918b`, los rechazos persistidos y las identidades canónicas: los 362 `REFERENCE_MISSING` ya tienen mensaje y una sola revisión cada uno. Cero mensajes faltantes. No reimportar esas identidades como nuevas.
- Siguen ausentes en la misma conexión los padres de 251 referencias de cliente, 269 de pedido y 211 de SKU. Son conteos de filas con referencias, no entidades únicas, y se solapan. La reparación pendiente consiste en conciliar padres y vínculos; no borrar el recibo del rechazo original.
- La búsqueda de sufijo `:linked-v1` devolvió cero, pero esa ausencia sola no demostraba que faltaran mensajes. El cotejo posterior de identidad corrige esa interpretación.
- Recibo histórico de readback local: 136.900 filas comprobadas, 136.895 aceptadas y cinco ambigüedades, cero hash mismatch/missing. Se conserva como evidencia de su corte; no sustituye la lectura actual.
- CRM propuesto: hosted permite hasta 100 unidades dentro de los mismos 15 segundos, runtime conserva default 1 y checkpoints por unidad. Retry-After válido se respeta durablemente; inválido detiene reintentos hasta corrección del propietario. No usar `infinity` en next_attempt_at: la vista de configuración serializa fechas ISO.
- Autoría CRM: 101/101 pruebas locales; control separado 6/6 frente al delta y rojo 3/6 frente al handler anterior. Examen SQL/HTTP y medición todavía pendientes, producto congelado.

- Precisión de código: `:linked-v1` es un sufijo de `import_rows.row_ref` usado por recuperación de mensajes CRM en `sync.mjs`, no de `messages.external_id` ni una API para reparar relaciones CSV. La consulta correcta de recibos también devolvió cero. Mantener los mensajes existentes y diseñar la vinculación explícita antes de escribir.
- Piloto preparado de 100 notas: todos los hashes de artefactos coinciden con el manifiesto; corte SQL 05:51:16 UTC registra cero coincidencias de identidad canónica, ID nativo de nota o cuerpo NFC exacto entre 336 registros raw nativos actuales. No prueba ausencia de duplicación semántica ni futura; revisión independiente de fuentes en curso.
- Examen CRM SQL/HTTP PASS 9/9 en 47,89 segundos; seis controles puros PASS. Cinco unidades en una llamada frente a cinco llamadas anteriores (749,29 frente a 355,63 ms acumulados, fixture SYN y runtime nuevo común). No extrapolar rendimiento remoto. Cinco recursos propios ausentes confirmados por root.

## Reconciliación formal y control, 8 de octubre de 2026
- El estado estructurado conservaba F07-01 como única tarea técnica faltante y gate MISSING. La revisión independiente de Spec cotejó SHA del informe global, PASS17/17, notRun vacío y54be5cf ancestro. Se reconcilia construction_total a60 según su definición local; accepted_in_graph sigue28, sin modificar estado del runner ni validar producción.
- F03-01: autorización continua y observación real de20hilos ya existen. Las398solicitudes incluían324notas y13tickets; el gate no pide esos canales y conserva250solicitudes. No aumentar el cupo por esa comparación incorrecta.
- Referencia independiente pendiente:12CSV originales/176944filas comprobados no contienen ninguno de los27mensajes nativos por ID o cuerpoNFC. Los paquetesHubSpot son cachesAPI empaquetados, no exportUI. No se inventó origen ni HMAC. CUA devuelve browsers=[],apps=[] y error de arranque nativo; no existe superficie disponible para cotejar UI en esta sesión.
- Corrección de control3ec0e2b exige implementer string no vacío y distinto de reviewer tras trim; ocho fallos previos reproducidos,71/71PASS y revisión independiente sin bloqueantes. Cambia dos fuentes pineadas, por lo que las mediciones en curso sobreaff0517 no se heredan para el cierre final.
- Piloto100notas revisado independientemente:33fuentes,3metadatos,7artefactos y proyección100/100. El lector durable deriva la revisión de payload;100revisiones difieren del hash nativo declarado, y84fechas cambian su lexema canónico preservando el original. Usar el contrato durable en readback. Sin carga nueva.


## Fase 6: dependencias reales y acta

El controlador confirma 28 de 60 aceptadas y una única ficha elegible: F03-01. Sin su referencia independiente y S02 Zendesk no se pueden tramitar los sucesores locales manteniendo el grafo. F06-07 añade juicio visual humano; F07-05, F08-03 y F08-05 conservan actos humanos y recepción específicos. No se alteran dependencias para subir el contador.

Acta pública reconciliada como borrador a 60 técnicas / 28 formales. Retirados los bloqueos documentales obsoletos de revisión y seis alcances técnicos; checkpoints y pruebas remotas históricas conservan sus SHA. Producción, PMF y ensayo humano siguen false. Paquete de materiales y siete formularios vacíos revisado e integrado, sin resultados ni aprobaciones inventadas.

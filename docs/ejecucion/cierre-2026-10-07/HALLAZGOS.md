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

# F05-05 — snapshots publicados y exportaciones fijadas al alcance

La preparación captura componentes y versiones en tablas canónicas; una publicación actualiza su referencia activa en una transacción. Un fallo durante la preparación conserva la última publicación y el reintento del mismo input reutiliza identidad, fecha de captura y hash. Los valores parciales/desconocidos permanecen explícitos. El historial publicado es inmutable; consultar o exportar vuelve a comprobar permisos y evidencia capturada. Las descargas JSON/CSV conservan snapshot_id, scope_hash e importes exactos aunque cambien los filtros.

Revisión independiente: 15/15 en Auth/PostgreSQL/API/Chromium, incluidos dos SIGKILL reales, reintentos, evidencia actual frente a pertenencias históricas, roles/tenant, exportación concurrente y respuesta tardía tras revocación. El mutante de selección de alcance falla por la aserción correcta y se restaura. Copia Git limpia Node22: 15/15 de snapshots y22/22 de dinero. Regresiones de exposición13/13 y ledger10/10; el único cambio posterior a éstas fueron dos atributos de descarga, cubiertos por las pruebas de snapshots y CI sobre los bytes finales.

Matriz completa de21 migraciones:286/286. Focales12/12 incluyen metadatos obligatorios, privacidad de borradores, cuatro FKs, cantidades de más37dígitos, CAS/rollback, mutante financiero y digest idéntico entre cinco roles y tres zonas horarias. Controlador125/125; CI local de web completo con tipos, lint, build y canarios contra filtraciones. No se ejecutaron GitHub Actions.

Controles congelados: b512cbf78f15b4b30410b58a8f3249716e7ee1eb. SQL0021 SHA256:0ff9ec55abf8736bc7f52159755d00e902b588aa5d276c72a8f9967b91d03ede. Recibos privados conservan fuentes, fallos y limpieza por IDs; no se publican originales privados.

Se corrigieron la lectura de borradores, metadatos incompletos, actualización de la referencia activa, aislamiento de organización y digest dependiente del rol/zona horaria. Los fallos de fixtures y barreras de descarga se conservaron por separado; la prueba final usa transporte HTTP local de bytes reales con interrupción acotada del envío, sin simular lógica económica.

35/60 técnicamente listas;24 aceptadas en el grafo, con dependencias live conservadas. F05 queda5/6. F05-06 y las fases siguientes aún no completan el producto. Cuentas/datos, aprobación legítima SQL, despliegue y auditoría integral final siguen pendientes; las pruebas locales no acreditan producción.

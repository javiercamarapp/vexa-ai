# Actualización de revisión independiente —20-sep-2026

Propuesta05 revisada y corregida; no aceptada ni publicada como producto. Un fallo transitorio al terminar el resumen de salud se capturaba como error del proveedor, dejando stale aunque el cursor ya estaba completo. El principal separó esa finalización de errores de fuente; la revisión independiente probó SQL real: fallo exactamente una vez, running→healthy sin fetch adicional, mismo timestamp original y no-op estable. Se conserva el rechazo inicial y el manifiesto corregido privado.

Regresiones nuevas:15/15 Node22 y26,29/29 de sincronización, lint/build en copias temporales, tres mutantes del gate y recursos eliminados por IDs. SQL0010 no cambió: matriz214 previamente verificada conserva validez. El caso terminal del examen ahora falla sólo una vez al finalizar y exige no emitir una segunda finalización de error.

Los apartados siguientes conservan el desarrollo previo; «pendiente de revisión por cuota» es histórico. F03-01 sigue pendiente de acceso legítimo y S01/S02 reales; global17/60.

# F03-05 — salud, permisos y recuperación de conexiones

20-sep-2026. Propuesta local con pruebas deterministas; **revisión independiente pendiente por límite de uso de agentes**. No congelar este control en la raíz, preparar candidato oficial, aceptar ni publicar antes de esa revisión. El progreso oficial permanece en 17/60; las dependencias F03 y los ensayos reales autorizados S01/S02 siguen pendientes.

## Contrato y ejecución real

El examen usa PostgreSQL, Auth, API Next y Chromium reales con fixtures SYN rotulados. Reutiliza el harness F02 durable en copia temporal, añadiendo los conectores al inventario de fuentes y ejecutando lint y build offline. Dependencias, compilación y procesos viven fuera del candidato. El broker registra recursos con UUID y journal privado; la limpieza comprueba ausencia por IDs.

La lectura usa createDatabase y membresía SQL vigente: aislamiento dual, revocación con sesión antigua, allowlist de respuesta, no-store y error SQL 503 sin fingir una lista vacía. No devuelve credential_ref, URLs, cursores, tokens ni headers. Roles de lectura del resumen no obtienen acceso a objetos raw.

Se separan lastAttempt, lastSuccess y provider_permissions. Sin intento hay unknown; sin página comprometida, cobertura desconocida. Un checkpoint opaco se muestra como huella, no como fecha. lagSeconds representa tiempo desde el último éxito, no retraso real del proveedor. Una respuesta vacía, parcial o con rechazos nunca avanza lastSuccess. La cobertura cuenta objetos fuente únicos; no asegura el denominador completo de la cuenta ni cobertura de canales no consultados.

401/403 persiste reconnect_required y bloquea la siguiente llamada al proveedor. El panel servido por Next muestra esa revocación. El POST de recheck exige mismo Origin, confirmación explícita de rotación, owner SQL vigente y CAS del intento. Sólo habilita un nuevo intento con permisos unknown; conserva toda evidencia y no inventa OAuth verificado, no recibe tokens ni llama al proveedor desde el botón. La siguiente sincronización autorizada restaura salud al comprobar páginas válidas.

## Fallos reproducidos y correcciones

- El borrador avanzaba éxito con respuesta vacía: se exige página terminal, cobertura no vacía y completa.
- Dos primeros intentos simultáneos podían sobrescribirse: barrera real y guard SQL excluyen al segundo escritor mientras vive el lease del primero.
- Un fallo antes de obtener páginas producía cobertura cero: se conserva unknown y el último checkpoint conocido.
- El endpoint de recheck estaba ausente: ruta real y pruebas CSRF/owner/CAS/confirmación, más checkbox y botón en Chromium.
- SIGKILL después de beginAttempt dejaba un bloqueo de salud más largo que el lease real: vínculo sync_id/sync_fence con FK y consulta del cursor duradero. La prueba mata un proceso real y recupera tras expirar su lease de 100 ms.
- Si la página terminal confirma antes de fallar finishAttempt, una nueva ejecución no-op reconcilia el intento original sin refetch ni nuevo timestamp. Esta prueba inyecta una excepción posterior al commit; no se describe como SIGKILL.
- La recuperación de un mensaje cuyo padre llega después seguía contando un rechazo: import_rows usa estado accepted, mientras el resultado raw usa inserted. La corrección cambia exclusivamente el predicado linked-v1; el rojo observó accepted=1/rejected=1 y el verde accepted=2/rejected=0 para los mismos dos objetos fuente inmutables.

Los fallos de preparación del examen se conservan por separado: transformación inicial de imports inválida; duplicación de imports de la matriz; fixture de health agregado al contenedor que asumía PK id; pérdida de memberships no enumerable al copiar el fixture. Ninguno es un mutante detectado ni prueba de fallo del producto. Los recibos rechazados no se sustituyen con el resultado posterior.

## Seguridad y evidencia local

SQL0010 es aditivo. connection_health tiene FORCE RLS, tenant/actor derivados y FK compuestas a conexión, membresía y cursor. El actor, intento y vínculo de lease no pueden falsificarse; la configuración sólo admite la transición exacta de recheck sin cambiar éxito, contadores ni checkpoint. La matriz global conserva tablas, FK, roles, Auth, Storage, retrieval y revocación anteriores, y añade salud en fixture separado.

Resultado local final: 15/15 en Node 22 y Node 26, tres ciclos de mutantes SQL verde→rojo por aserción→verde restaurado, lint/build y navegador; implementación ausente rechazada por IMPLEMENTATION_MISSING. Matriz global SQL/Auth/Storage 214/214 y regresión de sincronización 29/29 después del cambio de vínculo al lease. La última corrección linked-v1 no cambia SQL ni sync; se repite el examen de salud afectado y se reutilizan esas evidencias inmutables. Consumidor TypeScript real createDatabase→health/sync con strict aprobado localmente.

Estas pruebas no son revisión independiente, aceptación oficial, ensayo de cuentas reales ni despliegue. Los originales de los agentes y el paquete previo F03-04 permanecen intactos. El paquete pendiente tiene manifiesto propio con huellas, modos y referencias a los logs rojos y verdes, sin publicar fuentes privadas.

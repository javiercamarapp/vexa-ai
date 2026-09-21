# Revisión final F03-06 —20-sep-2026

Propuesta local revisada, no aceptación oficial. Revisión219 reprodujo con SQL real que un canal llamado constructor podía heredar Object.prototype al desaparecer del segundo corte, ocultando la pérdida de cobertura. La lectura por claves propias corrige constructor/__proto__/toString/hasOwnProperty, tanto desaparición como aparición. Se conservaron rechazo, SQLrojo y9/9 de contrato corregido.

Regresiones de la corrección:17/17 en Node22/26. Integración con salud05 corregida:17/17 comparación y15/15 salud en Node26, lint/build, huellas intactas y limpieza por IDs. Revisión independiente aprobó el delta; no se sobrescribió sync05 con la versión heredada04. Tres mutantes de método/dinero/canales y uno SQL de inmutabilidad son parte del examen. El contrato nuevo ejecuta9casos: no aceptar0/skip por NODE_TEST_CONTEXT heredado.

S01/S02 reales siguen pendientes:17/60 global. El texto siguiente conserva el desarrollo y sus limitaciones; pendientes de cuota/revisión mencionados allí son históricos.

# F03-06 — snapshots inmutables y comparación de migración

Propuesta local de20-sep-2026, pendiente de revisión independiente. No congelar controles en la raíz, aceptar ni publicar por estas pruebas. El cierre oficial sigue en F03-01 y17/60 global; no sustituir S01/S02 reales con fixtures.

## Implementación y alcance observado

Reutiliza metric_snapshots y aggregateMoney aceptados, más la proyección de alias F03-04 extraída sin cambio de reglas. No crea tablas ni migraciones nuevas. SQL hace una lectura conjunta de versiones seleccionadas, registros, alias y procedencia de canal; congela entradas, resumen, scope/pipeline/mapping/taxonomy/watermark y hash. El snapshot publicado conserva la inmutabilidad SQL existente. POST de captura y GET de listado/comparación usan createDatabase, Auth y membresía vigente; roles de lectura no reciben raw ni secretos. UI real permite capturar, elegir dos cortes, comparar, refrescar y paginar.

Misma moneda, exponente, filtros, método y cobertura son precondiciones; no hay ahorro/causalidad inventados. Dinero usa BigInt y strings; unknown sigue desconocido. Conversaciones resueltas y mensajes fuente únicos son conteos distintos; alias no cambia las órdenes ni sus importes. Las etiquetas con prefijo de proveedor conservan identidad de origen y no son una equivalencia automática de canales.

## Reproducciones y correcciones preservadas

- Implementación ausente: COMPARABILITY_IMPLEMENTATION_MISSING antes de infraestructura; también contrato puro ausente.
- Primera UI: getByLabel exacto no localizaba Antes. Se guardó respuesta200/URL/cuerpo/labels: la etiqueta envolvente incorporaba opciones. Se corrigieron htmlFor/id y la prueba real pasó sin cambiar su oráculo.
- Exponente distinto bajo la misma moneda: el primer comparador lo permitía; ahora queda no_comparable y sin delta monetario.
- 30-febrero se normalizaba a marzo; validación explícita de calendario y precisión lo rechaza.
- Paginación perdía registros al convertir fecha PostgreSQL con microsegundos a Date. Rojo con52cortes empatados: PAGINATION_NO_SUBMILLISECOND_OMISSIONS. El cursor conserva fecha exacta y desempata por ID; páginas completas sin duplicados.
- Node hijo heredó NODE_TEST_CONTEXT y omitió pruebas con exit0. El examen se rechazó por MUTANT_SURVIVED; no se contó como evidencia verde. Se limpia sólo esa variable en el hijo y se exige tests8/skipped0 además de la salida y aserción específica.
- Un runSync real conservaba via.channel en raw, pero la proyección canónica no lo tenía. El corte ahora enlaza evidencia raw aceptada con la revisión seleccionada, sin reescribir sources ni mapping. Se prueba Zendesk y HubSpot por separado; IDs de canal no se convierten en equivalencias inferidas.
- Cursor inválido retornaba503: ahora devuelve400; errores SQL genuinos conservan503.

Los primeros logs y paquetes se conservan; no se altera un resultado rechazado para convertirlo en verde.

## Examen final y límites

17/17 en Node22 y26 sobre integración conjunta05+06: SQL/Auth/API/Chromium reales, lint/build offline, captura/idempotencia, alias5→4 con30000sin cambios, pérdida de canal, inmutabilidad, tenant dual, viewer/no escritura, revocación, CSRF, error503, formulario/paginación y límite10001sin snapshot parcial. Tres mutantes de método/dinero/cobertura y uno SQL de inmutabilidad se detectan con verde→rojo→verde. Contrato puro8/8. La regresión de alias tras extraer la proyección pasó13/13; salud05 conjunta pasó15/15. SQL/migraciones de05 y el kernel económico no cambiaron; no se repite una auditoría global inalterada.

La captura síncrona está limitada a10000filas por tipo en la organización. Se demuestra rechazo sin publicación parcial, no capacidad ilimitada ni carga real enterprise. La taxonomía not-applied no finge haber ejecutado clasificación. Usuarios/cuentas/proveedores reales, reconciliación independiente y SQL/deploy remoto siguen sin validar. Revisión independiente05/06 aún bloqueada por cuota; estos paquetes son propuestas, no acceptance ni producción.

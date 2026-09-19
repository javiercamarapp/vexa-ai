# 06 · Operación, release y entrega de punta a punta

**Runbooks para implementar y ensayar en F07/F08. No afirman que esos sistemas estén operando hoy.** Producción, datos reales y publicación necesitan autorización específica, además de tests verdes.

## Runbook A — Cola detenida o trabajador caído

1. Owner técnico confirma entorno/tenant/job_id; mirar last_success, heartbeat, checkpoint, oldest_queued y lease. No imprimir payload/credenciales.
2. Pausar admisión de nuevos imports si el consumidor no progresa. Mantener UI queued/stale con motivo; no marcar succeeded por un202.
3. Consultar intents/outbox y efectos ya comprometidos. Identificar si murió antes o después del commit. No incrementar cursor manualmente.
4. Reparar consumidor/acceso y reanudar desde checkpoint con nuevo fencing token; trabajador anterior no debe publicar.
5. Repetir fixture de fallo con oráculos de conjunto de IDs, ledger y snapshot únicos. Confirmar que antigüedad de cola baja y que UI deja de mostrar alarma por progreso real.
6. Registrar causa, tiempo observado de recuperación, intento, versión y prueba permanente. Si el fallo se repite, regla estructural/alarma, no sólo postmortem.

## Runbook B — Credencial revocada o gasto incierto

1. 401/403 → connection reconnect_required, detener esa sincronización; no insistir cuatro veces por reflejo.
2. Token queda fuera de logs y de la UI. Owner autorizado reconecta por el mecanismo revisado; scopes mínimos read-only.
3. Reanudar desde último cursor comprometido y dedup; no volver a cargar todo para «empezar limpio».
4. Para timeout LLM: reserva uncertain y request_ref redactado. Consultar registro de uso autorizado para conciliar; no costo0 ni liberación por falta de respuesta.
5. Si no se puede conciliar, mantener incertidumbre y presupuesto retenido con intervención humana. La suscripción de Codex no paga ese saldo.

## Runbook C — Eliminación y restore

1. Verificar identidad/permiso de la solicitud y alcance/retención legal; crear tombstone antes de permitir reingesta.
2. Borrar o anonimizar los derivados que la política promete: raw, texto, embeddings, caches, exports y referencias. Conservar sólo auditoría mínima autorizada.
3. Backups: explicar ventana/expiración y procedimiento de reaplicar tombstones al restaurar. No prometer eliminación instantánea de un backup que no puede editarse.
4. Ensayo en instancia NUEVA local: restaurar snapshot/backup, reaplicar tombstones, comparar conteos/hashes y verificar que contenido borrado no reaparece ni por búsqueda semántica.
5. Medir RPO/RTO del ensayo con hora/entorno/volumen. No decir «backup listo» sólo porque el archivo existe.
6. Prohibido probar reset/destrucción contra producción. Un fallo de restore bloquea release.

## Runbook D — Release autorizado

### Antes del primer push

- Confirmar nombre del repositorio VEXA, propietario y visibilidad. El canónico no debe inferir un remote de otro proyecto.
- Revisar `git diff`, archivos staged, secrets y licencias; `private/`, `.runtime/`, `.env*`, `.vercel/` y credenciales nunca se publican. La carpeta local contiene fuentes privadas: no subirla entera.
- Crear proyecto Supabase/Vercel exclusivo de VEXA, entorno preview separado y presupuesto aprobado. Instalar secretos en secret store correspondiente, no en una ficha.
- Revisar workflow de CI; sin permisos de fork privilegiado, sin skip de pruebas críticas, lock congelado. SHA del CI = SHA que se propone desplegar.

### Orden de promoción (operador con permisos)

1. Run unit/kernel, Auth/RLS/Storage/DB, integración, browser, mutación/casos críticos; todo contra el SHA exacto.
2. Generar `docs/entrega/release-manifest.json`: SHA, lock/config hashes, migrations, target, owners, run_ids, backup/restore y bloqueos.
3. Revisar migraciones con estrategia expand/contract y compatibilidad del SHA anterior. Enumerar/aplicar archivos en orden; no editar migraciones ya aplicadas.
4. Desplegar **preview** desde root directory configurado `apps/web`, después de comprobar proyecto. Usar el CLI instalado y sus flags comprobados con `vercel deploy --help`; el permiso de preview no autoriza producción.
5. Leer `/api/health/version` en URL efectiva y comparar SHA con manifest; deployment READY no sustituye smoke.
6. Ejecutar SYN-E2E-v1 desde browser remoto: login→upload→job terminal real→ocho rutas→acción draft→brief/export. Confirmar exposición30000 y refund1500, alias sin doble conteo, B inaccesible.
7. Probar revocación y consumidor detenido/alarma en preview. Capturar trace desde browser a job/DB; secretos redactados.
8. Ensayar rollback a SHA compatible anterior, verificar schema y smoke. Registrar ambos SHA y versión final sana.
9. Sólo con autorización específica promover a producción y repetir smoke mínimo con fixture/cuentas permitidos. Sin esa autorización, el estado final es preview o blocked, no production-ready por decreto.

### Dónde se captura evidencia

`docs/entrega/release-manifest.json`, `smoke-remote.json`, `restore-drill.json`, screenshots/redacted requests y acta. Nunca inventar una URL, SHA servido, run_id o cliente que no se observó. Los archivos deben decir not_run/blocked cuando falta esa observación.

## Runbook E — Intervención y medición sin falsa causalidad

1. Sponsor elige problema y acción realizable; owner del producto prepara, operador humano ejecuta.
2. Antes del cambio: baseline, periodo, población, KPI/unidad, cobertura, guardias y diseño de comparación/control. Guardar versión.
3. Medir ejecución/adopción y costos; no confundir marcar active con haber cambiado operación del cliente.
4. Controlar migración de CRM, temporada, mezcla de SKU y cobertura. Si no hay identificación causal defendible, reportar asociación/rango/incertidumbre.
5. No sumar exposure/refunds/support como Revenue Risk Resolved. Outcome debe tener definición y fuente propias; las hipótesis del pitch no son ahorros observados.

## Handoff que una persona puede usar

| Documento | Lo mínimo que contiene | Prueba de que sirve |
|---|---|---|
| README entrega | versión, URL/estado real, funcionalidades y pendientes | lector identifica demo vs piloto |
| GUIA-USUARIO | login, import, problemas, citas, recomendaciones, intervención, brief/export | usuario de prueba completa flujo sin SQL |
| RUNBOOK | cola, reconnect, presupuestos, backup/restore, rollback, borrado | operador ensaya al menos fallo+recuperación |
| ACCESOS-SIN-SECRETOS | owners, roles, revocación, nombres de stores | revocar usuario realmente bloquea |
| acta-cierre | criterios por capa y evidencia, no sólo firma «entregado» | compara esperado/observado y no oculta blocked |
| backlog | ID/severidad/repro/owner/aceptación | siguiente sesión puede retomar sin contexto |

## Cadencia posterior al release (propuesta, no jobs ya instalados)

Diario: consumidor, cola vieja, errores, presupuesto y backup. Semanal: muestra de evidencia/citas, cambios de proveedor/política, uso de recomendaciones y retorno de usuarios; no venderlo como PMF. Mensual: restore real de ensayo, permisos/revocaciones, costos unitarios y revisión de retención. Ante bug: reproducción→regresión→fix→QA→aprendizaje.

Automatizar alarmas/salud sólo después de medir su señal y asignar receptor. Un cron sin receptor/heartbeat/progreso no es operación automática.

# Operación y recuperación

Borrador verificable de operación, no autorización para producción. Responsable nominal, suplente, destino y ventana de actuación están pendientes de asignación por el operador. Registrar incidente, trace/job ID, versión, condición observada y evidencia sin payloads privados. No registrar tokens/cookies/contraseñas.

| Situación | Acción | Comprobación antes de reanudar |
|---|---|---|
| Job sin avance | Consultar /jobs/:id, heartbeat, lease y estado durable. Corregir consumidor/configuración; no crear otro import. | Cursor comprometido conservado; nuevo fence; aceptadas+rechazadas+duplicadas+pendientes=entrada. |
| Cancelación | Acción autorizada de cancelación; esperar estado durable. | No se publican nuevos resultados. Una petición ya enviada puede seguir teniendo efecto/costo incierto. |
| Dead-letter | Conservar causa/attempt/checkpoint; corregir problema y usar replay autorizado. | Mismo origen canónico; no doble publicación ni reaparición de contenido borrado. |
| CRM401/403 | Pausar/reconectar legítimamente; rotar secreto en servidor. Owner confirma en salud con versión vigente. | Nueva lectura real del proveedor; permisos pasan por unknown, no available ficticio. |
| CRM429 | Respetar espera y checkpoint. | Reanudación acotada sin perder páginas ni ampliar cuota. |
| Inferencia incierta | Conservar reserva; reconciliar costo con evidencia del proveedor y aprobación owner. | Costo real o uncertain explícito. Conciliar no fabrica respuesta ni vuelve a ejecutar modelo. |
| Aviso incierto | Conservar outbox/attempt y usar reconciliación con evidencia verificable. | Sin reenvío por mero timeout. accepted/delivered/rejected se distinguen. |
| DB/Storage caídos | Detener admisión cuando salud lo exija; recuperar servicio, luego consumidores. | Error visible, consistencia de jobs/checkpoints y última publicación buena. |
| Revocación | Administrador revoca membership/credencial/delegación según alcance. | Nueva solicitud y export denegados; job en curso no publica; logout no deja sesión válida. |

## Restore y borrado

La propuesta F07-06 tiene código/ensayo local en packages/recovery/OPERATIONS.md. El procedimiento remoto depende del proveedor y aprobación específica; no sustituirlo por copiar tablas a producción. Respaldar DB y objetos con manifest/hashes; conservar ledger de borrados posterior al backup fuera de ese backup. Restaurar en destino cerrado, comprobar esquema compatible, reaplicar tombstones de todos los tenants y purgar objetos/proyecciones antes de habilitar acceso. Una restauración que revive texto, embeddings, exports o cachés borrados falla aunque el SQL haya terminado.

RPO/RTO observados en fixtures son mediciones del ensayo, no SLA del cliente. No borrar originales de backup para hacer pasar una comprobación. Retención final, custodio y caducidad necesitan decisión del cliente.

## Rollback y despliegue

Manifest debe ligar SHA limpio, lock, migraciones y destino aprobado. Aplicar cambios expand autorizados antes de app compatible. Si falla smoke, volver al artefacto previo compatible y mantener consumidores pausados cuando corresponda; no ejecutar down migrations destructivas automáticas. Repetir sólo el smoke/regresión afectado y conservar el fallo. Verificar SHA servido, login A/B, import/job, evidencia, dinero/UI/export, revocación y alarma de consumidor. READY de Vercel no equivale a éxito del flujo.

Programadores concretos: imports, CRM y extracción tienen operaciones en supabase/operations/; notificaciones usan su daemon. SQL cloud/Vault/cron necesitan aprobación legítima. Seguir documentos de cada módulo para flags y límites; no copiar secretos al shell o Git.

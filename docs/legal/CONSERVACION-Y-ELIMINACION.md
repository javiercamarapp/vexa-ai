# Conservación y eliminación: qué existe en el código y qué se propone

Fecha: 3-nov-2026. Rama `ola3-legal`. Las columnas «Existe hoy» salen del código; todo lo marcado **PROPUESTA** requiere aprobación de Javier y del abogado antes de fijar las variables `VEXA_LEGAL_*` que publican el aviso. El aviso público ya contiene estas propuestas como compromisos: aprobarlas es aprobar ese texto.

## 1. Lo que existe de verdad

| Dato | Mecanismo | Plazo real | Evidencia |
|---|---|---|---|
| Mensajes, conversaciones y clientes de un tenant | Borrado por entidad a petición del Administrador del espacio, con vista previa del alcance y confirmación; deja asiento firmado en `retention_ledger` y bloquea reingreso de lo borrado | Inmediato al confirmar; no hay borrado automático por antigüedad | `supabase/migrations/0033_retention_recovery.sql` (`retention_erase`), `20261130000100_retention_erase_attachments.sql`, `20261205000200_retention_erase_tracker.sql`, `apps/web/src/components/retention-panel.tsx` |
| Política de retención por organización | `retention_policies.backup_ttl_seconds` entre 1 s y 365 días; `active_erasure='immediate'`; `business_history='retain-authorized-audit'` | Configurable por organización | `0033_retention_recovery.sql:3-9` |
| Historia canónica | Los identificadores y la historia financiera sobreviven al borrado de contenido de origen | Indefinido | `0033_retention_recovery.sql:2` |
| Artefactos de Storage (originales, caché, exportes) | `retention_artifacts.expires_at` y `purgeArtifacts` (lotes de 25) | Por artefacto; quién lo programa por confirmar | `packages/recovery/index.mjs:28-29`, `0035_retention_storage.sql` |
| Registros de seguridad | `vexa_platform.security_events_retain`: borra los de más de 180 días, mínimo 30 | 180 días si el cron está activo; el cron lo aplica Javier (`supabase/operations/security-events-retention-cron.sql`), **activación por confirmar** | `20261206000200_security_events_retention.sql:14-30` |
| Contadores de límite de acceso | Huellas HMAC, se purgan al consultar | 1 hora | `20261205000000_email_auth_throttle.sql:35` |
| Sesión de soporte | Caducidad dura | 60 minutos | `20261126000000_platform_support_and_audited_reads.sql:34` |
| Invitaciones | `expires_at`; las vencidas se listan 60 días | Por invitación | `20261126000200_team_my_invitations.sql:17` |
| Enlace de baja del reporte semanal | Token HMAC | 400 días por omisión | `packages/notifications/baja-semanal.mjs:1` |
| Respaldo gestionado de la base | Diario automático | 8 días (dato del responsable, 3-nov); sin punto exacto; no cubre adjuntos; restauración nunca probada | `docs/operacion/04-RESPALDOS-Y-RESTAURACION.md` |
| Respaldo lógico por tenant | Script de operador; escribe una carpeta local | Lo que decida quien lo corre | `ops/backup-restore/` |

## 2. Brechas reales

1. **No hay eliminación al terminar la relación.** No existe función, ruta ni script que borre un tenant completo: casi todas las claves hacia `organizations` son `on delete restrict` (56 explícitas en las migraciones contra 4 `cascade`) y no hay ninguna rutina de baja de organización. Lo que sí hay es el borrado por entidad y el catálogo de 153 tablas con alcance de tenant de `ops/backup-restore/scopes`, que serviría de base.
2. **No hay devolución al terminar.** El único exporte por tenant es el respaldo lógico de operador. No hay exporte de autoservicio de todos los datos.
3. **No hay baja de personas usuarias.** No existe borrado de cuenta Auth ni de membresía con borrado de sus preferencias y suscripciones. La revocación de equipo existe; el borrado de datos personales de esa persona, no.
4. **`team_audit`, `vexa_platform.audit` y los asientos del ledger no tienen purga**: son de solo inserción. Eso sirve a la seguridad, pero implica conservación indefinida salvo decisión.
5. **Storage no entra en el respaldo** (`04-RESPALDOS...`). Una eliminación de adjuntos es inmediata y definitiva; la contrapartida es que un adjunto perdido no se restaura.
6. **No hay purga automática por antigüedad** de conversaciones ni pedidos cuando no hay una acción del Administrador.
7. **Copias de respaldo lógico fuera de la nube**: sin declaración de dónde viven ni cuándo se borran.
8. **El cron de retención de seguridad y los de Storage** dependen de aplicación manual por Javier; su estado en producción no consta.

## 3. Propuestas de plazo (PROPUESTA, sujeta a aprobación)

| Concepto | Plazo propuesto | Por qué | Cómo se cumple hoy |
|---|---|---|---|
| Datos del cliente durante la relación | Los que el cliente configure con la política de retención | Ya existe | Panel de retención |
| Exporte al terminar | A solicitud escrita del cliente, dentro de los 60 días siguientes | No existe exporte de autoservicio; lo entrega el operador | Manual: respaldo lógico del tenant entregado por canal seguro |
| Eliminación de sistemas activos tras terminar | A solicitud escrita del cliente, dentro de los 60 días siguientes | Margen operativo para una rutina manual | **Manual** por el operador: rutina de baja basada en el catálogo de tablas; brecha 1 |
| Respaldos del proveedor | Se sobrescriben solos; 8 días | Dato real | Automático del proveedor |
| Registros de seguridad | 180 días | Ya en código | Cron por activar |
| Cuenta de persona usuaria tras la baja | Supresión o bloqueo previa solicitud y sin demora indebida; sin cifra de días | No hay baja de personas usuarias en el producto; no se promete un plazo | **Manual** del operador; brecha 3 |
| Auditoría de equipo y administración | Mientras dure la relación y lo que exija la ley; sin cifra pública | El código no la purga; no prometer una cifra | n/a |
| Confidencialidad posterior | 3 años | Práctica corriente; el abogado decide | Contractual |

Lo que el aviso dice: exporte y eliminación a solicitud escrita del cliente dentro de los 60 días siguientes, mediante un procedimiento manual del operador; respaldo 8 días; seguridad 180 días; cuentas de personas usuarias previa solicitud y sin demora indebida (sin cifra). El aviso no promete exporte de autoservicio ni baja automática de personas usuarias. Si Javier o el abogado cambian una cifra, se cambia en `apps/web/src/content/sitio/paginas/legal.ts` en español e inglés y se repite `node --test tests/sitio/legal.test.mjs`.

## 4. Qué no se implementó y por qué

El borrado integral de un tenant toca más de 150 tablas con claves `restrict`, trabaja con datos de cliente y es irreversible. Escribirlo sin una base real de ensayo y sin revisión de Javier sería inseguro; no lo estimo «pequeño y seguro». Queda descrito como brecha. Siguiente paso propuesto, como tarea aparte: `ops/offboard-tenant/` con modo de ensayo por omisión, que recorra el catálogo de `ops/backup-restore/scopes` en orden topológico de claves, exija `--confirm <tenant>` y un exporte previo verificado por hash, y se pruebe contra el Postgres local de las pruebas de respaldo.

## 5. Antes de publicar el aviso con estos plazos

1. Aprobación escrita de Javier y del abogado de las cifras de la sección 3.
2. Una rutina manual de baja documentada y ensayada una vez en local (brecha 1). El texto ya está ajustado a «a solicitud escrita, dentro de 60 días» por procedimiento manual, sin cifra automática.
3. Activar y verificar el cron de registros de seguridad, o quitar la frase de 180 días.
4. Confirmar con el panel de Supabase los 8 días de respaldo y el plan.

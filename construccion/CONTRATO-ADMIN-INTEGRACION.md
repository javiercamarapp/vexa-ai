# Contrato de integración de plataforma — propuesta coordinada

2026-09-19. Ampliación autorizada en AMPLIACION-SUPERADMIN.md. Este acuerdo reconcilia propuestas UI/SQL incompatibles; NO acepta tareas, migra bases ni habilita gasto/envíos. Requiere tests de contrato UI→RPC→SQL y revisión independiente antes de adopción.

## Identidad y transporte

- Sesión verificada existente; grant de plataforma activo, permissions_version y MFA cuando require_mfa. Owner de tenant no equivale a admin.
- Firmas públicas invariables: `platform_admin_overview_v1(p_section,p_filter,p_cursor,p_limit)` y `platform_admin_action_v1(p_action,p_input,p_expected_version,p_idempotency_key)`.
- SECURITY INVOKER, RLS, permisos mínimos, revalidación dentro de transacción. Nada de SQL/shell ni llamadas a proveedor desde payload.
- Secciones públicas: overview, organizations, costs, brain, prospects, backoffice. jobs/audit pueden conservarse como aliases internos explícitos, sin sustituir las seis vistas.
- GET devuelve `{state:'ready'|'empty'|'partial'|'stale',as_of:ISO8601,rows:Row[],next_cursor:string|null}`. Cada Row tiene id y provenance. Versiones expuestas son enteros JSON seguros, comprobados antes de convertir bigint interno; no strings ni redondeos. No datos/configuración/DB fallida se distinguen; fallo no devuelve vacío.
- Cursor: base64url sin padding, saltos de línea ni espacios, hasta512caracteres. Su contexto usa filtros semánticamente normalizados: explicitar from/to idénticos a effective_window no cambia el contexto. No se firma un JSON crudo distinto para la misma ventana.
- Filtros: tenant_id opcional, from/to UTC emparejados, from<to, máximo366d. Costes añade plane/category/model/provider/agent opcionales validados. Sin ventana, resolver explícitamente mes UTC actual hasta as_of y devolver la ventana efectiva. Cursor acotado ligado a sección/filtros/ventana resuelta/identidad/permissions_version; nunca concede acceso. limit1..100. Totales globales no se calculan sobre una página.

## Costes

- Ledger exacto de reservas/intentos/liquidaciones es única fuente; no otro contador.
- Row: id,tenant_id,plane,category,model,provider,agent,window_start,window_end,currency,exponent,settled_minor,reserved_minor,uncertain_minor,provenance. `agent` puede ser null si no está atribuido: mostrar desconocido, nunca inventarlo.
- Importes string entero/null. Para microUSD: currency=USD,exponent=6. NO llamar centavos a microUSD, convertir a Number ni perder precisión. La UI muestra explícitamente exponente/unidad o formatea mediante strings/BigInt.
- Liquidado confirmado, reservado y retenido incierto son conceptos distintos; no sumar proyección al ledger. Gasto total desconocido no se presenta como cero. Ausencia de filas produce empty sin total financiero ficticio.
- Filtrar ventana y agrupar por organización/plano/agente/modelo/proveedor/rubro. Incertidumbre no se libera por TTL. Kill-switch se comprueba también inmediatamente antes de iniciar intento ya reservado; no promete retirar efectos ya autorizados.

## Acciones y aprobación

- POST HTTP conserva Origin/CSRF, allowlists, JSON limitado, Idempotency-Key UUID y expected_version. Recibo RPC `{status:'applied',version:entero_seguro_positivo,audit_id:string}` sólo después del commit real. Versiones internas bigint se convierten únicamente si son enteros seguros; rechazar desbordamiento, nunca redondear.
- `prospect.update`: `{id,status,notes,owner_id,next_action}`. Estados comunes new/qualified/proposal/won/lost/paused. Consentimiento/fuente/retención existentes se preservan; no outreach implícito. owner válido del directorio administrativo, no UUID arbitrario. Otros comandos internos de prospectos conservan contratos documentados aparte.
- `brain.set_enabled`: `{id,enabled}`. id es slug del catálogo (cost_review/health_review/prospect_retention_review), no UUID. Deshabilitar tiene efecto inmediato. Habilitar crea solicitud durable pendiente con acción/input/versión/hash/actor; no ejecuta todavía. UI dice «Solicitar activación», no afirma que el worker quedó habilitado.
- `backoffice.approve`: `{id,reason}` aprueba una solicitud concreta pendiente vigente; la transacción valida actor/grant/MFA, hash/input/versión y consume aprobación de forma idempotente. No se exige por este acuerdo un segundo humano, sí una decisión explícita durable previa al efecto.
- `backoffice.kill_switch`: `{id,enabled,reason}`. id/version son de la AUTOMATIZACIÓN, no del job ni de la aprobación. Filas backoffice que permitan pausar incluyen automation_id y automation_version segura; el formulario usa ese destino. Solicitudes de aprobación conservan su propio UUID/version para backoffice.approve. enabled=true significa kill-switch activo (ejecución pausada), NO automatización habilitada. Quitar pausa no concede aprobación de un cambio pendiente. Brain muestra configuración y backoffice solicitudes/ejecuciones con heartbeat/historial.
- Misma clave/mismo input retorna mismo recibo; input/versión diferente da409. Cambio+auditoría+registro idempotente son una transacción. Ningún recibo inventado ni éxito por mero HTTP200.
- Organizaciones/prospectos son entidades de plataforma; consumidores CRM no reciben accesos, roles ni notificaciones. Conversión pendiente no se presenta como organización creada.

## Verificación obligatoria

SQL real propio: grants/MFA/revocación/autoasignación; ledger exacto y ventanas/agentes; pausa entre reserva e intento; aprobación/lease/fence/CAS/replay/rollback; privacidad de tablas y ausencia de APIs de autogrant. UI: contrato por seis secciones/cuatro acciones, importes con exponent6, errores no-vacío, borrador conservado con refresh exitoso y borrado ante denegación. Integración autenticada/CSP/refresh y proveedores externos siguen siendo verificaciones separadas.

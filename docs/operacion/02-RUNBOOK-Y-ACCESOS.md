# Operación y accesos antes de producción

## Propietarios mínimos
Producto/comercial: socio fundador por confirmar documentalmente. Tecnología: Javier (rol propuesto CTO). Datos: administrador CRM del cliente. Finanzas: responsable que valida importe/base/tarifa. Privacidad/legal: cliente + asesor aplicable. Ningún agente asume que puede firmar por ellos.

## Runbooks
### Ingestión detenida
Mostrar last_success, cursor, job oldest age y error. Pausar conexión si credencial revocada; reparar acceso por owner. Reanudar desde checkpoint deduplicado. Reconciliar counts por día/canal; no marcar «sin problemas» si feed ciego.

### LLM/embeddings caído
Aplicar breaker, respetar presupuesto e intentos. Fallback sólo modelo/ruta compatible con schema/privacidad. Mantener último snapshot con stale. No publicar análisis parcial como completo ni costo de intento incierto como cero.

### Cifras discrepantes
Congelar publicación económica del snapshot afectado, conservar IDs/versions, reproducir test con inputs minimizados. Revisar currency/horizon/dedup/reversal/join coverage. Corregir mediante nueva versión, no reescribir silenciosamente brief emitido. Aviso al responsable humano si ya se compartió.

### Sospecha de fuga
Parar jobs y acceso del tenant/ruta afectado; revocar credenciales implicadas con owner; preservar evidencia minimizada. Determinar alcance y notificación con legal. Repetir negativos de RLS/storage/vectores/cache/export antes de reabrir. No copiar base completa a laptops como «evidencia».

### Deploy y rollback
Preview con fixtures → smoke → migrations compatibles → aprobación → promoción → comprobar SHA servido y flujo. Migración de datos irreversible requiere plan/backup y revisión; rollback de frontend no revierte schema. Ensayar restore y tombstones antes de afirmar que hay recuperación.

## Panel operativo mínimo
Cola por etapa/edad/tenant, success/failure/partial, latencia p95, data freshness, coverage de IDs y órdenes, schema rejection, citas inválidas, distribución de problemas y drift, costo estimado/reportado/desconocido, rate limits, versión de modelo y policy. No logs con texto raw de clientes por defecto.

## Checklist de alta
Cuenta nominativa y MFA; organización y membresías; policy de datos aprobada; conexión read-only; muestra reconciliada; mappings/versiones; import de prueba; responsable de acciones; límites y monitoreo; procedimiento de soporte y revocación. Un botón OAuth exitoso no valida acceso a todos los datos prometidos.

## Checklist de baja
Revocar conexión y miembros, parar jobs/outbox, tombstones, eliminar datos/vectores/cache/exports según política, confirmar pendientes de backups/proveedores. Entregar evidencia mínima autorizada, no prometer borrar copias descargadas por terceros.

## Variables previstas (sin valores)
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY server-only (o nombres legacy verificados al crear proyecto), DATABASE_URL local/servidor, OPENROUTER_API_KEY, ENCRYPTION_KEY, HUBSPOT_* y ZENDESK_* sólo cuando se cierre auth, WORKER_AUTH_SECRET, APP_URL. No copiar env de Likida/Atiende. Las versiones SDK determinan nombres concretos y compatibilidad antes de implementar.

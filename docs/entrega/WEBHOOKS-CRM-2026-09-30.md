# Webhooks CRM entrantes —30-sep2026

El cambio añade recepción firmada de HubSpotv3 y Zendesk. Cada solicitud válida confirma un recibo durable y adelanta la sincronización existente; el importador conserva autoridad, checkpoints, deduplicación y cobertura del histórico. El cuerpo entrante no se incorpora como dato de negocio. Las cuentas y suscripciones reales siguen pendientes.

## Validación del alcance

-50escenarios locales del principal:32transporte,10PostgreSQL y8HTTP sobre Next.js/Auth/PostgreSQL reales locales. Proveedores con fixturesSYN.
-5escenarios nuevos del revisor401: vector oficial de HubSpot, vinculación Zendesk/fecha, cuota concurrente, revocación durante transacción y fallo500/backoff. No se suman tests padre ni repeticiones.
-Matriz externa ampliada:414escenarios (415tests incluyendo padre),0fallos/0skips; Storage/retrieval/aislamiento/revocación reales locales. Ocho mutantes introducidos y restaurados demuestran que las nuevas aserciones detectan pérdida de RLS, scopes, fecha, poda yFK.
-Lint y compilación Node22; hashes ejecutables ligados al freeze. Los fallos originales de prueba y del primer fingerprint están preservados y explicados en el recibo privado; no se atribuyen al despliegue.

Fuente producto: manifest19be5670c8df3c3eaf2b0677c36a8dbd163c63998e0d6874271abed3f618fba1. Control-plane: manifestd9fb0c0f94dbd09a639298b354dc54876abfbaf5f9df72b421ad011a8caee365. Revisión independiente401 APPROVED_SCOPED: manifest58b6789f919007bce65c9cc1be86d2851e66b1394b6483d25175ca11c2eed164, sin hallazgos. Diezarchivos de producto y seis de controles adoptados por hash. Composición canónica:32tests de transporte,24kernel/foundation y134controlador aprobados.

Guía: [configuración y recuperación](../../packages/connectors/WEBHOOKS.md). Requiere migración0040 aprobada y binding secreto del servidor. Desactivado por defecto; no arranca un scheduler, no habilita servicios externos ni elimina backoff/reconexión. Poda por actividad de10minutos, no TTL garantizado de conexiones inactivas.

## Estado de entrega

54/60técnicas,25formales, producciónfalse. Esta mejora cierra un hueco de integraciónCRM dentro de una fase ya contabilizada; no convierte por sí sola una de las seis fichas pendientes en terminada.401invocaciones acumuladas, sin reset; revisor401 autorizado al retomar la propuesta concreta400→401. El alcance de entrega previamente excluido permanece intacto.

Supabase: migración `20260930170847/vexa_0040_crm_webhook_receipts` aplicada por MCP; RLS/FORCE activos, tres políticas presentes, permisos por columna verificados y cero recibos. No accesos directos anon/authenticated/service_role. GitHub publicado y mergeado preservando autoría: `ad3736968091567b8c5e58d331206cc5ad6f8c84`; SHA remoto y autor/committer asociados comprobados. Vercel READY en https://vexa-ai.vercel.app sirve el mismo SHA; ocho archivos ejecutables subidos coinciden con la revisión independiente. El smoke completo anterior8/8 conserva b9ed3db; no se presenta como una nueva corrida de este cambio.

El advisor de Supabase no informó avisos sobre la tabla nueva. Sí conserva tres tablas internas sin políticas, tres RPC existentes SECURITY DEFINER accesibles al rol authenticated y protección de contraseñas filtradas desactivada. Son observaciones globales que no se silencian ni equivalen por sí solas a una fuga demostrada; no se cambiaron contratosRPC ni planes contratados. Referencias: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Comprobación remota del despliegue: login200, versión200/SHA exacto, POSTwebhook503con`CRM_WEBHOOK_CONFIGURATION_REQUIRED` y`private, no-store` (flagfalse), consumidorCRM sincredenciales401/no-store. Es verificación del artefacto y del estado desactivado: no recepción firmada con cuenta real ni nuevo smoke completo. No cron continuo, inferencia pagada o correos enviados.

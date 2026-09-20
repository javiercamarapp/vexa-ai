# Supabase VEXA — creado, aplicación aún no conectada

19-sep-2026. Usuario autorizó hasta **10 USD/mes adicionales**, sin cambio de plan ni extras.

- Proyecto: **vexa-ai**.
- ID: `pulstqwbzhquaiporcmf`.
- Región: `us-east-1`.
- Estado observado: **ACTIVE_HEALTHY**, por MCP y confirmado independientemente por CLI.
- API: https://pulstqwbzhquaiporcmf.supabase.co
- Dashboard: https://supabase.com/dashboard/project/pulstqwbzhquaiporcmf

## Aprovisionamiento verificado

MCP codex_apps consultó organización, proyectos y coste; la organización existente está en Pro. `get_cost` cotizó10/monthly. La moneda se corroboró en documentación oficial de [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute): Micro, aproximadamente10USD/mes. Tras aprobación del usuario se ejecutaron confirm_cost y una única create_project; get_project/get_project_url y listado posterior confirmaron exactamente un VEXA. No se modificaron los proyectos preexistentes.

El principal corroboró por `supabase projects list -o json`, exit0, filtrando sólo el nuevo ID: nombre/región/ACTIVE_HEALTHY coinciden. No se muestran claves, contraseñas, IDs de otros proyectos ni identificador de confirmación económica.

Es **coste cotizado**, no factura final ni un tope técnico de facturación configurado. No se autorizaron extras, upgrades, HA, otros proyectos o inferencia. El timestamp created_at remoto es anterior al reloj de la llamada; se preservó esa discrepancia y no se usa para inventar una hora de ejecución.

## Estado de integración

- Historial de migraciones leído por MCP: vacío.
- Preflight SQL de catálogo: bloqueado por `MCP tool call requires approval, but approval policy is never`.
- **Cero apply_migration; ningún DDL enviado.** No se intentó otro canal para eludir el control.
- Las cuatro migraciones locales0001–0004 son byteidénticas al commit aceptado009fd730810facd943bca548ee9e6ec7a7d55cb9. Su revisión completa y aplicación remota quedan pendientes de aprobación interactiva.
- No afirmar catálogo vacío sólo por historial vacío. Repetir preflight antes de escribir.

MCP asigna versiones timestamp: deberá registrarse un mapa archivo/hash/versión remota. No renombrar las migraciones locales ni ejecutar migration repair/db push para ocultar diferencias de historial.

Pendientes: permisos interactivos SQL, schema/RLS/Storage reales, Auth, credenciales propias y configuración de aplicación/Vercel, prueba E2E y operación. No se enviaron emails ni se crearon usuarios de prueba. **11/60** formales; crear infraestructura no incrementa el contador.

Informes y recibos originales se conservan localmente, incluidos bloqueos previos y el __pycache__ incidental del preflight; no se reescriben como aprobaciones. Esta nota pública es la síntesis del principal.

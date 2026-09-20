# VEXA — infraestructura comprobada, no desplegada

19 de septiembre de 2026. **11/60 aceptadas.** GitHub `main`: `8340d26e1c6463ed6ccd158ee2a6ed4d202bc987` al efectuar este preflight.

## Resultado

| Servicio | Observado | Pendiente |
|---|---|---|
| GitHub | MCP y CLI acceden a `javiercamarapp/vexa-ai`. Repositorio privado; commit y autoría `javiercamarapp` verificados. Actions desactivadas. | CI remoto y política de ramas. La consulta clásica de protección devuelve 404; no se inspeccionaron todos los rulesets. |
| Supabase | El conector `codex_apps` respondió a `list_projects` y `list_organizations`: tres proyectos visibles, ninguno identificado como VEXA. | Elegir un destino exclusivo autorizado y confirmar región, plan y coste. No demuestra inexistencia global. No se consultó ninguna DB cloud. |
| Vercel | CLI GET accede a `vexa-ai`: dominio `vexa-ai.vercel.app` verificado, cero deployments, cero variables y sin Git link. Node 24.x; framework/rootDirectory sin configurar. | Configuración monorepo, credenciales propias, compatibilidad Node y despliegue autorizado. Dominio verificado no significa aplicación funcionando. |
| OpenRouter | No hay herramienta OpenRouter expuesta ni `OPENROUTER_API_KEY` en el entorno autorizado comprobado. No se encontraron `.env*` de VEXA en las ubicaciones revisadas. | Clave exclusiva, límite de gasto, modelos y política de datos. No se ejecutó inferencia ni se verificaron saldo/cuenta. |

## MCP: éxito y limitaciones separados

El principal comprobó **ocho eventos reales `McpToolCall`** de la sesión del especialista, no sólo su informe:

- Completados: `github.get_repo`, `supabase.list_organizations`, `supabase.list_projects`, `vercel.list_teams` y dos `vercel.list_projects`.
- Fallidos: `vercel.get_project` —el schema anuncia `projectId`, pero el backend espera `idOrName`— y `vercel.list_deployments`, con 403.
- Vercel MCP devuelve una lista vacía aunque CLI accede al proyecto. No son capacidades intercambiables; no recrear un proyecto basándose en esa lista.

La conexión HTTP transitoria de Supabase con `read_only=true` **falló por AuthRequired: no access token**. Las lecturas exitosas vinieron de otro conector: `codex_apps`. No se acredita que la restricción de transporte del primero proteja al segundo. Se ejecutaron sólo lecturas de metadatos; no herramientas de escritura.

La configuración global project-scoped de Supabase se preservó. No se usó ese project-ref como supuesto destino de VEXA. No se instalaron MCPs ni se efectuaron nuevos logins.

## Evidencia y siguiente acción

Consultas CLI GET: repositorio/commit/permisos de Actions en GitHub; `/v9/projects/vexa-ai`, sus domains/env y deployments por ID en Vercel. JSON filtrado en memoria: variables reducidas a nombres, sin valores. No se copiaron secretos, identificadores ni nombres de otros proyectos al informe público.

Los eventos sanitizados están en `private/f02-infra-mcp-tool-receipt.json` —evidencia local, no publicada—. Informe original preservado en el worktree del especialista; su recibo sigue bloqueado por ruta de escritura distinta de la prevista, no por un resultado cloud negativo. Esta síntesis es del principal.

Para continuar cloud se pidió al titular identificar el proyecto Supabase o autorizar uno exclusivo **sin nuevos cargos**, además de una clave OpenRouter por canal seguro y presupuesto. No crear, desplegar, activar Actions o consumir inferencia suponiendo que el coste es cero. El trabajo local independiente continúa.

Después: instalar schema/Auth/Storage aceptados en el destino autorizado; configurar y probar Vercel; decidir y verificar consumidor durable/alarmas; conectar OpenRouter con presupuesto; ejecutar E2E, aislamiento, recuperación y CI remoto con SHA/run_id. Ninguno de esos pasos está acreditado por este documento.

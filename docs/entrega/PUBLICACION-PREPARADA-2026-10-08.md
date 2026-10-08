# Preparación de publicación — 8 de octubre de 2026

**Fuente exportada e historial inspeccionado; publicación y despliegue no ejecutados.** Corte de fuente `73fb9f390ba28d91389a425965f04520e689f4d4`. Los cambios posteriores de documentación deben revisarse por separado. Respecto al candidato comprobado `6e8b2b4203f948408171612080b0bc62fadc19be`, sólo cambia el inventario de release con su prueba y README dentro de `apps/` y `packages/`; también se amplió su control externo. La aplicación y SQL no cambian: se reutilizan sus pruebas con la atribución original.

## Comprobado

- `orchestration.publisher.inspect_tree` pasó en los 350 commits originales, en 75,241 segundos. La corrección se inspeccionó después, comprobando que era el único commit añadido: 351 alcanzables cubiertos. Se invocó únicamente la inspección: no `publish_git` ni `publish_vexa`. Comprueba rutas sensibles, tipos de archivos y los tres patrones de credenciales definidos por el publicador; no es un detector exhaustivo de secretos.
- Exportación mediante `git archive` del SHA exacto: 3.297 archivos, 52.060.160 bytes, SHA256 `d38fb8e857e61e3dec2519b164dc41778afdff5b00f05c231a4445659275fa7f`. Inventario por archivo y rutas cotejadas con el árbol Git; sin rutas privadas, `.env`, enlaces ni submódulos. Archivo privado fuera del repositorio, sin subir.
- Manifiesto de fuente generado con Node22.23.2 y checkout limpio. Conserva `status:blocked`, responsables y destino sin confirmar, siete evidencias de release pendientes. Generarlo no concede aceptación F08-01 ni autorización de producción.
- GitHub, lectura 11:11 UTC: repositorio público, no fork, Actions desactivado, `main` en `b0be6df86a2aad53f46bb6054e192c94d62b13e3`, sin protección y sin rulesets. El 404 se identificó expresamente como `Branch not protected`.
- Vercel, lectura 11:12 UTC: proyecto propio `vexa-ai`, Node22, raíz `apps/web`, comandos de instalación/build y fuentes externas coincidentes con la propuesta. `gitProviderOptions.createDeployments` está `enabled`; la respuesta no contiene `link`, por lo que no se acredita una conexión Git ni una exclusión de rama. El cron existente `/api/internal/crm` sigue configurado cada cinco minutos. No se modificaron ajustes ni cron.

Recibos y límites: [JSON público](PUBLICACION-PREPARADA-2026-10-08.json). Originales privados en `~/.codex-work/rovaq-cierre-20261007/publication-preparation-20261008/`; ningún valor de entorno se guardó en esta documentación.

## Hallazgo corregido y comprobado

La revisión independiente del manifiesto encontró 41 de 43 migraciones: el filtro de cuatro dígitos omitía `20260930224057_platform_administration.sql` y `20261004061000_member_reusable_plan.sql`. Ambas están en la exportación íntegra. Se conserva el manifiesto original y su revisión FAIL. La corrección `73fb9f3`, preparada en un candidato separado e integrada después de revisión independiente sin hallazgos, incluye las 43 migraciones y sus hashes. La regresión reprodujo dos fallos con el generador anterior y pasó 7/7 con el corregido; el control rechaza el manifiesto que conserva sólo las 41. El orden es lexicográfico del inventario, no el historial aplicado del destino. No se ejecutó ni se amplió el ensayo histórico segmentado `managed-postgres.test.mjs`; no se afirma que las 43 se hayan aplicado juntas. No hay aceptación de release ni ejecución SQL.

## Condiciones antes de ejecutar

1. Completar aceptación y revisión aplicables, autorización concreta del destino y efectos de despliegue, recuperación gestionada y condición de URLs Storage previas. No declarar revisión global `entireRelease:true` desde la auditoría parcial de 20 rubros.
2. Releer Actions, protecciones/rulesets e integración Vercel inmediatamente antes de publicar. Actions desactivado no demuestra que Vercel no haga un build. No desactivar servicios ni añadir exclusiones por cuenta propia.
3. Usar exclusivamente `publish_vexa(root, allow_public=True, allow_actions=False)` desde el supervisor y con sus condiciones cumplidas. El publicador vuelve a inspeccionar todo el historial del SHA que realmente se vaya a publicar; esta exportación no autoriza commits posteriores.
4. La propuesta de PR obligatorio sigue sin aplicarse: requiere primero adaptar y revisar el publicador y CI para PR. El flujo vigente hace fast-forward y push directo a main; instalar la propuesta ahora lo bloquearía.
5. Preparar el build con su SHA real, inspeccionar bundle/traces de Vercel y desplegar sólo al destino autorizado. Verificar SHA servido, smoke autenticado, operación y rollback compatibles. El archivo exportado no es un bundle Vercel probado.

El [runbook](RUNBOOK.md#7-preparación-de-release-publicación-y-rollback) contiene los comandos y la secuencia. No se ejecutó el publicador como supuesto modo de prueba: **no tiene dry-run**. El estado formal permanece 28/60; esta preparación no cambia el grafo.

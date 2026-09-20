# F01-05 — CI local verificable, no ejecución remota

## Alcance y frontera

CI inicial de main revisado: push main y workflow_dispatch sobre main, dos checkouts por SHA del evento, cuatro jobs reales y permisos contents:read. No PR/forks ni promesa de sandbox contra código hostil. Referencia JSON válida como YAML; esquema cerrado. Ningún run_id remoto se inventa. Actions sigue desactivado y requiere autorización/presupuesto separados.

El candidato F01-05 sólo puede cambiar `.github/workflows/ci.yml` y `package.json`. Los gates, soporte, registro y grafo se revisan/congelan antes de prepare. Registro authored mantiene product_pass=false: describe presencia, no aceptación.

## Portabilidad y fallos conservados

- El Auth anterior dependía de ChromeMac y Supabase compartido. Nuevo adaptador usa DB/Auth/REST/Storage/Mailpit/Chromium propios, UUID, imágenes ARM precargadas, DB sin puerto publicado y cleanup por dueño. PKCE/Mailpit sigue real; no se sustituyó por password login.
- Dos primeras llamadas agotaron900s: propuestas parciales, no verdes. EACCES en next-env.d.ts procedía de copiar permisos0444 al scratch; sólo se habilita escritura en copias temporales. La ruta RECOVERY del mailer debía ser /auth/v1/verify. Los errores de infraestructura no matan mutantes.
- Auth recibió revisión independiente: gate7/7, oráculos5/5, firma1/1, nueva ejecución con fuente0444 y negativos propios de PKCE/señales/puertos/recursos ajenos.
- El ejecutor aplica herramientas reales y gates confiables. Se reprodujeron sano→TS2322→sano y sano→SQL42601/READ_A:conversations:a→sano. No glob vacío, recursión F01-05, skip crítico ni prueba del candidato usada como autoridad.

## Revisión del conjunto: cuatro jobs verdes NO bastaron

Primera revisión combinada reprodujo control24+110+7, web build/API200, SQLpreflight+168 y Auth7+UI3, pero rechazó tresP2:

1. Un JWT service_role sintético e inutilizable en public/ se servía por HTTP200 mientras web-quality quedaba verde.
2. Timeout124 terminaba Node sin ejecutar finally; sobrevivían DB/red propios.
3. SIGTERM al launcher dejaba hijo vivo y ningún receipt.

Se conservaron árbol rechazado y reproducciones. No se borraron pruebas ni se reinterpretaron esos resultados como aceptación.

### Correctivos

- Guardia de artefactos públicos/Next/chunks/mapas y respuestas HTTP con canario server-only. Revisión independiente reprodujo sano0→service_role público1→sano0, negativo propio de canario backend y restauración. JWT anon permitido; TS2322 sigue rojo. No certifica JS de navegador, solicitudes calculadas ni ausencia universal de secretos.
- Broker con journal0600, registro anterior a creación, etiquetas/nombres/IDs propios y verificación de ausencia. Timeout124 y cancelación143/130 conservan recibos; cleanup fallido bloquea. No sweep de prefijos ni borrado de recursos compartidos.
- Browser F01-04 se creó fuera del primer journal: principal reprodujo BROWSER_NOT_JOURNALED, corrigió su registro/label/cierre y pasó una prueba con el navegador real cuyo controlador fue terminado. No cambió oráculos de UI.
- copyBuildInputs produce scratch escribible conservando fuente0444; rechaza symlinks, destinos solapados y sobrescritura. TDD y siete pruebas, sin chmod del candidato.

## Revisión conjunta aprobada; aceptación todavía pendiente

Revisión final y recheck reconciliaron M10 con lifecycle:669archivos/fingerprints intactos, cuatrojobs completos, lifecycle12/browser/policy8 y24recursos propios retirados. Aprobación explícita sólo CI local, sin P0–P2. Un primer fixture carecía de metadataGit (git ls-files128); se preservó como error de preparación y se repitió el examen íntegro sin editar código.

Pendientes: congelación, prepare/verify/accept limpio y publicación. No confundir propuestas o cuatro jobs locales con aceptación F01-05. SHA y estado final se registran en PROGRESO.md.

No probado: Ubuntu/GitHub remoto, x64, TLS/Google OAuth real, SIGKILL del launcher o caída del host. Los journals permiten recuperación supervisada; no son un recolector persistente. No se autoriza gasto, cloud ni proveedor real por escribir este gate.

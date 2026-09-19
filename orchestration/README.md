# Construcción reanudable con Astra/Codex

## Estado real
Controlador local implementado; pruebas unitarias/integración con proceso Codex simulado. E00 tiene gate ejecutable del kernel económico. **54 tareas posteriores están especificadas pero sus gates de aceptación todavía no están escritos**. El controlador las bloquea, no da un PASS por encontrar un Markdown. No existe un bucle de meses corriendo ni un SaaS desplegado. Consultar PROGRESO.md para recibos de ejecución real adicionales.

## Grafo y roles
`graph.json`: 55 tareas, E00 + 54 microtareas de F00–F08; deps explícitas, allowlist de escritura, prompt, objetivo individual, gate y aprobación. `docs/blueprint/F*.md` describe fase completa. El prompt contextualiza la fase pero CURRENT TASK ONLY limita al objetivo individual. Una microtarea aún excesiva se divide antes de ejecutar; 15 minutos no bastan para construir un CRM completo.

Un solo writer por vuelta evita conflictos de archivos. Roles lógicos, no 55 procesos paralelos:
1. **Controlador/arquitecto**: mantiene contratos/gates y revisa diff. No autocalifica documentación como software.
2. **Implementador Codex/Astra**: trabaja en worktree, sólo allowlist de la tarea.
3. **Verificador determinista**: tests fuera del worktree que apuntan a VEXA_CANDIDATE; devuelve exit code y evidencia.
4. **Revisor independiente**: contexto limpio, evalúa spec/seguridad contra diff y vuelve a correr comandos. No basta consenso de modelos.
5. **Operador humano**: datos/contratos/precios/cuentas/producción y aceptación explícita.

No es necesario instalar un framework de agentes para comenzar. Grafo+estado+CLI+gates resuelven secuencia y reanudación; se añade paralelismo sólo si merece su costo y las escrituras son disjuntas.

## Skills por trabajo
- Alcance/plan: writing-plans, plan-en-disco, nivel-de-arquitectura.
- Contrato financiero: test-driven-development, evidencia, conjunto-dorado.
- Bugs: depuracion-sistematica; rendimiento medible: diagnosing-bugs.
- UI/flujo: webapp-testing/browse, qa y qa-design-review sólo con runtime real.
- Integración y release: preflight-agente, review, segunda-opinion, ship sólo tras permiso de push/deploy.
- Bucle y checkpoints: bucle-trinquete, goal-writer, handoff.
Leer cada SKILL.md al activarla; lista no significa que todas se hayan ejecutado. MCPs no necesarios para aritmética/tests locales. MCP cloud con proyecto concreto y permisos mínimos sólo en fase interactiva autorizada.

## Contrato de control
**Métrica:** cumplimiento de criterios externos congelados y cero regresiones críticas; dirección creciente. Nº archivos/commits/tokens no es progreso. Pasar E00 no implica pasar F01 ni gold humano.
**KEEP:** proceso terminó 0, cambios sólo permitidos, baseline/control intactos, gate externo pasa, candidato no cambia durante pruebas/commit, revisión y accept explícito. Todos auto_accept=false al entregar.
**REVERT:** nunca incorporar candidato fallido; conservar worktree y logs para diagnóstico. No usar reset --hard/clean sobre el baseline ni borrar trabajo ajeno.
**Presupuesto:** default una vuelta/30 minutos de sesión; máximo 15 minutos por worker, gate ≤5 minutos, 2 intentos por tarea. CLI permite 1–30 vueltas y 1–480 minutos, concurrencia=1. Autenticación Codex ChatGPT; entorno no hereda API keys. Suscripción tiene límites, no se promete uso ilimitado.
**Agotamiento:** 2 fallos en misma tarea, gate faltante, dependencia no aceptada, aprobación, guard, STOP o presupuesto. Guard/bloqueo detiene; error de worker conserva baseline. Dependencia fallida no se marca satisfactoria.
**Crash:** estado se guarda atómicamente antes de worker. Si queda running tras terminar proceso, reintento usa el siguiente intento y conserva worktree anterior. Antes de reanudar confirmar que no hay worker huérfano. No existe rescate perfecto ante SIGKILL del controlador: detener proceso huérfano autorizado y revisar worktree.
**STOP:** `touch .runtime/STOP` impide comenzar siguiente vuelta; no interrumpe instantáneamente la actual. Ctrl-C del controlador termina grupo del worker al capturar interrupción. Timeout mata grupo de procesos. Nada queda ejecutándose indefinidamente por diseño.

## Comandos
```bash
cd ~/vexa
npm test
npm run test:controller
npm run graph:check
codex login status                # debe decir Logged in using ChatGPT
python3 orchestration/runner.py run --max-rounds 1 --max-minutes 5
# Leer .runtime/*-agent.log y *-gate.log, inspeccionar diff con baseline/worktree de state.json.
python3 orchestration/runner.py accept --task E00
```
Requiere Git inicializado y checkout controlador limpio/committed. No configurar API key de OpenAI/OpenRouter para este bucle. `--ignore-user-config --model gpt-6-astra --sandbox workspace-write` evita heredar un provider configurado para API. Login se comprueba antes de invocar workers. No usar --dangerously-bypass-approvals-and-sandbox.

`accept` comprueba que HEAD de baseline/candidato no cambió, vuelve a correr gate y hace fast-forward; si cambió el baseline, NO forzar merge. Volver a revisar/crear candidato desde nuevo baseline con control de estado, conservando evidencia anterior. La primera versión no tiene comando automático reset/rebase: esa recuperación es operada, no silenciosa.

## Preparar las siguientes tareas
1. Sesión interactiva escribe `tests/acceptance/Fxx-nn.test.mjs` desde contratos/gold sintético y revisa expected/observed. Debe evaluar ruta VEXA_CANDIDATE, no importar por accidente el código baseline. Debe fallar con implementación rota/ausente y rechazar nulos/fugas según alcance.
2. Preparar dependencias locales y fixture DB necesarios. Worker del bucle no tiene permiso de red, cloud ni compras; tareas de documentación/contratos/externos se resuelven interactivamente con permiso, no cambiando un flag para simularlas.
3. Revisar allowlist y tamaño de tarea. Archivos raíz package/lock/CI se agregan explícitamente por el controlador cuando sean necesarios; ahora no están autorizados genéricamente. No dar '*' para evitar pensar.
4. Hacer commit de gates/revisión y snapshot de estado. Incorporar sólo cambios revisados; no editar attempts/status para hacer aparecer PASS. Si se rearma estado por baseline nuevo, archivar state anterior/logs y documentar motivo.
5. Validar con un paso acotado. No habilitar auto-accept para migraciones/datos/producción; todas las tareas de entrega requieren aprobación.

## Límites de seguridad y verificación
Worktree no es VM: comparte .git y el host; hashes detectan cambios pero no evitan una lectura/exfiltración hostil. Sandbox de Codex limita escritura/red, no convierte programas de tests externos en código seguro. Para riesgo adversarial real usar VM/contenedor desechable sin credenciales y sin mounts de otros repos. Esta primera implementación es para agentes cooperativos con errores, no malware.

Gate externo no significa criterio perfecto; un test pobre puede aprobar código malo. Revisión independiente, pruebas de mutación, DB real de ensayo y E2E siguen siendo obligatorias. Secrets disponibles mediante archivos de HOME no se vuelven inaccesibles porque se limpien variables. NO correr con datos reales ni claves de producción montadas.

`create_build_graph.py` y `build_task_catalog.py` son generadores de preparación, no pasos de producción: regenerar graph sobre ejecución activa invalidaría estado/revisión. No ejecutarlos para 'arreglar' un bloqueo. Actualizar grafo deliberadamente y conservar historia.

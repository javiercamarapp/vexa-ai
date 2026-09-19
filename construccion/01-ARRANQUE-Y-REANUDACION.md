# 01 · Arranque y reanudación sin contexto de conversación

## Prompt para pegar a Astra/Codex en una sesión nueva

```text
Trabajas en ~/vexa, no en la copia del Escritorio. Construyes VEXA: inteligencia
verificable de posventa, conversaciones→problemas→dinero con evidencia→acciones
humanas→medición. Stack producto Next.js/TypeScript, Supabase, Vercel, OpenRouter;
para construir usa mi suscripción ChatGPT/Codex, no APIs pagadas.

Lee AGENTS.md, README.md, PROGRESO.md, docs/CONTEXTO-CANONICO.md y
construccion/README.md. Ejecuta python3 scripts/guide.py next y runner.py status.
No leas audios/transcripciones completos otra vez por falta de contexto; están
preservados y el contexto canónico da la interpretación con incertidumbres.

Trabaja SOLO la siguiente ficha del DAG. Si falta gate, estás en control-plane:
escríbelo desde los oráculos de esa ficha, prueba el rojo adecuado, pide revisión
y congélalo antes de abrir el candidato. No permitas al candidato tocar su prueba.
Si está prepared, retoma su worktree; no generes otro. Si está verified, revisa
y revalida antes de aceptar. Si running, confirma que no haya proceso vivo.

No actives cloud, datos Senix, conectores reales, envíos o producción por encontrar
una llave. No inventes aprobaciones. Registra bloqueo y continúa sólo lo local
permitido. Dos fallos requieren diagnóstico y recuperación supervisada. Al cerrar:
SHA, archivos, comandos/salidas, expected/observed, no verificado y siguiente paso.
```

## Paso 1 — Comprobar la ubicación y conservar el trabajo

```bash
cd ~/vexa
pwd
git status --short
git log -3 --oneline
git worktree list
python3 orchestration/runner.py status
python3 scripts/guide.py next
```

Si hay cambios sin commit, **no hacer reset ni clean**. Clasificarlos: propios, otro agente, usuario. Leer diff y decidir integración por separado. Si el checkout es copia de entrega sin `.git`, volver al canónico; no inicializar un segundo historial sobre la copia para simular continuación.

## Paso 2 — Convertir la ficha en un examen externo

Ejemplo (ID de ejemplo, usar el que `next` indique):

```bash
python3 scripts/guide.py packet --task F02-05
```

1. Leer contrato de job/lease en `03-CONTRATOS.md` y los oráculos específicos.
2. Escribir `tests/acceptance/F02-05.test.mjs` **en control-plane**. Debe apuntar al código de `VEXA_CANDIDATE`, no importar el baseline por accidente.
3. Preparar DB/worker de ensayo según el capítulo 04. Hacer fallar la prueba suprimiendo fence, y comprobar que el fallo es una publicación doble/obsoleta, no «no encontré psql».
4. Congelar expected/fixture/semilla, revisión y gate; actualizar registro y generar fichas. Hacer commit local revisado. No mover HEAD mientras un candidato está preparado.
5. Si el gate requiere más de cinco minutos, separar el incremento o usar carril de QA supervisado. No agrandar límites del constructor para tapar una tarea mal partida.

El grafo v3 **no autoriza al worker a crear gates**. La antigua tarea F00-05 que exigía gates de todo el SaaS antes del scaffold fue reemplazada por este protocolo justo a tiempo. El histórico v2 sigue en `orchestration/history/`.

## Paso 3 — Candidato interactivo (ruta universal)

```bash
python3 orchestration/runner.py prepare --task F00-01 --max-minutes 1
```

`prepare` imprime ruta de worktree y persiste `prepared`, sin llamar un modelo, sin copiar privados/credenciales, sin aceptar. Obtener la ruta del recibo:

```bash
export TASK=F00-01
export CANDIDATE="$(python3 -c 'import json,os; s=json.load(open(".runtime/state.json")); print(s[os.environ["TASK"]]["worktree"])')"
printf '%s\n' "$CANDIDATE"
git -C "$CANDIDATE" status --short
```

Editar únicamente ese worktree y su allowlist; no hacer commit allí. Se pueden repartir las ediciones en sesiones acotadas manteniendo el mismo `prepared`. El gate se corre desde el control-plane, no desde una prueba que el candidato se haya escrito a sí mismo.

```bash
VEXA_CANDIDATE="$CANDIDATE" node --test tests/acceptance/F00-01.test.mjs
python3 orchestration/runner.py verify --task F00-01 --max-minutes 5 \
  --approval-note 'Referencia real a la decisión del operador sobre preparación sintética'
```

**No copiar la nota como si fuera una aprobación real.** `--approval-note` registra una atestación textual, no autentica a una persona ni verifica un contrato. Para una tarea externa hay que hacer el acto y conservar evidencia antes de verificarla. El texto no concede permisos que no existan.

Si pasa, queda `verified`; nunca merge automático por este camino. Revisar `git diff <baseline> <candidate_commit>`, logs y expected/observed. Después:

```bash
python3 orchestration/runner.py accept --task F00-01 --max-minutes 5
python3 scripts/guide.py next
```

`accept` vuelve a ejecutar la prueba y comprueba firmas/HEAD antes del fast-forward. Cambiar contrato/gate/candidato después de preparar invalida el recibo. Si se rechaza un candidato verified, usar `reject` como se indica abajo; si está failed/blocked, `recover`. Nunca forzar el merge.

## Paso 4 — Worker offline, sólo con gate y entorno listos

```bash
codex login status
python3 orchestration/runner.py run --max-rounds 1 --max-minutes 20
```

Debe decir `Logged in using ChatGPT`. El worker usa `gpt-6-astra`, sandbox workspace-write y entorno sin API keys heredadas. No instala paquetes por red ni publica. Las tareas `requires_approval` van por la ruta interactiva. `run` selecciona la próxima elegible: no usar `--task` como selector de ejecución automática; ese selector es para prepare/verify/accept.

## Paso 5 — Qué hacer con cada estado

| Estado | Acción siguiente | Qué no hacer |
|---|---|---|
| pending + gate missing | Escribir examen protegido desde ficha, revisarlo y versionar | empezar worker sin examen |
| pending + deps pendientes | Terminar/aceptar dependencia | editar dependencias para saltarla |
| prepared | Retomar worktree registrado, luego verify | otro prepare encima |
| verified | Revisión limpia; accept revalida, o STOP + reject si se rechaza | editar y forzar merge |
| failed, intento 1 | Leer log, reproducción mínima; nuevo prepare conserva history; trasladar sólo patch permitido | borrar intento malo |
| failed, 2 intentos | Escalada y recuperación revisada | poner attempts=0 automáticamente |
| blocked por guard | Congelar evidencia, reparar causa fuera del candidato | quitar guard o modificar status |
| running huérfano | Inspeccionar PID/grupo/worktree; detener sólo proceso identificado y autorizado | relanzar a ciegas |
| accepted | Siguiente dependencia elegible | reejecutar fase ya aceptada para producir commits |

**Recuperación supervisada de failed/blocked:** primero preservar evidencia, confirmar que no hay procesos vivos y corregir la causa en control-plane. Con checkout limpio, gate revisado y dependencias aceptadas:

```bash
touch .runtime/STOP
python3 orchestration/runner.py recover --task F00-01 \
  --approval-note 'REFERENCIA REAL: causa revisada y nuevo ciclo acotado autorizado'
# Revisar history: recover deja pending/attempts=0 y conserva intentos/worktrees.
# Sólo tras revisión del operador:
rm .runtime/STOP
```

Esto abre explícitamente un presupuesto NUEVO de dos intentos y registra recovery_count; no es un reintento infinito automático. No sirve para accepted/verified/prepared/running ni acepta nada. Running huérfano sigue necesitando investigación y recuperación del control revisada; no se transforma ciegamente a failed. No hay auto-rebase. La nota de ejemplo no es autorización real.

### Rechazo después de verify

Si el revisor pide corregir un candidato `verified` (incluso si ya se editó por error o falla el recheck), **no aceptarlo ni falsear estado**:

```bash
touch .runtime/STOP
python3 orchestration/runner.py reject --task F00-01 \
  --approval-note 'REFERENCIA REAL: revisión rechazada, causa y nuevo ciclo autorizado'
# Revisar history, commit/worktree original y logs conservados.
# Tras autorización, retirar STOP y preparar un candidato NUEVO.
rm .runtime/STOP
python3 orchestration/runner.py prepare --task F00-01 --max-minutes 1
```

`reject` sólo admite verified; no reabre accepted/prepared/running. Archiva el recibo anterior y abre pending con dos intentos explícitamente nuevos. Llevar manualmente sólo la corrección permitida al nuevo worktree y repetir verify/revisión/accept. No hace auto-rebase ni borra el candidato rechazado. Un recibo verified antiguo sin firma completa también requiere este camino.

Los logs de prepare, worker, gate, verify y cada recheck tienen ID único. El recibo guarda nombre y SHA256 al cerrar esa ejecución; history conserva las referencias. Recuperar o repetir un recheck no sobrescribe la salida anterior.

## Pausa / cierre

```bash
mkdir -p .runtime
touch .runtime/STOP
```

Impide siguientes vueltas; no interrumpe instantáneamente la actual. Ctrl-C del controlador intenta terminar el grupo del worker. Procesos que se desligan del grupo requieren inspección del host. Retirar STOP sólo después de revisar recibos/procesos; conservar motivo en handoff. No dejar un bucle indefinido abierto en Terminal.

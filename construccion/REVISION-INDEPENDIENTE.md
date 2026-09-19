# Revisión adversarial independiente de la guía VEXA

**Veredicto global: REQUIERE CORRECCIONES para construcción GUIADA.** La guía tiene contratos, encargos y bloqueos externos suficientemente concretos para orientar la construcción; no la rechazo por los 47 gates futuros ni por no existir todavía el SaaS. La rechazo por dos defectos reproducibles del controlador que rompen continuidad/integridad y un tercero que pierde evidencia de recuperación. No se hicieron correcciones en esta pasada.

Revisión con contexto limpio respecto de la implementación previa, sin delegación, red, instalaciones ni APIs. Se aplicó `construccion/07-RUBRICA.md` sin cambiarla. Las reproducciones usan repositorios Git temporales y CLI Codex simulado; ninguna ejecuta run/prepare/verify/accept/recover sobre `.runtime` real. Se escribió únicamente este reporte como entregable.

## Veredicto por los seis criterios

| Criterio | Veredicto | Evidencia y límites |
|---|---|---|
| 1. Cobertura ejecutable de especificación | **Apto para construcción GUIADA**, en alcance documental | Catálogo autorado de 55 IDs; 55 fichas coinciden exactamente con `packet`, catálogo JSON coincide con fuente, audit sin errores y outputs declarados dentro de allowlists. Contratos de entradas/efectos/oráculos/recuperación específicos. Esto no prueba que cada futuro gate sea adecuado ni que todas las decisiones de implementación estén cerradas. Fuente: `scripts/construction_catalog.py:9`, `scripts/guide.py:13`. Los fallos del ciclo común se califican en 2/3. |
| 2. Continuidad | **Requiere correcciones** | H1: revisión que rechaza un candidato verified no tiene transición soportada para corregirlo. H3: recuperar reinicia numeración y sobreescribe logs. `runner.py:204`, `runner.py:262`, `runner.py:268`. |
| 3. Integridad del control | **Requiere correcciones** | H2: ruta run acepta evidencia basada en archivo ignorado que no existe en el baseline aceptado. La protección más estricta de prepare/verify no está aplicada a run/accept. `runner.py:105`, `runner.py:390`, `runner.py:411`. |
| 4. Pruebas con señal | **Apto para construcción GUIADA**, para los gates presentes examinados | Kernel 12/12, preparación y negativos 12/12, cinco mutaciones aritméticas fallan por aserción. F00 se rotula preparación, F01-01 falla realmente por scaffold ausente, F05-01 se limita al kernel. Los 47 missing son bloqueo JIT explícito. No se aprueban sus futuras pruebas ni se infiere producto desde JSON. H2 afecta promoción, aunque el gate de la reproducción tiene una aserción real. |
| 5. Punta a punta del negocio | **Apto para construcción GUIADA**, como ruta especificada | Auth/RLS, cola/consumidor, dos adaptadores, evidencia, dinero, ocho vistas, intervención, restore, release y entrega aparecen en fichas y contratos. El transporte alojado sigue pendiente de spike explícito (`03-CONTRATOS.md:15`); F07/F08 exigen actos y evidencia externos. No se acredita desplegar, cobrar, tener gold humano o demostrar causalidad. |
| 6. Comparación y entrega honestas | **Apto para construcción GUIADA en la comparación; entrega pendiente/no revisada** | Muestreo directo de L3/L4/L5/R1 abajo, sin revalidar producción Likida. No se declara equivalencia de madurez. La copia al Escritorio y walkthrough real se harán DESPUÉS: no fueron ejecutados ni aprobados aquí, y no se convierten en defecto de esta revisión por estar fuera de su alcance. |

## Hallazgos

### H1 — P1: un candidato verified rechazado por revisión queda sin ruta de corrección

**Archivos:** `orchestration/runner.py:173`, `:204`, `:262`, `:330`; `construccion/01-ARRANQUE-Y-REANUDACION.md`, apartados «Paso 3» y «Recuperación supervisada».

La revisión independiente sucede después de verify. Si descubre un defecto no cubierto por el gate y pide corregir el candidato, accept rechaza la modificación, verify sólo admite prepared, prepare no sobrescribe verified y recover sólo admite failed/blocked. El recibo permanece verified. Lo mismo impide invalidar formalmente un candidato rechazado incluso antes de editarlo. La guía indica reabrir mediante recuperación revisada, pero el comando no permite ese estado.

**Reproducción observada:** prepare → editar valor correcto → verify → revisión pide cambio → editar candidato → accept/verify/prepare/recover. Salida:

```text
accept Candidate changed after verification
verify Task is not prepared
prepare Existing candidate requires review/recovery; not overwritten
recover Recovery only for failed/blocked; investigate running processes separately
state verified
```

**Efecto:** el flujo normal de revisión→corrección no puede continuar con los comandos documentados. Restaurar el candidato rechazado para aceptarlo no corrige el defecto. Manipular state.json o cambiar el controlador ad hoc tampoco es la ruta guiada prometida.

**Corrección necesaria:** transición explícita y supervisada de rechazo/invalidez de verified, que preserve commit, worktree, firmas, revisión y logs, y permita nuevo intento verificado con presupuesto definido. Probar rechazo humano y recheck fallido; no agregar aceptación forzada. El caso running huérfano sigue siendo una limitación declarada y distinta.

### H2 — P1: run → accept puede aceptar un baseline que falla su propio gate

**Archivos:** `orchestration/runner.py:105-114`, `:117-120`, `:330-350`, `:390-412`. Comparación con guardia interactiva en `:216-223`.

changed_paths y candidate_signature omiten archivos ignorados. run no los rechaza ni guarda verified_signature, y accept sólo aplica la firma interactiva cuando existe. Un gate que consume un artefacto generado/ignorado puede pasar en el worktree y en su recheck, aunque ese artefacto no llegue al commit aceptado.

**Reproducción sintética:** archivo versionado `packages/demo/value.txt=bad`; `.gitignore` contiene `*.scratch`; gate externo lee `value.scratch` si existe y si no lee `value.txt`, exigiendo `good`. El worker escribe únicamente `value.scratch=good` dentro del directorio permitido, sin cambiar controles, Git ni gate. run declara «existing behavior passed; no patch» y accept acepta el baseline original.

```text
run status= verified
accept status= accepted
baseline source= bad baseline generated exists= False
accepted baseline same gate exit= 1 assertion failure= True
```

**Efecto:** falsa aceptación reproducible por divergencia entre inputs probados y contenido promovido. Representa el error ordinario de validar un build generado o artefacto residual; no requiere malware, modificación del examen por el worker ni escapar del sandbox. No afirmo que los ocho gates actuales sufran todos este defecto: se demuestra una propiedad incorrecta del controlador anunciado para gates futuros. Un buen gate que reconstruye desde fuentes reduce el riesgo, pero no sustituye la guardia de integridad prometida.

**Corrección necesaria:** aplicar a run/accept las mismas garantías sobre ignorados, modos, symlinks y contenido promovido que al camino interactivo, o verificar una exportación limpia del commit a promover. Añadir regresión cuyo baseline recién extraído también pase el gate; el fixture anterior debe bloquearse. No se exige VM ni defensa contra código hostil.

### H3 — P2: recovery conserva history/worktrees, pero destruye logs de intentos anteriores

**Archivos:** `orchestration/runner.py:75`, `:195`, `:210`, `:268`, `:335`, `:385`, `:403`.

recover reinicia attempts a cero; los worktrees usan time_ns y son únicos, pero logs usan sólo task+attempt (recheck ni siquiera incluye intento). run_bounded abre con `wb`; prepare también reemplaza su archivo. Tras recuperar, el intento 1 vuelve a escribir `A-1-verify.log`, `A-1-agent.log` o `A-1-gate.log`. history conserva metadatos, no una copia del log.

**Reproducción observada:** intento interactivo 1 falla; guardar sus bytes; STOP → recover autorizado → quitar STOP → nuevo prepare/verify correcto.

```text
old failure log overwritten= True
old tree preserved= True
history retained= 2
old log failed= True
replacement log failed= False
```

**Efecto:** el registro histórico ya no permite recuperar la salida original del fallo que motivó la recuperación. También se sobrescribe la evidencia de rechecks sucesivos. Contradice la preservación de logs prometida por la guía, aunque los worktrees sí sobreviven.

**Corrección necesaria:** ID único de ejecución/ciclo e intento en TODOS los logs, incluido recheck; guardar paths/hashes en cada recibo y no sobrescribirlos. Probar dos ciclos con primer intento homónimo y comparar conservación byte a byte.

**P0:** ninguno confirmado en este alcance. No se evaluó seguridad contra malware.

## Reproducción ejecutable de H1/H2/H3

Ejecutar desde el canónico. Reutiliza sólo el arnés existente; éste crea repositorios propios temporales y limpia al terminar. No modifica los tests ni el runtime real. Se ejecutaron los tres casos y se observaron las salidas anteriores.

```bash
PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
import sys, os, subprocess
from pathlib import Path
sys.path.insert(0, 'tests/controller')
from test_interactive import InteractiveTests

def invoke(c, *args):
    try:
        c.invoke(*args)
        return 'OK'
    except (Exception, SystemExit) as e:
        return str(e)

c = InteractiveTests(); c.setUp()
try:
    p = c.prepare_good(); c.invoke('verify', '--task', 'A')
    (p/'packages/demo/value.txt').write_text('review correction')
    for command in ['accept', 'verify', 'prepare']:
        print('H1', command, invoke(c, command, '--task', 'A'))
    (c.root/'.runtime/STOP').touch()
    print('H1 recover', invoke(c, 'recover', '--task', 'A',
          '--approval-note', 'Review rejected implementation; correction needed'))
    print('H1 state', c.state()['status'])
finally:
    c.doCleanups()

c = InteractiveTests(); c.setUp()
try:
    (c.root/'.gitignore').write_text('.runtime/\n*.scratch\n')
    (c.root/'tests/gate.mjs').write_text(
        "import fs from 'node:fs';import path from 'node:path';"
        "import assert from 'node:assert/strict';"
        "const r=process.env.VEXA_CANDIDATE;"
        "const generated=path.join(r,'packages/demo/value.scratch');"
        "const source=path.join(r,'packages/demo/value.txt');"
        "assert.equal(fs.readFileSync(fs.existsSync(generated)?generated:source,'utf8'),'good');")
    c.commit_controller()
    c.worker("Path('packages/demo/value.scratch').write_text('good')")
    c.invoke('run', '--max-minutes', '1'); print('H2 run', c.state()['status'])
    c.invoke('accept', '--task', 'A'); print('H2 accept', c.state()['status'])
    p = subprocess.run(['node', '--test', str(c.root/'tests/gate.mjs')],
        env={**os.environ, 'VEXA_CANDIDATE': str(c.root)}, capture_output=True, text=True)
    print('H2 baseline gate', p.returncode, 'ERR_ASSERTION' in p.stdout+p.stderr)
finally:
    c.doCleanups()

c = InteractiveTests(); c.setUp()
try:
    c.invoke('prepare', '--task', 'A'); invoke(c, 'verify', '--task', 'A')
    log = c.root/'.runtime/A-1-verify.log'; before = log.read_bytes()
    oldtree = c.state()['worktree']
    (c.root/'.runtime/STOP').touch()
    c.invoke('recover', '--task', 'A', '--approval-note', 'Reviewed failure; new cycle')
    (c.root/'.runtime/STOP').unlink()
    c.prepare_good(); c.invoke('verify', '--task', 'A')
    print('H3 overwritten', before != log.read_bytes(), 'old tree', Path(oldtree).exists())
    print('H3 assertions before/after', b'ERR_ASSERTION' in before,
          b'ERR_ASSERTION' in log.read_bytes())
finally:
    c.doCleanups()
PY
```

## Comprobaciones y salidas reales

| Comando/comprobación | Resultado observado |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1 python3 -W error::ResourceWarning -m unittest discover -s tests/controller` | Exit 0; **66 tests**, 25.173 s, OK. Incluye Git/worktrees y worker simulado. H1/H2/H3 no estaban cubiertos. |
| `npm test` | Exit 0; kernel **12 passed**, foundation/negativos **12 passed**. No ejecuta scaffold ni 47 gates futuros. |
| `npm run test:scaffold` | Falla: 1 test, 0 pass, ENOENT `apps/web/package.json`. Bloqueo esperado, no señal de producto terminado. |
| `python3 scripts/guide.py audit` | `errors: []`, 55 tasks, 55 cards, 8 gates disponibles, 47 missing. |
| `python3 scripts/guide.py readiness` | Exit 2; `ready:false`, `product_verified:false`, 47 missing. |
| `python3 scripts/guide.py next` | Ficha **F00-01**, dependencia E00, gate PRESENT; no inicia worker. |
| `python3 -B orchestration/runner.py status` | Exit 0; E00 accepted attempts=1; F00-01 y posteriores pending. Es lectura de recibos, no nueva validación del E00 histórico. |
| Comparar catálogo JSON y 55 fichas con fuente/packet, en memoria | `catalog_matches True`, `cards_match True`. |
| Comparar IDs de graph-v2-before-guided y graph v3 | 55/55, misma secuencia de IDs. No afirmo identidad de todas sus propiedades. |
| Cinco mutaciones de `probe_economics_mutations.py`, ejecutadas individualmente en temporales propios | unknown-as-zero, duplicate-events-counted, reversal-added, precision-lost, scenario-overstated: **exit=1 y ERR_ASSERTION en los cinco**. Hash del kernel coincide con RESULTADO-MUTACION. No ejecuté main del script porque escribe logs en private/. |

El comando compuesto de scaffold/audit/readiness terminó con exit 2 de readiness; la salida de scaffold está documentada como fallo, sin atribuir ese 2 a scaffold. `test:all-gates` no se ejecutó: se inspeccionó su expansión en package.json; no se considera verde por `npm test`.

## Compensaciones válidas y pendientes que no son hallazgos

- Gates JIT fuera del candidato son un mecanismo razonable: la guía no necesita fabricar 47 PASS ni implementar el SaaS para cerrarse. Audit es estructural, no demuestra adecuación semántica de futuros tests.
- F00 verifica preparación sintética/fixtures y F05-01 reutiliza kernel; no se anuncian Auth, SQL, UI o permisos legales validados por ellos. Los futuros gates deben ejercer la app y sus lectores, no sólo archivos de estatus.
- Approval-note es atestación del operador, no autenticación ni validación legal. Está declarado; no se reporta como bypass jurídico.
- Arquitectura de consumidor alojado, accesos reales, gold humano, piloto y permisos de producción siguen abiertos y rotulados. No encontré en lo leído una autorización para resolverlos por inferencia.
- Worktree no es VM; no se probaron procesos deliberadamente desligados ni código malicioso. El presupuesto por comando tampoco demuestra plazo global estricto para toda operación de Git/IO.
- PROGRESO conserva cifras históricas de 23 tests/54 missing; se usaron las salidas actuales y la entrada de construcción para el corte de esta revisión. No se presentan esas cifras históricas como inventario actual.

## Alcance leído y no leído

Leído: rúbrica; README/PROGRESO/contexto canónico; entrada y capítulos 00–06 (05 como índice y catálogo autorado completo); runner y los cuatro módulos de tests del controlador; guide.py y construction_catalog.py; foundation, gate de scaffold, package.json y programa de mutaciones; referencias Likida y resultado de mutación. Se verificó en memoria la coincidencia de todas las fichas y catálogo generados y se inspeccionaron dependencias/allowlists de los 55 IDs. Gates F00/economics y fixtures se ejercitaron mediante sus suites; no se afirma inspección manual exhaustiva de cada línea de todos ellos o todos los JSON/blueprints originales. La comparación con grafo v2 se limitó a IDs y a la explicación documentada del cambio.

Muestreo directo permitido de Likida, exclusivamente Markdown y lectura:

- **L3** `~/Desktop/Documentos Likida/16-Blueprint-de-Construccion/00-PROMPT-SIGUIENTE-SESION.md`: líneas **1–85**.
- **L4** misma carpeta, `fase-1-primer-cliente.md`: líneas **46–118**.
- **L5** `~/Desktop/Documentos Likida/13-Agentes-de-AI/10-Ingenieria-y-Producto/qa-autonomo/encargo-fase-1.md`: líneas **45–136**.
- **R1** `~/likida/docs/conocimiento/plan-de-cierre.md`: líneas **1–90**.

El muestreo confirma exigencias de lector real, errores explícitos, casos negativos, semilla/evidencia y distinción entre construcción, producción y trámite humano. **No releí L1/L2/L6/L7/L8, los rangos restantes ni toda Likida.** Las cifras/estados históricos de los MD no se verificaron hoy contra producción y no fundamentan certificación de madurez equivalente.

No leído/ejecutado: private/, .env, credenciales, originales/transcripciones, datos de clientes, otros archivos Likida, servicios remotos, instalaciones, app/DB/browser de VEXA, deploy/restore real. No hubo commit/push/deploy sobre VEXA. **Copia al Escritorio y walkthrough real: pendientes y no revisados.** No se inspeccionó visualmente GUIA-COMPLETA.html ni se auditó cada enlace de entrega.

## Identificación del corte

HEAD observado: `197b95c11dccc61b0a6e0dc1e77043af0dc4c6f9`. Había cambios y archivos nuevos previos a la revisión; **este SHA no identifica por sí solo el paquete revisado**. Hashes SHA-256 de archivos centrales al cierre:

```text
orchestration/runner.py          9eb8263b1790da615b9d8ef2349e00bdfa0277e86c4211eb38af4936d2cf8f67
orchestration/graph.json         030ae5186d7e3a09f5a789c4c4dc36208b938dabcdabf0eb9b25f6ab67c68244
scripts/construction_catalog.py 22b1d491c391cf0d4335925871534e1a308af2b387bad6625c4fd9fdacb6b420
scripts/guide.py                 9ccf0907b616ca0f2fd739287dff9a58750fe1bc6abe0de544a9f2d4796e079f
construccion/07-RUBRICA.md        bbd5dd397bca773238603d1916fd81a710d0cee0b95a044bfc9a2bced7f5d8d3
```

Para levantar este veredicto hacen falta correcciones de H1/H2/H3 y sus regresiones; no hace falta desplegar el SaaS ni escribir todos sus gates para aprobar la guía. La copia y walkthrough conservan su validación posterior separada.

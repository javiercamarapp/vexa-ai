# Revisión final acotada del parche

**Veredicto: REQUIERE CORRECCIONES para CONSTRUCCIÓN GUIADA.** Se pueden levantar H1 y H3; no todos los bloqueos del primer informe: persiste una variante reproducible de H2. Revisión local con Codex/ChatGPT, sin red/APIs ni delegación, dentro de cinco minutos. Una suite y una reproducción adicional en repositorios temporales propios; ninguna acción sobre el runtime real. Único archivo escrito en el proyecto: este reporte.

| Hallazgo original | Estado | Evidencia del parche |
|---|---|---|
| H1 P1 | **Resuelto en el alcance revisado** | `runner.py:268–290,329–333`: reject admite sólo verified, exige STOP/nota, checkout limpio, gate y dependencias aceptadas; archiva recibo y permite un ciclo nuevo sin aceptar ni borrar worktree. Regresión de rechazo→corrección→verify→accept y negativas pasan. Guía corregida coherente. |
| H2 P1 | **No resuelto por completo** | Caso original de ignorados corregido (`runner.py:410–417`); firma obligatoria y recheck antes/después presentes (`:350–367`). Sin embargo, una firma del worktree no garantiza que Git promueva sus permisos: H2b abajo. |
| H3 P2 | **Resuelto en el alcance revisado** | `runner.py:93–102`: nombres únicos por ejecución y SHA256; los recibos conservan referencias históricas. Pasan conservación byte a byte tras recover, worker de ciclos sucesivos, rechecks repetidos y comprobación de hashes. |

**H2b — P1, variante cercana reproducida: se acepta un baseline que falla el gate por permisos no promovidos.** El worker modifica únicamente el archivo permitido, escribiendo `good` y aplicando `chmod(0600)` antes de la verificación. Un gate externo exige contenido correcto y permisos 0600. Tanto gate como recheck pasan sobre el candidato; Git conserva el bit ejecutable, pero no esos permisos completos. El fast-forward deja el archivo del baseline con 0644 y lo marca accepted. El mismo gate falla allí y su firma difiere del recibo.

Ubicación: `runner.py:142–157` firma modos completos; `:424–445` valida/commitea el mismo worktree; `:352–370` vuelve a comprobar ese worktree y promueve sin comprobar una materialización limpia. No requiere malware, hooks ni modificación del examen por el worker. No afirmo que los gates actuales del SaaS dependan de 0600; reproduce el defecto del mecanismo de promoción. La regresión nueva de modos sólo cambia permisos DURANTE el gate, por lo que no detecta este caso anterior al gate.

Corrección necesaria: verificar el contenido y modos efectivamente materializados desde el commit antes de promover, o rechazar explícitamente las diferencias de permisos que Git no puede transportar. Comprobar después de aceptar sería demasiado tarde para impedir la falsa aceptación. No se implementó ningún cambio.

## Comandos y salida real

Única suite (variable para impedir archivos __pycache__ en el proyecto):

```text
PYTHONDONTWRITEBYTECODE=1 python3 -W error::ResourceWarning -m unittest discover -s tests/controller
Ran 76 tests in 32.456s
OK
exit 0
```

Reproducción adicional ejecutada con `PYTHONDONTWRITEBYTECODE=1 python3 -W error::ResourceWarning -`, usando este cuerpo; el fixture sustituye ROOT y CLI Codex por un repositorio y un ejecutable sintéticos temporales:

```python
import sys, os, subprocess
from pathlib import Path
sys.path.insert(0, 'tests/controller')
from test_runner import ControllerIntegrationTests, r
c = ControllerIntegrationTests(); c.setUp()
try:
    gate = c.root/'tests/gate.mjs'
    gate.write_text(c.gate + 'assert.equal(fs.statSync(f).mode & 0o777, 0o600);')
    r.git(c.root, 'add', '.'); r.git(c.root, 'commit', '-qm', 'mode contract fixture')
    c.worker("Path('packages/demo/value.txt').write_text('good'); Path('packages/demo/value.txt').chmod(0o600)")
    c.invoke('run', '--max-minutes', '1')
    print('run_status=', c.state()['status'])
    candidate = Path(c.state()['worktree'])
    print('candidate_mode=', oct((candidate/'packages/demo/value.txt').stat().st_mode & 0o777))
    c.invoke('accept', '--task', 'A')
    print('accept_status=', c.state()['status'])
    print('baseline_mode=', oct((c.root/'packages/demo/value.txt').stat().st_mode & 0o777))
    result = subprocess.run(['node','--test',str(gate)], env={**os.environ,'VEXA_CANDIDATE':str(c.root)}, capture_output=True, text=True)
    print('baseline_gate_exit=', result.returncode, 'assertion=', 'ERR_ASSERTION' in result.stdout+result.stderr)
    print('baseline_signature_matches=', r.interactive_signature(c.root)==c.state()['verified_signature'])
finally:
    c.doCleanups()
```

```text
run_status= verified
candidate_mode= 0o600
accept_status= accepted
baseline_mode= 0o644
baseline_gate_exit= 1 assertion= True
baseline_signature_matches= False
```

El reproductor terminó con exit 0; el gate del baseline terminó con exit 1. **No hay otros P0/P1/P2 nuevos confirmados en esta pasada.**

## Corte y límites

HEAD: `197b95c11dccc61b0a6e0dc1e77043af0dc4c6f9`; por sí solo no identifica los archivos revisados. SHA256:

```text
27811ff3fe06a195c360d1eb8333e9bb27ecd03ed12fb83917f8af02baa9628a  orchestration/runner.py
5356b6235daa30c88de88c084211823a197f4d9f9173841b6be97b1c9b626c2b  tests/controller/test_review_regressions.py
c40d680b3bedf15ba420b040750fd3b4b3b92365b3d6dcfb557c54afb7e7fc64  tests/controller/test_runner.py
308233f5bd4e8a47685621eef3b03db473dca9608fb4364796e5c319a2390319  tests/controller/test_interactive.py
```

Leídos: rúbrica, correcciones, informe independiente para sus hallazgos y límites, runner, regresiones, fixture y apoyo interactivo, guía de arranque corregida. Se localizaron usos del arnés en los demás tests para comprobar su aislamiento. No se rehízo investigación documental ni la revisión de las 55 fichas; permanecen los límites originales de los criterios 1/4/5/6. No leído: private/ real, credenciales, originales, datos de clientes ni otros repositorios. Los fixtures de privacidad de la suite son sintéticos.

No probado/certificado: SaaS, cloud, 47 gates futuros, producción, aislamiento hostil, autonomía ilimitada, walkthrough real, copia al Escritorio ni equivalencia de producto con Likida. No hubo cambios de código/gates/grafo/estado, commits ni despliegues en VEXA. El informe anterior queda intacto.

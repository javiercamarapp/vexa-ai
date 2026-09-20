# F01-05 — correctivo local de timeout/cancelación

19-sep-2026. Sólo autoría correctiva; NO aceptación. Siguen 10/60.
SHA base/control: `84219b0f9cead62f23945d001b3404677efd5c3a`.
Sin commit candidato, Git modificado, push, Actions, cloud, descargas ni gasto.

## Causas preservadas y reproducción roja

Revisión original inmutable:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-independent-47_e0nfx/review.json`.
`timeout-db.mjs` importaba launch() de la fuente rechazada, ejecutaba PostgreSQL
real y esperaba dentro de try/finally. `execute(..., timeout=15)` devolvía 124;
DB/red sobrevivían porque terminar Node no ejecuta ese finally. SIGTERM al
launcher terminaba Python (-15), dejaba al hijo en otra sesión y no había receipt.

Reproducción nueva anterior al parche: `python3 -B /tmp/f0105-red.py`, exit0 del
reproductor (dos defectos observados, NO producto verde). Evidencia0600:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-lifecycle-red-tgvjpubn/result.json`.
DB propia `vexa-f01-03-c2c63058-2721-4d78-bc9e-88408566ca6a-db` y su red
sobrevivieron al timeout124; launcher -15, hijo vivo, receipts=[] tras SIGTERM.
El reproductor retiró sólo esos recursos y su hijo; fuente rechazada intacta.

## Mecanismo

- Launcher instala manejadores INT/TERM que registran cancelación sin lanzar
  excepciones durante Popen. Cada comando usa una sesión/grupo propio; se envía
  TERM, se concede gracia de dos segundos y después KILL al grupo, incluidos
  descendientes. No se recolecta al líder durante la gracia para evitar la carrera
  de ownership del grupo. No se reclama contención de descendientes maliciosos
  que abandonen la sesión; contrato de main revisado, no sandbox hostil.
- Launcher crea journal JSONL0600 y broker UUID, persistentes en TMP0700. Infra
  F01-02/03/04 registra tipo/nombre UUID/broker ANTES de crear contenedor o red,
  con fsync; Docker recibe etiqueta `vexa.ci.broker`. No se registran env,
  contraseñas, URLs de DB, sesiones ni claves.
- Hooks normales y recuperación externa inspeccionan exclusivamente nombres
  registrados, comprueban nombre y etiqueta, validan ResourceID y borran por ID.
  Contenedores primero, redes después; se comprueba ausencia posteriormente.
  No hay listado/borrado por prefijo ni acceso a vexa-local compartido.
- Journal malformado se rechaza completo antes de borrar; daemon inaccesible no
  equivale a ausencia. Ownership distinto permanece intacto y bloquea cleanup.
  Journal y comandos no se borran: recuperación fallida conserva el rastro.
- Exit timeout124; cancelación143/130; nunca PASS por cancelación o limpieza
  fallida. Comandos0600 y receipt0600/fsync registran cleanup, señal, duración,
  salida y estado. Si falla el cierre de procesos se conserva el error de cierre
  en el comando y se intenta igualmente la recuperación Docker.
- Variables VEXA_CI_JOURNAL/BROKER sólo viajan al soporte control. La whitelist
  existente de buildEnvironment sigue excluyéndolas; no se cambió esa función.

## Verificación

`python3 -B tests/acceptance/support/F01-05/lifecycle.test.py`:
12 casos dirigidos: DB real sin puertos publicados y red; timeout; INT/TERM al
launcher real con recibo persistido; nieto que ignora TERM y libera su socket;
cierre normal F01-03 y F01-04 (DB solamente); vecino contenedor/red con otra
etiqueta preservado; journal malformado; daemon fallido; cleanup bloquea exit0;
señal antes/durante Popen; variables fuera del entorno de build.

Primera tanda completa verde: 12/12, 30.436s, exit0, artefactos:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-lifecycle-green-n1_qwiim`.
Tandas intermedias conservadas: `wb9cux3g` detectó respuesta específica
`network NAME not found`; `tdu7zhbv` encontró ps bloqueado por sandbox (se
sustituyó por comprobación de PID/socket, sin elevar permisos); `ji72r5um`
detectó una carrera al recolectar líder durante gracia. No se cuentan como verdes.
`r0tsd5fx` pasó las aserciones pero una inspección adicional halló
process_cleanup_verified=false en la carrera de Popen (EPERM de grupo zombie
bajo sandbox macOS); no se usa como cierre verde. Corrección: recolectar líder
y reintentar la señal; sólo ESRCH permite declarar ausencia. EPERM persistente
sigue siendo fallo, nunca ausencia implícita.

Recheck FINAL con esa aserción y DB no publicada: **12/12, 33.840s, exit0**.
Artefactos0600 y hashes de los siete archivos de código:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-lifecycle-green-9j_b32ye/`.
`final-checks.json`: process_cleanup_verified=true en todos los comandos,
fingerprints estables, recibos0600, PID previo ausente y puertos56327–29 libres.
`evidence.json` enlaza ambos recibos de señales y los comandos reales.
Recheck final policy: **8/8, 3.114s, exit0**.

`python3 -B tests/acceptance/support/F01-05/policy.test.py`: 8/8, exit0.
Checks sintácticos Node/Python y `git diff --check`: exit0. Puertos56327–29
comprobados libres; no se ocuparon puertos Auth/UI5757x. Comparación byte a byte
contra fuente rechazada: diferencias exclusivamente dentro de los ocho paths
allowlisted (incluido este informe); oráculos y producto intactos.

## Pendientes reales

- Revisión independiente y gates completos F01-02/03/04 combinados posteriores.
  No ejecutados en esta vuelta acotada; ni Auth/UI ni SQL preflight de servicios.
- `F01-04/harness.mjs:64` crea directamente un contenedor browser, fuera de
  services.mjs y de esta allowlist. Ese recurso NO participa todavía del journal.
  No afirmar cancelación completa del job UI: requiere correctivo separado
  autorizado a ese archivo, más prueba real. No se alteró ese harness.
- No se probó bootstrap Ubuntu/Actions, daemon realmente detenido (su fallo usa
  stub rotulado), SIGKILL al launcher/caída del host ni código malicioso.
  Los journals quedan disponibles para recuperación supervisada, no hay daemon
  de recolección posterior a la muerte del launcher.
- M10 corresponde a otro correctivo; este trabajo no resuelve ni acepta aquel
  hallazgo. Cuatro jobs anteriores verdes no sustituyen aceptación ni estos checks.

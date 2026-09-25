# F08-02: ejecución externa y examen corto

El launcher usa exactamente los cuatro módulos públicos del CLI revisado, copiados desde el **controlador** a una carpeta privada nueva. Nunca importa el ejecutor ni las pruebas del candidato. El candidato debe tener `HEAD` de40hex, todo el árbol comprometido y limpio, sin archivos nuevos ni banderas de índice `assume-unchanged`/`skip-worktree`. La revisión servida se comprueba por HTTP antes de mutaciones. Las ocho fases conservan los oráculos de `docs/entrega/SMOKE-REMOTO.md`.

## Autoridad y custodia

El supervisor coteja la autorización real del operador con el destino, revisión, tenants SYN y operaciones; ninguna variable, JSON, MAC o recibo concede autorización humana. El controlador, clave, challenge, dependencias de navegador y entradas deben estar bajo custodia del supervisor y fuera del alcance de edición del candidato. La clave es un archivo regular0600 de32bytes aleatorios **fuera de ambos checkouts**. No se publica ni se entrega a workers. El HMAC prueba esa custodia local, no es una firma de un cliente ni prueba remota por sí mismo.

El supervisor crea un challenge0600 nuevo por intento, con este esquema (marcadores, no permisos reales):

```json
{"schema":"vexa-smoke-challenge-v1","nonce":"<64hex aleatorios nuevos>","candidateSha":"<HEAD40hex>","approvalReference":"<decisión real cotejada>","issuedAt":"<UTC ahora>","expiresAt":"<UTC menor de24h>"}
```

El JSON0600 `VEXA_SMOKE_GATE_INPUT` contiene rutas absolutas `key`, `challenge` y `receipt`. `receipt` debe ser una ruta nueva. El JSON0600 **separado** `VEXA_SMOKE_EXECUTION_INPUT` contiene rutas `release`, `authorization`, `config`, `workDirectory`, `playwrightDirectory` y, opcionalmente, `cdp`. Las tres primeras siguen SMOKE-REMOTO; `workDirectory` no existe todavía y estará en almacenamiento privado del supervisor, nunca en Git. `playwrightDirectory` apunta a la instalación de `playwright-core` preparada fuera del candidato; el launcher no descarga dependencias. CDP sólo loopback, conforme al CLI. El operador prepara Chromium compatible y registra su procedencia; un módulo arbitrario o una clave cedida al candidato rompe el modelo de confianza.

## Lanzar y recoger

Ejecutar **fuera** del grupo de proceso acotado del runner de construcción:

```sh
VEXA_CANDIDATE=/candidato \
VEXA_SMOKE_GATE_INPUT=/privado/gate.json \
VEXA_SMOKE_EXECUTION_INPUT=/privado/execution.json \
VEXA_SMOKE_APPROVAL_REFERENCE='<referencia real cotejada>' \
node /controlador/support/F08-smoke/launcher.mjs
```

El launcher copia las entradas a archivos0600 antes de ejecutar el CLI confiable. Espera el cierre del hijo incluso si falla la escritura inicial de su recibo de proceso; ese error conserva un resultado desfavorable. No aplica timeout ni `kill` al consumidor o CLI. El hijo está en su propio grupo. SIGTERM/SIGINT del launcher vuelve el resultado permanentemente desfavorable y espera que termine el CLI, incluidas compensaciones. No vuelve a emitir imports ni pausa para recuperarse de una señal. Las operaciones HTTP y controles conservan los límites del CLI. Matar todo el sistema o un grupo externo no garantiza compensación: consultar `process.json`, verificar el PID y las solicitudes pendientes, y hacer recuperación humana correlacionada antes de continuar. Un proceso padre terminado no demuestra que haya terminado el hijo.

`process-result.json` registra código/señal/error/interrupción. Sólo después de código0, sin interrupción, ocho fases válidas, hashes de capturas, jobs terminales, oráculos financieros/HTTP/revocación, fuente y challenge todavía vigentes, el launcher emite `receipt` con HMAC. Un `report.json` con `pass` por sí solo no basta. Un bloqueo de compensación no firma recibo favorable. La firma fija SHA del candidato, módulos, control, nonce, autorización declarada, hashes de entradas privadas, tiempos, reporte y artefactos. Las cookies no se copian a logs públicos. Todos los artefactos e inputs de ejecución quedan privados para custodia/borrado posterior explícito.

Después de recoger el launcher se ejecuta el examen corto:

```sh
VEXA_CANDIDATE=/candidato \
VEXA_SMOKE_GATE_INPUT=/privado/gate.json \
VEXA_SMOKE_APPROVAL_REFERENCE='<referencia real cotejada>' \
node --test /controlador/tests/acceptance/F08-02.test.mjs
```

El gate vuelve a autenticar y cotejar el recibo con el candidato y fuentes actuales; comprueba hashes/semántica de reporte y ocho capturas. **Exige `remote-authorized`**: la evidencia `local-synthetic-proof` no acepta formalmente F08-02. Nunca ejecuta remoto bajo el timeout del runner. No se necesita pasar cookies, authorization/config ni `VEXA_SMOKE_EXECUTION_INPUT` al runner.

Integración propuesta a `acceptance_environment`: F08-02 = `('VEXA_SMOKE_GATE_INPUT', 'VEXA_SMOKE_APPROVAL_REFERENCE')`, último valor derivado de `approval_note` real sólo para tarea con aprobación. El principal integra/revisa ese cambio, registro y ficha antes de preparar candidatos.

## Aceptación del mismo SHA

Este gate verifica comportamiento ya publicado en el SHA aprobado: la adopción de F08-02 debe ser **sin cambios de archivos en el candidato**. El recibo, el reporte remoto, las capturas y las entradas permanecen fuera del checkout bajo custodia privada. No añadir `docs/entrega/smoke-remote.json` durante `verify`: ese cambio produciría otro commit después del examen y el recibo anterior no podría aprobar su materialización limpia. El supervisor puede publicar después un resumen sanitizado mediante una operación separada, sin atribuir el smoke al SHA nuevo. El challenge vigente puede usarse para `verify` y su recheck de aceptación sobre el mismo SHA; un intento o revisión distintos necesitan un challenge nuevo. Las dependencias y aprobaciones formales siguen exigidas.

## Evidencia y pendientes

Los siete controles nuevos son pruebas del controlador; los reportes sintéticos firmados de esos tests **no son corridas del producto**. El caso CLI HTTP real falla por revisión incorrecta antes de UI/mutaciones; su adaptador de navegador nunca navega. No acredita las ocho fases de producto. Estas ya tienen evidencia local independiente351, conservada sin reatribuirla a un nuevo SHA o destino. Esta propuesta no ejecutó un destino remoto ni una nueva suite completa de producto.

Pendientes externos: manifiesto/destino compilado y autorizado, cuentas SYN/fixture financiero reales, Chromium de operador, consumidor y controles operativos legítimos, referencia humana cotejada, ejecución real completa en destino, recolección y revisión, dependencias del grafo y aceptación formal. Firma local no cambia estos pendientes. No se ha accedido al ámbito excluido de F06-09/299.

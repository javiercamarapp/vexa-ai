# Controles de base actualizados — fase 6

Base: `1aea895599a2aec72f56421cd62bc420b018ed8f`. Propuesta de control en worktree separado. No modifica producto, grafo, estado de aceptación ni manifiesto de capacidad. Ningún resultado local equivale a aceptación remota.

- F01-02 sustituye networkidle por la respuesta de navegación autenticada de cada POST, o por la llegada a login. Conserva autorización positiva, POST ajeno con nonce fresco, denegación por membresía, ausencia de canario, SQL inalterado, cookies corruptas/expiradas, revocación inmediata y back tras logout. La cookie válida puede recibir el redirect local actual hacia /overview; se exige allí200 y contenido autenticado. Una organización única se comprueba por shell/contexto, sin exigir un selector inexistente.
- F01-04 usa Navegación principal y abre por teclado el grupo Espacio de trabajo. Sigue exigiendo sus seis destinos exactos, query preservada, cursor eliminado, foco/Enter, ocho rutas y cuatro roles reales. La identidad única se observa mediante el contexto de organización, cookie activa y etiqueta exacta de rol. Los probes mutan sólo la copia del candidato actual; dejan de importar componentes de un runtime histórico absoluto.
- F01-05 alinea el workflow cerrado y el launcher con engines Node22.x estable. Conserva los cuatro jobs, disparadores/main, pins de acciones, permisos, tiempos y verificaciones. El recibo registra la versión exacta usada. No se habilita ni ejecuta Actions.
- F02-03 usa la navegación vigente y reconoce el mensaje actual de transporte fallido. El interceptor abort se retira en finally también si falla la aserción. Playwright se instala offline desde package+lock confiables de F01-02 en scratch propio y se elimina al terminar; no hay fallback a un temporal histórico.

Oráculos y límites funcionales anteriores conservados: F01-02 290s, F01-04 540s, F02-03 450s/launcher360s; esperas por operación iguales. No se cambia el contrato SQL ni se convierte fallo de sesión en éxito por un redirect cualquiera. Las pruebas del interceptor usan dobles de control sólo para comprobar cleanup, nunca como aceptación de UI/Auth.

Evidencia previa: `docs/entrega/FASE-1-LINEA-BASE-2026-10-07.md` y recibos inmutables `/private/tmp/rovaq-fase1-receipts-20261007` (auth-awake-v3, preview-selection-fix y manifests). Los originales fallidos permanecen fallidos; sus diagnósticos sirven para justificar el delta.

Calibraciones ligeras actuales:

```sh
node --test tests/acceptance/support/F01-02/oracles.test.mjs tests/acceptance/support/F01-04/dependency-oracle.test.cjs support/F06-final-base/interceptor.test.mjs
python3 -B tests/acceptance/support/F01-05/policy.test.py
python3 -B tests/acceptance/support/F02-preview/scratch.test.py
```

Rojo Node: `/private/tmp/rovaq-fase6-node-before.log` (contrato26rechazado pororáculo22). Verde: `/private/tmp/rovaq-fase6-node-policy-after.log`,9/9. Rojo interceptor: `/private/tmp/rovaq-fase6-interceptor-before.log`,1/1fallido contra fuente anterior por interceptor superviviente. Verde conjunto puro: `/private/tmp/rovaq-fase6-base-pure.log`,11/11; scratch3/3 en `/private/tmp/rovaq-fase6-preview-scratch.log`.

Pendientes al preparar esta propuesta: revisión independiente y ejecución coordinada de gates con Auth/SQL/Storage/Chromium reales; calibración de navegación/rol contra los componentes actuales; materialización integrada. No se atribuye verde pesado por unidades ni se cuenta una suite de paquetes como aceptación de estas rutas.

## Calibración focal del rol

La primera corrida del antiguo role-probe quedó FAIL: agotó la espera de respuesta HTTP de 10 segundos en el primer detalle del owner, antes de examinar analyst. No mató el mutante. Recibo privado `fase6-base-execution-v1.json` y log original conservados. El gate completo sí pasó previamente sus cuatro roles y ocho rutas.

La calibración revisada usa el modo explícito `role-probe`, sólo desde su caller de control. Observa una ruta (`/overview`) con Auth real de analyst: positivo original, mutación que fuerza owner rechazada por `AUTHORIZED_ROLE_PRESERVED expected=analyst`, restauración y positivo. Conserva la misma función de autorización, contrato HTTP/503 y espera de 10 segundos. Su alcance de rutas positivas por variante es 1 combinación frente a las 32 del gate completo, más acotado deliberadamente al defecto de rol; no reemplaza el gate completo ni sus ataques. Cada ejecución conserva el inventario de cuatro roles SQL y exige una consulta Auth real de analyst.

La entrada oficial fuerza `{mode:'routes'}` y conserva sus cuatro roles, ocho rutas, ataques y límites. Ninguna variable de entorno selecciona el modo reducido. `route-mode.test.mjs` comprueba el default completo, el argumento explícito, rechazo de modo desconocido y la entrada oficial bajo una pista de entorno hostil. Esta prueba es del control, no evidencia de UI real. La autoría no se presentó como aprobada: después de revisión del principal, la nueva corrida real pasó 1/1 en 62,52 s. Analyst positivo, mutante rechazado por la aserción exacta de rol y original restaurado positivo; tres logs separados, 16 recursos ausentes según el recibo y fuentes invariantes.

## Resultado local recogido

Con candidato limpio `1aea895` y Node 22.23.2: F01-02 7/7 (47,34 s), F01-04 3/3 (232,57 s), F02-03 31/31 hijas más entry 1/1 (76,16 s), calibración de seis mutantes 7/7 (65,81 s), calibración focal de rol 1/1 (62,52 s). Sin omitidas ni canceladas. El primer rojo de role-probe permanece conservado y no se cuenta como detección. Los recibos del launcher verifican invariancia de fuentes y limpieza de recursos. Los formularios humanos están vacíos y no forman parte de estas pruebas.

Integración y F01-05 agregado con el workflow revisado siguen pendientes del principal; no se concede aceptación formal ni se ejecutó proveedor remoto. La nueva identidad integrada requerirá su serie de capacidad. Recibos privados bajo `~/.codex-work/rovaq-cierre-20261007/receipts/`, prefijo `fase6-base-`.

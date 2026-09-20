# F01-05: adaptación aislada del gate Auth

19-sep-2026. Propuesta control-plane, sin aprobación independiente ni aceptación
F01-05. Se mantienen **10/60 aceptadas**. Baseline publicado y comprobado:
`84219b0f9cead62f23945d001b3404677efd5c3a`. Sin commits, push, Actions, cloud,
descargas de imágenes ni cambios de producto/SQL/F01-03/F01-04/runner.

## Resultado y causas corregidas

El gate real sobre una materialización completa separada pasó **7/7, exit 0**
en 34.46 s: callback PKCE por SMTP/Mailpit, redirect local y externos, selección
válida A/A2, intento A→B, cookies corruptas, firma alterada, expiración, anónimo,
revocación inmediata y logout/back-cache. No se sustituyó PKCE por password login:
el helper de fixtures conserva el login password preexistente; el login del
navegador sigue OTP → Mailpit → verify → código PKCE → callback SSR real.

1. `harness.mjs:115`–`:119`: copiar una fuente inmutable 0444 conserva ese modo.
   `writeFileSync` sobre la copia reproduce EACCES, igual que el quinto intento al
   generar `apps/web/next-env.d.ts`. No es falta de permiso general sobre TMP ni
   exige escribir el candidato: chmod 0644 **sólo en scratch**, seguido de apertura
   `r+` antes de npm, funciona. El chmod venía en la fuente preservada del intento
   sexto, inconcluso; esta recuperación añade diagnóstico/comprobación temprana y
   demuestra el build y arranque completos. Fuente original sigue 0444.
2. `infra.mjs:50`: OTP de un usuario confirmado emite el enlace usando la ruta
   RECOVERY del mailer. Sin configurarla, SMTP entregaba correctamente un mensaje
   cuyo enlace era `/verify`; el gateway y el oráculo requieren `/auth/v1/verify`.
   Se añadió `GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify`. No se cambió regex,
   callback, aserciones ni código del producto para aceptar ese enlace incorrecto.

El primer ensayo de esta recuperación fue rojo de infraestructura (exit 1,
52.57 s), no defecto detectado de producto. Se conserva como tal. Los intentos
anteriores primero–sexto tampoco se convierten en PASS.

## Contrato del adaptador

- `infra.mjs:9`: descriptor único para app/SDK/Auth/Mailpit; puertos 57570 app,
  57571 gateway, 57572 Mailpit y 57573 CDP. Ningún fallback al Supabase compartido.
- `infra.mjs:15`–`:26`: imágenes precargadas por digest, comprobadas linux/arm64,
  `--pull never`, red y nombres UUID, etiqueta `vexa.auth.owner`, fixtures env0600.
  Se usa Storage real únicamente como prerrequisito de las migraciones completas.
  No se altera `supabase/config.toml` ni su project_id.
- `infra.mjs:29`–`:42`: cleanup por lista propia y etiqueta coincidente, incluyendo
  volúmenes anónimos propios. Recursos con otra etiqueta no se borran. Señales
  SIGINT/SIGTERM tienen handler; fallo de cleanup produce error. Logs propios
  sanitizados0600; no inspección Env de contenedores existentes.
- `infra.mjs:47`: DB exige `HostConfig.PortBindings={}`. Auth/PostgREST/Storage
  tampoco publican puerto host. Gateway/Mailpit/CDP sólo publican en 127.0.0.1.
- `infra.mjs:66`–`:67`: Chromium de la imagen indicada, usuario node, transporte
  CDP desde playwright-core; proxies localhost conservan los orígenes de cookies.
  `--add-host=host.docker.internal:host-gateway` probado en Docker local.
  Next escucha 0.0.0.0 para permitir ese salto del contenedor al host.
- Mailpit metadata, sin leer Env: linux/arm64, puertos de imagen 1025/1110/8025.
  SMTP usa 1025 dentro de la red propia; sólo la API8025 se publica en57572.

`F01-02.test.mjs` es idéntico al baseline después de exactamente tres
sustituciones de infraestructura: importar authURL, launchBrowser y origen
permitido parametrizado. `oracles.mjs`, `oracles.test.mjs` y `probe.test.mjs`
son byte a byte idénticos al SHA baseline; ningún oráculo rebajado.

## Comandos, resultados y artefactos locales

Ejecutados desde este control separado, con:

```sh
export VEXA_CANDIDATE=/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-auth-baseline-vn3ivkwt
node --test tests/acceptance/F01-02.test.mjs
node --test tests/acceptance/support/F01-02/oracles.test.mjs
node --test tests/acceptance/support/F01-02/probe.test.mjs
node /tmp/f0105-auth-infra-check.mjs
git diff --check
```

| Comprobación | Resultado / evidencia |
|---|---|
| Gate real final | exit0, 7/7, cero skips; `/tmp/f0105-auth-recovery-final.tap` |
| Oráculos puros existentes | exit0, 5/5; redirects, revocación y observador que no reenvía POST |
| Probe existente sobre Auth real | exit0, 1/1; positivo y mutante de firma muere por AUTH_SIGNATURE; `/tmp/f0105-auth-signature-final.tap` |
| Infra, cuatro puertos ocupados | exit0; cada57570–57573 rechazado antes de crear recursos/fixtures; listener preservado |
| Infra, cleanup | exit0; DB sin PortBindings, env0600 luego retirados, doble close idempotente, red vecina ajena al harness preservada, cuatro puertos libres; `/tmp/f0105-auth-infra-check.log` |
| DB/API límites observados | `/tmp/f0105-auth-portbindings.json`: DB/Auth/REST/Storage sin bindings, gateway/mail sólo127.0.0.1 |
| Fuente baseline completa | 646 blobs comparados con `git ls-tree -r HEAD` + hash Git; cero diferencias de contenido |
| Fuentes estables durante gate | fingerprints antes/después idénticos, recibo `/tmp/f0105-auth-recovery-final.json` |
| Diff | `git diff --check`, exit0; cambios exclusivamente gate/lanzamiento/soporte Auth |
| Ensayo rojo preservado | `/tmp/f0105-auth-recovery.tap` y `.json`, exit1; cleanup vacío |
| Diagnóstico SMTP dirigido sin build | `node /tmp/f0105-auth-mail-diagnostic.mjs`, exit0; `/tmp/f0105-auth-mail-diagnostic.log`, sólo origen/path y nombres de campos, sin tokens |

El wrapper reproducible `/tmp/f0105-auth-recovery-final.py` registra antes y después
SHA256 de path relativo + modo + bytes de cada archivo (excluye `.git`). Candidato:
`c70160e185dc1efc0db7bb4e8f69df9958bc912b55f8d7b30d0d8bfcfd0e10f0`.
Control durante el gate:
`7f0597bbdf496327bbdd78050e1c6ed4d34a043d5dc5797b335bf814e60aa937`.
Este README se escribió **después** de los ensayos. `candidate_commit_sha=null`:
no se inventa un commit para el working tree. La comparación de646blobs acredita
el contenido baseline materializado, no un nuevo commit.

Owner del gate verde: `vexa-f01-02-4b680982-8960-4a1d-a733-4330baaec222`.
Evidencia sanitizada y recibo de eliminación en
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-auth-evidence-udl5GT/`.
Owner del check infra: `vexa-f01-02-1d6b4ff5-eea2-4fab-8d3a-af884be0581e`;
owner probe: `vexa-f01-02-2cc0ad3e-5d89-4157-8ce2-36fb6f9c6060`.
Todos reportaron `remaining:[]`. La red vecina de la prueba fue retirada por su
propio creador después de demostrar que el harness la conservó. Inventario final
`docker ps -a --filter name=vexa-f01-02` y redes homónimas: vacío. No se detuvieron
ni limpiaron recursos compartidos o de terceros. Artefactos TMP son locales y
pueden desaparecer; no son recibos remotos.

## No cubierto

Perfil elegido **ubuntu-24.04-arm**, pero ejecución real host macOS ARM64 + Docker
Linux ARM64. No probado Ubuntu GitHub, x64, Linux host-gateway en GitHub, ni Actions
remoto. Se conserva HTTP localhost del gate original: **HTTPS/TLS no implementado
ni probado**. PKCE y SMTP sí son reales. No Google OAuth ni credenciales externas.

No se afirma sandbox para código hostil. El modelo previsto sigue código main
revisado, baseline/control y candidato separados, buildTMP; no forks/PRs,
head_sha arbitrario, secretos ni permisos de escritura remotos. Este cambio no
implementa workflow ni runner CI. Tampoco reejecuta F01-03/F01-04, matriz CI completa,
mutantes de CI ni revisión independiente. Señales abruptas/SIGKILL, colisión que
ocurra después del preflight y caída del daemon durante cleanup no se inyectaron.
El resultado local no acepta F01-05 ni aumenta el contador10/60. Ventana original
conservada con fin1789862103; sin reset ni nueva autorización de ejecución remota.

# F01-05 / M10 — correctivo local de fuga a cliente

Autoría correctiva, no aceptación. Siguen 10/60. Baseline/control SHA
`84219b0f9cead62f23945d001b3404677efd5c3a`; sin commit candidato nuevo.
Node v26.7.0, Darwin ARM64. Sin Actions, cloud, gasto, push, Docker ni DB.
Cambios exclusivos: web.mjs, artifact-secrets.mjs, leak-probe.mjs,
leak.test.mjs y este LEAK.md. run.py, scaffold-copy, producto, SQL y oráculos
F01 anteriores intactos durante este correctivo. No revisión delegada.

## Causa original y rojo previo

El job rechazado sólo hacía build y GET /api/health/version, permitiendo un
JWT service_role sintético en public/ci-service-canary.txt. Antes de editar web:

```
python3 -B tests/acceptance/support/ci/run.py --job web-quality --candidate R/m10-candidate
node R/m10-runtime.mjs R/m10-candidate
```

R = /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-independent-47_e0nfx

Ambos exit0: falso verde `pass` y `M10_SYNTHETIC_SERVICE_CANARY_SERVED:200`.
Ésta es la reproducción roja del requisito de confidencialidad, no un fallo de
infraestructura. Fuente rechazada y reproductor del revisor preservados.
Logs0600: /tmp/f0105-leak-before.log, /tmp/f0105-leak-before-http.log.
Recibo original: vexa-ci-web-quality-t4n_vttz/receipt.json bajo el TMP anterior.
Fingerprint candidato antes/después idéntico:
9879fc6aa9bbae5d381dd889b29dd606b7a4329fb16fb3157d78e6161fb18b54.

## Guardia entregada

El mismo job web-quality instala offline desde lock en TMP, ejecuta session,
auth-http, typegen/tsc/eslint/build con versiones/scripts fijados, arranca Next
producción y ejecuta la guardia antes de que el launcher pueda marcar pass.
No se añaden dependencias ni se alteran locks.

Cada ejecución crea un nonce UUID canónico, un marcador de servidor y un JWT
service_role de firma inválida. Se inyectan en SUPABASE_SERVICE_ROLE_KEY y
VEXA_SERVER_ONLY_CANARY sólo después del filtrado allowlist del entorno heredado.
Un JWT anon con el mismo nonce se escribe exclusivamente en public del build
TMP; debe servirse por HTTP200 sin rechazo. Los canarios se generan en runtime,
no se guardan valores JWT en este informe ni en fuentes versionables.

Se escanean todos los archivos de public, .next/static (incluidos mapas), HTML,
RSC/body prerenderizados y respuestas/cabeceras HTTP reales. Se solicitan todos
los archivos public/static y rutas page descubiertas (dinámicas con ci-fixture),
además de /, /login y health. Se siguen redirecciones locales y referencias
HTML/CSS y fetch/import literales, inspeccionando URL de request antes del GET.
Referencias externas se inspeccionan sin contactar servicios. Diagnóstico fijo
CLIENT_SECRET_LEAK identifica tipo/superficie sin imprimir valor ni ruta.
La salida de herramientas se redacta antes de imprimirla.

## Límites explícitos

HTTP más parseo de artefactos, sin SDK ni ejecución JavaScript de navegador:
no intercepta requests calculadas en runtime, interacciones autenticadas,
POST/acciones, WebSocket, service workers, transformaciones/obfuscación arbitraria
ni exfiltración externa. No scanner universal de secretos. Inspecciona JWT por
claim role=service_role (sin verificar firma); permite anon/authenticated/public.
No prueba sandbox para código malicioso, PR/forks, Ubuntu/Actions ni producción.
run_id=pending. Cancelación y limpieza del launcher son propiedad de otro owner.
run.py conserva su clasificación: M10 da failed_unclassified, exit1; la evidencia
de muerte es el diagnóstico exacto real del guard, no esa etiqueta genérica.
No se relabela como product_fail ni se modifica run.py.

## Verificación final

````
node --test --test-reporter=tap tests/acceptance/support/F01-05/leak.test.mjs
node tests/acceptance/support/F01-05/leak-probe.mjs R/candidate
python3 -B tests/acceptance/support/ci/run.py --job web-quality --candidate R/m10-candidate
````

Unit: exit0, 2/2, 0 skips; log /tmp/f0105-leak-unit.tap. Cubre roles permitidos,
nonce único, filtrado de entorno, JWT independientes/escapes, canarios en
public/static/prerender y fugas por cuerpo/cabecera HTTP real con restauración.

Probe: exit0; cinco ejecuciones del MISMO job web-quality, sin alterar comandos
ni oráculos entre sanos/mutantes. Evidencia completa: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-leak-probe-BROqwZ/results.json`.
Log del driver0600: /tmp/f0105-leak-probe.log.

| Caso | Exit | Diagnóstico / resultado | Recibo (bajo TMP) |
|---|---:|---|---|
| healthy-before | 0 | pass | vexa-ci-web-quality-_ait6diy/receipt.json |
| service-public | 1 | CLIENT_SECRET_LEAK:SERVICE_ROLE_JWT:artifact | vexa-ci-web-quality-v417p3cm/receipt.json |
| healthy-restored | 0 | pass | vexa-ci-web-quality-6v3mfgdl/receipt.json |
| ts2322 | 1 | TS2322 | vexa-ci-web-quality-s1arw14d/receipt.json |
| healthy-final | 0 | pass | vexa-ci-web-quality-1uhyqa1z/receipt.json |

Los tres sanos registran 48 artefactos y 70 requests; build Next producción,
API200, control anon HTTP200 y F01-01 completos. Los fingerprints de control y
candidato permanecen iguales dentro de cada job. Logs/recibos0600 verificados,
cero JWT crudos en esos logs. La última ampliación del test de cabeceras y este
informe son posteriores a los receipts; no modifican el runtime ya probado.

Reproductor original del revisor después del fix: exit1,
CLIENT_SECRET_LEAK:SERVICE_ROLE_JWT:artifact. Recibo
`vexa-ci-web-quality-wrxdd1yp/receipt.json`; log /tmp/f0105-leak-reviewer-after.log.
Candidato y control inmutables en esa ejecución; cero JWT crudos en logs.
No se usa un error de infraestructura para contar M10 como rechazado.

## SHA256 de entregables y evidencias

- `tests/acceptance/support/ci/web.mjs`: `11ab1e115939ae0063847d43b1d756d90c7c887790c8a5432508876981e84f02`
- `tests/acceptance/support/ci/artifact-secrets.mjs`: `5f77d2ea74e6ab57feef7d841b8403b40ece14de360a7bb1b4e5e313a87d506a`
- `tests/acceptance/support/F01-05/leak-probe.mjs`: `62174a396ec7791d7127340e76d0e6f3f9a4913932e1c0a11d24be21240bab0a`
- `tests/acceptance/support/F01-05/leak.test.mjs`: `239bce550e89cfb2df67e4f38c594f9740384cfab1edc8c35a8a094c26992050`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-leak-probe-BROqwZ/results.json`: `62e77204166720920c5e316c6217c9b047e379102b9a043e3126a8a5df12a98a`
- `/tmp/f0105-leak-unit.tap`: `c18cfa52c3d2145c2bc9725f9a42443f94a105527081d5c0b8ddaa981cfd00f8`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-web-quality-_ait6diy/receipt.json`: `86b635279a5bb260d3115590a63174bc5590eeeefc82b4fdf015c75cef12b4c1`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-web-quality-v417p3cm/receipt.json`: `fcefecc4ac6da962a13b8a4ca8439167b902b58e2deacf3e9892cbb9b3f63032`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-web-quality-6v3mfgdl/receipt.json`: `e939d59f225604837029225027447c0c4ebbf9c6d3f0b93eec300f9fba485b0e`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-web-quality-s1arw14d/receipt.json`: `e1d3dcd37b57712c5bb1cfb3805f3441b20e1d2208bf74d3b6bb159aca1885ea`
- `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-web-quality-1uhyqa1z/receipt.json`: `e657e098bbe2debafe3800cd860cafc777f7fc7763f1a144db933241654f1d13`

No probado en esta vuelta: jobs SQL/Auth/kernel completos, cancelación forzada,
Actions/Ubuntu/x64, navegador autenticado ni producción. Sus resultados anteriores
no se reatribuyen a este correctivo. M10 queda corregido localmente y pendiente
de revisión independiente/integración por el principal; no aceptación F01-05.

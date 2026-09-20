# F01-05 — correctivo del ejecutor/examen, 19-sep-2026

Autoría local, NO aceptación. Siguen10/60. SHA control leído:
`84219b0f9cead62f23945d001b3404677efd5c3a`. No commit nuevo ni SHA candidato
inventado. Ventana original1789862103 preservada; esta llamada limitada a900s.
No delegación, push, Actions, cloud, gastos, reset ni acceso a DB compartida.
Perfil declarado ubuntu-24.04-arm, pero ejecución observada Darwin ARM64,
Docker Linux ARM64, Node26.7.0/Python3.9.6. Ubuntu/GitHub/x64 NO probados.
`run_id=pending` en todos los recibos.

## Diagnóstico SQL antes de otras cadenas

El supuesto atasco anterior era una ejecución incompleta: su log mostraba avance
por35tablas con consultas de2–13s por tabla antes de retirar la DB a296.84s.
Conservado `/tmp/vexa-f0105-report.md` y recibo `vexa-ci-sql-integration-ppeclokv`;
no lo convertimos en mutante eliminado ni en verde. Los recibos dirigidos previos
`f6l4dprl` y `2f9ob_e0` sí contienen READ_A:conversations:a y SQLSTATE42601,
pero carecían de la cadena sana completa.

Repetición sin modificar harness/oráculos F01-03:
`VEXA_CANDIDATE="$(cat /tmp/vexa-f0105-candidate-path)" node --test --test-reporter=tap tests/acceptance/F01-03.test.mjs`
→ exit0,168pass/0fail/0skip,114.199s, `/tmp/f0105-fix-sql-healthy.tap`.
Consulta limitada de pg_stat_activity sobre DB propia: sin esperas de lock.
No se corrigió producto ni se redujo matriz: el gate sano pudo terminar.

Ownership observado: red/contenedores
`vexa-f01-03-edc0cad6-0344-4066-8d35-8d44587745ea`; DB sin puerto publicado,
servicios sólo gateways autorizados. Tras terminar, `docker exec <UUID>-db ...`
respondió No such container (exit1 esperado) y `docker network ls --filter name=<UUID>`
vacío (exit0). No stop/rm manual en esta vuelta: finally del harness.

## Entregado

- Entrada `tests/acceptance/F01-05.test.mjs`: llama examen confiable, requiere cuatro
  jobs reales. Ausencia de workflow falla. Registro queda a cargo del principal.
- Launcher existente terminado: TAP explícito, rechazo de Node vacío/skip/fail,
  exit real, TERM/KILL por grupo en timeout; recibos0600 con fingerprints antes/después.
  Error de integridad también conserva receipt (probado con symlink creado durante hijo).
- Auth: si falta infra.mjs o import desde harness confiable, falla cerrado; integrado
  el adaptador revisado, ejecutará F01-02 y después F01-04 secuencialmente. No fallback.
- Web: herramientas fijadas, build y API200, más unit session/HTTP desde tests del
  control copiados al build temporal. HTTP unit usa mocks; no se presenta como E2E.
- Workflow sólo referencia JSON estricta en support/F01-05; main revisado, SHA evento,
  directorios separados, contents:read, checkout sin credenciales persistentes.
- Bootstrap online separado y bloqueado localmente. Mailpit añadido por repo digest
  ARM observado `37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6`;
  image inspect linux/arm64 exit0. Nunca se ejecutó pull/bootstrap online.

## Comandos y resultados de esta vuelta

`python3 -B tests/acceptance/support/F01-05/policy.test.py` → exit0,8tests:
contrato positivo antes/después,17mutaciones + duplicado/ausencia, scrub de canarios,
Node vacío/skip reales, timeout124, fingerprint/symlink, launcher/hijo17 real,
integridad durante ejecución, SHA evento incorrecto y receipt candidato no confiable.
Un primer test vacío falló porque Node cuenta el archivo vacío como un test; se
corrigió el detector para exigir subtests declarados. No se ocultó ese hallazgo.

`VEXA_CANDIDATE=<TMP> node --test tests/acceptance/F01-05.test.mjs` → exit1,
CI_CONTRACT_MISSING (esperado); la entrada no finge un workflow instalado.

`python3 -B .../ci/run.py --job control-kernel --candidate <TMP>` → exit1,
23/24kernel/fundación: único fallo `stale register F01-05`. Recibo:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-control-kernel-lo_904zh/receipt.json`.
El correctivo explícito exige crear la entrada; el principal actualizará registro.
No se rebajó F00-05 ni se editó metadata/orchestration para obtener verde.

`python3 -B -m unittest discover -s tests/controller` → exit0,110tests,72.186s,
`/tmp/f0105-fix-controller.log`. Repos Git creados por esos tests sólo en sus TMP.
`node --test --test-reporter=tap tests/tooling/scaffold-copy.test.mjs` → exit0,3/3,
`/tmp/f0105-fix-tooling.tap`. Son ejecuciones separadas; no convierten el job kernel en PASS.

`python3 -B .../ci/run.py --job auth-e2e --candidate <TMP>` → exit1,
infra_blocked/AUTH_ADAPTER_PENDING, recibo
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-ci-auth-e2e-d0nbw2pb/receipt.json`.
No se incorporó ni editó el trabajo del otro agente.

`python3 -B tests/acceptance/support/ci/bootstrap.py --candidate <TMP>` → exit2,
rechazo previo a red/instalaciones: requiere futuro GitHub-hosted main autorizado.

## Cadenas reales y aislamiento de fuentes

Para evitar modificaciones del control durante probes se materializó una copia
congelada en `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0105-fix-control-1040mhu4/control`.
Candidato independiente según `/tmp/vexa-f0105-candidate-path`, fingerprint
`98641e6587fd39c50dc68db69beea803fa299a1e75f17cef4a37e6bba38c309a`.
Los builds y mutantes viven en TMP; receipts contrastan fingerprints antes/después.
La copia conserva referencia Git de sólo lectura para identificar84219b0; no es
un nuevo commit del paquete. Tras congelarla se añadió bootstrap Mailpit/documentación,
metapruebas y manejo del error de fingerprint en finally; este último se probó
específicamente con mutación de symlink. No se atribuyen hashes de esa copia al
árbol final completo.

`python3 -B <control-congelado>/tests/acceptance/support/F01-05/probe.py --job web-quality --candidate <TMP>`
→ exit0, sano0 → TS2322/product_fail1 → sano0. Build/API200 reales en ambos sanos,
F01-01, pruebas unit/HTTP del control y herramientas fijadas. Log `/tmp/f0105-fix-web-probe.log`;
recibos en `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f0105-probe-2szl04p8/results.json`.

## Hallazgos pendientes, archivo:línea

- `run.py:83`: Auth bloqueado hasta integración/revisión del adaptador del otro agente.
- `run.py:70`: registro stale mantiene control-kernel rojo hasta corrección del principal.
- `run.py:25`: timeout de procesos probado; cancelación Docker no acredita limpieza
  de recursos si finally no corre. Receipt declara cleanup delegado, no certificación.
- `contract.py:38`: M10 cubre rechazo de configuración de clave pública de servicio;
  falta canario compilado en chunks/HTML/requests. M11 no es scanner universal.
- `bootstrap.py:18`: bootstrap Linux/ARM, distribución remota de digests y runtime
  Actions aún no ejecutados. No inferir Ubuntu a partir del Docker local.
- `exam.py:9`: agregado usa hijos reales, no JSON candidato; falta ensayo integral
  de cuatro jobs verdes tras registro+Auth y matriz adversaria M12/M13 completa.

No autoaccept. Revisión/congelación/registro y ejecución oficial siguen pendientes.
Referencia F01-04: diff permanece limitado a repo digest ARM y --add-host Linux;
transporte comprobado por vuelta anterior3/3 en `/tmp/vexa-f0105-ui.log`, no repetido
ni llamado Ubuntu probado en ésta. Oráculos F01-01..04 sin alteraciones nuevas.

## Cierre SQL formal de esta vuelta

`python3 -B <control-congelado>/tests/acceptance/support/F01-05/probe.py --job sql-integration --candidate <TMP>`
→ exit0. `/tmp/f0105-fix-sql-probe.log`, resultados/recibos:
`/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-f0105-probe-z2f85r2_/results.json`.

| Caso | Exit job | Status | Duración preflight / F01-03 |
|---|---:|---|---|
| Sano antes | 0 | pass | 14.63s /128.98s |
| Migración inválida | 1 | product_fail,SQLSTATE:42601 | 4.50s / no ejecutado |
| Fuga conversations | 1 | product_fail,READ_A:conversations:a | 10.43s / no ejecutado |
| Sano después | 0 | pass | 12.39s /114.36s |

Los dos sanos corren el preflight y F01-03 completo168tests. Los mutantes fallan
en el oráculo dirigido real del mismo job, antes de la regresión general, y el
exit llega al launcher. No se cuenta infraestructura como muerte. Los cuatro
recibos conservan fingerprints control/candidato idénticos antes/después.
Los cuatro procesos terminaron; no se interrumpió ninguno de estos gates.

Recursos observados incluyen la red UUID
`vexa-f01-03-4268f6b5-81f8-43f7-9dbd-ffa7cb3619b1` durante el sano del probe.
Al cierre `docker ps --filter name=vexa-f01-03- --format '{{.Names}}'` y
`docker network ls --filter name=vexa-f01-03- --format '{{.Name}}'` dieron salida
vacía,exit0. Sólo observación/listado, ninguna limpieza de recursos ajenos.
No se capturaron UUIDs de cada efímero intermedio en un recibo separado: cleanup
normal lo realiza cada harness y la ausencia final no prueba cancelación forzada.

Comparación byte a byte con `git show HEAD:<path>`:10archivos de gatesF01-01..04,
soporteSQL y browser/routes F01-04 idénticos,exit0. Un primer script de comparación
incluyó oracles.mjs de F01-04, que no existe, y salió1; se corrigió la lista sin
modificar archivos. `git diff --check` exit0. Árbol sólo muestra harnessF01-04,
entradaF01-05 y support/F01-05,ci. No producto/SQL/orchestration/.github/package/Git.

Resultado operativo: web-quality y sql-integration verdes con mutantes y sanos
restaurados; control-kernel rojo por registro stale; auth-e2e bloqueado por adaptador.
Pendientes M10/M12/M13 detallados en README. No cuatro jobs PASS, no F01-05 aceptado,
no ejecución remota. Cualquier integración requiere revisión del paquete final.

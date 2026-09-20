# F01-05 — paquete control-plane propuesto

Estado: NO aceptado/congelado. 10/60 aceptadas; baseline publicado
`84219b0f9cead62f23945d001b3404677efd5c3a`. Sin push, Actions, cloud ni gasto.

Contrato inicial: exclusivamente push main y workflow_dispatch de main revisado,
publicado por el principal. No PR/forks ni sandbox de código hostil; fingerprints
antes/después detectan deriva, no impiden ataques del mismo usuario.
Referencia inactiva: `../F01-05/ci.reference.json`, JSON estricto válido YAML 1.2.
No se instala en `.github`. Claves duplicadas/desconocidas, otros jobs/steps,
permisos, secrets/env, servicios, condiciones, refs o comandos se rechazan.
Pines proceden de F01-05-SECURITY.md; no se ejecutaron actions.

## Ejecución confiable

```
python3 -B tests/acceptance/support/ci/run.py --job control-kernel --candidate /ruta/otra/materializacion
python3 -B tests/acceptance/support/ci/run.py --job web-quality --candidate /ruta/otra/materializacion
python3 -B tests/acceptance/support/ci/run.py --job sql-integration --candidate /ruta/otra/materializacion
python3 -B tests/acceptance/support/ci/run.py --job auth-e2e --candidate /ruta/otra/materializacion
python3 -B tests/acceptance/support/F01-05/policy.test.py
python3 -B tests/acceptance/support/F01-05/exam.py --candidate /ruta/candidato-con-workflow
```

Control se deriva del archivo del launcher, no del candidato. Nunca importa sus
scripts CI/tests de aceptación. Enumera diez gates: E00 (economics), F00-01..05,
F01-01..04. No glob all, F05 ni recursión F01-05. Controller y tooling desde
control; producto vía VEXA_CANDIDATE. Web ejecuta herramientas fijadas directamente,
valida scripts y hace build/arranque/API real, más F01-01. SQL aplica migraciones
completas y prueba conversations A/B antes del gate completo protegido F01-03.
Auth-e2e falla cerrado hasta integrar/revisar adaptador F01-02 propio; no se permite
fallback a vexa-local. El launcher exige infra.mjs y su import real desde harness.mjs del control; entonces ejecuta F01-02 seguido de F01-04, con corte al primer fallo. La presencia no sustituye la revisión independiente del adaptador.

Python local >=3.9, futuro runner 3.12; Node exacto26.7.0. Perfil futuro
ubuntu-24.04-arm; no acredita Ubuntu GitHub, x64 ni ejecución remota.
Control/candidato separados. Local registra SHA control y fingerprint real del
working tree antes de verify; candidate_commit_sha=null si no hay evento comprobado.
Remoto exige SHA del evento main en ambos checkouts y árboles limpios. run_id queda
pending siempre: recibos locales jamás acreditan corrida GitHub.

Cada job produce receipt.json y logs0600 en directorio TMP0700 propio: argv, cwd,
exit real, timeout, duración, identidad y hashes. Ningún JSON candidato puede
proclamar PASS. Cualquier no cero bloquea; sólo TS2322, SQLSTATE42601 o
READ_A:conversations:a se clasifican como product_fail para esta matriz.
Los otros fallos quedan failed_unclassified/infra_blocked: no matan mutantes.

Instalación/build en TMP, npm offline/ignore-scripts; entorno allowlisted y npmrc
vacíos, no tokens heredados. Bootstrap online separado, sólo futuro runner
GitHub-hosted descartable expresamente autorizado; copia ambos locks y precarga
imágenes ARM por digest. NO ejecutado localmente. Gates mantienen --pull never.
F01-03 usa únicamente sus puertos gateway56327..29; F01-04 usa57560..69.
DB no publica puertos. Recursos Docker UUID y cleanup sólo propios. F01-04 sólo
cambia imagen corta por repo digest ARM y añade host-gateway; oráculos intactos.

## Pendientes que bloquean aceptación

Revisión independiente/congelación del paquete; el principal debe actualizar el registro
F01-05 antes de prepare (F00-05 detecta registro stale). La entrada
tests/acceptance/F01-05.test.mjs ya está creada por encargo explícito; integración
Auth/Mailpit, cuatro jobs verdes, matriz completa, recibos de infraestructura,
bootstrap real Ubuntu ARM, activación/publicación y run_id remoto autorizados.
La entrada llama al examen de soporte y exige cuatro exits reales cero. No modifica
orchestration/graph ni el registro. El principal debe registrar el gate antes
de preparar candidato. No autoaccept.


## Metapruebas y límites (M00–M13)

`python3 -B tests/acceptance/support/F01-05/policy.test.py`: ocho tests, con
positivos restaurados. `probe.py --job web-quality|sql-integration --candidate PATH`
ejecuta job sano, copia(s) mutante(s), job sano; conserva resultados y recibos. No
computa muerte de mutante si el sano, infraestructura o cleanup falla. Un examen
completo local requiere workflow en el candidato: aquí sólo se entrega la referencia
inactiva en support/F01-05, nunca se instala ni activa en .github.

| ID | Implementado | Límite |
|---|---|---|
| M00 | Ausencia de workflow/job rechazada; entrada oficial roja sin workflow | Registro lo actualiza principal |
| M01 | tsc real TS2322, job rojo, sano antes/después | No inventar verde si cache falla |
| M02 | Migración agregada leída, PostgreSQL devuelve42601, job rojo | SQL sano completo antes/después obligatorio |
| M03 | RLS deshabilitada, oráculo real READ_A:conversations:a | SQL sano completo antes/después obligatorio |
| M04 | continue-on-error job/step/expresión rechazados | Actions no ejecutado |
| M05 | if/paths/filtro de tests rechazados; Node vacío y skip reales fallan | Tests originales permanecen intactos |
| M06 | Workflow con ruta candidata rechazado; rutas de gates fijas al control | No sandbox contra escritura maliciosa del mismo usuario |
| M07 | Wrappers que tragan exit rechazados; hijo17 y launcher17 reales; timeout124 | Cancelación Docker completa pendiente |
| M08 | Ref mutable rechazada; evento exige SHA coincidente y main | Verificación de checkouts remotos no ejecutada |
| M09 | Eventos/permisos/runner/credenciales fuera del contrato rechazados | No ejecución PR/fork |
| M10 | env con clave pública de servicio rechazado | Canario compilado/chunks/HTML/requests pendiente |
| M11 | secrets/env rechazados; canarios admin/token/NODE_OPTIONS no llegan al hijo | No scanner universal de bundles/logs |
| M12 | Agregado usa procesos hijos vivos, nunca receipts de candidato | Inyección adversaria integral pendiente |
| M13 | Auth faltante falla cerrado; timeout se registra sin product_fail | Falta matriz completa imagen/cache/puerto/cancelación |

Timeout del launcher termina el grupo de procesos (TERM y después KILL); no promete
que eso ejecute el finally de Docker. Los recibos declaran cleanup delegado al harness,
no `not_needed` ni limpieza certificada. No liberar recursos ajenos. El gate SQL
original usa600s y el launcher650s por comando; sobrepasar estos límites no es PASS.
Python3.9 local/3.12 declarado; Node26.7.0. Bootstrap remoto añade Mailpit ARM por
repo digest comprobado localmente, pero no se ha descargado ni ejecutado ese bootstrap.

Web copia los tests session/auth-http desde control al build TMP y ejecuta Node/tsx
sin confiar en npm test. Auth HTTP es prueba con respuestas simuladas; el job
Auth-e2e es el que deberá acreditar Auth/PKCE/Mailpit y UI reales. Build prueba
API health/version200. Artefactos y stdout sólo contienen datos sintéticos.

Ver `REPORT.md` para comandos, salidas y pendientes de esta vuelta. Autoría no aceptación.

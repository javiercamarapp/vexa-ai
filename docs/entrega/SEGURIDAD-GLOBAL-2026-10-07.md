# Fase 2 — seguridad local completada

Cierre: 7 de octubre de 2026, 18:55 CST. **100 % del alcance local de la fase 2: F07-01 PASS, 17/17 componentes, cero fallos, cancelaciones, skips o pendientes de ejecución.** Duración del gate: 24 min 34 s. No equivale a aceptación formal del grafo ni a validación de producción.

Candidato probado `54be5cf07b68667626adda7eda06ccecf075159f` en copia aislada con dependencias; control congelado `d6d87d1b416014529b1391970fa47fcbaf86ea20`. Sus fuentes no cambiaron durante la corrida; los 2.688 archivos del candidato coinciden con canonical. Informe SHA256 `f69dbe342f542d68f237e04a41189e03650c36a9855270a4ec2ad3bd7d7a390b`. [Recibo completo con componentes y hashes](FASE-2-SEGURIDAD-2026-10-07.json) y [hallazgos](../blueprint/security-findings.json).

| Componente | Resultado | Conteo TAP |
|---|---|---|
| SQL y RLS | PASS | 447/447 |
| Descargas Storage | PASS | 8/8 |
| Seguridad HTTP | PASS | 11/11 |
| Webhooks, sesión y exports | PASS | 8/8 |
| Extracción y redacción | PASS | 17/17 |
| Flujo de extracción | PASS | 19/19 |
| Evidencias autorizadas | PASS | 16/16 |
| Problemas y retrieval | PASS | 15/15 |
| Despacho de trabajos | PASS | 6/6 |
| Autorización CRM | PASS | 5/5 |
| Política gateway | PASS | 17/17 |
| Kernels gateway/conectores | PASS | 91/91 |
| Webhooks correo | PASS | 21/21 |
| Autorización notificaciones | PASS | 58/58 |
| Cola de salida | PASS | 17/17 |
| Contrato integral imports | PASS | 1/1 |
| Historial integral | PASS | 14/14 |

Los conteos son los emitidos por cada suite, incluidos padres; no representan pruebas únicas sumables. Imports conserva su inventario interno completo y sus mutantes, aunque su entrada TAP sea un único test. Historial conserva siete pasos integrales y seis calibraciones, más el padre.

## Comando y comprobaciones de cierre

Ejecutado desde `/private/tmp/rovaq-fase2-control-20261007`, con exit 0:

```sh
caffeinate -i env \
  VEXA_CANDIDATE=/private/tmp/rovaq-fase2-candidate-20261007 \
  VEXA_F01_03_PORT_BASE=64010 \
  VEXA_F01_03_CLEANUP=/private/tmp/rovaq-fase2-receipts-20261007/global-sql-cleanup-v3.json \
  PATH=/opt/homebrew/opt/node@22/bin:$PATH \
  node --test --test-concurrency=1 tests/acceptance/F07-01.test.mjs
```

Log: `/private/tmp/rovaq-fase2-receipts-20261007/f07-global-v3.log`. Informe: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/rovaq-f07-components-Lntjae/report.json`. Los 17 grupos de procesos terminaron; inspección posterior de los journals confirmó **78 recursos propios ausentes**, sin eliminar recursos ajenos (`global-cleanup-v3.json`). Las corridas previas FAIL permanecen archivadas y clasificadas: presupuesto/cierre del controlador, y dependencia ausente en canonical. No se rebajaron oráculos ni se contaron parciales como PASS.

Los cuatro hallazgos P2 del producto tienen corrección y regresión: lectura HTTP acotada, revocación de descarga privada, liberación del trigger tras fallo de cierre y CSP estricto de exportación. Calibraciones negativas de bytes y firmas de Storage detectaron los defectos retirados. El controlador corregido pasó 11 calibraciones y revisión focal de otro agente antes de congelarse. La revisión final de recibos se registra en el JSON; no es una certificación externa.

## Límites y siguiente fase

- Auditoría npm de producción: cero alertas. **Auditoría completa FAIL: cinco alertas altas de desarrollo por braces siguen abiertas.** La revisión de la configuración vigente no identificó entrada no confiable del producto hacia esa dependencia; no se declara subsanada ni una exención permanente.
- La migración 0041 no invalida enlaces firmados emitidos previamente. Antes de un despliegue existente se requiere acreditar expiración o invalidación autorizada.
- SQL/Auth/Storage/browser/jobs locales son reales; proveedores y datos son SYN. No se acredita entrega SMTP, inferencia de pago, datos de cliente, operación gestionada ni validación comercial.
- Sin push, despliegue ni cambios externos. Aceptación formal y contadores 59/60 técnicos y 28/60 formales no se modifican manualmente.
- `/security-review` no estaba disponible; se hizo revisión manual y `/code-review` con agentes separados, además de regresiones adversarias. No se afirma haber ejecutado la habilidad ausente.
- **Fase 3 pendiente:** corregir health/version y medir nueva serie 10K → 50K → 150K. No se inició en esta sesión.

## Historial de diagnóstico y evidencia incremental

Los apartados siguientes conservan estados intermedios y fallos; el cierre vigente es el anterior.

## Inicio de la continuación autorizada — registro histórico

- Restricción documental435 retirada por instrucción expresa de Javier, commit `88484f3`. No hay bloqueo activo observado ni cambio de controles de plataforma.
- Matriz original F01-03 del código actual: **445/445 PASS, cero fallos/cancelaciones**,382,364s; log `/private/tmp/rovaq-fase2-receipts-20261007/sql-matrix-current.log`. Este resultado reemplaza la matriz114/2 como evidencia reciente de esa suite, sin convertirla en gateF07global.
- HallazgoP2 confirmado: lecturasHTTP no acotadas antes de bufferizar. Corrección local en curso: lector de bytes con límites por ruta, cancelación/deadline5s y máximo64lectores por proceso; triggers≤2bytes. Unidades7/7 y27/27; scaffold original lint/tipos/build PASS34,036s. Revisión focal pendiente.
- ControlF07-01 se prepara aparte en worktree `/private/tmp/rovaq-fase2-control-20261007`, rama `control-f07-01`; no es candidato aceptado. Prueba nueva de descargasStorage en diagnóstico: contrastar autenticación vigente y emisión de enlaces reutilizables. Ningún hallazgo nuevo se considera cerrado antes de su prueba.
- Canonical `/Users/javiercamaraportepetit/vexa`, rama `fase-2-seguridad`, cambiosHTTP todavía sin commit. Copia compilada `/private/tmp/rovaq-fase2-dependencies-20261007`; recibos `/private/tmp/rovaq-fase2-receipts-20261007`.

## Verificación incremental de seguridad — continuación

- **HTTP P2:** extensión a todos los lectores detectados en email, equipo, evaluación, recuperación, plataforma, imports y notificaciones. Dos revisiones estáticas focales sin nuevos P1/P2. La admisión64 se comparte por contexto Node; no es una cuota distribuida.
- El scaffold ampliado registró `spawnSync npm ETIMEDOUT`; se conserva rojo en `body-expanded-scaffold.log`. Diagnóstico por etapas con el mismo límite55s: lint PASS13,528s, tipos PASS9,765s y build PASS52,262s en copia aislada. Estos resultados no borran el fallo anterior ni prueban todavía la matrizHTTP servida.
- **SEC-04 confirmado:** un enlace firmado emitido por el propietario seguía entregando200 después de revocar su membresía (`storage-revocation-before.log`, aserción `SIGNED_URL_SURVIVES_REVOCATION`). La migración 0041 deniega firmas de descarga individual, lote e imagen mediante política restrictiva, manteniendo descargas autenticadas y admisión de uploads firmados.
- GateStorage de control revisado y congelado en `95b4ec8`: **8/8PASS**, cero fallos/cancelaciones,25,232s (`storage-revocation-after-v2.log`). Comprueba bytes/ranges/listados positivos, A/B/anon, uploadfirmado, tres variantes de firma denegadas y revocación inmediata del mismo URL autenticado. Calibración por defecto ausente completada: copia sin0041 falla independientemente en las tres variantes de firma, preserva positivos (`storage-signing-mutant.log`).
- La primera ejecución posterior al parche falló por el texto del error bulk esperado por el examen; el servicio devolvió una denegación válida. El ajuste del literal se revisó fuera del candidato, sin admitir errores internos ni URLs firmados.
- **Transición pendiente de despliegue:** la migración no invalida URLs emitidos anteriormente. Para afirmar revocación inmediata en una instalación existente hace falta acreditar su expiración o un mecanismo de invalidación autorizado. No se cambió producción ni claves.
- Limpieza de la matrizSQL445 verificada: sus cuatro contenedores y red constan ausentes en `sql-cleanup.json`.

## Estado de la verificación HTTP y partición SQL

- GateHTTP congelado `497db64`, corrección de equivalencia de redirects `360077b`: **11/11PASS**,129,409s, sin cancelaciones (`http-security-final.log`). Prueba31POST con origen ausente/ajeno y topes específicos, TCPchunked/stall,65lectores en tres bundles (64timeouts y un429), seis triggers con secreto y positivoIDLE, headers, selectors y mismaURL owner→viewer→B/revocación. Los conteos sin cambios sólo observan imports/jobs/connections/memberships; no afirmar cobertura de mutaciones de todas las tablas.
- Primera corrida HTTP: un único subtest falló porque el examen esperaba Location absoluto y Next emitió `/login` relativo. Se normaliza con `new URL(location,base)` y se exige la URL final exacta, incluyendo origen/path/query; cambio revisado fuera del candidato.
- Fallo de disponibilidad concreto: imports hosted conservaba `active=true` si `close()` lanzaba. Reproducción `trigger-cleanup-before.log` (siguiente petición409 en vez de200); finally anidado corrige liberación. **28/28PASS** en `trigger-final.log`; revisión focal sin nuevos defectos.
- Kernels gateway/conectores:91PASS. Tres módulos email del primer comando no tenían `VEXA_CANDIDATE` y fallaron por configuración del examen, no por producto; repetidos con el candidato explícito: **21/21PASS**, `security-email-kernels.log`.
- MatrizSQL posterior a0041:443PASS, cero fallos de aserción, **una cancelación** del padre por600s, duración649,170s (`sql-matrix-final.log`). No cuenta como matriz completa; los cinco recursos propios constan eliminados. La corrida previa445PASS sigue siendo evidencia del código SQL anterior a0041.
- Control `66a79d7` divide el mismo examen en tres tests top-level, conserva todos los oráculos, fixtures y orden, cada uno con el plazo previo600s y barrera de prerequisito/fallo/cancelación. Mediciones de subtests: core177s, dominio173s, FK41s; setup/seeds añaden tiempo. No se elevó un plazo compartido a ciegas. Resultado de la partición: **447/447PASS**, cero fallos/cancelaciones/skips,568,824s (`sql-split-final.log`). La diferencia de dos pruebas son los nuevos padres, sin quitar oráculos. Los cuatro contenedores y la red propios están ausentes (`sql-split-cleanup.json`).
- ControlHTTPextra `5ed5b7c`: **7/7PASS**,99,769s (`http-extra-final.log`), build con canarios, CRMfirmado→receiptSQL y replay/negativos/revocación, logout real con cookie antigua/pestaña/back, logs sin canarios secretos/PII. La primera corrida falló por origen loopback normalizado por Next y lectura parcial de cabeceras Playwright; el control fija localhost y `headerValue`, sin debilitar verificación del producto. Exports autenticados: delta aún pendiente.
- Extracción real+gateway SYN, control `f018e5c`: **17/17PASS**,36,100s (`extraction-security-final.log`), roles system/user separados, contenido hostil y cita con revisión B rechazada sin issues A, PII redactada, ningún fetch externo. No acredita comportamiento semántico de un modelo vivo.
- Historial congelado en `676888a`; notificaciones en `66e7230`. Revisiones estáticas focales sin bloqueantes; sus ejecuciones completas siguen pendientes.

## Diagnósticos nuevos durante la integración

- Notificaciones `66e7230`: **58/58PASS**,147,481s, consumidor ySQL reales con receptorSYN local; no entrega externa. Log `notification-security-final.log`.
- Historia `676888a`: FAIL87,116s tras tres pasos aprobados (102conversaciones CRM, API acotada y kill/reanudación). Primera extracción failed. El preload histórico sólo intercepta OpenRouter global, mientras la configuración usa EU; calibración en memoria reproduce `transport_error` antes de red y de registrar proveedor. Corrección sólo del control en revisión; seis recursos propios eliminados. No se altera residencia/configuración del producto.
- Exports `013b349`: el examen servido detectó CSP estricto sustituido por CSP global, regresión del parche local de cabeceras antes de desplegar. Fix preparado en next.config con entrada posterior específica `/api/briefs/:id/export`. Misma aserción repetida sin rebajar política: **8/8PASS**,62,074s en `http-export-after.log`; verifica exportJSON/HTMLreal, identidad/hash, bytes/headers sin canarios, escapeHTML, aislamiento y revocación. `http-export-final.log` conserva rojo (6PASS/2FAIL contando padre).

- Calibración HTTP: copia aislada sin límite de bytes rechazada específicamente por `CHUNKED_LIMIT` (408observado/413esperado);9subtestsPASS y1FAIL más padre, sin cancelaciones,73,421s (`body-mutant.log`). No se cambió el candidato para esta calibración.

## Composición local final — tercera ejecución en curso

- Producto HTTP y cabeceras: `c5f239d`. Storage0041: `fd73831`. Los15 commits de control revisados se incorporaron localmente conservando commits y autoría; no hay push ni merge remoto.
- Control congelado: `5a02a4c`; candidato integrado: `8935893`. F07-01 existe y el registro dice authored, con `product_pass:false`; no se altera la aceptación formal.
- Historia corregida: **14/14PASS**,492,181s (`history-security-after.log`), incluye seis calibraciones del simulador y los siete pasos reales con102conversaciones, extracción/agrupación, kill/reanudación, cancelación y revocación. Los hashes de nueve tablas de publicación y el número de llamadas del proveedor permanecen iguales tras revocar. Infraestructura propia retirada.
- Manifiesto de fuentes renovado deliberadamente:2216archivos,6añadidos,38cambiados,ningunoeliminado; preflightPASS sin infraestructura/capacidad (`source-preflight-final.json`). Toda medición previa conserva su composición; fase3 debe empezar10K→50K→150K después de su ajuste health/version.
- Gate global:17componentes secuenciales, sin filtros/skips ni resultados vacíos admisibles. Rechaza fallos/cancelaciones, cambios de fuentes y huecos de cobertura. Primera ejecución FAIL en `f07-global.log`: presupuesto SQL exterior720s agotado y `kill EPERM` posterior al cierre impidió recibo individual. TAP incompleto no cuenta como PASS. Cinco recursos propios recuperados por ID/etiquetas verificadas (`global-sql-recovery.json`), sin recursos ajenos. Corrección del controlador en revisión: recibos persistentes, journal0600 por componente, recuperación acotada y presupuesto SQL derivado de sus tres casos existentes600s +360s de cierre/arranque, sin ampliar casos ni rebajar oráculos.
- Reparación del controlador congelada `d6d87d1`, adoptada localmente `54be5cf`: **11/11 calibracionesPASS**, incluyendo EPERM post-exit, journal ajeno denegado, CLI resistente aSIGTERM y descendiente vivo eliminado antes de recuperar. Revisión Spec sin bloqueantes; ambosP2delcontrol resueltos. Segunda corrida integral en `f07-global-v2.log`; no hay resultado global todavía.
- Segunda corrida FAIL tras12componentesPASS y fuentes sin cambios: emailkernels no pudo importar `resend` porque canonical se conserva sinnode_modules. Solución de ambiente, sin cambiar controles/producto: worktree aislado `54be5cf` con npmci offline; 2688archivos/hash de fuentes idénticos, lock idéntico, copia Git limpia. Los21casos email pasan en0,364s (`global-email-prepared.log`). Tercera corrida completa `f07-global-v3.log`, sin reutilizar resultados parciales como PASS global.
- Revisión estática adicional de SSRF: los conectores no descargan URLs de adjuntos/recording_url; las rutas CRM se construyen con IDs y origen permitidos. Storage usa servidor configurado y path autorizado; no se identificó destino de adjunto controlado por payload. El wrapper de recuperación no prohíbe redirects explícitamente: revisión de flujo, no prueba dinámica de DNS/infraestructura.

## Trabajo independiente completado

La auditoría del lock consultó el registro público npm desde una copia aislada, sin enviar fuentes, credenciales ni datos de cliente. Reportó siete alertas altas correspondientes a tres causas. Se actualizaron dos dependencias transitivas dentro de sus rangos compatibles:

| Causa | Antes → después | Resultado |
|---|---|---|
| `sharp` | 0.35.4 → 0.35.5; paquetes binarios correspondientes y libvips 1.3.4 | Alerta eliminada del lock. El smoke macOS ARM64 carga librsvg 2.63.2. |
| `source-map-js` | 1.2.1 → 1.2.2 | Alerta eliminada del lock; conversión básica de mapas verificada. |
| `braces`, vía micromatch/fast-glob/plugin/config ESLint Next | 3.0.3, sin cambio | Cinco alertas transitivas altas de desarrollo siguen abiertas, una causa común. |

Las versiones correctivas proceden de los avisos de [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) y [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). El aviso de [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) no publica una versión corregida; `npm view braces` devuelve 3.0.3 como última versión. No se aplicó el downgrade mayor a ESLint Next 14 que sugiere `npm audit fix --force`.

`npm audit --omit=dev` terminó con exit 0 y cero alertas. La auditoría completa terminó con exit 1 y cinco alertas altas: **el resultado completo sigue rojo**. Estos resultados identifican dependencias conocidas; no demuestran explotación del producto ni ausencia de vulnerabilidades desconocidas. La exclusión de desarrollo acota la exposición reportada y no resuelve el riesgo de las herramientas de construcción.

Revisión estática focal del riesgo restante por `/root/sql_spec`: la única llamada de `@next/eslint-plugin-next` a fast-glob está condicionada a `settings.next.rootDir`; la configuración ESLint vigente y las heredadas no lo definen y usan cwd directamente. Un href JSX no alimenta ese patrón. No se identificó un flujo desde entradas HTTP/CRM/adjuntos del producto a braces. Las cinco alertas high siguen abiertas y el audit completo sigue FAIL; no se consideran por sí solas un P1/P2 de producto demostrado ni una exención permanente. Añadir patrones rootDir no confiables o reutilizar estos paquetes exige revisar la conclusión. No se alteró el lock para ocultarlas.

El lock cambia semánticamente 28 entradas: las dos librerías y los binarios/libvips de sharp. No cambian versiones directas ni rangos. Se actualizó únicamente el hash de `package-lock.json` en el inventario de carga y se declaró una nueva composición. Se requiere una serie nueva 10K → 50K → 150K en fase 3.

## Verificación

- Instalación limpia en copia temporal con scripts de instalación desactivados: exit 0.
- Gate original F01-01, que incluye instalación offline, lint, TypeScript y compilación Next: 1/1 PASS, 32,076 s, sin cancelaciones ni cambios de plazo.
- Smoke de imagen PNG y mapa de código: PASS en macOS ARM64. No ejecutado en Linux ni en el despliegue.
- Preflight del manifiesto: 2.210 archivos concordantes; no crea infraestructura ni mide capacidad.
- No se modificaron `tests/acceptance` ni `orchestration`. Sin push, despliegue o cambios de producción.

Comandos, resultados completos de npm audit, versiones y hashes: [recibo de dependencias](FASE-2-DEPENDENCIAS-2026-10-07.json).

## Revisión focal del parche

**Standards — 0 hallazgos.** El revisor `/root/sql_standards` comprobó cambios semánticos limitados a 28 entradas, hash del lock concordante y límites de capacidad conservados. Sin infracciones documentadas ni smells pertinentes.

**Spec — 0 hallazgos.** El revisor `/root/sql_spec` comprobó versiones y rangos directos intactos, parches compatibles, nueva composición explícita y braces abierto. Sin requisitos ausentes dentro del lote ni alcance adicional.

Ambas revisiones son estáticas sobre `f6ee046…0913644` y los recibos; no repitieron las pruebas ni comprobaron todos los binarios opcionales. Son independientes del autor de este parche y no revisan ni aprueban F07-01.

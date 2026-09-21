# Construcción automática VEXA

Objetivo completo: [ALCANCE-CONFIRMADO](construccion/ALCANCE-CONFIRMADO.md). Programa: [PROGRAMA](PROGRAMA.md). Repositorio canónico `~/vexa`; NO ejecutar en la copia de Escritorio. Las fuentes privadas permanecen locales.

## Checkpoint vigente —17/60; F03 en construcción

F02 sigue6/6 aceptada y publicada. F03-01..05 tienen propuestas locales revisadas; salud05 pasó15/15 en Node22/26 y29/29 de sincronización tras corregir una recuperación de resumen. Comparación06 pasó17/17 en ambas versiones antes de revisión; un caso de nombres de canal ya tiene corrección aprobada y regresiones finales en cierre. Estos resultados son pruebas locales, no incrementos del contador aceptado.

El cierre oficial sigue en F03-01: faltan cuentas/permisos legítimos de HubSpot/Zendesk y reconciliación independiente sobre20conversaciones autorizadas. El usuario autorizó expresamente continuar propuestas locales de F04 mientras tanto. Gateway01 reutiliza el banco revisado y está en examen local; sin inferencia pagada ni resultados de cliente inventados.

Límites conservados:220llamadas acumuladas, deadline00:00 del21-sep UTC−06, máximo3agentes y cero gasto nuevo. El trabajo de controles revisados puede conservarse en GitHub bajo la autorización explícita de push/merge, con publisher, Actions desactivadas y SHA comprobado; no presenta el producto propuesto como aceptado. No hay un supervisor desatendido acreditado. Los apartados siguientes son históricos.

## Historial — F02 completa,17/60

F02 en6/6, compilada y probada. F02-05 (`9e738b9`) y standalone06 (comportamiento existente en `63b9725`) pasaron27grupos cada verifyNode22/acceptGitlimpioNode26; cuatro regresiones y cuatro jobs CI verdes, producto intacto y cleanup verificado. Publicar cierre06 antes de abrirF03. IncidenciaCSV anterior no reproducida sigue documentada, sin causa demostrada; examen reforzado y seguimiento en auditoría integral. No producción remota ni Actions habilitado. Presupuesto acumulado200/220; deadline vigente00:00 del21-sep UTC−06, sin reset ni gasto nuevo.

## Historial — F02-05 aceptado,16/60

F02 en5/6. Producto `9e738b9`: revisión independiente, verifyNode22 y acceptGitlimpioNode26 con27grupos cada uno; regresiones01–04 y cuatro jobs CI verdes, fuentes/control intactos y limpieza verificada. Publicar mediante publisher autorizado antes del cierre06. IncidenciaCSV anterior no reproducida: causa desconocida preservada, examen reforzado con recibo/precondiciones y seguimiento en auditoría final. Sólo después de aceptar/probar/publicar06 se anunciará17/60. Sin producción remota ni Actions habilitado.

## Historial — F02-04 aceptado,15/60

F02 en4/6. Producto `26a0d9f`: revisión independiente, verify04, regresiones01/02/03 y cuatro jobs CI pass; huellas intactas y limpieza verificada. Padre interrumpido reconciliado mediante evidencia original en recibo nuevo; accept limpio exit0. Publicar mediante publisher autorizado antes de integrar05. Faltan05/06 y pruebas remotas; no anunciar17/60 hasta aceptar, compilar, probar y publicar toda F02.

## Historial — F02-03 aceptado,14/60

**14/60; F02 en3/6.** Commit `f0eb856`: verify03, F02-01/02 y los cuatro jobs CI pass; fuentes/control intactos y cleanup verificado. Accept reejecutó desde copia Git limpia, exit0. Publicar por publisher con opt-in público antes de preparar04. Permanecen pendientes04–06 y validación remota. El relato siguiente conserva el rechazo anterior, no el estado vigente.

## Historial — cierre único F02-03

**13/60**. Recoger resultados terminados antes de abrir más trabajo. F02-03 pasó su examen y F02-01/02, pero fue rechazado por regresión global: lint de efecto React y número de destinos del menú principal. Propuesta de corrección mínima y revisión del smoke offline en curso; no repetir aprobaciones de código inalterado ni aceptar un candidato con regresiones rojas. Después de accept limpio, publicar por publisher y comprobar el SHA remoto antes de avanzar.

Cada fallo requiere comando, causa reproducible, corrección y prueba afectada; conservar también errores intermitentes y corridas incompletas. Las propuestas04–06 no frenan el cierre independiente de03. F02 sólo se anuncia terminada con6/6 aceptadas, compilación integrada, regresiones y publicación:17/60 global.

## Último checkpoint aceptado — F02-02

**13/60**, commit `791c854`. Carga directa y confirmación atómica aceptadas tras corregir/revisar la matriz global (168baseline/172producto,97/100FK). Nuevos verify/accept limpios, F02-01 y cuatro jobs CI pasaron:12gates anteriores+controlador110, fuente/control intactos y24recursos limpiados. Rechazo original preservado. F02-03/04 continúan como propuestas disjuntas: navegador03 todavía en depuración, examen03 y persistencia04 sin aceptación.

Usuario reiteró loop y entrega connection-ready de TODO blueprint+audios, conintegraciones implementadas ydespués sólo credenciales/autorizaciones externas. DespliegueVEXA enVercel autorizado; no gastoextra/inferencia/Actions. Supabasepropio creado, SQLremoto bloqueado poraprobacióninteractiva, no eludirporotrocanal.

Renovación REAL de todo el día del20-sep: ventana hasta00:00 del21-sep UTC−06, techo76F02/220global con base144; registro privado atómico sin reset. Corte de revisión:191global iniciadas. Máximo3agentes de la misma fase, principal único integrador. STOP propio archivado y retirado después de revisión/corrección congelada. No hubo bucle activo toda la noche; no se afirma ejecución desatendida por tener un plan. Revisiones/aceptación no renuevan presupuestos automáticamente. Fuentes/rechazos intactos; no reutilizar la antigua extensión errónea ligada al permiso económico. Recibos privados vigentes mandan.

## Publicación y cierre autorizados el20-sep

GitHub VEXA es público por decisión externa y confirmación explícita del usuario. El primer intento fue bloqueado; se corrigió el publicador mediante opt-in revisado, no bypass. Principal: `publish_vexa(root, allow_public=True, allow_actions=False)`. El supervisor mantiene default cerrado: no arrancarlo asumiendo que ya tiene ese permiso configurado.13tests de publicador/117controlador y revisión independiente; publicar sólo cambios reales revisados, sin secretos ni fechas/commits artificiales.

El cierre exige60/60 más auditoría final integral con testers de UI, botones, features, agentes, integraciones y recuperación. Después únicamente credenciales/configuración/autorizaciones externas; no conectores por programar. Auditoría local no acredita producción externa ni elimina aprobaciones humanas.

## Modo vigente — paralelismo dentro de una fase, cierre serial

Última instrucción del usuario: terminar/integrar una fase antes de avanzar, usando varios agentes para acelerar. Máximo3 agentes sobre **una sola fase/tarea**, con copias y responsabilidades separadas (examen, regresiones, QA); principal único integrador. F01-04 aceptado50674a4 y publicado84219b0 con SHA remoto verificado. F01-05 aceptado17263dc con verify/accept limpios y publicado8340d26 (SHA y autoría remotos verificados). BloqueF02 activo con hasta3agentes disjuntos: límites/streaming/XLSX del examen, examen durable SQL/Storage/jobs y propuesta de parser reutilizando banco. Propuestas y exámenes pueden avanzar en paralelo; el gate se congela antes de prepare/adopción oficial/verify/accept, no se usa esta regla para impedir propuestas aisladas. No autoaceptar propuestas ni contar CI remoto por pruebas locales. No abrir más módulos ni otro supervisor que compita. `PLAN.md` y recibos actuales prevalecen sobre cifras históricas siguientes.

Ventana vigente F02:11/60, hasta20:46 del19-sep,144invocaciones previas y6iniciadas=150/220 al abrir propuesta parser;120min/hasta24nuevas,3concurrentes, cero gasto de construcción/API. Excepción posterior explícita: hasta10USD/mes adicionales para UN proyecto SupabaseVEXA, sin extras/cambio de plan; no autoriza OpenRouter ni otros servicios. La ventana F01-05 terminó con aceptación y se archivó antes de abrir ésta. Reconciliar recibos, no reiniciar contadores ni renovar automáticamente al agotar límites. F01-04 ya tiene aprobación del examen/UI y aceptación limpia:193regresiones+110controlador. Timeout y posterior rechazo por registro stale permanecen preservados. Repetir congelar/prepare/verify/revisión/regresiones/accept/publicación para cada siguiente tarea. No declarar producción por fuentes sintéticas ni activar gasto/cloud/envíos por esta renovación.

## Historial: propuestas paralelas, promoción serial
El usuario pidió agentes/loop graph y fijó UN MES. PLAN.md contiene el mapa de propietarios/entregables. Módulos independientes pueden construirse como propuestas aisladas antes de que sus dependencias se acepten; no se cuentan como progreso aceptado. Antes de adoptar en candidato oficial: examen externo diseñado/revisado/congelado desde contrato, allowlist explícita, pruebas/revisión/materialización limpia. Propuestas no modifican raíz/control-plane ni DB compartida.

El supervisor serial se detuvo en checkpoint; equipo paralelo terminó y Auth fue aceptado después. Las pausas propias se retiraron verificando token, sin borrar ajenas. Recibos del equipo en `private/parallel-batch-1.json` y `.runtime/team-*/`. Antes de reanudar comprobar revisión del grafo v4, presupuesto reconciliado y checkout limpio. No lanzar otro escritor del baseline por ver un PID parado.

## Historial: continuidad tras renovación de créditos
El usuario renovó créditos después del checkpoint de una hora. Siete propuestas quedaron en commits locales con estado parcial/revisión pendiente; se retoman, NO se reconstruyen. F01-03 amplió el examen a72controles/mutantes; sigue sin congelar por hallazgos y fallos de fixtures contra candidato. Principal también reprodujo13SQL de jobs,6SQL de métricas y13SQL de notificaciones; no equivalen a producto integrado. Fuentes/recibos en PROGRESO.md.

Nueva tanda acotada120min, hasta6agentes disjuntos y promoción serial, bajo techo acumulado220.Última reconciliación:88invocaciones Codex (33previas+55recibos); máximo132adicionales compartidas por propuestas manuales y supervisor serial. Recontar recibos antes de lanzar; no son presupuestos independientes ni contabilidad de tokens. El nuevo permiso no autoriza API pagada, contratación, envíos externos ni declarar producción sin pruebas. STOP propio del checkpoint se conserva hasta cerrar integración/revisión: no borrarlo para lanzar otro escritor.

## Checkpoint anterior — segunda ola del 19-sep
Tras recuperar la sesión, el autor corrigió F01-03 y terminó; STOP propio `parallel-wave-2-checkpoint-20260919` retuvo el supervisor antes de revisión/congelación. Principal reprodujo9controles SQL/mutantes reales. Propuesta conservada en `.runtime/auto-1789829683970974000-1789829684063951000-gate-worktree`; NO abrir otro autor sin revisar/adoptar lo que ya produjo. El examen completo todavía no acredita F01-03.

Cuatro constructores trabajan en propuestas disjuntas según PLAN.md y recibos `private/parallel-wave-2.json`.33llamadas consumidas antes de esta ola,20reservadas para propuestas/revisiones,167disponibles para el siguiente supervisor bajo techo220. Política reducida, no conteo reiniciado. Los números de tandas anteriores que siguen abajo son históricos. Antes de reanudar: terminar checkpoint, revisar lo integrado, reconciliar consumo real, comprobar locks/checkout limpio y retirar sólo STOP propio por token.

## Ciclo real
1. Seleccionar una tarea elegible del grafo, respetando dependencias aceptadas.
2. Autor separado escribe su examen externo faltante; ejecutarlo sobre baseline y someterlo a revisión independiente.
3. Abrir candidato aislado. Codex/Astra construye sólo la allowlist.
4. Gate congelado, revisor independiente del código, reejecución de TODOS los gates previamente aceptados contra el candidato y suite del controlador.
5. `runner accept` revalida una materialización limpia del commit antes de promoverlo.
6. Con permiso explícito del usuario: merge **fast-forward** a `main` y push al repositorio privado `javiercamarapp/vexa-ai`, verificando SHA remoto. No commits vacíos, fechas falsas, force-push ni división artificial de cambios para inflar actividad.

No basta un JSON que diga passed ni aprobarse a sí mismo. El gate debe probar efectos reales del requisito; una prueba simulada no acredita un servicio remoto.

## Ejecución y estado
```bash
cd ~/vexa
python3 orchestration/runner.py status
python3 orchestration/autoloop.py status
# Desde checkout limpio, sin candidato preparado/verified ni otra corrida:
python3 orchestration/autoloop.py run
```
`run` devuelve2 al detenerse con recibo parcial: revisar `reason`, no interpretarlo como producto terminado. El proceso puede ejecutarse desacoplado de la terminal; sólo un PID vivo y el recibo lo acreditan. No es un servicio que sobreviva garantizadamente a suspensión/reinicio/SIGKILL.

## Límites históricos de la tanda anterior
- Política `orchestration/auto-policy.json`:47IDs locales F01–F07 (incluye5notificaciones), **120min**,54ciclos; último corte132invocaciones adicionales bajo techo acumulado220. Usar reconciliación de recibos vigente, no cifras históricas; no borrar consumo al relanzar.
- Dos intentos por tarea; agotamiento persiste entre relanzamientos. Un solo escritor: supervisor mantiene tanto su lock como el del runner.
- Login ChatGPT comprobado antes de cada llamada, timeout15s; cada modelo hasta15min. Sin fallback a API key/OpenRouter para desarrollar.
- Sin gasto incremental autorizado. GitHub privado ya creado; **Actions desactivadas temporalmente** hasta aprobar uso/presupuesto. YAML o tests locales no se llaman CI remoto verde.
- Proyecto Vercel `vexa-ai` creado en cuenta existente, **sin deploy**. Supabase `vexa-local` corre localmente en5632x; proyecto cloud Supabase, Google real y OpenRouter real pendientes.
- Supabase local sólo sintéticos, config propia `supabase/config.toml`; jamás usar puertos5432x/5532x ni otras bases. La configuración local no es política de producción.
- No procesar datos de Senix ni usar credenciales ajenas. Las credenciales locales de ensayo deben capturarse dentro del test/proceso, no volcarse a logs ni al modelo.

La política cubre construcción local y publicación de código, no reduce el objetivo completo. Las tareas dependientes de permisos/datos/gasto siguen abiertas. El plazo es un límite operativo aproximado; no una garantía de deadline global estricto de toda IO.

## Pausar y recuperar
Crear `.runtime/STOP` detiene nuevas etapas/vueltas; no mata de inmediato una operación ya iniciada. No borrar un STOP ajeno ni modificar recibos a mano.

Tras investigar una tarea agotada y corregir la causa:
1. Mantener STOP y checkout limpio.
2. Si runner quedó failed/blocked, usar su `recover --task ID --approval-note 'revisión real'`. Si verified fue rechazado, usar `reject`. Un prepared requiere diagnóstico/verificación; no inventar su estado.
3. Ya en pending, renovar explícitamente sólo su presupuesto:
```bash
python3 orchestration/autoloop.py retry --task ID --approval-note 'causa revisada y nuevo ciclo autorizado'
```
4. `retry` conserva STOP y evidencia. Revisar antes de retirar la pausa y reanudar. No se renuevan ciclos agotados por simple relanzamiento.

## Ampliaciones y primera parada
Push/correos profesionales: [spec con destinatarios confirmados VEXA](docs/superpowers/specs/2026-09-19-notificaciones-propuesta.md). Grafo v4 añade explícitamente F06-08..12; componentes revisados en banco local, no funcionalidades integradas ni entregas remotas verificadas.

Primera tanda se detuvo por rechazo del gate F01-02: redirect tras éxito, control positivo de replay y demostración de oráculos sobre defectos. Se conserva el rechazo. Antes de reautoría leer [correcciones](construccion/correcciones/F01-02-gate.md). Ese corte no había aceptado Auth; posteriormente F01-02 sí fue aceptado en8f85ee7 tras gate real y materialización limpia. La renovación requiere nota y STOP explícitos, incluso si la tarea aún no tiene fila de producto.

## Evidencia
- Scaffold F01-01 aceptado en `9e0010a`: Next.js real, instalación offline/lint/typecheck/build en copia temporal; revisión independiente del código. Ese hito no acreditaba Auth ni producto completo; Auth local se aceptó después, el SaaS completo sigue abierto.
- Correcciones revisadas: login persistido, lock compartido, presupuesto persistente y publicación de main adelantada; esta última bloqueada antes de enviar, con refspec SHA inmutable.
- `python3 -W error::ResourceWarning -m unittest discover -s tests/controller`: **108tests OK** en repos canónico. La regresión adicional permite recuperación explícita si el gate fue rechazado antes de que existiera candidato; no crea un estado de producto ficticio. Git real, CLI Codex simulado y remotos bare en tests; no demuestra autonomía prolongada ni cloud.
- `npm test`:24tests kernel/preparación. `node --test tests/tooling/scaffold-copy.test.mjs`:3tests de copia/entorno; el filtro relativo conserva candidatos dentro de `.runtime`. El build usa whitelist de entorno y npm config vacía para evitar EALLOWSCRIPTS al invocarlo desde npm run y no heredar claves/preloads.
- Informes privados `automation-review-result.json`, `automation-recheck-result.json`, `publisher-final-review-result.json`; informes adversos preservados, no reescritos como aprobaciones. Última revisión:6tests publisher OK, sin P0/P1/P2 en ese alcance.

Worktree y revisores son controles para agentes cooperativos, no aislamiento frente a malware. Aún no se acredita el SaaS desplegado, aislamiento funcional completo, Google OAuth, inferencia pagada, datos cliente ni resultados comerciales.

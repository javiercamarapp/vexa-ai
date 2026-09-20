# Construcción automática VEXA

Objetivo completo: [ALCANCE-CONFIRMADO](construccion/ALCANCE-CONFIRMADO.md). Programa: [PROGRAMA](PROGRAMA.md). Repositorio canónico `~/vexa`; NO ejecutar en la copia de Escritorio. Las fuentes privadas permanecen locales.

## Modo vigente — paralelismo dentro de una fase, cierre serial

Última instrucción del usuario: terminar/integrar una fase antes de avanzar, usando varios agentes para acelerar. Máximo3 agentes sobre **una sola fase/tarea**, con copias y responsabilidades separadas (examen, regresiones, QA); principal único integrador. F01-04 aceptado50674a4 y publicado84219b0 con SHA remoto verificado. F01-05 activo: dos autores control-plane aislados para Auth portable y ejecutor/examen CI; revisión posterior, sin aceptar propuestas automáticamente. No abrir más módulos ni otro supervisor que compita. `PLAN.md` y recibos actuales prevalecen sobre cifras históricas siguientes.

Inicio de esta tanda:9/60aceptadas,128invocaciones consumidas/220globales,120min y hasta24nuevas. Reconciliar desde recibos, no reiniciar. F01-04 ya tiene aprobación del examen/UI y aceptación limpia:193regresiones+110controlador. Timeout y posterior rechazo por registro stale permanecen preservados. Repetir congelar/prepare/verify/revisión/regresiones/accept/publicación para cada siguiente tarea. No declarar producción por fuentes sintéticas ni activar gasto/cloud/envíos por esta renovación.

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

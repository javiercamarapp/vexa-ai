# Construcción automática VEXA

Objetivo completo: [ALCANCE-CONFIRMADO](construccion/ALCANCE-CONFIRMADO.md). Programa: [PROGRAMA](PROGRAMA.md). Repositorio canónico `~/vexa`; NO ejecutar en la copia de Escritorio. Las fuentes privadas permanecen locales.

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

## Límites de esta tanda
- Política `orchestration/auto-policy.json`:42 IDs locales F01–F07, **150min**,55ciclos,215llamadas Codex como máximo, después de5llamadas bootstrap/revisión.
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

## Evidencia
- Scaffold F01-01 aceptado en `9e0010a`: Next.js real, instalación offline/lint/typecheck/build en copia temporal; revisión independiente del código. No Auth ni producto completo.
- Correcciones revisadas: login persistido, lock compartido, presupuesto persistente y publicación de main adelantada; esta última bloqueada antes de enviar, con refspec SHA inmutable.
- `python3 -W error::ResourceWarning -m unittest discover -s tests/controller`: **107tests OK** en repos canónico. Git real, CLI Codex simulado y remotos bare en tests; no demuestra autonomía prolongada ni cloud.
- `npm test`:24tests kernel/preparación. `node --test tests/tooling/scaffold-copy.test.mjs`:3tests de copia/entorno; el filtro relativo conserva candidatos dentro de `.runtime`. El build usa whitelist de entorno y npm config vacía para evitar EALLOWSCRIPTS al invocarlo desde npm run y no heredar claves/preloads.
- Informes privados `automation-review-result.json`, `automation-recheck-result.json`, `publisher-final-review-result.json`; informes adversos preservados, no reescritos como aprobaciones. Última revisión:6tests publisher OK, sin P0/P1/P2 en ese alcance.

Worktree y revisores son controles para agentes cooperativos, no aislamiento frente a malware. Aún no se acredita el SaaS desplegado, aislamiento funcional completo, Google OAuth, inferencia pagada, datos cliente ni resultados comerciales.

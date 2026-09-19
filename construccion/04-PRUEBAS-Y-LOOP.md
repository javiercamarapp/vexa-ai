# 04 · Programa de construcción, examen externo y automejora

## Dos loops distintos

**Construcción:** requisito → gate → candidato → pruebas → revisión → aceptación → siguiente tarea. Es el controlador local de `orchestration/runner.py`.

**Calidad del producto:** generar escenario → ejecutar app/DB/worker → comparar oráculos → reproducir bug → regresión roja → fix → revalidar → documentar clase de fallo. Se implementa progresivamente en F07 sobre la app, no se declara existente por tener un controlador de desarrollo.

No agregar agentes de negocio al SaaS porque el constructor use agentes. No convertir un loop de ingeniería en permiso de CRM, correo, refunds o publicación.

## Programa del loop (reglas de trinquete)

- **Métrica:** criterios del incremento que pasan por verificación externa y revisión; dirección creciente. Nº de documentos, tokens y commits no es progreso.
- **Guardias:** cero regresión financiera/aislamiento; controles y expected intactos; sin datos/acciones no autorizados.
- **KEEP:** gate0, firmas/HEAD intactos, diff permitido, revisión; accept revalida antes de fast-forward.
- **REVERT:** el baseline nunca recibe candidato fallido. Conservar worktree/log como evidencia; no reset/clean de trabajo ajeno.
- **Presupuesto:** una vuelta por defecto, worker≤900s, gate≤300s, dos intentos por tarea; tiempo de sesión explícito. Instalaciones/red/QA larga son interactivas fuera del worker.
- **STOP:** gate ausente, dependencia pendiente, aprobación, 2 fallos, guardia, STOP o presupuesto. No renombrar blocked a pass.
- **Crash:** prepared se retoma; running huérfano necesita inspección. No prometer recuperación perfecta de SIGKILL/procesos desligados. Trabajo largo puede hacerse por varias sesiones en un prepared, sin aceptar a medias.
- **Aprendizaje:** reproducción y regresión permanente; dos ocurrencias de una clase justifican regla estructural; un snapshot actualizado no reemplaza una explicación de por qué cambió.

## Estado medible de gates

```bash
python3 scripts/guide.py readiness
```

El inventario inicial de esta ampliación tiene **8 gates de tareas presentes y 47 pendientes**. Los de F00 comprueban preparación/fixtures, no software. F01-01 es el gate de scaffold/build y **falla mientras no exista el scaffold**. F05-01 reutiliza el kernel, no prueba SQL/UI. Un gate pendiente tiene oráculos específicos en su ficha; se escribe y revisa justo antes de ese incremento.

Esto evita dos trampas: exigir tests de toda una app desconocida antes de empezar, o crear 54 archivos que sólo comprueban que existe un Markdown. **No se anuncia que todos los gates estén escritos.** Si el usuario quiere una corrida totalmente desatendida, este estado no la acredita.

## Cómo escribir un gate de función pura

Ejemplo orientativo para F04-04; la función es una interfaz a implementar, no código ya existente:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const candidate = process.env.VEXA_CANDIDATE;
assert.ok(candidate, 'candidate requerido; no importar baseline por accidente');
// Compilar TS a un temporal, o usar el loader fijado en F01; nunca inventar dist.
const {validateEvidence} = await import(pathToFileURL(path.join(candidate, 'packages/intelligence/evidence.mjs')));
test('rechaza cita del tenant B incluso si el texto coincide', () => {
  assert.throws(() => validateEvidence(
    {tenant:'A',revisionId:'B-r1',start:0,end:4,quote:'hola'},
    [{tenant:'B',id:'B-r1',text:'hola',role:'customer'}]
  ));
});
```

Ajustar la importación al módulo **real** creado por el contrato/ficha (TypeScript `src/evidence.ts` compilado en temporal). No crear una fachada que pase el test pero que la app no use. Añadir prueba de ruta HTTP→servicio→DB en F06/F07 para acreditar cableado. El ejemplo ilustra el oráculo, no es un archivo de gate entregado.

## Gates de integración: no se sustituyen por mocks

### DB/RLS
1. Verificador externo crea Supabase/Postgres efímero de ensayo, no instancia del cliente.
2. Aplica migraciones del candidato en orden. Sólo el setup usa servicio privilegiado.
3. Crea A/B y usuarios mediante Auth real local; inserta SYN-E2E-v1 con identidades distintas y canario B.
4. Ejecuta SELECT/INSERT/UPDATE/DELETE/FK/RPC/Storage como anon y usuarios A/B, roles de matriz; afirmar por valor y códigos exactos, no «ocurrió algún error».
5. Revoca membership entre requests y prueba cache/export/jobs. Consultar DB directamente para verificar persistencia.
6. Teardown sólo instancia/namespace propiedad de esa corrida. Si no pudo levantarse, `blocked`, nunca `skip` verde.

### Consumidor y durabilidad
Request→import/outbox atómicos→claim→efectos/checkpoint→ack→snapshot→lectura. Usar barreras explícitas para pausar entre commit y ack y para vencer lease antes del publish. Dos procesos reales sobre la misma DB; fake timers de Node no controlan reloj del servidor Postgres. Inyectar `now` en lógica y establecer las condiciones de lease en DB de ensayo bajo control del test.

Comparar conjuntos de IDs, no sólo COUNT(*): se puede perder una fila y duplicar otra conservando el conteo. Verificar oldest queued y alarma al apagar consumidor. Reordenar/repetir páginas/cancelar deben preservar garantías.

### Browser/HTTP
Playwright sobre la app **propia**. Usuarios A_owner/A_analyst/A_operator/A_viewer/B_owner. Abrir ocho rutas, usar botones reales, comprobar response y estado DB; el screenshot por sí solo no acredita POST exitoso. Medir a 390x844 y 1440x900, teclado/reduced-motion. Descargar export y comparar su scope/cifras con API/snapshot, no imagen parecida.

### Modelos/CRMs
Mocks sirven para 429/401/JSON inválido/reintentos/cursores y citas. No sirven para confirmar rutas/scopes efectivas ni precisión. Live tests necesitan permiso, presupuesto, datos mínimos y logs redactados. Anotar proveedor/endpoint/modelo/política y versión. Un catálogo de modelos accesible no implica elegibilidad contractual.

## Fixture exacto, bancos separados

- `tests/fixtures/syn-e2e-v1.json`: A/B, alias, 4 conversaciones A, 3 órdenes A, exposición global30000 USD, refund neto1500, replacement1200, soporte modelado500.
- SYN-PAGE-v1: 101 conversaciones neutrales distintas; paginación sin huecos/duplicados. No mezclarlas con totales del smoke.
- SYN-LOAD-v1: datasets10K/50K/150K con manifest por corrida y semilla. No decir que la precisión está validada por usar 150K textos repetidos.
- Gold humano: corpus privado consentido y versionado, train/dev/holdout separado por cliente/tiempo. Sin humano es synthetic, aunque el modelo «etiquete» muy bien.

## Matriz de promoción por capa

| Capa | Casos mínimos | Oráculo independiente | Punto de promoción |
|---|---|---|---|
| Dinero | FIN01..12 + replay/null/moneda/reversal/BigInt | kernel y expected de fixture | F05, sin modificar expected |
| Aislamiento | API/DB/FK/Storage/vector/export/cache/jobs | canario B y consultas como usuario | F01/F07, ninguna fuga |
| Ingesta | corruptos/límites/mapping/quarantine | filas originales vs aceptadas/rechazadas/duplicadas/pendientes | F02 |
| Durabilidad | JOB01..10 | efectos/checkpoints/fence en DB | F02/F07 |
| Migración | aliases/revision/deletes/cobertura | conjuntos antes/después, hashes de scope | F03 |
| IA | schema/quote/role/inyección/PII/política | revisiones autorizadas y gold externo | F04 |
| UX | UI01..08 + NEG01..08 | DOM+HTTP+DB+export; revisión visual | F06 |
| Operación | restore/rollback/tombstone/revoke/alarma | hashes/conteos y ensayo en entorno nuevo | F07/F08 |
| Comercial | comprensión/WTP/insight/acción | personas autorizadas y datos observados | piloto, no unit tests |

IDs y pasos ampliados en los cinco dossiers de `docs/blueprint/calidad/`; no se eliminan para mejorar un score agregado.

## Los seis modos de búsqueda adaptados a VEXA

1. **Propiedades:** montos enteros arbitrarios, cero/null, extremos, dedup; kernel ya tiene generación con semilla.
2. **Metamórficas:** orden/replay/partición de lotes/alias no cambian valor si no cambió identidad económica.
3. **Mutación:** quitar dedup, convertir null a0, sumar reversal, perder precisión, inflar escenario. En esta ampliación `scripts/probe_economics_mutations.py` prueba cinco mutaciones concretas en temporales. Resultado guardado en `RESULTADO-MUTACION.json`; **no es un mutation score completo del SaaS**.
4. **Fuzzing:** CSV/XLSX corruptos, zip bomb, fórmulas, encodings, Unicode y prompts hostiles; ningún ataque toca cuentas de terceros.
5. **Carreras/caos:** two claims, lease viejo, retry after commit, DB error por valor, timeout con costo incierto, revocación en vuelo.
6. **Red team con objetivo:** «extrae SOLO_B_9F como A» o «haz que UI y export discrepen con mismo scope». Componer pasos válidos, no sólo inputs absurdos.

Un mutante sólo es killed si falló una aserción relevante; syntax error/timeout/setup fallido se registran aparte. No subir umbral a100% con cinco mutaciones seleccionadas. Cada hallazgo debe reproducirse, quedar con seed/archivo/línea y conservarse en regresión.

## Qué se aprende de Likida sin copiar sus errores

Los documentos de Likida distinguen cobertura y protección, relatan crones sin heartbeat, lectores inexistentes y drift merge/deploy. VEXA adopta esa exigencia de observación. No importa sus autorizaciones de migrar automáticamente ni sus porcentajes históricos. «Nunca tocar pruebas» aplica al candidato; el control-plane sí mejora pruebas mediante revisión y rojo real, o el sistema no podría aprender.

# F02-04 y extensión global — propuesta de examen, NO aceptación

Llamada F02 34 / global178. Autor SQL/datos, sin delegación ni LLM adicional.
Worktree HEAD leído: `da5406b89a48b94a65a6e43bbc981cf4d4e834cc`.
Baseline oficial solicitado:13/60; este trabajo no modifica ese estado.
Fuente inmutable: `/Users/javiercamaraportepetit/vexa/.runtime/f0203-close-f0204-1789921456816411000/canonical`.
Fuente HEAD leído: `38a8c503cf691413fde27d385a47ade53273843e` (propuesta con cambios de producto no aceptados).
No candidate SHA nuevo: no se modificó Git. No freeze, guía, registry,
orchestration, producto, push, accept, cloud, gasto ni envíos.

## Implementación: defectos independientes reproducidos

1. **Identidad lógica / dinero duplicado.** `packages/ingestion/persistence/index.mjs:55`
   incorpora source_revision al ID proyectado; línea29 inserta otra orden.
   Dos revisiones de external_id `revision-money`, cantidades
   `9007199254740993` y `9007199254740994`, dejan2órdenes y suma
   `18014398509481987`. Historia=2 es correcto; proyección lógica=2 incumple
   `docs/blueprint/01-CONTRATOS-Y-DATOS.md`: actualizar por historia no sumar dinero.
   Rojo `LOGICAL_ORDER_SINGLE_PROJECTION`, observado2, esperado1. No trasladar
   esta duplicación a F05 como condición enterprise aceptada.
2. **Fecha opcional rechazada.** `index.mjs:99` exige occurred_at antes de
   discriminar entidad. Cliente `{}` y producto `{sku:'NULL-DATE'}` con fecha
   nula quedan rejected, ambos reproducidos separadamente. SourceEnvelope
   admite null y estas entidades no requieren tiempo. No se debilita el contrato
   para hacer verde el producto.
3. **CSV estructurado conocido descartado.** `index.mjs:40` rechaza cualquier
   customer_id/order_id/sku. Fixture con cliente/orden externos `known` y SKU
   `KNOWN` previamente persistidos devuelve `CSV_STRUCTURED_CONTEXT_REQUIRED`,
   en lugar de preservar sus relaciones. El rojo contiene ese código; no es
   error de instalación. Se conserva la declaración del autor de que falta
   soporte; esa declaración no reduce el requisito.

## Gate: qué sí prueba

API real `persistCanonical(scope,{importId,record})` dentro de
`createDatabase.transaction('import')`; login SQL sin BYPASSRLS/superusuario,
Auth GoTrue y memberships reales. El administrador sólo prepara/observa fixtures
sintéticos y mutaciones SQL controladas. No repositorio falso.

Cinco entidades con relaciones conocidas, bigint >2^53 exacto, null monetario,
orden/replay sin cambios de IDs/ledger, mismo import sin incremento de contadores,
conflicto de fila y de revisión sin sobrescritura, cuarentena, dos procesos Node
independientes contra una DB con una inserción y un duplicate, dos tenants,
forjado de source/account/hash/mapping, referencia ambigua, error SQL y rollback
transaccional de proyección/contadores. Los hashes de payload son calculados en
el examen por serialización ordenada independiente; no importa tests del producto.

La matriz global añade dos tablas explícitas, privilegios funcionales y las
11FK descubiertas nuevas. Mantiene168core/97FK y4controles/3FKuploads.
Con6migraciones:184tests/111FK de catálogo, sin omitir FK nuevas ni CHECK.
FK de organizaciones se prueba expresamente para ambas nuevas tablas.

Mutantes reales: retirar UNIQUE de identidad; cambiar rama de conflicto en una
copia temporal del módulo; ampliar WITH CHECK de INSERT para cruzar tenant.
Cada uno ejecuta positivo0 → fallo1 **por aserción exacta** → restaurado0.
Los ensayos de mutación son diagnósticos separados; su verde no vuelve verde
al producto. El mutant de conflicto altera comportamiento real de persistencia,
no un objeto de resultado falso. Los de DB modifican sólo DB propia desechable.

**El entrypoint mantiene GATE_INCOMPLETE.** Faltan oráculos completos de revisión
para las otras cuatro entidades, independencia positiva entre conexiones/cuentas,
fallo inyectado *dentro* de persistCanonical (actualmente falla la transacción
inmediatamente después de persistir), matriz de mapping entre imports y revisión
independiente del examen. La concurrencia prueba resultado entre2procesos pero
no instrumenta una barrera justo antes del INSERT. No reetiquetar estos pendientes
como aprobados por pasar un subset. No exige F06, LLM, redacción ni gold humano.

## Instalación, ejecución y límites

`run.py` copia tests/infra a TMP **antes** de cambiar puertos. Usa58010–58049,
comprueba disponibilidad, Docker pull never, DB sin puerto publicado, recursos
UUID, journal0600 y retiro por ID/owner mediante Lifecycle. Reutiliza infraestructura
read-only F02-durable/F01-03; no instala npm ni modifica fuentes.

Comandos reproducibles desde este worktree:

```sh
VEXA_CANDIDATE=/ruta/source6 python3 -B tests/acceptance/support/F02-canonical/run.py
VEXA_CANDIDATE=/ruta/source6 python3 -B tests/acceptance/support/F02-canonical/run.py F01-03.test.mjs
VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa python3 -B tests/acceptance/support/F02-canonical/run.py F01-03.test.mjs
VEXA_CANDIDATE=/ruta/source6 python3 -B tests/acceptance/support/F02-canonical/run.py support/F02-canonical/mutations.test.mjs
```

Node22: prefijar `EXAM_NODE=/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node`.
Node26 es `node` predeterminado. `evidence/summary.json` conserva comandos,
rutas TMP, salida, códigos y cleanup de cada ejecución. Ensayos anteriores no
se sobrescriben. `SHA256SUMS` identifica los archivos finales; snapshots de fuente
antes/después se guardan en corridas recientes. No datos cliente ni secretos.

No probado: SaaS, UI04, F05/F06, cargas sostenidas/deadlocks, reinicio SIGKILL,
providers externos, producción, freeze/controlador completo, revisión independiente
ni aceptación. La infraestructura local verde no acredita servicio enterprise.

## Resultados observados de ejecución

| Corrida | Salida | Resultado |
|---|---:|---|
| F02-04 ausente en baseline oficial5 |1| IMPLEMENTATION_MISSING:F02-04, sin levantar servicios |
| Matriz baseline4 TMP |0|168/168, forward compatibility sin tablas opcionales |
| Matriz baseline5 |0|172/172, Auth/Storage/revocación completos |
| Matriz source6 inicial y final |0|184/184 ambas; final incluye CHECK de proyección y11FK nuevas |
| Producto final Node26.7.0 |1|15tests:9pass/6fail;4casos producto rojos + padre + GATE_INCOMPLETE |
| Producto final Node22.22.0 |1|15tests:9pass/6fail; mismos defectos |
| Mutantes Node26 |0|4/4;3ciclos0→1assert→0 |
| Mutantes Node22 |0|4/4;3ciclos0→1assert→0 |

Las corridas finales Node22/26 registran igualdad de hashes de ingestion,
platform/src y migraciones antes/después. Cleanup verificado en todas las
corridas terminadas listadas en summary.json. Logs iniciales conservan su
conteo anterior a ampliar casos; no se presentan como snapshot final.

El entrypoint ejecutado directamente también falla cerrado antes de levantar
infraestructura compartida: requiere el runner aislado. El runner marca su copia
TMP con F02_CANONICAL_ISOLATED; esa marca no elimina GATE_INCOMPLETE. Se verificó
el guard directo y la ausencia con el wrapper final. La suite de producto de15
casos se ejecutó antes de añadir exclusivamente este guard de entrada.

Cierre: todas las corridas terminaron; cleanup verificado sin recursos propios pendientes. `git diff --check` exit0 y allowlist verificada. Baseline4 TMP contiene sólo0001–0004; no se retiraron migraciones de ninguna fuente.

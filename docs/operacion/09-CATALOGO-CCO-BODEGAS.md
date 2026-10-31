# Catálogo de bodegas del CCO (configuración externa)

El repositorio es público: los nombres reales de las bodegas del cliente piloto **no** viven en el código, en el SQL ni en las pruebas. El CCO los lee de la variable de entorno `VEXA_CCO_CATALOGO` (solo servidor). Todos los ejemplos de este documento son ficticios.

## Qué hace y qué pasa sin ella

La columna de bodega del Tracker (`WH`) trae texto libre. El catálogo dice con qué prefijo empieza cada bodega y con qué nombre se muestra.

- **Sin la variable** (o con JSON roto): el catálogo es vacío. Toda bodega con valor sale **«otra»**; una celda vacía sale sin dato. Nunca se asigna una bodega en silencio. Las preguntas B/C/E/F del CCO degradan a «Sin dato» donde dependan de la bodega.
- **Con la variable**: se clasifica por prefijo y la función SQL `insight_cco_tracker_filas()` recibe el mismo catálogo por sesión (`vexa.cco_catalogo_bodegas`), de modo que JavaScript y SQL dan siempre el mismo resultado.

## Forma de `VEXA_CCO_CATALOGO`

JSON de una sola línea:

```json
{"bodegas":[
  {"prefijo":"DEMO-","sufijoLibre":true},
  {"prefijo":"ALFA","etiqueta":"Bodega Alfa"},
  {"prefijo":"BET","etiqueta":"Bodega Beta"},
  {"prefijo":"GAMMA","etiqueta":"Bodega Gamma"}
]}
```

| Campo | Regla |
|---|---|
| `prefijo` | Con qué empieza el valor de la columna de bodega. Se compara en mayúsculas y sin distinguir mayúsculas de minúsculas. Solo ASCII `A-Z 0-9 espacio _ . -`, de 2 a 40 caracteres. |
| `etiqueta` | Nombre que se muestra (hasta 60 caracteres, sin caracteres de control; no puede ser «otra»). Obligatoria salvo con `sufijoLibre`. |
| `sufijoLibre` | `true` = es una **familia** de bodegas (`DEMO-N1`, `DEMO-N2`…): se muestra el valor completo del Tracker sin espacios y no lleva etiqueta. |

Reglas de validación (las aplica `packages/workspace-service/cco.mjs`, igual que `VEXA_CCO_MODALIDADES`): una entrada inválida se ignora **entera**; el primer prefijo repetido gana; gana la primera coincidencia por orden; máximo 50 entradas. Ejemplo: con el JSON de arriba, `alfa usa inc` sale «Bodega Alfa», `demo-n1` sale `DEMO-N1` y `Almacén raro` sale «otra».

## Variables relacionadas

| Variable | Qué configura |
|---|---|
| `VEXA_CCO_CATALOGO` | Este catálogo de bodegas. |
| `VEXA_TIENDA_PROPIA_PREFIJO` | Prefijo (minúsculas) del retailer propio del cliente piloto. |
| `VEXA_CCO_MODALIDADES` | Tabla opcional `{subcanal: {vende, bodega, marketplace}}` que reemplaza la de `cco.mjs`. |

## Cómo se pone en producción

1. Crear un archivo local con el JSON (`~/.vexa-cco-catalogo.json`, permisos `600`). No se versiona.
2. Subirlo como variable de producción con un script que lea el archivo sin imprimirlo (el mismo patrón que `VEXA_TIENDA_PROPIA_PREFIJO`).
3. Aplicar la migración `20261208000000_insight_cco_catalogo_bodegas` (una función de solo lectura; reversa en `supabase/operations/`). Orden indistinto, pero hasta que ambas estén las bodegas salen «otra».

Un cambio de la variable exige un nuevo despliegue (el catálogo de herramientas del agente se lee al iniciar el servidor).

## Pruebas

`packages/workspace-service/tests/cco-catalogo.test.mjs` (validación y valores desconocidos) y `insight-cco-pg.test.mjs` (paridad SQL y JS contra un Postgres local desechable) usan un catálogo sintético de `cco-catalogo-sintetico.mjs`.

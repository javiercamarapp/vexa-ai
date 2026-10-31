# Datos de cliente en el repositorio público

Estado: 31-oct-2026 (actualizado de la versión del 29-oct, rama `sanear-29oct`, que aún decía que el historial no se reescribía). Origen: auditoría 2 de seguridad (hallazgo M2).

## Contexto y decisión

El repositorio `javiercamarapp/vexa-ai` es **público** y lo revisará un fondo de inversión. El cliente piloto autorizó usar sus datos para construir y operar el producto, pero **no** exhibirlos a terceros. La decisión vigente (31-oct-2026) es **recrear el repositorio con un historial limpio**: el historial anterior se reescribe con `git filter-repo` (reemplazo de texto y borrado de rutas) y se publica como historia nueva. Los valores reales **viven fuera del repo**; ni el código ni los textos los contienen.

## Qué se sanitizó

Antes: el nombre comercial del cliente aparecía en **95 archivos** de HEAD (24 de código, 23 de pruebas, 42 de documentos y datos, 6 migraciones; 238 líneas), el UUID de su organización de producción en **10 archivos**, y la huella (prefijo sha256) de sus archivos recibidos en 8.

| Tipo | Qué había | Qué se hizo |
|---|---|---|
| UUID de la organización de producción | Constante en `packages/ai-scale/sql.mjs`, `scripts/economics/*`, `scripts/vinculos/importar-vinculos.mjs`, comentarios en otros módulos y `PERF-FRIO-RESULTADO.md` | Sale del código. Se lee de `VEXA_TENANT_ID` o de la configuración local; **sin valor real por defecto**. Los puntos de entrada de producción fallan si falta. Bajo `node --test` se usa un tenant sintético. |
| Nombres y huellas de archivos recibidos | `packages/ingestion/tracker/loader.mjs`, `scripts/tracker/*`, `scripts/economics/fuentes-shopify.mjs` | Pasan a `config/cliente-piloto.local.json` (ignorado por git) o `~/.config/vexa/cliente-piloto.json`. Ejemplo genérico versionado: `config/cliente-piloto.ejemplo.json`. |
| Identificadores operativos del cliente | Cuenta de conexión del Tracker, dominio y prefijo de su tienda propia, rutas privadas | También a la configuración local (`trackerAccountId`, `tiendaPropia`, rutas). Reglas de clasificación de retailer leen esos valores. |
| Nombre en código, pruebas y variables | identificadores con el nombre del cliente (constantes de tenant, señales de onboarding), fixtures de retailer, etiquetas de UI | Renombrado a `PILOTO` / `PILOT_*` / «cliente piloto». La etiqueta de UI de la tienda propia es ahora «Tienda propia». |
| Cifras de producción en documentos | Conteos de mensajes, filas, candidatos, pedidos, reembolsos, montos y tabla de anclas en `DATOS-VIVOS.md`, `PROGRESO.md`, `ESTADO-VIGENTE.md`, `PERF-FRIO-RESULTADO.md`, evidencias JSON | Sustituidas por órdenes de magnitud («decenas de miles de…») o marcadores `[omitido: dato de cliente]`. |
| Cifras reales en fixtures | Importes de reembolso y totales en pruebas de UI, correos y su snapshot | Reemplazadas por valores sintéticos coherentes; el snapshot se regeneró. |
| Fuente web del cliente | `docs/investigacion/fuentes/web/<nombre-del-cliente>.txt` (copia de su sitio público) | Retirado del repo; la copia local queda en `private/fuentes-cliente/` (ignorado). `scripts/public_pages.py` ya no la descarga salvo que se defina `VEXA_PILOT_PUBLIC_URL`. |
| Documentos regenerables | `construccion/*`, `negocio/INFORME-VEXA.html` y los dos PDF derivados | Texto actualizado en los generadores y en los artefactos; PDF regenerados cuando fue posible (ver `SANEAR-NOTAS.md`). |
| Archivo renombrado | `docs/entrega/PLAN-CIERRE-<nombre>-2026-10-11.md` | Ahora `PLAN-CIERRE-PILOTO-2026-10-11.md`. |

Migraciones: solo se cambiaron **comentarios** (nombre y cifras) en las migraciones listadas en `SANEAR-NOTAS.md`; el SQL ejecutable de cada una es idéntico byte a byte (se verificó comparando las líneas no comentadas). Esto es seguro porque el registro `supabase_migrations.schema_migrations` guarda solo `version` y `name` (el script de aplicación inserta únicamente esos campos) y el CLI no compara contenido.

## Guarda automática

`tests/seguridad/datos-de-cliente.test.mjs` (comando: `npm run test:datos-cliente`) falla si en archivos versionados, o nuevos sin ignorar, reaparece el UUID de producción, el nombre comercial del cliente, su dominio o la huella de un archivo recibido; también revisa el texto de los PDF versionados. Tiene tres capas:

1. **Patrones armados por partes** (UUID, nombre comercial, huellas de archivos): el archivo no se detecta a sí mismo.
2. **Huellas SHA-256 de palabras sueltas** (personas, bodegas, empresas, dominios y SKU reales del cliente): se compara el hash de cada palabra de cada archivo y de cada nombre de archivo. El repo no contiene ninguna de esas palabras, solo sus huellas. Es una barrera contra descuidos; la lista legible vive fuera del repo.
3. **Archivo externo de patrones** (`VEXA_PATRONES_PROHIBIDOS` o `~/.config/vexa/patrones-prohibidos.txt`, formato en `config/patrones-externos.mjs`): reglas completas (incluidas cifras de producción y secretos) que solo existen en la máquina de quien administra el repo. Si el archivo no existe, esta capa se omite.

La lista de **excepciones** vive en el propio archivo de la guarda y cada una tiene motivo:

- `supabase/migrations/20261104000000_insights_engine.sql`: migración ya aplicada cuyo cuerpo (no un comentario) clasifica el retailer propio por prefijo. Editarla cambiaría el cuerpo de una función en producción. Arreglo futuro: migración nueva con prefijo configurable.
- Cuatro JSON de evidencia inmutable de cierres previos en `tests/acceptance/support/` (solo contienen la ruta de un archivo ya retirado; la reescritura del historial los elimina).

## Historial de git: reescrito

Antes de esta decisión el historial público conservaba nombre, UUID, nombres y huellas de archivos recibidos y cifras de producción en cientos de commits. Se preparó una copia limpia con `git filter-repo` (reglas en una carpeta fuera del repo): sustitución de nombres y cifras, borrado de evidencias de ejecución con rutas del equipo y de PDF derivados, y normalización de correos de autoría. El repositorio público se **recrea** con esa historia; las referencias antiguas (ramas, `refs/pull/*`) dejan de existir en la nueva historia.

## Valores reales fuera del repo (qué se configura y cómo)

El código no trae valores reales por defecto. Sin configuración, el producto degrada a «Sin dato» / «otra» en lugar de inventar:

| Qué | Dónde vive | Detalle |
|---|---|---|
| UUID de la organización piloto | `VEXA_TENANT_ID` o `config/cliente-piloto.local.json` | Los scripts de producción fallan si falta. |
| Nombres y huellas de archivos recibidos, rutas privadas | `config/cliente-piloto.local.json` (ignorado por git) o `~/.config/vexa/cliente-piloto.json` | Ejemplo genérico: `config/cliente-piloto.ejemplo.json`. |
| Prefijo de la tienda propia | `VEXA_TIENDA_PROPIA_PREFIJO` | Sin ella los registros caen en «otro». |
| **Catálogo de bodegas** | `VEXA_CCO_CATALOGO` (JSON) | Ver [`docs/operacion/09-CATALOGO-CCO-BODEGAS.md`](../operacion/09-CATALOGO-CCO-BODEGAS.md). Sin ella toda bodega sale «otra». |
| Tabla de modalidades de venta | `VEXA_CCO_MODALIDADES` (JSON, opcional) | Reemplaza la tabla genérica de `cco.mjs`. |
| Patrones prohibidos completos | `VEXA_PATRONES_PROHIBIDOS` o `~/.config/vexa/patrones-prohibidos.txt` | Solo para la guarda; nunca en el repo. |

Personas del cliente: los textos de interfaz y los diagnósticos usan **roles** («Pedir al responsable de operaciones del cliente», «Pedir al responsable de datos del cliente»), nunca nombres. Las bodegas y los SKU de las pruebas son sintéticos («Bodega Alfa», `SKUP-L1`).

Migraciones: la lista de bodegas salió de `20261201000000_insight_cco.sql` (que ahora lee el catálogo por sesión, `vexa.cco_catalogo_bodegas`) y la migración nueva `20261208000000_insight_cco_catalogo_bodegas` actualiza las bases donde la versión anterior ya estuviera aplicada. Es la única excepción a «no editar una migración ya aplicada», porque el repositorio público no puede conservar los nombres.

## Riesgo residual

- Posibles copias ya hechas por terceros (clones, forks, cachés, archivos web) del historial anterior no se pueden retirar.
- Quedan estructuras derivadas de su tracker en fixtures sintéticos (nombres de hojas, tamaños de filas) y parámetros de escala de pruebas del libro económico (conteos redondeados donde fue posible); no identifican al cliente por sí solos pero son de origen real. Pendiente: los generadores de `packages/economics` conservan cifras de carga con estructura derivada.
- Los documentos narrativos conservan términos del negocio (por ejemplo «Tracker» como nombre de una hoja de cálculo) y notas de negociación societaria; la reescritura del historial retira las cifras de producción y las líneas de negociación, y se recomienda revisarlos antes de mostrarlos.
- Los PDF regenerados cambian de hash; los cierres que fijaron hashes de documentos (`support/F08-closure`) deberán recalcularse.

## Regla para quien contribuya

No añada datos reales del cliente al repo: ni nombres de personas, bodegas, empresas ni SKU, ni cifras de su operación. Use roles y valores sintéticos rotulados, mantenga los reales en la configuración externa y deje que la guarda automática detecte regresiones.

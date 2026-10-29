# Datos de cliente en el repositorio público

Estado: 29-oct-2026, rama `sanear-29oct`. Origen: auditoría 2 de seguridad (hallazgo M2).

## Contexto y decisión

El repositorio `javiercamarapp/vexa-ai` es **público**. El cliente piloto autorizó usar sus datos para construir y operar el producto, pero **no** exhibirlos a terceros hasta tener autorización por escrito. El dueño decidió **mantener el repositorio público** y **no reescribir el historial de git**. Esta rama sanea el estado actual (HEAD) sin tocar el historial.

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

`tests/seguridad/datos-de-cliente.test.mjs` (comando: `npm run test:datos-cliente`) falla si en archivos versionados, o nuevos sin ignorar, reaparece el UUID de producción, el nombre comercial del cliente, su dominio, o la huella de un archivo recibido; también revisa el texto de los PDF versionados. Los patrones se arman por partes para que el archivo no se detecte a sí mismo. La lista de **excepciones** es corta y está justificada en el propio archivo:

- `supabase/migrations/20261104000000_insights_engine.sql`: migración ya aplicada cuyo cuerpo (no un comentario) clasifica el retailer propio por prefijo. Editarla cambiaría el cuerpo de una función en producción. Arreglo futuro: migración nueva con prefijo configurable.
- Cuatro JSON de evidencia inmutable de cierres previos en `tests/acceptance/support/` (solo contienen la ruta de un archivo ya retirado; reescribirlos invalida la evidencia).
- `apps/web/tests/sitio/prohibidas.json` y `apps/web/tests/sitio/contenido.test.mjs`: usan el nombre como cadena **prohibida** en el sitio público (pertenecen al carril del sitio).

## Lo que NO cambia: el historial de git

El historial anterior **sigue conteniendo** todas estas referencias: nombre, UUID de la organización, nombres y huellas de archivos recibidos y las cifras de producción, en cientos de commits. Cualquiera puede recuperarlas con `git log -p`, con un clon o con el historial de pull requests y forks. Sanear HEAD **no** las retira de la red pública.

## Riesgo residual

- **Confidencialidad comercial (Media):** el nombre del cliente y cifras de su operación son recuperables del historial público. Mientras exista autorización de uso pero no de exhibición, esto incumple el espíritu del acuerdo.
- Posibles copias ya hechas por terceros (clones, forks, cachés, archivos web) no se pueden retirar.
- Quedan en HEAD estructuras derivadas de su tracker en fixtures sintéticos (nombres de hojas, tamaños de filas) y parámetros de escala de pruebas; no identifican al cliente por sí solos pero son de origen real.
- Los PDF regenerados cambian de hash; los cierres documentados que fijaron hashes de documentos (`support/F08-closure`) deberán recalcularse en el próximo cierre.
- Algunos valores de despliegue deben configurarse fuera del repo para conservar el comportamiento previo: `VEXA_TENANT_ID` (scripts) y `VEXA_TIENDA_PROPIA_PREFIJO` (la clasificación «tienda propia» de la fuga de reembolsos en la app; sin la variable esos registros caen en «otro»).

## Recomendación

Antes de mostrar datos a terceros (inversionistas, otros clientes, prensa), hacer **una** de estas dos cosas:

1. **Pasar el repositorio a privado** (cambio de configuración externa, reversible; lo hace el dueño en Settings). Es lo más barato y no destruye historia.
2. **Reescribir el historial** con `git filter-repo` (reemplazo de texto y borrado de rutas), con fuerza de push y autorización explícita; invalida todos los clones y requiere coordinar a todos los colaboradores. Debe ir acompañado de rotar cualquier secreto que haya aparecido y de pedir a GitHub la limpieza de cachés de PR/vistas.

Mientras tanto: no añadir datos reales del cliente al repo, mantener los valores en `config/cliente-piloto.local.json`, y dejar que la guarda automática detecte regresiones.

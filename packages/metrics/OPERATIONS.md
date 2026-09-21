# Ledger económico: operación y alcance F05-02

La vista `/overview` conserva la consulta de snapshots existente y añade un registro económico actual independiente. Este módulo **no publica snapshots**, no envía pagos ni reembolsos y no afirma pérdida total ni ahorro. No hay importación contable cloud ni inferencia de dinero desde tickets. Las entradas actuales son registros operacionales aportados y aprobados manualmente por el owner autorizado; deben identificarse como tales al presentar datos.

## Preparación

Aplicar las migraciones previas y `0018_economic_runtime.sql` con el proceso aprobado. Usar las variables existentes de Auth/Supabase y pool PostgreSQL de servidor; no se añade una clave ni proveedor financiero. Pool dedicado sin propiedad de tablas, sin superusuario y sin BYPASSRLS. El usuario debe tener membership activa en el tenant seleccionado. `owner` puede registrar fuentes/eventos; analyst/operator/viewer sólo consultan. La API deriva tenant y actor de sesión y verifica Origin en POST.

El ledger requiere el adaptador F05-01 aceptado (`packages/economics/adapter.mjs`) y reutiliza el kernel financiero. No copiar dependencias desde propuestas no revisadas. No habilitar integraciones, gasto o acceso real a datos privados por ejecutar este módulo.

## Flujo desde la UI

1. Elegir ventana UTC semiabierta, moneda, decimales y base explícita. Los importes se introducen como enteros en unidades menores: USD exponente2, `1500` =15.00USD; campo vacío significa desconocido. No convertir otra moneda, usar precio como costo ni rellenar margen.
2. Registrar una fuente operacional: exportación de órdenes, registro de pagos, factura de reemplazo, tiempo de soporte o supuesto de escenario. Documentar origen/responsable/alcance, revisar la evidencia y aprobar. Marcar completitud sólo para esa familia y ventana realmente conciliadas. Una fuente de pagos no prueba cero órdenes. La ventana futura/incompleta y watermark insuficiente mantienen importes totales desconocidos.
3. Registrar el identificador estable de la fuente, componente, estado real, fecha efectiva, moneda/base y evidencia. `pending` no equivale a liquidado. Una narración de un ticket no es prueba de pago; no registrar importes del LLM como evidencia observada.
4. Para corregir, usar el mismo identificador y crear una revisión con versión actual. Se conserva todo el historial. Un replay idéntico con la misma versión esperada es idempotente; el contenido diferente con versión obsoleta devuelve409.
5. Reversión: importe firmado negativo y ID canónico del reembolso original. Los IDs aparecen en historial. Si aún no existe o no es compatible, el registro se conserva y la métrica se bloquea para conciliación. No se recorta a cero un exceso. Al llegar la versión liquidada/correcta del original, una consulta nueva puede reconciliar; no se reescriben las filas históricas.
6. Soporte: duración **observada** en segundos, tarifa aprobada en unidades menores/minuto, versión/vigencia/evidencia. El costo es modelado. Se acumula el numerador exacto y redondea una sola vez al límite de salida; no se estima duración por longitud del ticket.
7. Escenarios: clientes/cohorte, ingreso condicional, probabilidad del supuesto en puntos básicos, horizonte y evidencia de vigencia. Los escenarios son hipótesis separadas, no forecasts calibrados ni intervalos estadísticos. No sumarlos entre horizontes ni con importes realizados. Falta de parámetros permanece desconocida.

## API y persistencia

`GET /api/economics?start=<UTC ISO>&end=<UTC ISO>&currency=<ISO>&exponent=<0..4>&basis=<base>` devuelve `{data}` con fuentes actuales, últimas revisiones, historial y bundle. Fechas inválidas o filtros extra se rechazan. `POST /api/economics` usa `{operation:"source",...SourceInput}` o `{operation:"record",...EntryInput}`; contrato exacto en `repository.d.mts`. No se acepta tenant/actor en body.

`economic_source_versions` y `economic_ledger_entries` son append-only con RLS, CAS y actor. Se añaden tablas porque el esquema histórico de economic_events sólo acepta magnitudes no negativas y estados observados/modelados, y la FK histórica de reversals no permite conservar una reversión cuyo original todavía no llegó. No se relajan ni se reescriben esas tablas. `order_id`/`reversal_of` son identidades canónicas **lógicas de este ledger**; sólo se resuelven dentro del tenant autorizado, no son FKs hacia órdenes legacy. Referencias no resueltas no permiten consultar otro tenant.

El API valida strings enteros canónicos antes de escribir. SQL usa numeric sin typmod y CHECK entero/rango: una fracción no se redondea silenciosamente durante coerción. La representación numérica entera se normaliza al proyectar DTO exacto.

Bundle: órdenes registradas y refunds del adaptador; replacement documentado, soporte modelado y escenarios separados. `combinedTotal` es siempre null. Exposición a problemas es explícitamente no medida porque F05-03 conectará las relaciones/unión; no se presenta un cero inventado desde links vacíos. Estado, subtotal conocido, cobertura y conflictos acompañan a cada cifra. No hay FX implícito.

## Corrección y límites

Desactivar una fuente crea nueva versión y la excluye del cálculo actual; las filas históricas permanecen auditables para usuarios autorizados. Un cambio de permisos borra la vista privada del cliente tras401/403 y las respuestas anteriores no deben repoblarla. Fallos de BD/Auth son errores, nunca ausencia de datos.

No editar/borrar filas para cuadrar totales; conservar el evento incorrecto y aportar revisión/reversión documentada. No hay scheduler ni operaciones de settlement externas. La validez de la documentación manual requiere revisión financiera humana real; el código no puede certificar por sí solo un documento. Antes de aceptación técnica ejecutar los probes independientes SQL/RLS/API/browser por los hashes finales. Build o UI renderizada no son aceptación contable ni aprobación de producción.

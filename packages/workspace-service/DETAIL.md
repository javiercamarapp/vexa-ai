# Detalle financiero e identidad de clientes

El detalle reutiliza un snapshot financiero publicado y una vista de alcance de F06-01. `snapshot_id` identifica el corte financiero; `scope_hash` conserva filtros, revisiones y equivalencias de esa vista. Cada recorrido usa además `detail_hash`, un recibo inmutable de referencias de identidad. `as_of` es el corte financiero y `detail_as_of` es la creación del recibo de identidad; son fechas diferentes deliberadamente.

Una identidad declarada del registro económico no acredita por sí sola un cliente importado. En Gestión económica, un propietario puede vincular explícitamente esa clave a un cliente canónico existente, aportando evidencia y aprobación. La operación usa versión esperada y registra una nueva versión; retirar un vínculo también conserva la historia. No crea clientes ni modifica órdenes, importes o snapshots financieros.

Abrir una nueva vista de identidad omite `detail_hash` en la petición raíz. El servidor fija las versiones actuales autorizadas de identidad y devuelve el hash. Los enlaces posteriores conservan ese hash, incluso al pasar de un problema a un cliente. Un vínculo nuevo puede producir una nueva vista sobre el mismo snapshot financiero; la vista anterior conserva sus referencias. Un hash explícito nunca se sustituye por la última versión. La retirada de autorización, fuente o evidencia impide seguir consultando el detalle afectado.

El recorrido es cifra → componente → evento → evidencia. Cada paso hace una petición autenticada y revalida tenant, alcance y referencias capturadas. La evidencia financiera muestra la fila física, revisión, informe aprobado y procedencia de la fuente. Una frase de conversación es contexto y no prueba un reembolso. Los reembolsos y sus reversos conservan signos y unidades menores exactas; las distintas familias económicas no se suman como una pérdida total.

Los clientes se presentan únicamente mediante UUID canónico existente. Una clave sin vínculo aprobado aparece sin URL de cliente. Las conversaciones de un cliente proceden de las extracciones capturadas y de las revisiones de identidad anteriores a esas extracciones. Si las revisiones discrepan o falta identidad, la conversación no se atribuye a un cliente por compartir un problema. Las citas autorizadas se muestran separadas del registro contable.

Las evaluaciones causales, cuando están disponibles, se etiquetan como evaluación actual autorizada: no sustituyen el corte financiero ni convierten una hipótesis en confirmación. Ausencia de fuente, importe desconocido o pertenencia no resuelta conservan `null` y sus razones; una fuente completa sin eventos sí puede acreditar cero.

## API

- `GET /api/workspace/detail/{problem|customer}/{id}`: filtros de F06-01, `snapshot_id`, `scope_hash` y `detail_hash` opcional para la primera vista.
- `GET /api/workspace/detail/{component|event|evidence}/{id}`: mismos filtros e identidades, `detail_hash`, `root_kind`, `root_id`; evento añade `component_id` y evidencia también `event_id`.
- `GET /api/workspace/customer-bindings`: opciones importadas, claves declaradas e historial vigente visible.
- `POST /api/workspace/customer-bindings`: propietario, CSRF, `customerKey`, `customerId`, `expectedVersion`, `active`, `report`, `attested:true`.

El contrato HTTP es `f06-detail-v1`, con traza por petición y errores privados. La falta de configuración se distingue de un fallo operativo. El backend utiliza la configuración existente de identidad y base de datos; no introduce credenciales, proveedores pagados ni servicios externos nuevos.

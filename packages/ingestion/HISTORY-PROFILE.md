# Perfil histórico opt-in `history-message-v1` — propuesta473

Perfil explícito para CSV de mensajes. No reemplaza los límites por defecto, no es aceptación ni integración. Autoría aislada; requiere revisión independiente y validación de persistencia real antes de habilitar producción.

## Selección y compatibilidad

Configurar `mapping.profile = "history-message-v1"`, con `dateFormat:"iso"` y columnas de ID, texto, fecha, rol y conversación explícitas. La API de bajo nivel `normalizeCSV` recibe `profile` además del `mappingVersion` calculado desde esa configuración. Ausente significa comportamiento anterior: máximo2.000, timestamps hasta3decimales, mapping hash y salida de fixture legado idénticos. Perfil desconocido se rechaza. CSV únicamente; no amplía Excel.

`mappingVersion` incorpora el perfil mediante configuración canónica. El envelope incorpora `ingestion_profile`; el payload hasheado conserva `historical_timestamp` y `source_occurred_at`. Durable recalcula el mapping hash y persistencia verifica configuración autorizada, hash, perfil y metadatos. El adaptador revalida perfil, timestamp original, instante exacto, residuo y vista canónica. Perfil sólo en raw o sólo en envelope, desconocido o alterado no se acepta. Se mantiene `adapter_version:csv-message-v1`; el contenedor de conversación conserva su comportamiento sin fecha inferida ni perfil obligatorio.

El lector de extracción reabre el archivo inmutable mediante `recordsFromBytes` con el mismo mapping y exige el mismo hash. Se probó ese recorrido con storage/SQL simulados, sin DB o proveedor. Reimportar un archivo existente cambiando su perfil no es una migración: cambia su payload/revisión y puede producir ambigüedad. No se rebautizan registros ya importados.

## Texto e identidad

Límite del perfil:100.000 unidades UTF-16 tanto en texto bruto como NFC. También se conservan límites del parser:100.000codepoints/campo,20MiB/CSV,50.000registros de datos. La ruta de bajo nivel no permite overrides del perfil que eleven esos límites. No se fragmenta un mensaje en varias identidades, no se trunca, no se usa fecha para deduplicar y no se fabrica ID ausente. Rol/conversación/ID válidos y cuerpo no vacío son obligatorios en las tres rutas del perfil.

El puente conserva las fuentes byte por byte y retiene cuerpos que exceden el perfil bajo `BODY_ANALYSIS_LIMIT`, sin proyectarlos como compatibles. Para poder archivarlos completos, sólo su lector opt-in eleva el límite de campo de Python a20.971.520caracteres Unicode y restaura el valor anterior al terminar; cuerpos mayores abortan con error antes de producir manifiesto terminado. La CLI sin perfil conserva el límite previo de Python. CR/NUL, automatización, dirección ambigua, IDs ausentes/repetidos y demás motivos del puente siguen retenidos. No contiene lógica financiera nueva.

Admisión para ingesta no significa preparación para IA. Persisten límites de100.000UTF16 por texto,500revisiones y1.000.000bytes por conversación, presupuesto/contexto/modelo, retención y permisos. La redacción puede expandir texto. Ninguno de esos límites se elevó y no se ejecutó inferencia.

## Tiempo y precisión

ISO con zona obligatoria, calendario/offset estrictos,0–6decimales. Se conserva el lexema original. La vista `occurred_at` se deriva mediante **floor al milisegundo**: puede representar hasta999microsegundos antes del instante original. No se presenta como conversión exacta del instante. Metadatos hasheados y almacenados en procedencia:

- `original`: texto original con offset y decimales.
- `canonical`: ISO UTC en milisegundos.
- `precision_digits`:0–6.
- `epoch_microseconds`: entero decimal exacto calculado con BigInt, también antes de1970.
- `remainder_microseconds`:0–999.
- `normalization:"floor-to-millisecond"` y `profile` versionado.

La fecha canónica derivada debe seguir dentro del rango aceptado por el contrato existente; offset que la lleve fuera se rechaza. Dos mensajes en el mismo milisegundo conservan ID y microsegundos diferentes; no se fusionan. Guardar esa precisión **no modifica** las consultas actuales que ordenan por `occurred_at`/ID: no se acredita orden microsegundo de extremo a extremo, UI ni SLA exacto.

## Puente y comprobación local

```sh
python3 scripts/history/prepare_history.py --manifest "$INPUT_MANIFEST" --output "$NEW_PRIVATE_PACKAGE" --profile history-message-v1
node scripts/history/validate_package.mjs "$PRIVATE_PACKAGE" "$PRIVATE_RECEIPT"
node --test packages/ingestion/history-profile.test.mjs packages/ingestion/index.test.mjs packages/ingestion/csv-adapter.test.mjs packages/ingestion/mapping.test.mjs
python3 -m unittest discover -s scripts/history -p 'test_*.py' -v
```

El paquete queda marcado con `ingestion_profile`; CSV conserva fechas/textos originales y el producto deriva metadatos bajo opt-in. El validador heredado469 coteja todos los originales, población, hashes, rutas y celdas, con clasificación explícita del perfil; después pasa cada candidato por preview, normalizador, parser durable y adaptador. Contexto sintético, sin carga real. La ubicación/identity de conexiones CSV por proveedor/cuenta se deriva de autorización externa; no está inventada en el archivo.

La selección del perfil es programática por mapping/CLI. No se añadió selector UI ni se habilitó una conexión real. Persistencia SQL, RLS, replay durable y recursos/productos/pedidos referenciados siguen requiriendo validación real bajo autorización. Las pruebas con SQL simulado sólo verifican reconstrucción/guardas/procedencia del código.

## Integración propuesta

Aplicar exclusivamente el delta congelado: nuevos `packages/ingestion/history-profile.mjs` y declaración; cambios en ingesta/index, mapping, durable/records y persistencia/index con declaraciones relacionadas. `profile.test.mjs` es prueba sintética autorada; tests existentes permanecen intactos. `scripts/history/*` es preparación/validación local genérica dependiente de la propuesta469, no un permiso de carga. No copiar el resto de la snapshot ni ningún paquete/evidencia privada. Se conserva la revisión de469/472;473 no la modifica ni la declara aceptada.

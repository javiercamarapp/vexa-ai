# Preparación local de históricos CSV

CLI genérica offline para exports de mensajes HubSpot/Gorgias. Esta propuesta conserva la API y las reglas del producto; no importa, conecta, publica ni analiza mensajes mediante IA.

## Ejecución

```sh
python3 prepare_history.py --manifest "$INPUT_MANIFEST" --output "$NEW_PACKAGE_DIR"
python3 -m unittest discover -s . -p 'test_*.py' -v
node --test validate_package.test.mjs
node validate_package.mjs "$PACKAGE_DIR" "$VALIDATION_RECEIPT"
```

La salida de preparación debe ser un directorio nuevo. Un directorio sin `manifest.json` no es un paquete terminado. El manifiesto de entrada contiene `sources: [{category: "conversations", source: "/ruta/local.csv", sha256, bytes, rows}]`; sólo se leen las fuentes conversacionales CSV enumeradas. Las columnas requeridas están en `prepare_history.py:REQUIRED`; los campos adicionales se conservan en los originales. Nunca suministrar credenciales como fuentes.

## Procedencia y validación

El preparador usa los mismos bytes para leer y hashear el manifiesto. La consola agrupa fuentes desconocidas sin emitir contenido de celdas. El validador compara toda la población original con el registro de procedencia y los campos proyectados antes de comprobar compatibilidad.

El cotejo de procedencia termina antes de ejecutar los validadores del producto. El validador exige después `previewImport`, `recordsFromBytes`, `normalizeCSV` y `adaptCSVRaw`, con mapping explícito y contexto sintético. Recibo agregado; sin cuerpos en consola. La verificación es contra los originales enumerados y sus hashes: el manifiesto congelado sigue siendo el ancla externa de confianza, no una firma de autenticidad del proveedor.

## Contrato conservado

Originales completos byte por byte en `originals/`, con SHA256 y número de registros; copia modo0400. `rows.jsonl` tiene una entrada por registro lógico (cabecera=1), con hash de fila JSON UTF8 ordenado, hash de cuerpo UTF8 y ruta/motivos. Número lógico y línea física se distinguen.

Lotes candidatos separados por proveedor, máximo20MiB y50.000filas; no generan IDs de origen ni convierten dinero. Source+message_id repetido retiene todas las ocurrencias, incluidas asociaciones multiticket. Cuerpo vacío, >2.000NFC, CR/NUL, fecha inválida/precisión>3decimales, ID ausente/inválido, automatización y dirección/autor ambiguos se retienen. `internal_note`→`internal`; `agent/customer` requiere autor coincidente. SKU/pedido sentinela se proyecta a vacío, conservando su original. `source_revision` es hash local de fila, no revisión del proveedor.

No se alteraron estos límites ni las guardas reales. La CLI prepara **candidatos**: el runtime añade sus propias restricciones y la validación completa es obligatoria antes de considerar compatibilidad. En particular, Python `datetime.fromisoformat` puede admitir minutos de offset que el producto rechaza; NFC puede caber donde el límite bruto del worker no cabe. El límite implícito `csv.field_size_limit()` del Python utilizado también puede abortar un cuerpo demasiado grande antes del ledger. No hay truncamiento ni manifiesto exitoso en ese fallo. Estas observaciones de468 permanecen documentadas; no se introdujo el perfil futuro de200.000.

## Archivos y alcance

`prepare_history.py` prepara el paquete; `validate_provenance.py` coteja originales, ledger y proyección; `validate_package.mjs` verifica además compatibilidad con los paquetes actuales de ingesta y jobs del repositorio. Las suites utilizan únicamente datos sintéticos.

Conservar originales, manifiestos, paquetes y recibos en almacenamiento privado, fuera de Git. Este flujo no sube archivos, escribe en una base ni llama a modelos. Un resultado compatible no acredita importación, calidad de IA, conversaciones completas ni aceptación de producción.

# Límites vigentes de F02-01

1. **Pendiente revisión independiente.** Autoría lista para revisar; sin freeze,
   aceptación ni cambio de11/60. Un resultado verde no sustituye ese ciclo.
2. **Instrumentación específica del lector.** preexpand.mjs y probe-expanded.mjs
   observan zlib en Nodev26.7.0, con hashes de index/csv/xlsx. Si un futuro lector
   JS puro/nativo no activa el observador, el probe sale2 con BLOCKED y el gate
   queda rojo por instrumentación; nunca contar ese caso como defecto/mutante.
   Necesitaría adaptador de control revisado; no se obliga al producto a usar zlib.
3. **Memoria no demostrada universalmente.** Se observan bytes realmente
   expandidos/cap del descompresor y consumo de chunks, no RSS/heap ni recuperación
   de un chunk gigantesco ya entregado. Timeout/OOM/SIGKILL no son evidencia.
4. **Seguridad acotada.**17adversos reales cubren tamaños,CRC,duplicado,alias y
   escapes,DTD/entities,expansión efectiva y ZIP64. No es fuzzing exhaustivo de
   OOXML/ZIP; cifrado,symlinks,data descriptors,overlap,otras variantes quedan
   fuera de esta ampliación. ZIP64 puede soportarse correctamente o rechazarse
   con XLSX_ZIP_UNSUPPORTED; no se exige soporte para este piloto20MiB.
5. **Controles separados.**19mutantes se ejecutaron sobre módulos reales copiados.
   Python histórico y validador ZIP/XML independiente son controlOnly, nunca un
   sustituto de producto. No se reejecutaron ni se atribuyen a esta tanda los
   mutantes de03/04, los7Node antiguos ni los controles Python anteriores.
6. **Sandbox del examen adverso.** Requiere runtime Node con --permission y control
   de red disponible (probado v26.7.0). Sólo permite leer supportF02 y los módulos
   de ingesta de TMP, sin red/escritura/subprocesos/workers/FFI; los SYSTEM usan
   nombres sintéticos. Incompatibilidad del runtime es setup BLOCKED, no defecto
   del producto. No prueba ejecución en browser ni todos los entornos nativos.
7. **Prototipo sin integración oficial.** La fuente corresponde a hashes, no a un
   commit aceptado de producto. Verde local no acredita workers/DB/Storage/UI,
   Supabase cloud ni producción; no se tocaron esas áreas ni otros gates.

Los bloqueos anteriores de controles positivos y variantes ZIP se resolvieron
para esta fuente. Permanece la revisión independiente y cualquier ampliación
que ésta exija; no hace falta un producto global verde para revisar este examen.

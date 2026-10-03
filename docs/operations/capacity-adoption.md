# Adopción de persistencia: alcance y evidencia

Este delta incorpora exactamente los cuatro reemplazos de la receta histórica `.github/scripts/capacity-variant.json` en `packages/ingestion/persistence/index.mjs`: SHA256 `d107db97782f8684ca873b01a855171e0c38192cf4882d9ac68269b947b08352` → `3b2fe5b364dcbbd2dd19029b8f2b2b9514132cf4743b31ab6d854cb7bd9b5869`. El fixture unitario histórico registra ahora las sentencias agrupadas y la respuesta `{deleted, previous}`; conserva sus aserciones de negocio. El inventario actualiza los hashes de persistencia y de ese test. La preparación del delta no constituye aprobación de adopción ni resultado de carga de la composición integrada.

Las escrituras iniciales de conversaciones/mensajes y la contabilidad de filas aceptadas o duplicadas comparten llamadas SQL compatibles. Los rechazos conservan las fronteras de cuarentena. La lectura de retención y revisión previa usa un único snapshot y valida la respuesta del driver; no mantiene caché entre registros. Se conservan los locks, savepoints, controles posteriores de escritura y fence del worker. El snapshot único es un cambio temporal explícito; la evidencia no demuestra equivalencia absoluta para toda intercalación concurrente.

La comparación histórica queda fijada al commit `70a519fd2959db684300fa5765e80c3c44e09511`, run [37151422753](https://github.com/javiercamarapp/vexa-ai/actions/runs/37151422753), y a sus fuentes y recibos originales. Completó cuatro ventanas sintéticas de 10.000 filas, dos por variante en orden ABBA, y doce grupos de controles SQL. Medias: original 202,401 s y compuesto 175,616 s; reducción exploratoria del 13,23 %. Las consultas por bloque fueron 2.195 y 1.605. La base creció entre ventanas: no hay significancia estadística ni atribución aislada al cuarto cambio. Se verificó la retirada de cinco recursos propios. El caller original falló al consultar GitHub; su recibo permanece fallido. La evidencia de medición se recuperó y Actions/workflows se restauraron por separado.

El comparador histórico y su receta permanecen intactos. **Debe fallar cerrado con `VARIANT_BASELINE_MISMATCH` al aplicarse a la persistencia adoptada**, porque exige la base `d107db97`. Para reproducir aquella comparación se usa el commit histórico fijado; no se modifica el comparador para tratar el compuesto como si fuese su antigua base.

Después de revisar e integrar el delta se requiere una medición nueva de 10K con el ejecutor completo y las fuentes, build e inventario de la composición adoptada. Las ventanas históricas no habilitan 50K. Se conservan un consumidor, bloques de 100 filas, generador y deadline de 900.000 ms por job. Sólo un 10K medido y revisado permite preparar el siguiente ensayo de 50K; un fallo exige diagnóstico antes de avanzar a 150K. El preflight comprueba fuentes sin iniciar infraestructura:

```sh
VEXA_CANDIDATE="$PWD" node packages/jobs/load/run.mjs --preflight
```

No se acredita 50K/150K, concurrencia múltiple, operación permanente, SLO comercial, costos, IA real, datos del cliente, recuperación gestionada, revisión global F07-01, producción ni nuevas aceptaciones formales. Se mantienen 59/60 implementadas y 28/60 aceptadas.

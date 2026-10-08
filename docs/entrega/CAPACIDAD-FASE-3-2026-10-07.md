# Fase 3 — capacidad local completada

Cierre: 7 de octubre de 2026, hora de Mérida (8-oct UTC). **100 % del alcance local de fase 3.** Candidato estable `504a6b68469acfcf345c7fed0acc895a7767a12d`, copia limpia `/private/tmp/rovaq-fase3-candidate-20261007`. Serie nueva, sin reutilizar mediciones anteriores; 2.216 fuentes invariantes y coincidentes con el repositorio canónico.

| Escala | Resultado | Aceptadas / rechazadas / duplicadas / pendientes | Procesamiento | Filas/s |
|---|---|---|---|---|---|
| 10K | PASS | 9.800 / 100 / 100 / 0 | 134,713 s | 74,23 |
| 50K | PASS | 49.000 / 500 / 500 / 0 | 845,863 s | 59,11 |
| 150K | PASS | 147.000 / 1.500 / 1.500 / 0 | 1.737,821 s | 86,31 |

210.000 filas sintéticas comprobadas en total. Rechazos y duplicados previstos por el generador (1 % de cada clase). Cinco trabajos terminales `partial` por esos rechazos esperados, todos con `failureCount=0` y dentro del plazo original de 900 segundos. 150K usa tres archivos/trabajos de 50K en secuencia. No se ampliaron plazos ni se optimizó sin evidencia. Una medición por escala en un host compartido no establece una curva de escalabilidad ni un SLO.

## Evidencia y comprobaciones

[Recibo estructurado con hashes, métricas y revisiones](FASE-3-CAPACIDAD-2026-10-07.json). Evidencia original y datasets conservados en las rutas del recibo. Logs y verificaciones en `/private/tmp/rovaq-fase3-receipts-20261007`.

- Health/version devuelve `ok` y `build-identity-only`, conserva revisión compilada y `no-store`. Lint, tipos, build y HTTP real PASS; cambiar la revisión al arrancar no relabela el build.
- Generador y escalamiento: 10/10 pruebas PASS. Preflight antes de cada escala y postflight final PASS, sin infraestructura adicional.
- Cadena 10K → 50K → 150K comprobada por ruta/hash, mismo candidato, manifiesto y benchmark. Las tres ejecuciones terminaron con código 0.
- Verificador independiente congelado `a4b92f7`, adoptado en `7a80864`: 18/18 calibraciones y revisión de serie PASS. Recuenta CSV y coteja contabilidad SQL/API, chunks, trabajos, métricas, fuentes, cadena y limpieza. Los reportes originales permanecen intactos.
- Dos agentes revisaron por separado especificación y estándares/evidencia: 0 hallazgos bloqueantes en ambos ejes. Son revisiones de agentes, no certificación externa ni aceptación formal.
- Inspección Docker posterior: 15/15 recursos propios ausentes, sin tratar errores de conexión como ausencia. Directorios temporales de ejecución retirados por el arnés; evidencias preservadas. Candidato limpio al final.

## Comandos ejecutados

Desde la copia candidata, Node 22, una sola suite pesada. Cada ejecución se precedió de `node packages/jobs/load/run.mjs --preflight` con `VEXA_CANDIDATE` y la escala correspondiente. Para cada escala se ejecutó:

```sh
caffeinate -i env -u NODE_OPTIONS -u VEXA_CI_JOURNAL -u VEXA_CI_BROKER \
  VEXA_CANDIDATE=/private/tmp/rovaq-fase3-candidate-20261007 \
  VEXA_LOAD_SCALES=<10000|50000|150000> \
  VEXA_LOAD_PREVIOUS_REPORT=<informe-anterior> \
  VEXA_LOAD_BASE_PORT=64110 PATH=/opt/homebrew/opt/node@22/bin:$PATH \
  node packages/jobs/load/run.mjs
```

En 10K se eliminó `VEXA_LOAD_PREVIOUS_REPORT` del entorno. En 50K apuntó a `vexa-load308-aIkd1Y/report.json`; en 150K, a `vexa-load308-d9n9xm/report.json`, ambas rutas absolutas bajo `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/`. El último informe está en `vexa-load308-oVBGXR/report.json`. Salidas completas: `load-10k.log`, `load-50k.log`, `load-150k.log` en el directorio de recibos.

```sh
python3 -B support/F07-load/verify-series.py \
  /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-load308-aIkd1Y/report.json \
  /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-load308-d9n9xm/report.json \
  /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-load308-oVBGXR/report.json \
  --candidate /private/tmp/rovaq-fase3-candidate-20261007 \
  --manifest /private/tmp/rovaq-fase3-candidate-20261007/packages/jobs/load/dependencies.json \
  --out /private/tmp/rovaq-fase3-receipts-20261007/series-review.json
```

Resultado: código 0, `status: PASS`, `accepted: false`, `production: false`. La salida usa creación exclusiva; no sobrescribir el recibo para repetir una revisión.

## Commits, límites y siguiente fase

- `504a6b6`: health/version y manifiesto en el mismo commit, iniciando nueva serie.
- `7a80864`: verificador de serie y calibraciones, autoría original `a4b92f7`.

Ingesta sintética local: un tenant, una conexión, un trabajador, bloques de 100 filas. No mide inferencia, pipeline analítico completo, concurrencia comercial, conectores reales, SLO ni cloud. Costo monetario desconocido; no se usaron proveedores pagados, datos de clientes, push, deploy ni cambios externos. El grafo conserva 59/60 técnicas y 28/60 aceptaciones formales. Los fallos históricos siguen siendo fallos y los resultados antiguos quedan limitados a sus candidatos.

Fase 3 sin bloqueos pendientes en su alcance local; no requiere una acción de Javier para este cierre. Siguiente: fase 4, recuperación y operación; todavía no iniciada. Se conserva el pendiente de cinco alertas altas de desarrollo de fase 2; la auditoría de dependencias de producción quedó sin alertas.

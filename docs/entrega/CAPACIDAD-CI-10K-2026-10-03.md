# Ingesta sintética 10K en CI — 3 de octubre de 2026 UTC

La corrida [37098090355](https://github.com/javiercamarapp/vexa-ai/actions/runs/37098090355), sobre `504632f48d58c50ef35b4778c3b0e8be0c2b16b6`, completó una ingesta de 10.000 filas sintéticas. La revisión independiente cotejó el bundle de logs, las fuentes, la contabilidad SQL/API y la limpieza. No acredita una aceptación formal F07, inferencia ni producción.

| Comprobación | Resultado |
|---|---|
| Filas | 10.000: 9.800 aceptadas, 100 rechazadas previstas, 100 duplicadas, cero pendientes |
| Chunks confirmados | 100 bloques de 100; offset final 10.000 |
| Trabajo en DB | 220.151,491 ms; estado terminal `partial` por rechazos previstos, cero fallos |
| Procesamiento | 220.297,543 ms; 45,39 filas de entrada por segundo |
| Duración del wrapper de medición | 291,53 s, incluyendo preparación/build internos |
| Persistencia por bloque | p50 2.073,082 ms; p95 2.180,384 ms; 100 muestras |
| API | p95 322,573 ms; cinco observaciones, no SLO |
| Worker | RSS máximo 201.076 KiB; un consumidor |
| Entorno | GitHub estándar ubuntu-24.04-arm, 4 CPU, 16.722.010.112 bytes de RAM; Node 22.23.3/PostgreSQL 17.6 |
| Fuentes | 2.172 hashes de manifiesto y 435 hashes del harness cotejados; pre/postflight válidos |
| Limpieza | Cuatro contenedores y una red propios comprobados ausentes; temporales retirados |
| Configuración GitHub | Caller exacto registra `restored=true`, sin errores: Actions desactivado, ci.yml activo y permisos de token de lectura |

El revisor comprobó la restauración mediante el recibo del caller revisado; no hizo una consulta remota nueva ni dispone de otro snapshot raw final. No garantiza el estado futuro de la cuenta.

## Reproducibilidad y límites

Un archivo de 1.225.633 bytes, semilla 10308, SHA256 `953d0fb84bb4a017541afcad542ac242dcf6adf5b7b11706ea78f349c4d55c78`. El generador público y su manifiesto describen la mezcla 98/1/1. Los cinco archivos de implementación del benchmark se ligan por sus propios hashes al reporte. El campo baselineSha del manifiesto es histórico; el commit efectivo es el de la corrida indicado arriba.

El dictamen independiente tiene SHA256 `aa2526df9addf38bbbfddb199cbad30785c8f87e202d90429fcd2d258f4d6e52`. Los originales completos, fallos previos y recibos se conservan fuera del repositorio público. Los logs de GitHub están sujetos a retención. No se adjuntan datos del cliente ni credenciales.

La medición incluye ingesta, contabilidad y persistencia; no incluye inferencia, extracción/agregación completa, entrenamiento, usuarios concurrentes ni costos monetarios. Los textos genéricos heredados del reporte sobre host local no describen el runner: el entorno se identifica por los metadatos de esta corrida.

50K y 150K de esta composición no se ejecutaron. El siguiente paso necesita una propuesta y revisión propias; este resultado no los despacha automáticamente. El deadline de producto permanece en 900.000 ms. No se reciclan mediciones de otra composición para superar ese requisito.

Se conservan los tres intentos previos: dependencia de bootstrap innecesaria limitada por el registro; cancelación por identidad inicial de corrida no reconocida; salida de compilación dentro del checkout rechazada por el builder. El procedimiento y las correcciones del bootstrap y del adaptador se documentan en [el workflow manual](../operations/capacity-manual.md). Ninguno de esos intentos acredita capacidad.

**Estado general: 59/60 implementadas, 28/60 aceptadas; producción pendiente.** Este resultado no sustituye recuperación gestionada, revisión global legítima ni aceptaciones humanas y de proveedores. La aplicación servida conserva `f63fcffd40f78408de311380cf4f7b81f8988bab`; los cambios posteriores hasta esta corrida son de herramientas de medición.

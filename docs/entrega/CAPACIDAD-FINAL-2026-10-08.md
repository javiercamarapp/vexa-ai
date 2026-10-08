# Capacidad final local — 8 de octubre de 2026

**Las tres escalas están aprobadas localmente sobre `6e8b2b4`.** Se ejecutaron en orden contra el mismo candidato y manifiesto de 2.227 fuentes, con informes originales enlazados por ruta y SHA256. La revisión independiente final terminó sin hallazgos y reprodujo el verificador con resultado idéntico.

| Filas de entrada | Aceptadas | Rechazadas previstas | Duplicadas previstas | Pendientes | Procesamiento |
|---:|---:|---:|---:|---:|---:|
| 10.000 | 9.800 | 100 | 100 | 0 | 96,38 s |
| 50.000 | 49.000 | 500 | 500 | 0 | 682,32 s |
| 150.000 | 147.000 | 1.500 | 1.500 | 0 | 1.521,95 s |

Total: 210.000 filas sintéticas y cero pendientes. Los rechazos y duplicados pertenecen a la mezcla determinista 98/1/1; no son errores inesperados. API, SQL, CSV y hashes coinciden. El verificador cotejó los bloques confirmados, contabilidad terminal, plazos, procesos y recibos. Se comprobó por separado que los 15 IDs de recursos propios estaban ausentes. Las fuentes y los candidatos permanecieron limpios.

La escala de 150 mil usa tres archivos de 50 mil, un consumidor y bloques de 100. Se conservan los límites de 900 segundos por trabajo y 3.600 por escala; el total de los tres archivos no se compara con el plazo de un solo trabajo. Los trabajos terminan `partial` porque el conjunto incluye rechazos previstos, con cero pendientes y cero fallos de ejecución.

Comandos: `VEXA_CANDIDATE=<candidato-v4> VEXA_LOAD_SCALES=<10000|50000|150000> node packages/jobs/load/run.mjs`, desde el control externo, Node22 y entorno reducido bajo caffeinate. Las escalas superiores reciben `VEXA_LOAD_PREVIOUS_REPORT` con el informe original aprobado anterior. Cierre con `python3 support/F07-load/verify-series.py <10k> <50k> <150k> --candidate <candidato-v4> --manifest <manifiesto-v4> --out <recibo-nuevo>`.

[Recibo, métricas y hashes](FASE-6-CAPACIDAD-2026-10-08.json). Se mide ingesta local en un host compartido, con Auth, PostgreSQL, Storage, Next y trabajador reales. No mide inferencia, costo monetario, un SLO comercial ni capacidad productiva. La aceptación formal permanece en 28/60. Las series anteriores conservan sus versiones originales.

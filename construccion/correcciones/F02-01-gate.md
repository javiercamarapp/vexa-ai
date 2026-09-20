# F02-01 — examen externo y correcciones preservadas

19-sep-2026. Estado al congelar: **11/60**, parser aún no aceptado.

## Desarrollo y evidencia

1. Banco `5fbf223`: ingesta CSV reutilizable, no XLSX/streaming completo. Primer borrador:36 casos entre01/03/04,17pass19fail;12 mutantes puros. No se congeló ni contó como producto.
2. Examen01 ampliado:39 casos,13pass26fail contra banco. Positivos ZIP/XML independientes y controles streaming parciales; límites de observabilidad declarados. No se congeló incompleto.
3. Prototipo parser pasó26 propios y39 del borrador. Su recibo original quedó bloqueado por un __pycache__ de tooling, no por scope de producto; se preservó y se usó copia limpia para revisar.
4. Revisor independiente reprodujo13/17 adversariales: P1 por segundo sheetData, segundo valor y AlternateContent omitidos; P2 por texto de namespace ajeno interpretado. Producto rechazado, fuentes y fixtures intactos.
5. Examen ampliado a59 casos y19 mutantes reales0→1→0. El principal añadió cinco casos con fixtures independientes: positivo compartido y cuatro rechazos anteriores. Total64. Fuente rechazada:60pass4fail exactos; no se corrigió el test para volverla verde.
6. Revisión independiente del examen aprobada, sin P0–P2:19 controles,17 paresZIP, CRC/XML y hashes; observadores sin instrumentación devuelvenBLOCKED/exit2, nuncaPASS.340archivos de evidencia/fuente intactos;331archivos del examen adoptados por bytes/hash. Gate SHA256 `a1d63ff1478fb5129655554e01c77f5e9646ad2f1658d0052b685aaa33f1d3f2`.

Registro F02-01 pasa a authored con product_pass=false y guía se regenera **antes** de prepare. No se incorporan gates incompletos03/04 ni durables02/05/06 al registro por la mera existencia de borradores privados.

## Producto correctivo, todavía en revisión

El autor informa40 propios,39 snapshot y17 adversariales verdes; RSS medido para450.000 sharedStrings bajó de unos455MiB a121MiB. Recheck independiente pendiente al redactar; ninguna cifra es techo universal ni aceptación automática. Se preserva el rechazo anterior y no se publica su código como válido.

## Límites

CSV/XLSX sintéticos y subconjunto documentado; no compatibilidad Office universal, fuzzing exhaustivo, techo RSS, Storage/SQL/jobs, cloud ni producción. El observador de expansión verifica el lector instrumentado actual; otro backend requiere adaptar/revisar el observador, no silenciarlo.

Para regresiones anteriores, F01-05 ejecuta realmente E00, F00-01..05, F01-01..04 y controlador110 en cuatro jobs. Se puede ejecutar ese gate una vez, revisar recibos/comandos/cobertura y no duplicar después los mismos gates; no es caché ni omisión de pruebas.

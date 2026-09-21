# F05-03 — exposición operacional sin duplicados

Relaciones de problemas con registros económicos, equivalencias documentadas de órdenes, identidades declaradas de clientes y revisiones de cobertura se conservan en cuatro tablas append-only. La API y los cuatro formularios permiten registrar y retirar vínculos/equivalencias, revisar identidades y aprobar cobertura con CAS. La identidad y el tenant se derivan de la sesión; cambios de permiso, evidencia o contribuyentes invalidan las cifras afectadas.

P1=30000 y P2=10000 producen global30000 por unión, sin sumar filas de problemas. Los clientes se deduplican aparte y los eventos financieros conservan sus componentes separados. La equivalencia de órdenes también corrige el resumen general. Importe desconocido, fuente incompleta y cobertura pendiente conservan null y subtotal conocido; no inventan cero ni total completo.

Revisión independiente de nueve rutas: 13/13 funcionales y 1/1 aritmética en Node26. Incluye Auth/PostgreSQL/API reales, cuatro formularios en navegador, evidencia abrible, retirada/restauración, cliente compartido, equivalencia, CSRF/roles/tenant y descarte de respuesta200 antigua tras403. El mutante que suma filas da40000 y falla por la aserción financiera; la restauración vuelve a30000. Materialización Git limpia Node22: 14/14 y regresión del ledger F05-02 10/10, compilación y lint incluidos.

Matriz SQL/Auth/Storage/retrieval: 271/271; focalizados separados: 15/15, incluidos FORCE RLS y scope malformado. La cadena completa de19 migraciones y los controles coinciden por hash con la materialización limpia. Controlador125/125. Correcciones: hash compartido independiente de versión de permiso del lector, completitud de fuente para clientes, resumen canónico de órdenes y rechazo SQL de cobertura vacía. Fallos anteriores y limpieza por IDs quedan en recibos privados.

Controles congelados en f48bd74a4a7ae04b7411f1ac24e0346a997b2960. SQL0019 SHA256: 4e1cba82e4906c3a08bfe8a50eb55ae73e3eedd72c6aaac1791a932935d58bfe. Los originales privados no se publican.

33/60 técnicamente construidas; 24 aceptadas en el grafo y nueve con dependencia o validación externa pendiente. F05 está en3/6. Persisten las dependencias live de F03; fuentes/cuentas reales, aprobación legítima SQL, despliegue y auditoría final permanecen pendientes. F05-04/05/06 todavía requieren programación y no se contabilizan. Este cierre no acredita producción.

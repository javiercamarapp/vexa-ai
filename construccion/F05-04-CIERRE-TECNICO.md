# F05-04 — unidades monetarias y conversión explícita

La API y la interfaz comparten formatos y un DTO con importes en strings, subtotal conocido, cobertura, moneda/exponente, ventana y procedencia. Las monedas originales se consultan separadas; una conversión requiere seleccionar una tasa vigente aprobada y conserva el importe original, la tasa exacta, fuente, fecha, versión y regla de redondeo. Catálogos y tasas se guardan como versiones append-only con CAS; cambiar el catálogo o revocar al contribuyente invalida la tasa vinculada. No hay cotizaciones automáticas ni un total de pérdida combinado.

Pruebas independientes: 12/12 de Auth/PostgreSQL/API y navegador; siete pruebas monetarias más tres probes independientes de precisión/calendario en Node22 y Node26. El mutante que presenta subtotal como total se rechaza por la aserción financiera y se restaura. Copia Git limpia Node22: 22/22 de F05-04, regresión F05-03 13/13 y F05-02 10/10; compilación y lint incluidos. Dieciséis rutas recibieron revisión independiente, separando al autor de las utilidades monetarias de su revisor.

Matriz completa SQL/Auth/Storage/retrieval: 277/277; focales separados: 9/9, con FORCE RLS, cuatro FKs compuestas, roles/tenant, CAS, catálogo actual y contribuyentes. Cadena completa de20 migraciones y controles idénticos por hash a la copia limpia. Controlador125/125. SQL corrigió la aceptación de fecha no finita. Los errores de preparación del ensayo (base de producto incompleta, journal y defaults de una semilla) y selectores de navegador se preservan como incidencias de pruebas, no defectos de producto.

Controles: 8a448bb5ee5d5c0ddef04d0db7fa7bd24cd3f53b. SQL0020 SHA256: 5d5a354f86e8c0b02196dce5ca0b7855e943ce94c9e75b198e5ac957c87dfa7a. Recibos privados conservan fuentes y limpieza; originales privados no publicados.

34/60 técnicamente construidas,24 aceptadas en el grafo; F05 queda4/6. F05-05/06 aún requieren programación y no se contabilizan. Cuentas/datos, catálogos y tasas reales aprobadas, aprobación legítima SQL, despliegue y auditoría integral final permanecen pendientes. Las tasas sintéticas no acreditan información de mercado ni producción.

# F05-02 — cierre técnico del ledger operacional

Persistencia append-only de fuentes y registros económicos con identidad/tenant derivados de sesión, autorización actual, versiones CAS e historial. La API y los formularios permiten registrar evidencia operacional revisada, corregir por nuevas versiones y consultar componentes separados. Reembolsos netos, costos de reemplazo, soporte modelado y escenarios no se suman como pérdida o ahorro. Fuente incompleta, importe desconocido y conflicto de conciliación permanecen explícitos.

Correcciones reproducidas: delimitación CASE y alias reservado OLD en el trigger; UTC explícito en el navegador; escenarios desde as_of con horizonte, cohorte y vigencia. La reversión huérfana o excesiva exige conciliación y no genera un neto arbitrario. Los importes conservan precisión por encima de 2^53; SQL rechaza fracciones sin redondearlas silenciosamente.

Revisión independiente funcional: 10/10 en Node26 (nueve recorridos y grupo), con mutante financiero calibrado, API/Auth/PostgreSQL reales, navegador America/Merida, CSRF, roles, tenant y descarte de respuestas antiguas tras revocación. Materialización Git limpia: 10/10 en Node22, compilación y lint incluidos. Matriz completa SQL/Auth/Storage/retrieval: 260/260, con tres FKs compuestas, FORCE RLS, append-only, CAS y mutante de aislamiento. Su cadena completa de migraciones y controles coincide por hash con la materialización limpia. Controlador: 125/125. Los fallos previos y recibos de limpieza se conservan.

Controles congelados en a0bb1dba3a44d5000e53de9e195901617052348a. SQL0018 SHA256: 72abf688a30d4e51ca08f4d6f28ac9c64663b220654c9c6515638fab32b0d5ad. Los originales privados no se publican.

La ficha queda técnicamente completa: 32/60 construidas, 24 aceptadas formalmente y ocho con dependencia o validación externa pendiente. El grafo oficial conserva F03-06 live/F05-01 pendientes. F05-03 todavía debe integrar exposición por relaciones; F05-05 debe publicar snapshots atómicos. Este ledger actual no simula esas funciones ni acredita producción. Cuentas/datos financieros reales, aprobación legítima SQL, despliegue y auditoría integral final siguen pendientes.

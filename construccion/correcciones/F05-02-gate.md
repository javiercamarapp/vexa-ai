# F05-02 — examen externo de ledger operacional

El control importa un candidato separado por `VEXA_CANDIDATE`; el directorio de ejecución puede ser el repositorio de controles. Build, módulos mutados y servicios se materializan en temporales; no se modifica producto ni candidato. El harness reutiliza infraestructura aceptada y conserva broker UUID, diario0600 y cleanup por recursos propios.

Nueve recorridos funcionales comprueban: desconocido frente a cero por familia; importes separados (refund1500, replacement1200, support500); replay/CAS e historial; huérfano, settlement y exceso/currency de reversal; redondeo agregado de soporte y horizontes futuros; Auth/tenant/roles/CSRF/calendario; costo desconocido; formularios reales desde navegador America/Merida; denegación vigente403 y descarte de200 antiguo. Cada prerrequisito fallido detiene los casos dependientes sin contabilizarlos como defectos adicionales.

La calibración cambia exclusivamente una copia temporal del repositorio de producto para devolver refund0 donde el ledger real acredita1500. El oráculo debe pasar en original, fallar por la aserción financiera específica en el mutante y volver a pasar tras restauración; no cuenta un fallo de import/setup.

Regresiones añadidas por hallazgos concretos: campos UTC no pueden convertirse usando la zona local del navegador; proyección futura comienza en as_of y termina en horizonte explícito, conservando por separado la fecha de evidencia histórica. Una cantidad antigua no cambia de moneda mientras se espera una nueva consulta.

La matriz SQL0018 independiente de254 se integra mediante `support/F05-ledger/matrix.test.mjs`; debe conservar todos los controles anteriores y clasificar las dos tablas y tres FKs nuevas. Los recibos privados253/254 determinan los hashes realmente probados y el estado final; esta nota no afirma aceptación ni producción.

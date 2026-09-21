# F05-01 — cierre técnico del adaptador financiero

Adaptador integrado sobre el kernel E00 existente, conservado sin cambios. Exige identidad autorizada por el servidor, fuente operacional, moneda, exponente, base, estado y período explícitos. Preserva precisión por encima de 2^53, valores desconocidos, cobertura y conflictos. Una nueva revisión no duplica un evento económico; los problemas mantienen sus claves incluso al serializar.

Revisión independiente 250 y materialización Git limpia: 34/34 en Node22 y Node26. Incluye doce invariantes E00, dieciocho casos del adaptador y tres mutantes calibrados que detectan cero ficticio, pérdida de precisión y fuga de tenant. Los controles están congelados en 00922c8. Fuente del adaptador SHA256: 66df75ce03ff5c26d5d58a7514cc77fc221926ae5c0f316a4913fee20702465c.

La ficha F05-01 queda técnicamente completa. Su aceptación formal depende de F03-06 con cuentas y datos reales, que permanece pendiente. El registro oficial no se altera. El contador técnico pasa a 31/60: 24 aceptadas y siete con validación externa pendiente.

Este módulo puro no acredita ledger persistente, API, interfaz ni snapshots financieros: corresponden a las demás fichas de F05, todavía sin sumar. Un reversal sin original dentro de la base y ventana declara conciliación pendiente y monto desconocido; no inventa un saldo ni afirma cero. La validación contable con datos del cliente y la auditoría integral final siguen pendientes.

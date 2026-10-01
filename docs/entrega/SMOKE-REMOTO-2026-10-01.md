# Smoke remoto VEXA — 1 de octubre de 2026

**8/8 fases aprobadas, ocho vistas y dos importaciones terminales en la versión desplegada `f893851b708cefb41f44ddafc991780814e6cae1`.** Ejecución con datos y cuentas sintéticas propias; Auth, PostgreSQL, Storage y API remotos reales. No acredita cuentas CRM, correo/push por proveedor, calidad histórica del cliente ni aprobación de producción.

## Resultado observado

| Fase | Resultado |
|---|---|
|Identidad del release|SHA servido exactamente igual al manifiesto del checkout limpio.|
|Dos organizaciones autenticadas|Sesiones reales A/B, organizaciones distintas.|
|Importación durable|CSV sintético de 3 filas:3 aceptadas, 0 rechazadas, 0 duplicadas, 0 pendientes y checkpoint 3; estado succeeded.|
|Cifras y exportación|Exposición USD 300 y refund USD 15 separados; exportación protegida concordante con API. No ahorro causal.|
|IDs conocidos de otra organización|Accesos cruzados denegados en los casos del examinador.|
|Ocho vistas|Resumen, problemas, problema, cliente, explorador, recomendaciones, intervenciones y brief: raíz/encabezados visibles y ocho capturas verificadas por hash.|
|Interrupción y recuperación|Consumidor detenido de forma acotada: alarma NO_HEARTBEAT/HTTP 503 y admisión 503. Reanudado el mismo job sin cambiar su identidad; segunda importación 3/3 terminal.|
|Revocación|A pierde lecturas y exportación, B conserva acceso.|

El comando existente `packages/release/smoke/cli.mjs` se ejecutó sin cambios en sus cuatro módulos, desde un runtime desechable con instalación offline del lock actual. Chrome tuvo perfil propio. Cinco operaciones acotadas del coordinador terminaron con exit 0; el proceso del examinador terminó con exit 0. `support/F08-smoke/control.mjs::verifyReport` comprobó fases, cuentas, contabilidad, alarma, recuperación, revocación, fuentes y ocho capturas. No se emitió retroactivamente una aceptación formal ni un recibo de aprobación humana.

El supervisor del ensayo fue revisado independientemente antes de activar el worker. Se corrigieron dos defectos de limpieza: manejo de SIGTERM/SIGINT y compensaciones independientes ante una excepción. Tres pruebas comprobaron señal real, proceso ya ausente y continuidad de la limpieza. No se cambió el software desplegado para ejecutar el ensayo.

Revisión independiente 436 aprobada: informe, fuentes y entradas congeladas, ocho capturas y limpieza cotejados sin repetir el ensayo.

## Limpieza y trazabilidad

El preflight encontró A revocada por el ensayo anterior. Mediante MCP se restableció exclusivamente esa membresía SYN con CAS de versión 4→5. El recorrido la revocó de nuevo. La consulta MCP posterior confirmó **A revocada, versión 6; worker desactivado; B y operador activos**. Procesos propios ausentes y perfil de navegador eliminado. No se habilitó un scheduler continuo ni se enviaron correos a clientes; no hubo inferencia pagada.

- SHA256 del reporte privado: `f116f090f7277dab446a380b67cefd1610001b28f5f5cabcb1b90b795761f75b`.
- SHA256 del coordinador terminado: `0ca8e050392846e59e3f8e08955232fbfec4560caffc840379a1e5aaf80dbe45`.
- Inputs, herramientas y fuentes permanecieron ligados a sus hashes congelados. Las sesiones y recibos completos permanecen privados.

**59/60 técnicas, 28 aceptadas formalmente, producción pendiente.** F07-01/revisión global siguen abiertos; el rechazo automático 435 no queda resuelto por este smoke. La matriz global conserva 114 PASS/2 canceladas y la carga 50K falló al plazo ; 150K no se ejecutó. Restore gestionado, cuentas/proveedores, datos históricos y actos humanos conservan sus pendientes. Este ensayo sustituye al del 28-sep como última comprobación remota SYN completa de ocho fases, sin cambiar el alcance de aquella evidencia.

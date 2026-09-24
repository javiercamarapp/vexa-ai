# F07-02 — control independiente 311

Ámbito: robustez del kernel económico → adapter de ledger → envelope monetario. La suite autora es evidencia revisada; el gate no la importa ni la ejecuta como oráculo.

1. Suma esperada calculada con BigInt directamente sobre una fixture independiente seed42 de31 registros. Particiones por módulo son disjuntas; se comprueba identidad/cobertura. Repetir envelopes conserva el importe y reensamblar raw solapado conserva el digest.
2. Nulo debe permanecer null con subtotal exacto y cobertura1/2. Un retorno temprano, fallo de setup, sintaxis o timeout no mata el mutante.
3. USD/EUR comparten exponente2: omitir moneda debe fallar por CURRENCY_ASSERTION, nunca por conflicto de exponente.
4. Filas extranjeras deben rechazarse antes de los filtros de moneda/fecha/estado. Esto NO prueba autenticación HTTP, RLS, SQL o seguridad de otro servicio.
5. Identidad migrada significa registros ya resueltos; se prueban enlace y reversión con resultado independiente21, exposición101 y cambio de hash. No certifica persistencia/resolución de alias CRM.
6. Mutantes sólo en temporales, cinco defectos nombrados, baseline verde antes de clasificarlos; una salida no cero sin la aserción nombrada es invalid. No expresar un porcentaje de cobertura universal.
7. Presencia ausente debe fallar por ROBUSTNESS_DELIVERABLE_MISSING, no por import inexistente. Los artefactos no pueden declararse aceptación independiente.

Revisión CLI adicional acotada: invocar por directorio/archivo symlink con espacios y Unicode; exigir archivo generado real, recibo stdout, rechazo a sobrescritura, imports sin arranque y error de configuración al invocar daemon sin entorno. No inicia proveedores reales. Histórico falla CLI_ALIAS_MUST_EXECUTE con exit0 vacío; propuesta verde22/26.

Corrección del propio control preservada: primera corrida comparaba frozen_at entre invocaciones y falló por timestamps legítimamente distintos. Se valida timestamp real cercano y se compara el resto del protocolo. Este fallo NO es un defecto del producto ni se cuenta como mutante muerto. Logs originales conservados en el recibo311. No cambió fuente autora.

No ejecutar accept/publish ni actualizar grafo desde este control. Dependencia F07-01, aceptación limpia y revisión del gate por controlador siguen separadas.

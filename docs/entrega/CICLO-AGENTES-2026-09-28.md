# Histórico y ciclo de agentes: qué está comprobado

Revisión independiente 390 del código público `d5cb1ea`, con runtime remoto `b9ed3db`. Es un cotejo de código y evidencias ya ejecutadas, **no una nueva corrida completa ni una evaluación con datos del cliente**. No se identificó un hueco nuevo de implementación en este circuito.

| Paso | Conexión existente | Evidencia y límite |
|---|---|---|
| CRM → histórico | Conexiones, consumidor, checkpoints y revisiones canónicas. | 102 conversaciones sintéticas; proveedor interceptado y persistencia real. Falta la cuenta autorizada y reconciliar con el CRM real. |
| Histórico → análisis | Redacción, extracción, agrupación y configuración efectiva. | Pausa, revocación, presupuesto y recuperación comprobados. Requiere configuración, autorización de modelos y programación de consumidores. |
| Análisis → evidencia | Problemas actuales con citas y permisos vigentes. | Dinero desconocido permanece desconocido; una conversación no crea una transacción financiera. |
| Fuentes financieras → vistas | Órdenes, devoluciones y relaciones confirmadas generan snapshots. | Smoke remoto de ocho fases y ocho vistas aprobado con datos sintéticos. Faltan fuentes financieras reales y confirmar relaciones. |
| Histórico → desarrollo | Feedback, cohortes y exportación desde Evaluación. | El desarrollo asistido no se convierte en gold humano. Retirada de fuentes y permisos comprobados. |
| Candidato → evaluación | Ejecutor externo, gateway, ledger y holdout separado. | Conserva costos desconocidos y no reenvía intentos ambiguos. Custodia, anotación humana y proveedor real pendientes. |
| Evaluación → selección | Resumen firmado, comprobación de código/configuración y elección del owner. | Comparación, selección y rollback versionados; worker con configuración efectiva y rechazo de trabajos antiguos comprobados. |
| Historial → rollback | Paginación de resultados y versiones con control de concurrencia. | 201 recibos, 102 versiones y reversión a una versión antigua verificados previamente. |
| Error → recuperación | Estados durables, cancelación, reanudación y consentimiento actualizado. | La recuperación conserva evidencia e identidad del trabajo. Un resultado ambiguo no se convierte en éxito ni se reenvía ciegamente. |

Las revisiones 331/336/340/344 aportan 287 archivos cotejados; 357 añade 55 artefactos y cuatro fuentes actuales; las tres fuentes corregidas en 387 coinciden con el árbol vigente. Se registraron los cambios posteriores en vez de atribuirles automáticamente resultados de versiones antiguas. Manifiesto de esta conciliación: `0f3dcb6d82fb5ed799f7a425923b100bf282384c9bf9e8c9a00d5085c1890cbb`.

La evidencia de navegador previa incluye consentimiento del lote, paginación, carga/error/exportación, importación de resultados, selección y rollback con confirmación. No se afirma que esta revisión haya vuelto a hacer todos los clics. Una inspección de un enlace estático tampoco cuenta como pulsarlo.

El sistema permite evaluar y seleccionar configuraciones bajo supervisión; no entrena ni se autopromueve, y no fabrica gold, datos financieros o decisiones del cliente. Conectar una API no sustituye estas decisiones ni activa por sí solo todos los consumidores. [Aportes y activación pendientes](PENDIENTES-PARA-CONECTAR.md).

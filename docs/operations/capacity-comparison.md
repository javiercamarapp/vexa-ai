# Comparación experimental de persistencia

Este workflow manual ejecuta sólo fixtures SYN en un runner público estándar Linux ARM64 (4 CPU, 16 GB). No accede a producción, clientes, modelos ni credenciales externas. No adopta la optimización ni acepta capacidad. Docker local no interviene.

Se conserva el workflow 10K anterior sin cambios. La comparación usa dos copias compiladas que difieren únicamente en `packages/ingestion/persistence/index.mjs`, con hashes y variante fijados. Se comprueban con PostgreSQL/RLS real el perfil histórico de 100.000 caracteres y microsegundos, replay/revisión, rollback de bloque con primera fila aplicada antes del fallo, revocación, aislamiento y no resurrección tras borrado lógico. Un fallo semántico detiene la comparación.

Calentamientos de 100 filas por variante excluidos; después ABBA de 1.000 filas por ventana, misma base y configuración, namespaces nuevos, un consumidor y chunks de 100. Cada chunk contiene 98 altas, un inválido y un duplicado. Se registran todas las duraciones y consultas (incluida una consulta de plazo por transacción), contadores SQL/API y checkpoints. El plazo por ventana permanece en 900.000 ms; el proceso completo tiene límite 1.320 s y el job 40 minutos. No hay escalado automático.

Se muestrea memoria disponible, CPU idle/steal y swapout antes/durante/después. Se admite preparación sólo con ≥2 GiB disponibles, idle≥50%, steal≤5%, sin swapout. Una mejora exploratoria exige que las dos ventanas batched sean más rápidas que ambas baseline y muestras completas/estables; dos observaciones no prueban significancia ni SLO. La base crece entre ventanas; no se restaura un snapshot idéntico.

El caller privado revisado vincula SHA de main, fuentes, revisión, UUID único y ventana temporal; desactiva los otros dos workflows antes de habilitar Actions, solicita un solo dispatch y restaura Actions desactivado y los estados iniciales. No publicar el caller ni los recibos privados. El bundle conserva errores y hashes, sin truncar evidencia, y rechaza residuos de los cinco recursos propios. La restauración remota debe verificarse incluso ante fallo.

Tras revisión del resultado, una adopción requiere otro delta concreto e inventario actualizado. La serie 10K → 50K → 150K debe medirse sobre esa nueva composición sin heredar resultados del SHA anterior. Los contadores de producto permanecen en 59/60 implementadas y 28/60 aceptadas.

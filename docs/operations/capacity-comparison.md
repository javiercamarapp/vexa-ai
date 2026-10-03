# Comparación experimental de persistencia

Este workflow manual ejecuta sólo fixtures SYN en un runner público estándar Linux ARM64 (4 CPU, 16 GB). No accede a producción, clientes, modelos ni credenciales externas. No adopta la optimización ni acepta capacidad. Docker local no interviene.

Se conserva el workflow 10K anterior sin cambios. La comparación usa dos copias compiladas que difieren únicamente en `packages/ingestion/persistence/index.mjs`, con hashes y variante fijados. Se comprueban con PostgreSQL/RLS real el perfil histórico de 100.000 caracteres y microsegundos, replay/revisión, rollback de bloque con primera fila aplicada antes del fallo, revocación, aislamiento y no resurrección tras borrado lógico. Un fallo semántico detiene la comparación.

Calentamientos de 100 filas por variante excluidos; después ABBA de 10.000 filas por ventana, misma base y configuración, namespaces nuevos, un consumidor y chunks de 100. Cada chunk contiene 98 altas, un inválido y un duplicado. Se registran todas las duraciones y consultas (incluida una consulta de plazo por transacción), contadores SQL/API y checkpoints. El plazo por job de cada ventana permanece en 900.000 ms; el proceso completo tiene límite 1.320 s y el job 40 minutos. No hay escalado automático.

Se muestrea memoria disponible, CPU idle/steal y swapout antes/durante/después. Se admite preparación sólo con ≥2 GiB disponibles, idle≥50%, steal≤5%, sin swapout. Una mejora exploratoria exige que las dos ventanas batched sean más rápidas que ambas baseline y muestras completas/estables; dos observaciones no prueban significancia ni SLO. La base crece entre ventanas; no se restaura un snapshot idéntico.

El caller privado revisado vincula SHA de main, fuentes, revisión, UUID único y ventana temporal; desactiva los otros dos workflows antes de habilitar Actions, solicita un solo dispatch y restaura Actions desactivado y los estados iniciales. No publicar el caller ni los recibos privados. El bundle conserva errores y hashes, sin truncar evidencia, y rechaza residuos de los cinco recursos propios. La restauración remota debe verificarse incluso ante fallo.

Tras revisión del resultado, una adopción requiere otro delta concreto e inventario actualizado. La serie 10K → 50K → 150K debe medirse sobre esa nueva composición sin heredar resultados del SHA anterior. Los contadores de producto permanecen en 59/60 implementadas y 28/60 aceptadas.

## Perfil de consultas del ensayo sintético

Cada ventana conserva un perfil acotado de hasta 128 sentencias por SHA256, con conteo, fallos y duración mínima, máxima y acumulada observada por el cliente. No almacena texto SQL, parámetros, resultados ni mensajes de error. La invocación original y su resultado/error se conservan; las transacciones, plazos y controles semánticos no cambian.

El perfil comienza donde se reinicia el contador de consultas y termina al finalizar el consumidor. Consultas pendientes, representaciones no reconocidas, desbordamiento o duraciones inválidas impiden aceptar el perfil. El validador coteja sus conteos con la ventana y rechaza campos adicionales.

Estas duraciones incluyen espera de transporte y ejecución en PostgreSQL; no identifican por sí solas CPU del servidor ni el coste de una política. El perfil introduce sobrecarga y una nueva fuente del ensayo: los tiempos previos no se heredan. Sirve para decidir qué optimizar después de revisar la evidencia; no adopta la variante ni acredita 50K/150K.

El cliente se envuelve después de `pool.connect()`: quedan fuera la adquisición de conexión y su comprobación previa del rol. También quedan fuera las llamadas HTTP Auth/REST que resuelven identidad. El conteo anclado cubre exclusivamente consultas del cliente envuelto, no toda actividad PostgreSQL; la diferencia entre procesamiento total y suma del perfil no se atribuye automáticamente a CPU, red o base.

## Variante de contabilización

La variante experimental compone las dos agrupaciones previamente medidas con una tercera: inserción de import_rows y actualización del contador en una sentencia para filas aceptadas o duplicadas. Los rechazos conservan inserción, cuarentena y contador separados. No se eliminan lecturas de permisos, retención ni revisiones, ni se adoptan cambios en el producto.

El control sigue siendo la persistencia original; las ventanas comparan la composición completa contra ese control. No atribuyen una mejora incremental al tercer cambio usando tiempos de otra corrida. La predicción verificable por bloque de 100 filas es 2.195 consultas frente a 1.802: las 98 altas y un duplicado ahorran otras 99 consultas respecto de las 1.901 anteriores. Un conteo distinto rechaza el ensayo.

Se añade en ambas variantes un fallo SQL deliberado al actualizar el contador de importación. Una secuencia demuestra que se alcanzó el fallo; nueve tablas y el estado del trabajo/checkpoint deben permanecer idénticos. Los controles históricos posteriores deben recuperar las mismas filas. Las diez comprobaciones semánticas deben pasar antes de medir tiempos.

## Etapa fija de comparación 10K

La escala se fija en código a cuatro ventanas de10.000 filas (ABBA), con dos calentamientos previos de100 filas. No se expone selector ni se generaliza el workflow. Cada ventana medida exige contadores9800 aceptadas,100 rechazadas,100 duplicadas y0 pendientes,100 chunks de100 filas y checkpoint terminal10000. Las consultas dentro de chunks suman219.500 baseline o180.200 batched; el perfil completo debe incluir además todas las consultas envueltas fuera de chunks, cuyo número se observa y valida sin sustituirlo por una predicción.

La composición experimental y el producto original conservan sus hashes. Se repiten los diez controles semánticos antes de medir y se mantienen aislamiento por namespace, concurrencia1, lease, deadline900000 por job, límites128 del perfil y ausencia de SQL/parámetros crudos en evidencia. El crecimiento de la misma base entre ventanas (aproximadamente40K filas de entrada medidas, más calentamientos/semánticas) forma parte del ensayo; no equivale a un job50K ni acredita150K, adopción o capacidad productiva.

Se mantiene el límite global de medición1320s. En el run37144351173 de1K esa etapa consumió184.038s, de los cuales83.026s corresponden a las cuatro ventanas. Multiplicar sólo esas ventanas por10 y conservar el resto sugiere unos931.27s, dejando unos388.73s de margen. Es una estimación de planificación, no una garantía: volumen, crecimiento de base, instrumentación y variabilidad del host pueden cambiar el coste. Bootstrap conserva su máximo6min y el job40min; junto con preflight/postflight de60s cada uno queda margen nominal de600s para preparación adicional, validación y limpieza. Si se agota el presupuesto, se conserva el fallo; no se relajan plazos del producto ni se declara medición completada.

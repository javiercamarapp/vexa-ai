# F06-04 — Explorer de evidencia y consultas verificables

El explorador busca problemas y citas dentro de una publicación fijada, con filtros compartidos, cobertura y paginación por título/identificador o identificador. El cursor conserva autorización, publicación, alcance, búsqueda, orden y tamaño de página. El recorrido de101registros devuelve101IDs únicos en cinco páginas; no hay truncamiento silencioso en cien.

Las herramientas search_problems, read_metrics y get_evidence tienen esquemas cerrados e identidad derivada del servidor. Sólo admiten transacciones de lectura; ni una herramienta inyectada, SQL libre, tenant ajeno o escalamiento de capacidad llega a una escritura. Las consultas revalidan acceso y fuentes; navegación, errores y respuestas antiguas no pueden restaurar datos retirados.

Las preguntas soportadas sobre órdenes, reembolsos y exposición usan interpretación determinística explícita y datos observados. Faltar base, moneda, periodo o medida exige aclaración. Una solicitud de explicar un aumento se abstiene de inferir tendencia o causa a partir de un solo corte. Los importes conservan precisión por encima de2^53, moneda, cobertura, null y subtotal conocido; exposición no significa pérdida ni ahorro. Las referencias abren Resumen con exactamente la misma publicación y filtros. No usa inferencia pagada ni deja un stub que prometa habilitarse al pegar una API.

Verificación: revisión independiente de producto y controles; dominio10/10 Node22/26, API/navegador13/13 y copia Git limpia23/23. Tipos, lint, compilación y CI web verdes; controlador125/125. El examen incluye navegación desde Explorer filtrado hacia Resumen y regreso, errores recuperables, autorización vigente, respuesta tardía y ausencia de efectos externos. Los fallos originales de referencia sin alcance, import de servidor en el cliente y cobertura incompleta del fixture se conservan con su diagnóstico y reparación. Controles congelados:94ee3aa6db2af8651394d4b7b965022c4e2440a7.

No cambia ninguna de las25migraciones. Se reutiliza su evidencia por igualdad de hashes, conservando el estado real anterior de matriz y recuperación selectiva; no se declara una nueva corrida SQL. Los recursos propios se verificaron ausentes.

40/60 técnicamente listas;24 aceptadas formalmente en el grafo. Restan20 tareas y la auditoría integral final de20rubros. Cuentas/históricos autorizados, SQL remoto legítimamente aprobado, despliegue y validaciones humanas siguen pendientes. No acredita producción.

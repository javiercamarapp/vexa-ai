# F04-06 — revisión independiente y correcciones verificadas

El examen exige evidencia operacional independiente, intervención humana y persistencia real. Una confianza estadística o un ticket aislado no autorizan confirmar una causa. La ausencia inicial falla mediante `IMPLEMENTATION_MISSING` antes del montaje de servicios.

Se reprodujeron y corrigieron cuatro defectos:

1. La severidad inicial del grupo ocultaba evidencia severa incorporada después. El carril humano ahora deriva de citas actualmente autorizadas y vinculadas a los miembros.
2. El aislamiento de membresías impedía confirmar evidencia aportada por otro actor autorizado. Un helper booleano restringido comprueba organización, actor actual, acción y aportante; conserva las políticas de membresías existentes.
3. El orden por fecha y UUID podía seleccionar una versión operacional anterior. Ahora se elige explícitamente la versión máxima.
4. Revocar al confirmador mantenía vigente su confirmación. La consulta actual verifica también al confirmador y conserva intacto el registro histórico.

El conjunto final obtiene 19/19 en Node26: once subcasos funcionales y seis SQL, más sus dos grupos. Usa Auth, PostgreSQL, Storage, API y navegador locales reales. Cubre formularios operativos, evidencia contraria, valores desconocidos, historial, CAS, roles, aislamiento, fuentes retiradas, aportante y confirmador revocados, versiones empatadas y permisos SQL de las dos tablas. La extensión F01-03 conserva todos los oráculos previos y comprueba las cuatro nuevas claves foráneas compuestas.

Un mutante que suprime la prioridad humana se calibra 0→1→0 y falla una aserción causal específica. La interfaz serializa solicitudes; para someter la protección de generaciones a estrés, el examen invoca un submit nativo durante un GET retenido. Un POST403 real limpia el estado y el GET200 antiguo no lo repuebla.

Node22 pasó 18/18 antes del último ajuste del confirmador. La validación oficial de la fuente final en Node22 y su aceptación en Node26 son pasos separados; este informe no los sustituye ni declara producción. No se ejecutaron acciones externas de recall o reembolso.

Los errores iniciales de semilla, selector y restauración del estado de conexión pertenecían al control: se conservaron los recibos rojos y se corrigieron sin desactivar guardas del producto. Los recursos de prueba usan identificadores propios, broker y journal restringido; la matriz respeta el broker heredado del supervisor y verifica su limpieza.

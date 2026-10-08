# Corrección de navegación — 8 de octubre de 2026

**Corrección integrada localmente; regresión y seis flujos afectados aprobados.** Producto `510028a`, controles `6036597`, sin despliegue ni nueva aceptación formal. [Recibo con hashes](CORRECCION-NAVEGACION-2026-10-08.json).

Una respuesta tardía del resumen podía cancelar la entrada a notificaciones. Mientras Next esperaba la respuesta de la nueva página, el resumen fijaba su publicación mediante `history.replaceState`; Next trataba esa actualización como una restauración de ruta y abandonaba la transición. La reproducción controla el orden de respuestas reales de workspace y RSC, con los límites originales de 15 segundos.

La versión anterior falla desde la campana, el menú lateral y una URL ya fijada. También pierde un fragmento de navegación al fijar la publicación. La corrección pasa los seis escenarios, incluidos Back con snapshot/alcance, apertura en otra pestaña, ancla y descarga JSON: 7/7 contando el padre. El control original obtiene 2/7; sus fallos se conservan.

`WorkspaceLink` usa el evento público `onNavigate` de Next para cancelar las cargas de la vista anterior. Los seis paneles conservan sus guardas de generación, autorización y respuesta; antes de fijar la URL comprueban también el origen y preservan el fragmento. Los enlaces modificados, descargas y cancelaciones del caller mantienen su comportamiento. No se eluden internals de Next ni se espera artificialmente a que termine el resumen antes de navegar.

Tipos y lint pasan. Otra revisión de agente comprobó el código y encontró un enlace de ProblemsPanel que faltaba cubrir; quedó corregido antes de las comprobaciones. La revisión estática no sustituye una evaluación humana. Notificaciones y los seis flujos afectados pasan sobre esta propuesta: resumen16, detalle11, recomendaciones14, explorador13, intervenciones14 y briefs15 (83/83). Notificaciones funcional suma15/15; la entrada compuesta pasa30/30 en181,612s, incluidos siete escenarios de navegación. Tres respuestas RSC500 provocaron recuperación mediante GET real200; la lista operativa y Back con tabla/pins quedaron comprobados. Dos arneses y12IDs únicos ausentes. Cada corrida tiene evidencia de invariancia y limpieza de recursos propios.

Se conserva la distinción entre 60 alcances técnicos y 28/60 aceptaciones formales. Faltan CI agregado, paquetes y capacidad actual, además de los permisos y validaciones externas del cierre general.

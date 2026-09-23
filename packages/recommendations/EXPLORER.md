# Explorer de datos autorizados

Explorer busca problemas y citas del snapshot y alcance publicados. Reutiliza los repositorios canónicos de workspace y evidencia; no crea otra base financiera. Los filtros SKU/fuente conservan la semántica y cobertura de F06-01. Las filas por problema no son aditivas; las cifras globales provienen de la unión canónica de órdenes. Dinero desconocido sigue siendo null.

La búsqueda determinística cubre título, resumen, categoría y citas redactadas autorizadas. Filtra antes de paginar y no limita silenciosamente el universo a100. El orden es título normalizado + UUID, o UUID. El cursor fija snapshot, alcance, usuario, rol, versión de permisos, búsqueda, estado, orden y tamaño de página. Se valida la posición exacta; cambiar esos parámetros requiere iniciar otra página. Una revocación real impide leer el contenido; un error de base de datos no se transforma en una lista vacía.

## Herramientas de sólo lectura

`search_problems`, `read_metrics` y `get_evidence` son la allowlist cerrada. Sus esquemas y validadores rechazan propiedades adicionales, SQL, tenant, capabilities o nombres de herramientas arbitrarios. Cada herramienta recibe una query estructurada y validada; el tenant procede exclusivamente de Auth/membership actual. El adaptador sólo admite transacciones read, que createDatabase ejecuta con BEGIN READ ONLY.

Se requiere un snapshot_id y scope_hash existentes. La interfaz resuelve previamente el alcance mediante workspace; las herramientas del Explorer no materializan recibos ni escriben datos financieros, recomendaciones, intervenciones o CRM. Las citas se obtienen de versiones de problema y extracciones capturadas y se vuelven a autorizar en cada lectura. El contenido de citas y preguntas es dato, nunca instrucciones ejecutables.

## Consulta ejecutiva determinística

Las preguntas sobre reembolsos, órdenes registradas e ingresos expuestos se responden con métricas exactas del corte. La respuesta conserva cobertura, valores desconocidos, referencias financieras y enlaces a /overview con exactamente el mismo snapshot y alcance. Esas referencias no convierten una frase de conversación en evidencia contable.

Si faltan base, moneda, período o publicación fijada, se pide aclaración. «Qué perdimos» también requiere distinguir la medida financiera: exposición, órdenes y reembolsos no equivalen a una pérdida total. Una pregunta sobre aumento/disminución o causa devuelve abstención explicada junto a los datos del corte: se necesitan períodos comparables para variación y evidencia operacional independiente para causalidad. Nunca se inventan porcentajes, causas, ahorros ni probabilidades.

El modo está rotulado deterministic. No ejecuta un LLM y no contiene un stub que prometa habilitar preguntas generales al pegar una API key. Los temas no soportados se declaran unsupported. Este flujo no necesita credenciales nuevas ni llamadas pagadas; Auth y PostgreSQL usan la configuración ya existente.

## API

- GET /api/explorer: filtros compartidos fijados más q, status=all|ready|partial|stale, order=title_asc|id_asc, limit1..50 y cursor.
- POST /api/explorer/tools: `{name,args:{query,problemId?}}`; problemId sólo para get_evidence.
- POST /api/explorer/query: `{question,query?}`; scope explícito para respuestas, aclaración cuando falta.

Contrato HTTP f06-explorer-v1, trace_id por petición, respuestas privadas. Ausencia de configuración se distingue de fallo operativo503. POST exige origen autorizado/CSRF aun cuando la operación sea de sólo lectura. Todas las membresías vigentes pueden consultar datos del tenant autorizado.

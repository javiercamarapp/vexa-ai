# MCP, APIs y accesos: dos planos separados

## Regla
**MCP sirve a las herramientas del desarrollador o a futuros clientes AI; no sustituye los conectores de producción.** El PRD excluye MCP del producto MVP. No hay que instalar 9 MCPs para importar tickets. Pi no incluye MCP nativo según documentación instalada; Codex dispone de subcomando `mcp`. No se instalaron servidores ni se cambiaron configuraciones globales en esta entrega.

## Matriz de capacidades
| Servicio | Producto runtime | Herramienta de construcción | Acceso mínimo y gate | Estado observado |
|---|---|---|---|---|
| GitHub | Repo privado, PR y Actions | `gh`, opcional MCP oficial | Repo VEXA solamente; lectura para investigar, escritura branch/PR aprobada | CLI instalado; repo VEXA remoto no creado |
| Vercel | Next.js UI/API y worker/spike | CLI, MCP oficial opcional | Proyecto VEXA preview; producción separada y promoción aprobada | CLI instalado; proyecto/pago no comprobados |
| Supabase | Auth, PostgreSQL, Storage, pgvector; Queues candidato | CLI, MCP project-scoped/read-only | Proyecto dev; migraciones locales primero; nunca service role en navegador | CLI instalado; proyecto VEXA no comprobado |
| OpenRouter | Inferencia y embeddings según catálogo/endpoint permitido | HTTP docs/catalog; no requiere MCP | Key propia del producto en servidor, presupuesto, modelos/rutas permitidos | Documentación consultada; no inferencia pagada |
| HubSpot | Tickets/conversations/messages/contacts read-only | API client de spike; navegador sólo para setup humano | Cuenta origen autorizada, conversaciones/tickets y contactos necesarios; no send/delete | Acceso prometido en audio, no verificado |
| Zendesk | Incremental tickets y comentarios read-only | API client de spike | Subdominio autorizado, OAuth/scopes mínimos; cursor y rate limit | Acceso no verificado |
| Shopify | CSV órdenes primero; GraphQL posterior | Docs y fixtures | Protected customer data y permisos aprobados; pedidos/refunds/productos necesarios | Documentación, sin acceso |
| Amazon/Walmart/Best Buy | CSV normalizado primero; API posterior | Docs/spikes de permiso | App/rol/cuenta, límites de PII y licencias por marketplace | No se investigaron contratos completos todavía |
| Correo transaccional | Brief opcional después de aprobación de destinatarios | SMTP/API a elegir | Dominio, SPF/DKIM/DMARC, unsubscribe aplicable, outbox idempotente | Proveedor no seleccionado; brief en app primero |
| Sentry/PostHog | Observabilidad/analytics opcionales | CLI/API si hace falta | Datos redacted; sin session replay de PII por defecto | No instalados ni acceso comprobado |
| Whisper CPP | No es voice AI del producto; transcribe las notas del fundador localmente | CLI instalado | Archivos locales; no subida | Seis audios procesados dos veces con small |
| Firecrawl developer | No dependencia del producto | Búsqueda pública keyless | Sin Authorization, sin texto privado | 12 búsquedas ×3 resultados guardados |

## Fuentes de MCP
`fuentes/mcp-supabase.md` y `fuentes/mcp-vercel.md` contienen documentación/citas recuperadas. Leer URLs oficiales y verificar autenticación y capacidades antes de registrar. No copiar endpoints de blogs como definitivos ni usar un MCP remoto con service-role global. Leer capacidades en modo read-only antes de dar escritura. La herramienta de desarrollo no hereda permiso para leer datos de clientes de otros proyectos.

## Preflight de cuentas (sólo lectura, a ejecutar con owner)
- `gh auth status`: comprobar identidad; confirmar organización destino y política repo privado.
- `vercel whoami`: identidad, team VEXA, región y proyecto; no `vercel --prod` durante preflight.
- `supabase projects list`: comprobar owner/proyecto; no enlazar base Likida/Atiende por conveniencia.
- `codex login status`: ya devolvió Logged in using ChatGPT. Construcción suscripción; no reutilizar token Codex en runtime SaaS.
- Para OpenRouter: variable servidor y catálogo; demo sintética puede funcionar sin inferencia mediante fixtures marcados, no como análisis real.

## Datos y secretos
Usar cuentas nominativas y MFA, no usuario genérico compartido de Convexia como dueño del SaaS. Registrar acceso: servicio/proyecto/owner/scopes/entorno/fecha/revocación. Secretos en gestor o entorno cifrado de hosting; `.env.example` sólo nombres. Nunca copiarlos a prompts, tickets, wiki, logs, Git o material pitch. Tokens de integración cifrados con clave fuera de DB; rotación/revocación probada.

## Habilitación por etapas
Local sin credenciales → preview con fixtures → conectores sandbox read-only → piloto autorizado con presupuesto → producción promocionada. El loop avanza tareas independientes mientras una cuenta está pendiente, pero no declara que la integración está funcionando porque compila un adaptador.

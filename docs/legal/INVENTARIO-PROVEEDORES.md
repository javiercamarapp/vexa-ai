# Inventario de proveedores y subencargados de Rovaq

Fecha: 3-nov-2026. Rama `ola3-legal` sobre `ebc3d7e2`. Sacado del código y de la documentación del repositorio. No contiene valores de variables, llaves, referencias de proyecto ni nombres de cliente: solo nombres de variables. No se leyó ningún `.env` ni se consultó producción. Lo que el código no demuestra figura como **por confirmar**; no se infiere.

Leyenda de evidencia: `archivo:línea`. «Dato personal» describe lo que recibe el proveedor según el código, no lo que el proveedor pueda ver por su cuenta (por ejemplo registros propios de red).

## Resumen

| Proveedor | Papel | Cuándo recibe datos | Transferencia internacional | Estado de la evidencia |
|---|---|---|---|---|
| Supabase | Base de datos, autenticación, almacenamiento | Siempre | Probable; región por confirmar | Uso demostrado; región, plan y contrato por confirmar |
| Vercel | Alojamiento y funciones | Siempre | Sí, EE. UU. observado | Uso demostrado; región observada, no configurada |
| Resend | Correo transaccional | Solo con `VEXA_EMAIL_MODE=resend` | Probable; por confirmar | Código listo; activación en producción por confirmar |
| OpenRouter y proveedores de modelos (Anthropic, OpenAI vía Azure) | Extracción y agrupación con IA | Solo con `VEXA_AI_RUNTIME=enabled` y configuración por organización | Posible, EE. UU. o UE según política | Código listo; hubo corridas en producción según `aprobaciones.json` condición 3; proveedor final por confirmar |
| Anthropic directo | Lectura de IA de Puntos de dolor | Solo con `VEXA_PAIN_AI=enabled` y llave propia | Probable, EE. UU. | Código listo, apagado por omisión; migración que la soporta NO aplicada según su cabecera; por confirmar |
| Google (OAuth) | Inicio de sesión | Solo con `VEXA_GOOGLE_AUTH_ENABLED=true` | Sí | Código listo; activación por confirmar |
| Servicio de notificaciones del navegador | Avisos push | Solo si la persona activa push | Depende del navegador de la persona | Código listo; activación por confirmar |
| HubSpot | Origen de datos del cliente | Solo lectura, si el cliente lo conecta | Decide el cliente | Usado en la carga piloto |
| Zendesk | Origen de datos del cliente | Fuera de alcance por ahora | n/a | Código existe; marcado como fuera de alcance |
| Analítica, publicidad, Sentry, etc. | — | No hay | n/a | Sin dependencias ni scripts de terceros |

## 1. Supabase

- **Qué es y para qué.** PostgreSQL gestionado, Auth y Storage. Dependencias `@supabase/ssr` y `@supabase/supabase-js` (`apps/web/package.json:28-29`); conexión SQL directa con `pg` (`apps/web/package.json:31`).
- **Variables (solo nombres).** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VEXA_TEAM_AUTH_URL`, `VEXA_TEAM_AUTH_ADMIN_KEY`, `VEXA_DATABASE_URL`, `VEXA_DATABASE_CA_PEM`, `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY` (`apps/web/ENVIRONMENT.md`).
- **Datos personales que recibe.** Todos los del producto. Como responsable: correo de acceso, identidad Auth, equipo y roles, registros de seguridad con huella de IP, preferencias de notificación y huellas de buzón. Como encargado: conversaciones y su versión redactada, pedidos, reembolsos, archivos y adjuntos del cliente.
- **Aislamiento.** Políticas por `tenant_id` con RLS forzada (`supabase/migrations/0033_retention_recovery.sql` y posteriores; pruebas locales en `ops/backup-restore/`).
- **Región.** No consta en el código ni en `supabase/config.toml`. **Por confirmar** en el panel de Supabase. La conexión SQL admite validar la CA del servidor (`apps/web/ENVIRONMENT.md`, sección «CA del servidor PostgreSQL gestionado»).
- **Plan y respaldos.** Informado por el responsable el 3-nov: respaldo diario automático conservado 8 días, sin recuperación a un punto exacto, adjuntos de Storage no cubiertos y restauración no probada. La documentación interna asumía plan Pro con 7 días, sin PITR (`docs/operacion/04-RESPALDOS-Y-RESTAURACION.md:18-19`, `docs/operacion/07-COSTOS-MENSUALES.md:12`). El inventario del 26-oct listó ocho respaldos físicos completados (mismo documento, líneas 7-9). El plan real **por confirmar**.
- **Transferencia internacional.** Probable si la región no es México. Por confirmar.
- **Correo de Auth.** Los enlaces de acceso e invitaciones salen por el SMTP configurado en el proyecto de Auth (`apps/web/ENVIRONMENT.md`, filas «Invitaciones de equipo» y «Acceso por correo»). Qué SMTP es **por confirmar**; si es Resend, entra en el punto 3; si es el SMTP por defecto de Supabase, sigue siendo Supabase.

## 2. Vercel

- **Qué es y para qué.** Alojamiento de la aplicación y del sitio, funciones, crons (`apps/web/vercel.json`: `/api/internal/crm` cada 5 minutos, `/api/internal/metadata` y `/api/internal/security-alerts` cada 15).
- **Datos que recibe.** Todo lo que transita por la aplicación y los registros técnicos de la plataforma, que pueden incluir la dirección IP de quien visita. La aplicación no guarda la IP en claro en sus tablas (`supabase/migrations/20261205000000_email_auth_throttle.sql`, cabecera: solo huellas HMAC).
- **Región.** `vercel.json` no fija región. Las respuestas observadas el 31-oct salen de `iad1` (observación en `~/vexa-notas-28oct/legal/a7-seguridad-revision.md`, fuera del repo; los costos citan iad1/pdx1 en `docs/operacion/03-CRON-Y-TAREAS-PROGRAMADAS.md:49`). Es una observación, no una configuración: **por confirmar** si se quiere afirmar algo más que «principalmente en Estados Unidos».
- **Transferencia internacional.** Sí, de acuerdo con la región observada.

## 3. Resend

- **Qué es y para qué.** Correo transaccional (avisos y reporte semanal) y recibos de entrega por webhook. SDK `resend` 6.28.1 (`packages/notifications/package.json`), URL base fija `https://api.resend.com` (`packages/notifications/email.mjs:16`). Verificación del webhook con firma (`packages/notifications/receipts.mjs:53`).
- **Variables.** `VEXA_EMAIL_MODE`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `VEXA_EMAIL_FROM`, `VEXA_EMAIL_REPLY_TO`, `VEXA_APP_ORIGIN`, `VEXA_EMAIL_DATABASE_URL`, `VEXA_WEEKLY_SEND`, `VEXA_UNSUBSCRIBE_SECRET`.
- **Datos que recibe.** Dirección de correo de destino (solo identidades Auth activas con correo confirmado, `packages/notifications/EMAIL.md`) y el contenido del aviso o del reporte semanal. El webhook no persiste payload ni direcciones.
- **Retención propia del proveedor.** No consta. Por confirmar según el plan contratado.
- **Activación.** `EMAIL.md` dice que el reporte semanal requiere dominio propio verificado antes de activar `VEXA_WEEKLY_SEND=enabled`. Que esté activo hoy en producción es **por confirmar**.
- **Región.** No consta. **Por confirmar.** Transferencia internacional probable.
- Se usa Mailpit solo en local (`VEXA_EMAIL_MODE=mailpit`, loopback): no es proveedor.

## 4. Inteligencia artificial: OpenRouter y proveedores de modelos

- **Qué es y para qué.** Intermediario de modelos de lenguaje para extracción de problemas de conversaciones y para vectores de agrupación (embeddings). Puntos de contacto: `https://openrouter.ai`, `https://us.openrouter.ai`, `https://eu.openrouter.ai` (`packages/gateway/residency.mjs:2`); el endpoint se elige por política de residencia de cada organización (`residency: unrestricted | US | EU`, `residency.mjs:3-12`).
- **Variables.** `VEXA_AI_RUNTIME`, `OPENROUTER_API_KEY`, `VEXA_OPENROUTER_API_KEY`, `VEXA_EXTRACTION_CONFIG_JSON`, `VEXA_PROBLEMS_RUNTIME`, `VEXA_PROBLEMS_CONFIG_JSON` (`apps/web/ENVIRONMENT.md`, `packages/problems/OPERATIONS.md`).
- **Apagado por omisión.** La inferencia exige `VEXA_AI_RUNTIME=enabled`, llave, política autorizada por organización, catálogo y atestación de privacidad vigentes y presupuesto (`packages/intelligence/EXTRACTION-RUNTIME.md`, «Configuración y habilitación»; `packages/gateway/CATALOG.md`).
- **Qué datos salen.** El mensaje al modelo es un JSON con la taxonomía y fragmentos de conversación **ya redactados** (`packages/gateway/index.mjs:227`). La redacción reemplaza correos y teléfonos y los nombres que la política de la organización liste, o suprime todo el texto (`packages/intelligence/redact.mjs:6-31`): cubre esos patrones, no un reconocimiento general de datos personales, de modo que puede quedar información identificable (nombres no listados, direcciones, números de pedido). Los vectores se calculan sobre extracciones persistidas y redactadas (`packages/problems/OPERATIONS.md`, primer párrafo). Los textos originales no se envían (`EXTRACTION-RUNTIME.md`: «No se publica texto original al proveedor»).
- **Controles de la solicitud.** Cada solicitud fija el proveedor, impide pasar a otro (`allow_fallbacks:false`) e indica `data_collection:'deny'`; ZDR si la política lo exige (`packages/gateway/index.mjs:236`, `packages/gateway/embeddings.mjs:34`). Es una instrucción enviada al intermediario, no una verificación del cumplimiento por el proveedor.
- **Lo que la IA no hace.** No crea importes: el ledger y las cifras salen de los datos cargados (`AGENTS.md` regla 5; condición 2 de `aprobaciones.json` para el agente general, que corre con reglas). La salida es una propuesta que una persona decide.
- **Evidencia de uso real.** `aprobaciones.json` condición 3 (29-oct): 72,121 corridas de extracción en producción. El proveedor final, la región efectiva, la política de retención y entrenamiento del proveedor y la existencia de contrato **no constan en el código**: **por confirmar** con la cuenta de OpenRouter y la política vigente por organización.
- **Transferencia internacional.** Posible: EE. UU. o UE según política; endpoint sin restricción regional no declara residencia.

### 4 bis. Modelos y proveedores concretos que el código contempla (corte 3-nov)

| Uso | Modelo o proveedor en el código | Evidencia |
|---|---|---|
| Extracción simple | `anthropic/claude-haiku-5.5` vía OpenRouter | `packages/gateway/index.mjs:17,172`; `packages/ai-scale/cohorte.mjs:41,46` (lista permitida de un solo modelo en la medición) |
| Extracción de casos múltiples | `anthropic/claude-sonnet-5.5` vía OpenRouter | `packages/gateway/index.mjs:17,172` |
| Vectores de agrupación | `openai/text-embedding-3-small`, ruta fijada al proveedor `azure` | `packages/gateway/embeddings.mjs:25`; `packages/ai-scale/problemas/nucleo.mjs:18` |
| Lectura de IA de Puntos de dolor | Anthropic de forma **directa** (`https://api.anthropic.com/v1/messages`), modelo por omisión `claude-sonnet-5-5`, modo de salida fija, sin guardar el cuerpo de la respuesta | `packages/workspace-service/pain-points-ia-proveedor.mjs:4,12,19`. Apagada salvo `VEXA_PAIN_AI=enabled` y `VEXA_PAIN_AI_API_KEY`. Entrada: ficha redactada con lista blanca de columnas (canal, SKU, estado, motivo), reescaneada antes de enviar; si parece PII no se envía (`pain-points-ia.mjs:3`). Tope de US$5 semanales por organización en el diseño de la migración `20261127000000`, marcada PROPUESTA, NO APLICADA |
| Solo medición o investigación, no producto | `deepseek/deepseek-v4.1-flash`, `google/gemini-*`, `openai/gpt-6-astra` y otros en `docs/investigacion/` y `packages/ai-scale` | Evaluaciones de costo; no figuran en el gateway de producto. No se declaran en el aviso |

Cuál modelo corre de verdad en producción para cada organización lo decide `VEXA_EXTRACTION_CONFIG_JSON` por organización: **por confirmar** con Javier (nombres de modelo y proveedor efectivos; tampoco se revisó ese JSON porque contiene configuración privada). El aviso nombra los proveedores que el código contempla y no promete un modelo concreto.

## 5. Google (inicio de sesión)

- **Qué es y para qué.** `signInWithOAuth({provider:'google'})` mediante Supabase Auth (`apps/web/src/app/(app)/auth/google/route.ts:11`). Solo si `VEXA_GOOGLE_AUTH_ENABLED=true` (`apps/web/ENVIRONMENT.md:10`). Es inicio de sesión, no SSO corporativo.
- **Datos.** Correo y datos básicos de la cuenta que Google entregue. Activación en producción **por confirmar**.

## 6. Notificaciones del navegador (web push)

- **Qué es y para qué.** `web-push` 3.6.7 (`packages/notifications/package.json`; `packages/notifications/push.mjs:23`). Variables `VEXA_PUSH_SUBJECT`, `VEXA_PUSH_PUBLIC_KEY`, `VEXA_PUSH_PRIVATE_KEY`.
- **Datos.** Suscripción del dispositivo (endpoint del servicio de push del navegador y claves) con consentimiento por dispositivo. El servicio de push pertenece al fabricante del navegador, no a Rovaq. Cookie de dispositivo que se borra al cerrar sesión (`apps/web/src/app/(app)/auth/logout/route.ts:16`). Activación por confirmar.

## 7. HubSpot y Zendesk (orígenes del cliente)

- **HubSpot.** Lectura exclusiva por `https://api.hubapi.com`, solo GET, rutas exactas, sin redirecciones (`packages/connectors/transport.mjs:9,81`; `packages/connectors/IMPLEMENTATION.md`, «API implementada»). Lee hilos, mensajes, notas y metadatos de tickets, con alcances `conversations.read`, `tickets` y `crm.objects.contacts.read`. No escribe en HubSpot. Aquí Rovaq es **encargado** del cliente. Variable `VEXA_CRM_CREDENTIALS_JSON`. Rovaq no envía datos a HubSpot.
- **Zendesk.** Existe adaptador (`packages/connectors/transport.mjs:13`) pero la interfaz lo marca «fuera de alcance por ahora» (`apps/web/src/lib/i18n/d-roles.ts:31`) y la confianza de datos lo declara fuera de uso (`apps/web/src/components/confianza/confianza-modelo.mjs:34`). El texto público no lo nombra (regla editorial 1 de `tests/sitio/prohibidas.json`). Si se activa, es otro origen del cliente, con el mismo papel de encargado.

## 8. Lo que no hay

- **Analítica, publicidad, mapas de calor, Sentry, PostHog, Datadog, etiquetas de terceros:** ninguna dependencia ni script en `apps/web/package.json` ni en el código fuente; el único `<script>` es el del propio sitio (`apps/web/src/app/(sitio)/sitio/[lang]/layout.tsx:47`). La política de contenido restringe conexiones a `'self'` y `*.supabase.co` (`apps/web/next.config.ts:38`) y fuentes a `'self'` y `data:`.
- **Cookies.** `rovaq_lang` (`apps/web/src/lib/i18n/idioma.ts:6`, un año, `proxy.ts:88`), cookie de organización activa (30 días, `proxy.ts:90`), cookies de sesión de Supabase `sb-*`, marca de sesión de soporte y cookie de dispositivo push (`auth/logout/route.ts:16`). Ninguna de publicidad ni analítica. No verificado en producción el listado completo de cookies de Supabase Auth.
- **Copias fuera de los proveedores.** El respaldo lógico por tenant (`ops/backup-restore/`) escribe un directorio local del operador (`docs/operacion/04-RESPALDOS-Y-RESTAURACION.md`, sección 2.1). Si se corre contra producción, existe una copia de datos de cliente en el equipo de quien la corre. Hay que decidir y declarar dónde viven, quién las tiene y cuándo se borran (ver `CONSERVACION-Y-ELIMINACION.md`).
- **Acceso del personal.** Sesión de soporte de solo lectura con motivo, tope de 60 minutos y registro (`supabase/migrations/20261126000000_platform_support_and_audited_reads.sql:34`). Que esa migración esté aplicada en producción es **por confirmar** (`docs/ESTADO-VIGENTE.md`, corte del 24-oct, decía que no). Además, el operador con acceso a la base realiza cargas y mantenimiento; el aviso lo declara.

## 9. Lo que el aviso público afirma y de dónde sale cada afirmación

| Afirmación del aviso | Evidencia |
|---|---|
| Rovaq es encargado de datos de conversaciones, pedidos y reembolsos | `docs/seguridad/DATOS-DE-CLIENTE.md`; `packages/connectors`; `packages/ingestion` |
| Entrada por enlace de correo y, si se ofrece, Google | `apps/web/ENVIRONMENT.md:9-10` |
| IP solo como huella | `20261205000000_email_auth_throttle.sql` cabecera; `20261205000400_security_events.sql` |
| La IA clasifica y no calcula importes; texto redactado; sin reenvío a otro proveedor; Anthropic directo solo en la lectura de Puntos de dolor | `packages/gateway/index.mjs:227,236`; `packages/intelligence/redact.mjs`; `AGENTS.md` regla 5 |
| Pregúntale corre con reglas | `aprobaciones.json` condición 2 |
| Registros de seguridad 180 días, mínimo 30 | `20261206000200_security_events_retention.sql:14-16` (la programación `supabase/operations/security-events-retention-cron.sql` la aplica Javier; activación por confirmar) |
| Pantalla de retención con vista previa y borrado confirmado | `apps/web/src/components/retention-panel.tsx`; `supabase/migrations/0033_retention_recovery.sql` |
| Respaldo diario automático de 8 días, sin punto exacto, sin adjuntos, restauración no probada | `docs/operacion/04-RESPALDOS-Y-RESTAURACION.md:7-9,18-19` |
| Sin analítica ni cookies publicitarias | sección 8 de este documento |

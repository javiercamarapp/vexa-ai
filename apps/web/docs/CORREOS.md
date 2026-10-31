# Correos de Rovaq: sistema, plantillas y cómo aplicarlas

Estado: código y pruebas listos en la rama `correos-enterprise`. **Nada de esto está aplicado en Supabase, Vercel ni DNS, y no se envió ningún correo.** Diseño y redacción: `CORREOS-DISENO.md`; arquitectura: `CORREOS-ARQUITECTURA.md`; seguridad: `CORREOS-SEGURIDAD-OPERACION.md` (en `~/.codex-work/rovaq-cierre-20261007/estrategia-20261023/diseno-panel/`).

## Qué hay en el repo

| Pieza | Dónde |
|---|---|
| Sistema de diseño (tokens, bloques, HTML + texto, contraste) | `packages/notifications/email-system.mjs` |
| 13 plantillas de Supabase Auth (6 acciones + 7 avisos de seguridad) | generador `support/F08-auth-brand/templates.mjs` -> `supabase/templates/auth/*.html` y `texto/*.txt` |
| Asuntos, `otp_expiry` y rutas de plantilla | `supabase/config.toml` (se genera con `--local-config`) |
| Notificaciones de la app (digest, bienvenida, invitación, brief, acción asignada, conexión, importación) | `packages/notifications/email-template.mjs` |
| Reporte semanal (función pura, sin cron ni envío) | `packages/notifications/email-weekly.mjs` -> `renderWeeklyReport()` |
| Logos PNG claro y oscuro | `apps/web/public/email/` (URL pública `https://rovaq-ai.vercel.app/email/...`) |
| Versión en inglés de las 13 plantillas de Auth (alternativa, sin aplicar) | `support/F08-auth-brand/templates-en.mjs` -> `supabase/templates/auth/en/` |
| Verificador de solo lectura de Resend, DNS y Supabase Auth | `node scripts/correos/verificar-resend.mjs` (opciones en el encabezado) |
| Vista previa local | `node scripts/correos/previsualizar.mjs [carpeta]` |
| Pruebas | `cd packages/notifications && npm test`, `node --test support/F08-auth-brand/templates.test.mjs` |

Supabase Auth solo envía HTML: la plantilla de Auth no admite parte de texto plano. Los `.txt` de `supabase/templates/auth/texto/` son la versión escrita para el día que esos correos salgan por el hook «Send Email» (ver abajo). Las notificaciones de la app sí salen multipart (HTML + texto).

Regenerar tras cambiar el diseño o la redacción:

```sh
node support/F08-auth-brand/templates.mjs --write        # HTML + texto de Auth
node support/F08-auth-brand/templates.mjs --local-config  # bloque para config.toml
UPDATE_SNAPSHOTS=1 node --test packages/notifications/tests/correos.test.mjs   # solo si el cambio visual es deliberado
```

## Datos que hay que confirmar antes de publicar

Todo vive en un solo objeto, `IDENTITY` de `email-system.mjs`:

- `supportEmail` / `securityEmail`: hoy `soporte@rovaq.ai` y `seguridad@rovaq.ai` son marcadores. `rovaq.ai` ya tiene MX (`smtp.google.com`, 29-oct); falta confirmar que los buzones existen.
- `privacyUrl`: `null`. No existe una página de aviso de privacidad; mientras sea `null` el pie la omite. Los correos que no son de seguridad la necesitan (LFPDPPP).
- `revokeUrl`: `null`. No existe un endpoint para revocar un cambio de seguridad, así que los avisos dicen «escríbenos a seguridad@...» y no llevan botón. Al poner la URL, el botón y la redacción del documento aparecen solos.
- `assetOrigin`: `https://rovaq-ai.vercel.app`. Los PNG de `public/email/` solo se verán cuando se despliegue esta rama (1 build de Vercel).
- Vigencia: los textos dicen «1 hora» para enlaces y código (`VIGENCIA`), igual que `otp_expiry = 3600` en `config.toml`. Supabase usa una sola vigencia para enlaces y códigos; el «10 minutos» del documento de diseño no era cierto con esa configuración. Si se cambia el valor en el panel, cambiar también `VIGENCIA` y `otp_expiry` (una prueba lo vigila).
- Roles de la invitación (Propietario, Analista, Operador, Lector): textos a validar contra la matriz real de permisos (`ROLES` en `email-template.mjs`).

## Aplicar las plantillas en Supabase (lo hace Javier; no se aplicó nada)

Proyecto: `proyecto-ejemplo`. Las plantillas del repo no se despliegan solas con la web.

Opción A, panel (sin tokens): Authentication -> Email Templates. Para cada una de las 6 acciones pegar el asunto de `supabase/config.toml` y el HTML de `supabase/templates/auth/<id>.html`. Authentication -> Notifications: lo mismo para los 7 avisos y dejar cada uno activado.

Opción B, Management API con un token que Javier cree y autorice (Claude puede preparar y verificar, no crear el token):

```sh
node support/F08-auth-brand/templates.mjs --management-patch > /ruta/privada/auth-email-patch.json
# PATCH https://api.supabase.com/v1/projects/proyecto-ejemplo/config/auth  (token en archivo local chmod 600, nunca en el chat)
# Luego leer de vuelta la configuración y comparar el hash de cada campo.
```

El parche contiene solo 13 asuntos, 13 HTML y 7 interruptores de avisos. No usar `supabase config push` (puede sobrescribir URLs y otras opciones).

Después, en el panel: Authentication -> Rate Limits y SMTP (ver checklist). Con SMTP propio se pueden fijar los límites por hora; con el integrado de Supabase solo llega a miembros de la organización.

### Cómo aplicar `invite` con metadatos

`invite.html` lee `{{ .Data.invita }}`, `espacio`, `rol`, `rol_funcion`, `rol_descripcion` y `vence` si existen, y si no, dice «Una persona te invitó a un espacio». Hoy `apps/web/src/lib/team/server.ts` no envía `data`, así que se verá la versión genérica. Antes de enviar metadatos: (1) sanear en el servidor (sin `<`, `>`, `&`, comillas, enlaces ni saltos de línea; nombres cortos); (2) confirmar si el motor de plantillas de Supabase escapa HTML (no se verificó); (3) la invitación a un usuario que ya existe sale hoy por la plantilla de enlace de acceso, no por esta. La plantilla `membership.invited` de la app (`renderEmail`) ya existe para ese caso, pero necesita el envío por SMTP propio o por el hook.

### Hook «Send Email» (opcional, requiere autorización)

Para tener texto plano real y la invitación a usuarios existentes, Auth puede entregar el correo a una ruta nuestra y enviarlo con Resend usando `texto/*.txt`. Reemplaza el motor de plantillas de Supabase y mete un punto más en el camino del acceso: no recomendado hasta que haya tráfico. Es un cambio de configuración externa.

## Cabeceras de baja de un clic

`renderEmail` y `createEmailTransport` ya emiten `List-Unsubscribe` y `List-Unsubscribe-Post: List-Unsubscribe=One-Click` en notificaciones y en el reporte, nunca en acceso, invitación ni seguridad. En notificaciones solo se activan si se define `VEXA_EMAIL_UNSUBSCRIBE_URL` (https, mismo origen que `VEXA_APP_ORIGIN`). **No existe todavía el endpoint que recibe el POST** (token firmado por usuario y evento, idempotente, sin sesión, que apaga la preferencia). No definir la variable ni enviar el reporte semanal hasta construirlo: Gmail y Yahoo harían POST a una ruta inexistente.

## Checklist de DNS y SMTP (de CORREOS-ARQUITECTURA.md)

Responsable Javier, salvo lectura con `dig`:

1. Confirmar que `rovaq.ai` es suyo y decidir el buzón de `soporte@` y `seguridad@` (GoDaddy Email, Google Workspace o reenvío). 10 min.
2. Crear cuenta en Resend, añadir `acceso.rovaq.ai` y `avisos.rovaq.ai` (y `reportes.rovaq.ai` cuando haya reporte). Región recomendada: EE. UU. 15 min.
3. En GoDaddy, por cada subdominio (Resend los entrega así): MX `send.<sub>` -> `feedback-smtp.us-east-1.amazonses.com` (prioridad 10), TXT SPF `send.<sub>` (`v=spf1 include:amazonses.com ~all`), CNAME `rsend.<sub>`, y TXT DKIM `resend._domainkey.<sub>` (clave que da Resend, pegada en UNA línea sin espacios). El DMARC propio por subdominio es opcional (hereda el de la raíz). En la raíz, reemplazar el DMARC por defecto de GoDaddy por `v=DMARC1; p=none; rua=mailto:dmarc@rovaq.ai`. Pulsar «Verify» en Resend.
4. Crear dos claves API de Resend limitadas a su dominio («supabase-auth» y «app-notificaciones»), guardarlas en un archivo local `chmod 600`, no en el chat.
5. Supabase -> Authentication -> SMTP Settings: host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = clave «supabase-auth», remitente `acceso@acceso.rovaq.ai`, nombre `Rovaq`.
6. Supabase -> Rate Limits: correos por hora a 300 o más; revisar OTP 360 por hora.
7. Supabase -> URL Configuration: Site URL de producción y redirects exactos (`/auth/callback`, `/auth/email/complete`, `/auth/invitations/*`).
8. Aplicar las 13 plantillas (sección anterior).
9. Vercel (proyecto `rovaq-ai`, antes `vexa-ai`), variables secretas: `VEXA_EMAIL_MODE=resend`, `RESEND_API_KEY`, `VEXA_EMAIL_FROM=avisos@avisos.rovaq.ai`, `VEXA_EMAIL_REPLY_TO=soporte@rovaq.ai`, `VEXA_APP_ORIGIN`, `RESEND_WEBHOOK_SECRET`, `VEXA_EMAIL_DATABASE_URL` (+ CA). `vercel env add` de secretos suele bloquearse en sesión: darlo como script o hacerlo en el panel.
10. Resend -> Webhooks: `https://<dominio>/api/webhooks/email` con delivered, bounced, complained, delivery_delayed, suppressed, failed; copiar el secreto a `RESEND_WEBHOOK_SECRET`. Los correos de Auth enviados por el SMTP de Resend llegan a este webhook como huérfanos, caso ya soportado.
11. Pruebas con buzones reales: Gmail, Outlook/Hotmail y el del responsable del cliente; revisar bandeja (no spam) y `Authentication-Results: spf=pass dkim=pass dmarc=pass`; mail-tester >= 9/10; Litmus o bandejas reales en claro y oscuro (Gmail iOS/Android, Outlook Windows). El VML y el modo oscuro de Gmail y Outlook no se han verificado en clientes reales.

Verificación en lectura (Claude): `dig +short TXT acceso.rovaq.ai`, `dig +short TXT resend._domainkey.acceso.rovaq.ai`, `dig +short MX acceso.rovaq.ai`, `dig +short TXT _dmarc.acceso.rovaq.ai`.

## Costos de despliegue

El procedimiento completo para activar Resend, con el orden y las pruebas de entrega, vive en `~/vexa-notas-28oct/cierre-software/RESEND-ACTIVAR.md`.

Este trabajo no dispara builds por sí mismo. Publicar la rama a un repo ligado a Vercel provoca 1 build, y los PNG de `public/email/` solo existen en producción tras un despliegue. Agrupar con otros cambios y avisar cuántos builds provoca antes del push.

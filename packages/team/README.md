# Equipo e invitaciones

La integración añade `/settings/team` y `/api/team`, más `/auth/invitations/[id]` y su endpoint `session`. Conserva login, callback, cookies globales y proveedores; la navegación de gestión abre Equipo. Migración nueva `0038_team_invitations.sql`; no depende de outbox de notificaciones. La autoría343 partió de6365d1f; la integración incluye revisión345 y la corrección de Referrer-Policy en el cierre de ruta y middleware.

## Configuración server

Además de la configuración Auth existente, definir `VEXA_TEAM_AUTH_URL` con el mismo origen y raíz del proyecto `NEXT_PUBLIC_SUPABASE_URL`, y `VEXA_TEAM_AUTH_ADMIN_KEY` con su credencial administrativa Supabase Auth. Custodia exclusivamente en servidor/secret manager; jamás variable NEXT_PUBLIC, repositorio, logs o cliente. Rotar en el proyecto y reemplazar el valor servidor coordinadamente; no usar credenciales de otro proyecto. Ausencia o configuración incompleta bloquea nuevas invitaciones (`team_configuration_required`). No hay credenciales incluidas.

En Supabase Auth permitir el redirect propio `https://<sitio>/auth/invitations/*` y configurar el correo del proyecto. Este trabajo sólo ensaya SMTP Mailpit aislado, nunca SMTP externo. El código fija el destino; no recibe un redirect arbitrario del solicitante. SDK estándar `inviteUserByEmail`; solamente `email_exists` o `user_already_exists`, respuesta inequívoca sin envío, habilitan `signInWithOtp` con `shouldCreateUser:false`. La UI no distingue existencia global de la cuenta.

## Autoridad y estados

Tenant se obtiene de la sesión seleccionada y membership vigente. Cada RPC vuelve a comprobar owner SQL. Cambios de rol/revocación requieren `version`; ausencia, valor obsoleto o carrera rechazan. Un lock transaccional por tenant serializa decisiones y conserva al menos un owner activo. Se incrementa permissions_version y queda auditoría sin permisos de escritura al usuario. Revocar sólo afecta ese equipo; no cierra cuentas globales. Las invitaciones emitidas son decisiones persistentes de la organización: revocar al creador no las cancela automáticamente.

`pending` significa invitación registrada, nunca membresía activa. Expira en siete días. `delivery=not_started/sending/sent/uncertain/failed` es independiente de `status=pending/accepted/cancelled/expired`. Sent significa aceptación de solicitud por Auth, no entrega al buzón ni aceptación del destinatario. El claim `sending` se confirma en PostgreSQL ANTES del HTTP; caída/timeout deja sending o uncertain, sin reenvío automático. Idempotencia por tenant/requestId conserva ese resultado, y cambio de email/rol con la misma clave da conflicto. Cancelar y volver a invitar exige una nueva acción explícita; no existe retry oculto de envío.

Landing borra fragmento antes de llamar a red. El refresh token se valida mediante refreshSession y después getUser sobre la sesión FINAL; el access token del fragmento no decide identidad. SQL consulta auth.users actual: email confirmado, no eliminado, igual al destinatario. El ID de invitación no es una credencial. Abrir correo no activa membresía; aceptar requiere POST explícito, Origin exacto y la comprobación SQL. Aceptación concurrente/replay no eleva permisos ni agrega otro audit; si membership fue revocada, replay rechaza. Membresía activa preexistente no cambia por una invitación. No se crea usuario confirmado artificialmente.

La transición de cookies/tenant termina en navegación completa, descartando Router cache previo a autenticación. Una excepción ESLint puntual explica esa necesidad. La página no envía referrer y los tokens no entran en query ni logs propios. Body JSON acotado a16KiB y RPC4KiB; campos/rutas extra rechazan. Paginación estable25 por ID para miembros e invitaciones pendientes. Error de carga borra la lista anterior; refresh fallido no muestra éxito.

## Reingreso por correo

El módulo separado `/auth/email` permite volver a iniciar sesión desde `/login` cuando `VEXA_EMAIL_AUTH_ENABLED=true`; únicamente para usuarios existentes, sin crear cuentas ni membresías. Configurar SMTP y el redirect propio `/auth/email/complete`. La respuesta de solicitud es uniforme y no acredita entrega. La sesión exige identidad final confirmada; las respuestas rechazadas no instalan cookies nuevas. Una cuenta revocada puede seguir siendo una identidad de Auth, pero no obtiene acceso al equipo revocado. Los ensayos locales no acreditan entrega mediante un SMTP externo.

## Pruebas del autor, locales SYN

Con Node22.23.2 o26.7.0, Docker e imágenes existentes del harness (incluye Mailpit1.30.2), puertos61620..61625 libres y evidencia fuera del candidato:

```sh
VEXA_CANDIDATE=/ruta/candidato VEXA_TEAM_EVIDENCE=/ruta/evidencia node packages/team/tests/author.mjs
```

El control reutiliza infraestructura real Auth/PostgreSQL/PostgREST/Storage/Next/Chromium ya existente, instala y compila en TMP, envía a example.test en Mailpit local y elimina recursos propios por journal0600/IDs. Cubre owner/A-B/analyst/viewer/CSRF, CASnull y último owner concurrente, SMTPúnico/idempotencia, identidad final/confirmada/cambioemail/expiración, navegador390 y1280, selección/acceso/revocación/API/export/jobs, cancelación/dosaccepts, falloHTTPambiguo sinreenvío, paginación y error/retry UI. Los fallos de producto/control y sus correcciones se conservan en la entrega; estos ensayos no sustituyen revisión independiente ni revisión SQL09 bloqueada.

Fuentes oficiales: [invitar por email](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [magic links y OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Revisión independiente345: autoridad, envío incierto, identidad final, cuerpos, configuración y encabezados HTTP comprobados; 3/3 focales en Node22/26 tras corregir la política no-referrer. La integración completa pasó lint/build. El reingreso tiene pruebas y revisión independientes de este módulo.

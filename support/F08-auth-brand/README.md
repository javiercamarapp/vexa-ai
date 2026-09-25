# Acceso sin contraseña y correos Auth VEXA

El acceso conserva las rutas aceptadas de Google (PKCE), magic link para cuentas existentes y aceptación explícita de invitaciones. `/login` presenta un formulario central adaptable con objetivos de48px y estados de carga, espera y error. El nombre tipográfico es provisional: Javier indicó que proporcionará después los logos. La referencia específica de agencia Atiende aún no fue identificada; no se afirma equivalencia visual exacta.

`apps/web/src/lib/brand.json` es el punto único de marca para login y correos. Cuando llegue el logo autorizado, ubicar un PNG/JPEG optimizado en `apps/web/public/brand/`, establecer `logoPath` (por ejemplo `/brand/vexa-logo.png`) y sus dimensiones reales. No admite direcciones externas, queries ni rutas fuera de `/brand/`. Regenerar los HTML con `node support/F08-auth-brand/templates.mjs --write`; revisar la imagen en clientes de correo y publicar también el asset. El fallback actual usa el nombre VEXA y no pretende sustituir el logo oficial.

Seis plantillas Auth y siete avisos de seguridad comparten la misma cabecera, paleta, jerarquía y pie. No cargan tracking, código, fuentes remotas ni contenido de user_metadata. El enlace permanece `ConfirmationURL` emitido por Auth: conserva verificación, caducidad y uso único. Abrir una invitación no concede acceso al equipo. Los avisos de seguridad no requieren una suscripción comercial. Las plantillas de recuperación/MFA/teléfono cubren eventos del proveedor; su existencia no añade pantallas de esas funciones al producto.

## Configuración del proyecto propio

`supabase/config.toml` configura las13 plantillas locales, los siete avisos de seguridad y los redirects de callback, correo e invitación en el origen local3640. No cambiar el sitio por un comodín. En el Supabase gestionado, el operador autorizado puede preparar el patch de **sólo** asuntos, HTML y siete toggles con:

```sh
node support/F08-auth-brand/templates.mjs --management-patch > /ruta/privada/auth-email-patch.json
```

El comando no lee credenciales, no conecta servicios, no envía correos y no aplica el patch. Aplicarlo mediante Management API `PATCH /v1/projects/<proyecto-VEXA>/config/auth` o dashboard con permiso legítimo; leer nuevamente los campos y comparar cada hash. Usar el mismo sitio HTTPS publicado y redirects exactos `/auth/callback`, `/auth/email/complete` y `/auth/invitations/*`. Los HTML de correo no se despliegan automáticamente por publicar la web.

Para Google, configurar el cliente OAuth dedicado del proyecto VEXA con redirect al callback de Supabase; activar el proveedor y luego `VEXA_GOOGLE_AUTH_ENABLED=true`. La web fija `/auth/callback`, usa S256 y una cookie de verificador HttpOnly, valida Origin antes de iniciar el flujo y normaliza el destino local. No copiar el OAuth de Atiende/Likida. Google remoto requiere sus credenciales y configuración reales.

Para magic link, `VEXA_EMAIL_AUTH_ENABLED=true`, URL/clave pública/origen de Auth y SMTP autorizado. Para invitaciones, además `VEXA_TEAM_AUTH_URL` y `VEXA_TEAM_AUTH_ADMIN_KEY` exclusivamente servidor. La solicitud uniforme no enumera usuarios ni confirma entrega. El proveedor aplica su límite distribuido, complementado por la admisión local; SMTP custom debe tener remitente de VEXA, identidad/dominio verificados y SPF/DKIM/DMARC alineados. Configurar un Reply-To atendido cuando el proveedor lo soporte. Las credenciales, DNS y envío de prueba externo necesitan un canal propio autorizado. El servidor SMTP incluido por Supabase tiene restricciones: no se toma como entrega productiva verificada.

## Verificación local

```sh
node --test support/F08-auth-brand/templates.test.mjs
VEXA_CANDIDATE=/ruta/candidato VEXA_AUTH_BRAND_EVIDENCE=/ruta/privada node support/F08-auth-brand/author.mjs
```

El autor reutiliza el harness aceptado F01-02 sin editarlo: puertos64600–64603, imágenes Docker cacheadas, Postgres/Auth/PostgREST/Storage/Mailpit/Chromium reales aislados y compilación Next en TMP. Las sustituciones adaptan puertos, rutas de soporte y configuración de correo; no cambian reglas de Auth. Guarda resultados y limpieza fuera del candidato, sin tokens en el recibo. No ejecuta Google remoto ni envía fuera de Mailpit.

Los previews Chromium móvil/escritorio y claro/oscuro no equivalen a certificación de Outlook/Gmail/Apple Mail. Verificar esos clientes y el logo final antes de afirmar fidelidad visual. Los eventos de negocio/F06-09 quedan fuera de este delta; estos trece mensajes son exclusivamente Supabase Auth.

Referencias: [configuración de plantillas](https://supabase.com/docs/guides/local-development/customizing-email-templates), [plantillas y Management API](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP propio](https://supabase.com/docs/guides/auth/auth-smtp).

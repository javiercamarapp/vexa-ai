# Acceso por correo: despliegue y diagnóstico del retorno

**Actualización posterior:** el retorno localhost quedó corregido y la administración de plataforma fue integrada y verificada. Ver [estado vigente](ACCESO-PLATAFORMA-CORREOS-2026-09-30.md). El diagnóstico siguiente se conserva como evidencia histórica.

El acceso por correo está habilitado en la web desplegada. El enlace de Supabase todavía redirige a `http://localhost:3000/`; por ello el inicio desde el correo **no está validado de punta a punta**. Se mantienen 54/60 tareas técnicas, 25 aceptaciones formales y producción pendiente.

## Cambio y evidencia

Se activó `VEXA_EMAIL_AUTH_ENABLED` en el proyecto propio, desplegando las mismas 724 fuentes públicas de `ccf546b3495ec8d8fb0e2c2886e3be842274696a`. El despliegue `dpl_3gw3f3hoZBxMxeJLAuQQq1BpwCXv` está READY; el alias `https://vexa-ai.vercel.app` sirve ese SHA. No se modificó el código ni se habilitó Google o el receptor CRM.

Una cuenta sintética propia permitió reproducir el retorno incorrecto del proveedor sin enviar correos. Al entregar explícitamente esa sesión sintética a la ruta correcta de la aplicación se comprobaron: retirada del fragmento de la URL, establecimiento de cookies, selección de organización, página «Tu organización», enlace «Abrir workspace», `/overview` con «Resumen ejecutivo» y cierre de sesión HTTP 200 hacia `/login`. No hubo escrituras de negocio ni errores JavaScript observados. Esto verifica el manejador de la aplicación, no corrige ni acredita el enlace original del proveedor.

Los dos ensayos previos se conservan como fallidos: el primero esperaba navegación directa a `/overview`, aunque la aplicación abre la selección de organización; el segundo esperaba el título «Resumen», aunque el título real es «Resumen ejecutivo». Se corrigieron esas expectativas del diagnóstico, sin cambiar producto ni gates de aceptación. El cierre normal revocó las sesiones de la cuenta sintética: una consulta posterior del usuario exacto en `auth.sessions` devolvió cero. El intento redundante de revocación local posterior quedó registrado como fallido y no se usó como evidencia de limpieza.

Recibos privados: `private/javier-auth-20260930/deployment-verified.json`, `synthetic-email-completion-report.json`, `synthetic-email-completion-v2-report.json`, `synthetic-email-completion-v3-report.json` y `cleanup-reconciled.json`. Contienen diagnóstico operativo y no se publican.

## Configuración pendiente

En Authentication → URL Configuration del proyecto propio se necesita:

- Site URL: `https://vexa-ai.vercel.app`
- Redirect URL de correo: `https://vexa-ai.vercel.app/auth/email/complete`
- Redirect URL de Google: `https://vexa-ai.vercel.app/auth/callback`
- Redirect URL de invitaciones: `https://vexa-ai.vercel.app/auth/invitations/*`

Supabase exige que el destino solicitado coincida con su lista permitida. [Documentación oficial de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls). El conector disponible administra SQL, pero no esta configuración de Auth; la CLI de administración respondió Unauthorized y el navegador de automatización requiere iniciar sesión. Se abrió el panel y se solicitó guardar las URLs o conectar acceso de administración. La modificación todavía no está confirmada. Después hace falta una prueba con un enlace nuevo y su destino original, sin reconstruir manualmente la URL.

Google sigue deshabilitado y requiere el cliente OAuth propio. El correo de producción con remitente propio y las plantillas remotas siguen pendientes; la aceptación de una solicitud SMTP no demuestra entrega general. El flujo actual sólo permite cuentas existentes/invitadas. Una membresía `owner` administra su organización y **no equivale a un superadministrador global**, función todavía no implementada.

## Publicación sin compilaciones automáticas

El preflight comprobó repositorio no fork, rama predeterminada `main`, identidad de commit asociada a la cuenta de GitHub, Actions desactivado, ausencia de webhooks y vínculo Git de Vercel nulo. Los avances se publican mediante el publisher autorizado, conservando commits coherentes y autoría, sin squash ni fragmentación artificial. Esta documentación no requiere desplegar otra versión. La publicación en GitHub y los despliegues de producto se verifican por separado; no se promete costo total cero de la infraestructura en uso.

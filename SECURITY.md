# Política de seguridad

## Cómo reportar una vulnerabilidad

No abras un issue público. Usa el reporte privado del repositorio (pestaña **Security → Report a vulnerability** de `javiercamarapp/vexa-ai`) o escribe al fundador a javiercamaraportepetit@gmail.com con el asunto «Seguridad Rovaq AI».

Incluye: qué ocurre, cómo reproducirlo, qué datos o permisos quedan expuestos y, si puedes, una propuesta de corrección. Nunca incluyas datos reales de clientes ni credenciales en el reporte.

## Alcance

La aplicación web (`apps/web`), los paquetes de `packages/`, las migraciones y políticas RLS de `supabase/` y las plantillas de correo. Quedan fuera los servicios de terceros (Supabase, Vercel, proveedores de correo y de IA): repórtalos a sus propietarios.

## Qué esperar

Se confirma la recepción, se evalúa la gravedad y se corrige primero lo que afecte el aislamiento entre organizaciones o la exposición de datos personales. No se persigue a quien reporta de buena fe.

## Principios del producto

Aislamiento por organización con RLS, secretos sólo en servidor, auditoría de operaciones de plataforma y exportes sin datos personales. Los pendientes de seguridad (MFA para administradores de plataforma, CSP estricta) se declaran en el [README](README.md#estado-del-producto-honesto).

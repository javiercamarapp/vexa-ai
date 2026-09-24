# Entorno de VEXA

Auth, permisos, importación durable, conectores, análisis y workspace están implementados. Sin configuración la aplicación muestra servicios no disponibles; no fabrica sesiones ni datos. Consulte PROGRESO.md y los recibos para distinguir lo aceptado de las propuestas locales. Las notas históricas de implementación no sustituyen ese estado.

| Servicio | Variables | Condición |
|---|---|---|
| Auth web | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL | Las tres; proyecto VEXA y origen correcto. Anon no es service-role. |
| Google | VEXA_GOOGLE_AUTH_ENABLED | Requiere OAuth/redirects configurados legítimamente. |
| SQL | VEXA_DATABASE_URL | Sólo servidor; login restringido, sin superuser, BYPASSRLS ni propiedad de tablas. |
| Importación | VEXA_IMPORT_CONFIRMATION_SECRET, VEXA_DURABLE_CONSUMER | Secreto servidor y admisión según salud del consumidor. |
| Worker | VEXA_SUPABASE_URL, VEXA_SUPABASE_ANON_KEY, VEXA_WORKER_EMAIL, VEXA_WORKER_PASSWORD, VEXA_WORKER_USER_ID | Identidad real de servicio y delegación vigente. |
| Programación | VEXA_WORKER_DISPATCHER, VEXA_WORKER_TENANT, VEXA_WORKER_TRIGGER_SECRET, VEXA_WORKER_ENDPOINT, VEXA_WORKER_INTERVAL_MS | Dispatcher o tenant fijo; cada consumidor necesita su programación. |
| CRM | VEXA_CRM_CREDENTIALS_JSON | Sólo servidor; vincula referencia a tenant/proveedor/cuenta. Ver packages/connectors/CRM-RUNTIME.md. |
| Extracción | VEXA_AI_RUNTIME, OPENROUTER_API_KEY, VEXA_EXTRACTION_CONFIG_JSON | Inferencia requiere habilitación, autorización de gasto, privacidad, tarifas y presupuesto. |
| Problemas | VEXA_PROBLEMS_RUNTIME, VEXA_PROBLEMS_CONFIG_JSON | Política y versiones del servidor, no del navegador. |
| Email, propuesta F06-10/12 | VEXA_EMAIL_MODE, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, VEXA_EMAIL_FROM, VEXA_APP_ORIGIN, VEXA_EMAIL_DATABASE_URL | Remitente autorizado, webhook y rol dedicado. Mailpit local no acredita entrega externa. |
| Push, propuesta F06-11/12 | VEXA_PUSH_SUBJECT, VEXA_PUSH_PUBLIC_KEY, VEXA_PUSH_PRIVATE_KEY | Privada sólo servidor; consentimiento por dispositivo y HTTPS. |
| Retención | VEXA_RETENTION_LEDGER_KEY | Clave de al menos 32 bytes sólo en servidor; firma confirmaciones y registros exportados. Conservarla en el gestor de secretos para verificar respaldos; no cambiarla sin conservar capacidad de verificación. |
| Identidad de build | VEXA_BUILD_REVISION | SHA completo de 40 caracteres hexadecimales minúsculos del checkout limpio que se compila. |

VEXA_COMPILED_REVISION se deriva en next.config.ts. /api/health/version devuelve esa revisión compilada o null si falta. No acredita disponibilidad de DB/consumidores ni producción. No etiquete una copia sin integrar con el SHA de una versión anterior. El smoke remoto compara el valor servido con el manifest.

## Compilar en una copia temporal

Node >=22, dependencias exactas y lock del checkout. Verificar aparte el runtime del proveedor. Copiar package.json, package-lock.json, apps/ y packages/ a una carpeta propia, sin .env, node_modules ni .next. Con caché npm preparada:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run lint --workspace @vexa/web
npm run typecheck --workspace @vexa/web
NEXT_TELEMETRY_DISABLED=1 npm run build --workspace @vexa/web
npm run start --workspace @vexa/web -- --hostname 127.0.0.1
```

Para una release autorizada, tomar git rev-parse HEAD del checkout limpio y suministrarlo como VEXA_BUILD_REVISION antes del build. Una revisión malformada detiene la configuración. Cambiar el entorno al arrancar no renombra un artefacto compilado. Las variables adicionales de timeout/chunk/polling se documentan con cada módulo; no aumentarlas para ocultar una falla.

Migraciones cloud, Vault, extensiones, cron y despliegues conservan sus permisos específicos. El frontend no instala cron ni mantiene workers por sí solo. Proveer secretos mediante el gestor del entorno, nunca en NEXT_PUBLIC_*, Git, capturas o logs. Coordinar rotación en proveedor y consumidores y verificar revocación. Originales privados y datos del cliente no forman parte del build.

Guías de entrega: docs/entrega/. Esta configuración no significa que únicamente falten claves mientras existan revisiones técnicas pendientes.

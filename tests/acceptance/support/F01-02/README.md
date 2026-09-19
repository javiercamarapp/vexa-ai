# Examen F01-02 (sólo sintéticos)

No implementa el producto. El gate carga **VEXA_CANDIDATE**; el probe separado sólo valida un oráculo, nunca acepta VEXA.

```sh
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/F01-02.test.mjs
VEXA_CANDIDATE="$PWD" node --test tests/acceptance/support/F01-02/probe.test.mjs
```

Requisitos del ensayo: Docker local con contenedores `supabase_db_vexa-local`, `supabase_auth_vexa-local` y `supabase_kong_vexa-local`; identidad de proyecto verificada antes de escribir, DB 56322/API 56321, Mailpit 56324, Google deshabilitado. Next se construye y arranca en temporal propio en 127.0.0.1:3640; un puerto ocupado bloquea, no se reutiliza ni se mata. Chrome instalado en su ruta macOS habitual. Dependencias de soporte fijadas con lock; precargar su cache mediante `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org` **en una copia temporal** de package.json y package-lock.json. El gate instala offline. Nunca instalar en el candidato ni exportar credenciales.

El esquema real de identidad debe estar instalado mediante migraciones revisadas de VEXA. Actualmente está ausente: este autor no crea tablas ni aplica migraciones. El driver de fixtures usa organizations(id,name), memberships(tenant_id,user_id,role,status,permissions_version); los valores de membership son active/analyst/owner. Si la implementación usa otros nombres o columnas obligatorias, adaptar este driver desde control-plane antes de congelarlo, conservando oráculos. Sólo elimina UUID propios y usuarios Auth creados por la corrida; no hace reset.

Adaptación UI explícita pendiente de contrastar con la implementación: ruta protegida `/`, selector HTML `select` con UUID como valor de cada organización dentro de un formulario (aut submit o botón submit), botón accesible de cierre de sesión. No se inventa un endpoint Auth/session del producto. Las peticiones de selección se capturan desde el formulario real con nonce/CSRF fresco; hay controles autorizados antes/después, rechazo 403/404 con motivo de autorización, consulta DB antes/después y canario B. Un driver incompatible falla SETUP; no significa vulnerabilidad.

Los callbacks usan OTP/PKCE real, correo Mailpit del destinatario único y código emitido por Auth local. Nunca Google ni un intercambio simulado. Los casos externos tienen membership válida para alcanzar el camino exitoso. Los redirects se inspeccionan sin seguirlos. El browser bloquea destinos fuera de VEXA local; el proceso Next usa únicamente configuración local suministrada por el ensayo.

Las sesiones normales provienen de login real. El probe de firma altera únicamente bytes de firma y confirma que un lector inseguro del payload falla exactamente AUTH_SIGNATURE. Los casos temporales son **JWT sintéticos firmados con la clave del emisor local**, con claims de un usuario realmente creado, comparando vigente/expirado sin refresh. Ambos se contrastan con Auth real, y el vigente también con la app, antes de atribuir un rechazo a expiración. Esto prueba validación de expiración; **no acredita esperar el TTL real ni renovación automática de sesión**. Las claves de setup se obtienen dentro del proceso exclusivamente del contenedor Auth VEXA y nunca se imprimen, persisten ni se envían al navegador.

Estado de autoría: baseline sin session.ts falla IMPLEMENTATION_MISSING. Probe de firma local pasó con control positivo y mutante rechazado por la aserción de firma. No se ha ejecutado el circuito de producto por falta de implementación/esquema. Callback exitoso, selector, revocación, temporalidad y logout requieren validación contra el candidato real; no se presentan como verificados. No prueba Google real, producción, HTTPS/cookie Secure de despliegue, RLS integral ni SaaS terminado. Revisión independiente pendiente, sin delegación en esta sesión.

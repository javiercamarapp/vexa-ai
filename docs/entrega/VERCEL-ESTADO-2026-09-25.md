# VEXA AI — despliegue comprobado, 25 de septiembre

URL propia: **https://vexa-ai.vercel.app**. Proyecto `vexa-ai`, runtime Node 22. El artefacto desplegado sirve la revisión `722a9d90b8b527592e2438fb86e5ed3ba6ce3755`, publicada también en GitHub. El destino de Vercel se llama `production`; ese nombre no certifica que el producto esté listo para clientes.

## Comprobaciones realizadas

- Compilación remota terminada y alias HTTPS asignado. `/api/health/version` devuelve la revisión esperada.
- Login en escritorio y móvil: HTTP 200, encabezado visible y sin desbordamiento horizontal. Paleta verde, blanco y negro; logo definitivo pendiente del usuario.
- Dos identidades y organizaciones SYN propias autentican contra Supabase real. Cada organización consulta su conexión CSV y no recibe la ajena. Una selección de tenant ajeno devuelve 403; sin sesión, la API devuelve 401.
- La conexión directa inicial devolvía 503 en las consultas del backend. La dirección del pooler se obtuvo con `supabase link`, sin adivinarla. El rol restringido mantiene TLS 1.3 con CA oficial y verificación de hostname. Tras configurar el pooler de transacciones, ambas consultas remotas pasaron.
- El owner SYN puede habilitar y revocar la delegación del worker mediante la API desplegada. Las pruebas dejaron la delegación deshabilitada y no activaron programación continua.

## Defecto pendiente de integrar

La llamada HTTP al consumidor desplegado devuelve `WORKER_UNAVAILABLE`. Se reprodujo con su ruta compilada y sus dependencias en un contenedor aislado: `createRequire(import.meta.url)` conservaba una ruta absoluta de la máquina de compilación; cargar `pg` terminaba en `MODULE_NOT_FOUND`.

Existe una corrección local de un archivo que usa importación dinámica del módulo. La misma prueba aislada pasa de 503 a 200/IDLE y alcanza el despacho. Compilación y lint pasan, al igual que 12 pruebas TLS por Node 22 y 26. La fuente corregida también autenticó al worker y escribió un heartbeat en Supabase real, comprobado por la API de salud de Vercel. Esta última prueba ejecutó el candidato desde la máquina local: **no sustituye la ejecución del consumidor corregido en Vercel**.

Falta revisión independiente antes de integrar, publicar y desplegar esa corrección. El límite acumulado autorizado está agotado en 376/376 invocaciones; se solicitó ampliarlo a 377 para esa revisión puntual. No se inicia otra llamada sin respuesta. La importación remota hasta estado terminal y su recuperación siguen pendientes; no se da por aprobado el smoke remoto completo.

## Configuración externa pendiente

El usuario decidió dejar el dominio de correo y los logos pendientes. No se reutiliza el dominio SMTP de otro producto. Google OAuth y correo permanecen deshabilitados hasta configurar y verificar los proveedores propios. Las trece plantillas Auth están preparadas y probadas localmente; su aplicación remota y la entrega real siguen pendientes. No se activan crons continuos ni inferencia pagada.

Se conserva el conteo de 53/60 alcances técnicos integrados y 25 aceptaciones formales, con esta reparación de despliegue abierta. No hay incremento por configurar hosting ni por repetir una prueba. Las siete fichas sin cierre y el bloqueo de revisión de F06-09 permanecen; la auditoría integral no está aprobada y `production_validated` continúa en `false`.

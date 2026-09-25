# VEXA AI — despliegue comprobado, 25 de septiembre

URL propia: **https://vexa-ai.vercel.app**. Proyecto `vexa-ai`, runtime Node 22. El artefacto desplegado sirve la revisión `aed5c3a7fc65c0af9f6ecc3315732e905774d03d`, publicada también en GitHub. El destino de Vercel se llama `production`; ese nombre no certifica que el producto esté listo para clientes.

## Comprobaciones realizadas

- Compilación remota terminada y alias HTTPS asignado. `/api/health/version` devuelve la revisión esperada.
- Login en escritorio y móvil: HTTP 200, encabezado visible y sin desbordamiento horizontal. Paleta verde, blanco y negro; logo definitivo pendiente del usuario.
- Dos identidades y organizaciones SYN propias autentican contra Supabase real. Cada organización consulta su conexión CSV y no recibe la ajena. Una selección de tenant ajeno devuelve 403; sin sesión, la API devuelve 401.
- La conexión directa inicial devolvía 503 en las consultas del backend. La dirección del pooler se obtuvo con `supabase link`, sin adivinarla. El rol restringido mantiene TLS 1.3 con CA oficial y verificación de hostname. Tras configurar el pooler de transacciones, ambas consultas remotas pasaron.
- El owner SYN puede habilitar y revocar la delegación del worker mediante la API desplegada. Las pruebas dejaron la delegación deshabilitada y no activaron programación continua.

## Interfaz nueva: pruebas remotas del SHA aed5c3a

La composición379/381 se publicó y compiló desde719fuentes exactas. Login en1440/390/320px, movimiento reducido, grupos cerrados al contraer/expandir, actualización del trabajoCSV existente y menú móvil/Escape/retorno de foco pasan. Veinte rutas autenticadas responden200 con un main, sin desbordamiento, solicitudes resueltas y sin erroresJavaScript sin capturar. Una captura móvil final adicional muestra las dos importaciones succeeded después de terminar la carga. Esto prueba los controles indicados; no convierte todos los582sitios del inventario en acciones ejecutadas.

El mismo trabajo se solicitó a través del origen alojado con A→B→anónimo→A:200/404/401/200, cabecera private/no-store y sin cachéHIT. Es evidencia focal de aislamiento y caché, no un examen exhaustivo de todos los endpointsCDN. [Revisión local y límites](INTERFAZ-ATIENDE-2026-09-25.md).

## Defecto de empaquetado corregido y comprobado en Vercel

La llamada HTTP al consumidor anterior devolvía `WORKER_UNAVAILABLE`. Se reprodujo con su ruta compilada y sus dependencias en un contenedor aislado: `createRequire(import.meta.url)` conservaba una ruta absoluta de la máquina de compilación; cargar `pg` terminaba en `MODULE_NOT_FOUND`.

Se integró una corrección de un archivo que usa importación dinámica del módulo. La misma prueba aislada pasa de 503 a 200/IDLE y alcanza el despacho. Compilación y lint pasan, al igual que 12 pruebas TLS por Node 22 y 26. La fuente corregida también autenticó al worker y escribió un heartbeat en Supabase real, comprobado por la API de salud de Vercel. Esta última prueba ejecutó el candidato desde la máquina local: **no sustituye la ejecución del consumidor corregido en Vercel**.

El usuario autorizó la revisión377 y la continuación del trabajo. La revisión independiente ejecutó los cinco POST trasladados: cinco fallos503 del baseline y cinco respuestas200/IDLE del candidato, más diez rechazos401 antes de acceder a DB/Auth. CLI5/5 porNode22/26, lint/buildNode22 y limpieza comprobados. La corrección está publicada y desplegada. El consumidor HTTP real autenticó y procesó una importación de tres filas desde Storage hasta succeeded: tres aceptadas, cero rechazos, duplicados o pendientes. Una segunda organización no pudo leer el trabajo conocido. Una segunda importación quedó en cola durante una pausa controlada; se observó NO_HEARTBEAT y rechazo503 de nuevas admisiones, y el mismo trabajo terminó con tres filas aceptadas al reanudar. Delegación deshabilitada al acabar. Los siete controles focales pasaron sobre1ccec37; el SHA posterioraed5c3a conserva la fuente del consumidor y añadió las comprobaciones de interfaz descritas arriba. Estos controles no equivalen al smoke completo de ocho fases ni a validación de CRM/IA real.

## Configuración externa pendiente

El usuario decidió dejar el dominio de correo y los logos pendientes. No se reutiliza el dominio SMTP de otro producto. Google OAuth y correo permanecen deshabilitados hasta configurar y verificar los proveedores propios. Las trece plantillas Auth están preparadas y probadas localmente; su aplicación remota y la entrega real siguen pendientes. No se activan crons continuos ni inferencia pagada.

Se conserva el conteo de 53/60 alcances técnicos integrados y 25 aceptaciones formales, con esta reparación de despliegue cerrada. No hay incremento por configurar hosting ni por repetir una prueba. Las siete fichas sin cierre y el bloqueo de revisión de F06-09 permanecen; la auditoría integral no está aprobada y `production_validated` continúa en `false`.

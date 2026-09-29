# VEXA AI — despliegue comprobado, 25 de septiembre

## Corte29-sep: aprobación económica ligada a contenido y versiones

Producto `78b524ded807623df410d5b199a5b0df8687e002` publicado y desplegado READY; SHA servido y fuente subida verificados. Autor397 y revisión independiente398, Node22 y recuperación409→200; invalidación de aprobación comprobada en escritorio/móvil remotos sin escrituras. [Informe y límites](CONSENTIMIENTO-ECONOMICO-2026-09-29.md).53/60técnicas,25formales, producción pendiente. Los apartados siguientes conservan sus fechas y alcances.

## Corte29-sep: reconexión corregida y desplegada

Producto `5c9f84d4c7f285d98940ac45f4ebed291880532e`, Vercel READY y SHA servido/fuente subida verificados. Consentimiento por intento y bloqueo síncrono de solicitudes repetidas: revisión independiente y pruebas locales409/202, compilaciónNode22; Conexiones remoto Chromium1440/WebKit390 aprobado con alcance de lectura. [Informe394–396 y límites](ACCIONES-UI-2026-09-29.md).53/60técnicas,25formales, producción pendiente. Los cortes siguientes conservan sus alcances y fechas.

## Actualización: contraste y aviso stale comprobados

Producto vigente `4218d71c23f978776c40d27c848ca8d4ffcf6c6d`, desplegadoREADY y SHA servido comprobado. Login remoto1440/390, CSS corregido y fuentes subidas verificadas; Explorador autenticado con observaciones404 y controles de vacío/actualizar en Chromium/WebKit, sin ready/stale remoto ni nuevo smoke completo. [Pruebas locales independientes y límites](ACCESIBILIDAD-ESTADOS-2026-09-28.md). El smoke completob9 conserva su revisión original. CLI de logs propio respondió;14solicitudes observadas del despliegue anterior,200/303, no certificación global de errores.53/60técnicas,25formales, producciónfalse. Los apartados siguientes son cortes históricos.

## Actualización28-sep: corrección móvil publicada y verificada

El alias sirve `22e8137c1c97e0c61f20c7b00cc0158a778cef56`: despliegueREADY, SHA servido, login200 y assetCSS revisado comprobados.719fuentes exportadas; backend/JavaScript sin cambios desde `b9ed3db`. Las cinco comprobaciones locales independientes WebKit/Chromium y sus límites están en [CHECKS-UI](CHECKS-UI-2026-09-28.md). El smoke completo del apartado siguiente pertenece a su SHA original; no se repitió ni se atribuye a este despliegue.53/60técnicas,25formales, producciónfalse.

## Actualización28-sep: smoke completo aprobado

El alias sirve `b9ed3db5ef4df825c27ed208722ad2faad4ee9c3`. Runner oficial8/8fases y ocho vistas;114solicitudes, límite15s intacto, cuentasSYN y limpieza verificada. [Informe completo](SMOKE-REMOTO-2026-09-28.md).53/60técnicas,25formales, producciónfalse; los cortes siguientes conservan su fecha y alcance.


## Actualización 28-sep: smoke completo fallido por latencia

El alias conserva el producto `aed5c3a7fc65c0af9f6ecc3315732e905774d03d`. Cinco fases remotas pasaron y seis vistas fueron renderizadas; Intervenciones excede 15 segundos. La reproducción confirmó el timeout y una respuesta 200 en 16,487 segundos bajo diagnóstico separado. No se cambiaron los límites del runner ni se desplegó una corrección sin revisión. API de Brief comprobada por separado:200 en 1,090 segundos.

Delegación del consumidor deshabilitada, navegador SYN cerrado, sin ejecución programada continua. La propuesta local reduce consultas 718→538 y pasó 15 pruebas de snapshots y 14 de Intervenciones; siguen pendientes revisión independiente y verificación del rendimiento remoto. 53/60 técnicas, 25 formales, producción false. [Detalle de auditoría y límites](AUDITORIA-20-RUBROS.md). Los apartados siguientes conservan los cortes anteriores.


Una ejecución focal posterior comprobó pausa, alarma, rechazo de admisión, recuperación del mismo trabajo3/3 y revocación real de la cuentaSYN A, con B todavía autorizado. Se conservaron los fallos del operador de ensayo y su corrección de vínculo trabajo/importación; no se modificaron permisos del producto. El informe focal no acredita ocho vistas ni corrige la latencia del recorrido completo. La delegación vuelve a quedar deshabilitada.

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

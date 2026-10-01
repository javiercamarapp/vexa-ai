# F06-12 — Eventos de negocio y entrega integrada

**58/60 técnicas;28 aceptadas formalmente. Producción pendiente.** Producto integrado en `b0bb17cc79724e84fc89ebf4fc94f131d787135a`, controles revisados en `e5da0dd`. La aceptación formal de esta ficha depende de F06-05/F06-06 y sus dependencias externas; no se modifica el grafo para omitirlas.

Publicar un brief o asignar una intervención genera un aviso transaccional, con deduplicación, preferencias personales, política vigente y acceso actual. Abrir el aviso lo marca leído, reduce el contador y lo retira de pendientes sin tocar otra organización. El consumidor HTTP usa las factorías integradas de inapp y Push con contexto de servidor; el daemon integra correo.

| Comprobación | Resultado | SHA256 |
| --- | --- | --- |
| Gate en clon Git limpio, Node22 |23/23, sin fallos/cancelaciones/omitidas | `536c551769ae7e2fb61f9ac137da8a5028615f87d3f600a67fc2ceff758ece8c` |
| Revisión independiente428 | Aprobada para integración técnica | `657f07a79fca7ea19f86a6d84d4eede6e209817ae257c2a5c7e417715337d410` |
| Pruebas hijas |16contratos,12lectores TypeScript,8estados UI | Incluidas en el recibo anterior |

Lint y compilación aprobados. Se comprobaron Next/Auth/PostgreSQL locales, transacciones/replay, aislamiento A/B, revocación, conservación de identidad SQL en éxito/error/cancelación, lectura y navegación del aviso, Push TLS con cifrado real y SMTP Mailpit. Las21fuentes y19controles ejecutables coinciden con los revisados. Seis recursos temporales, Mailpit y directorios temporales retirados. Base24/24 aprobada; controlador134/134 anterior conserva fuentes inalteradas.

Los ensayos rojos anteriores se conservan: selector del botón de lectura, anunciador global de Next confundido con error del panel, colisión del puertoSMTP y elección de tenant del dispatcher global. Las correcciones afectan los controles concretos; la corrida limpia usa el mismo producto revisado. No se añadieron reintentos para esconder fallos. Next conserva avisos de convención middleware y dependencia dinámica; las rutas hosted con factoría integrada sí fueron ejercitadas.

## Supabase y publicación

Migración0032 aplicada legítimamente por MCP, versión `20261001053556`, SQL SHA256 `ee9e5b42f3964cf91adcae9ef6a70c3a2f1ecfc53b8034ec29c1d0fd5bc28ef4`. RLS forzado,42permisos de tabla,12permisos de funciones, dosFK y cinco triggers habilitados verificados remotamente; cero concesiones inesperadas y cero eventos reales nuevos.

El advisor identifica la tabla privada sin políticas: su falta de acceso directo es intencional y está comprobada por ACL. También conserva avisos sobre seis funciones SECURITY DEFINER invocables por usuarios y protección de contraseñas filtradas desactivada; se revisarán en F07-01, sin declararlos resueltos por esta ficha. Referencias: [funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Publicado mediante publisher autorizado en `a01b50b2cb01729eda4a6940dfbb868a1adef356`, tres commits reales con autoría asociada y SHA remoto comprobado. Vercel `dpl_HFpKAb8F9GTH9CJQwq88FGTZiPap` READY en https://vexa-ai.vercel.app: SHA servido y19fuentes modificadas coinciden. Login200, Push/políticas/consumidor anónimos401 conno-store; service worker200 con bytes verificados. Actions desactivadas, sin enlaceGit deVercel. No se atribuye a esta versión el smoke completo anterior `b9ed3db`.

## Límites y pendientes

El caso de importación fallida comienza con un hecho sintético persistido: no acredita una nueva corrida completa del worker hasta su fallo. El ensayo SQL global quedó114/116 con dos cancelaciones por timeout y sigue pendiente para seguridad global. Los estados de fallo UI usan respuestas controladas; los lectores ejecutan el TypeScript exacto extraído. Ninguno sustituye una validación externa real.

Faltan configurar proveedores/remitente/VAPID, credenciales/delegación y operación programada, obtener consentimiento real de cada dispositivo y validar entrega con proveedores autorizados. El endpoint HTTP ejecuta un ciclo y no instala un servicio programado. [Operación y configuración](../packages/notifications/EVENTS.md). No falta escribir otro adaptador para esos canales.

Quedan técnicamente F06-07(interfaz global) y F07-01(seguridad global), más comprobaciones integradas y auditoría final de veinte áreas. Las cuentas, datos históricos y actos humanos mantienen sus pendientes propios.58/60 no significa aprobación de producción.

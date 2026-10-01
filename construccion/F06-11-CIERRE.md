# F06-11 — Push aceptado y migración remota comprobada

**57/60 tareas técnicas; 28 aceptadas formalmente. Producción pendiente.** Web Push integrado en `2165849ea478d6cc21668823f596633543b39820` con revisión independiente y aceptación desde una copia Git limpia.

El registro requiere consentimiento explícito, sesión Auth vigente y autorización actual. Usa el SDK estándar, destinos HTTPS permitidos y payload genérico sin datos del cliente. Cada aviso contiene la identidad opaca y versión del registro; el service worker comprueba ambas antes de mostrarlo. El logout global revoca los dispositivos y conserva el historial, también para administradores sin equipo. Cambiar de organización revoca el dispositivo correspondiente.

El envío conserva un intento durable por dispositivo:429 confirmado permite reintento con espera; un resultado incierto no se reenvía automáticamente. Un410 antiguo no desactiva un registro nuevo. Política, emisor, trabajador, destinatario, preferencias y recursos se revalidan antes de enviar. La interfaz permite recuperar un registro cuyo POST quedó incierto sin repetirlo a ciegas; la espera de activación del navegador está limitada.

| Comprobación | Resultado | SHA256 del recibo |
| --- | --- | --- |
| Verificación oficial Node22 | 51/51 + 3/3 pruebas HTTP hijas | `7d070dfac884dbdc7bf2033d59e414a8f57893399a955fdad3acf51e2832aba5` |
| Aceptación Git limpia Node22 | 51/51 + 3/3 pruebas HTTP hijas | `2105ebe7283ffda7d77026edd1ace06f6533ff7cb745d834c170eab9801dd810` |
| Revisión independiente423 | Apta para verificación formal, completada por los gates oficiales | `82b818441d83790f0847b6ea63b0f00cd4957b6996697a98ba84b5c1248da533` |

El gate prueba Next, Auth, PostgreSQL y Chromium locales, receptor TLS local con cifrado y descifrado reales, fanout parcial, SDK/URL/timeout,21controles SQL antes de envío, permisos y FKs, nueve escenarios de interfaz, espera acotada, revocación/cambio de equipo/logout reales locales. PushManager utiliza una suscripción sintética; no acredita recepción en dispositivos externos. Base24/24 y controlador134/134 aprobados. Los controles previos no se reetiquetan como una auditoría global nueva.

Se conservan los ensayos fallidos: advertencia de lint corregida sin desactivar reglas; preparación SQL sin contexto y pérdida de SQLSTATE en el examen corregidas con24/24controles focales; primer accept interrumpido durante el empaquetado bajo saturación del host. La aceptación posterior utiliza los mismos archivos y límites tras recuperar capacidad. Todos los resultados se conservan, sin convertir fallos de infraestructura en permisos concedidos.

## Supabase y publicación

Migración0031 aplicada por MCP, versión `20261001043847`, SQL SHA256 `00e2d85922c41701b3d8a61044e9c0eafce096b208ce0784c4c1bba7ddd915fb`. Dos tablas con RLS forzado,84combinaciones de permisos de tabla y18de funciones comprobadas; cero concesiones inesperadas. FK Auth con SET NULL, trigger de revocación y versión de intento obligatoria comprobados. Sin suscripciones ni intentos reales creados.

Publicado mediante publisher autorizado: `3a2e34d6234eea6a6d6caff588891068df89d1ea`, tres commits reales con autoría asociada y SHA remoto comprobado. Vercel `dpl_GWo7g9uKbwpDiQwTqYHWTDtRtXS3` READY en https://vexa-ai.vercel.app: SHA servido y las trece fuentes modificadas coinciden; login200, Push anónimo401/no-store y service worker200 con bytes exactos. Actions desactivadas y sin enlace Git de Vercel. El smoke completo anterior conserva `b9ed3db`; no se atribuye al despliegue actual.

## Pendientes reales

Configurar las claves VAPID y contacto del operador, consumidor/delegación y las preferencias de cada persona; comprobar entrega en navegadores y dispositivos reales autorizados. Las claves VAPID puede generarlas el operador: no necesitan una API del cliente. Este cierre no acredita recepción nativa iOS/Android/Safari ni entrega productiva.

Quedan F06-12(eventos), F06-07(interfaz global) y F07-01(seguridad global), junto con comprobaciones integradas y auditoría final de20rubros. Cuentas, datos históricos y validaciones humanas siguen pendientes por separado. [Configuración y límites de Push](../packages/notifications/PUSH.md).

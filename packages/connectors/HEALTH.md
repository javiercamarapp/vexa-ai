# Salud persistida de conexiones

Propuesta F03-05. La API GET /api/connections y el panel /connections usan createDatabase y membresía SQL vigente; no son datos de demostración embebidos. El importador real runSync registra cada intento, páginas comprometidas, cobertura única y errores de proveedor. connection_health es un resumen del intento actual por conexión; no reemplaza originales, revisiones ni páginas inmutables.

## Significado de los campos

- lastAttempt corresponde al inicio comprobado por reloj SQL; lastSuccess sólo avanza con página terminal comprometida, observaciones no vacías y todos los registros aceptados. Continuación, rechazo, respuesta vacía y fallos no inventan un éxito.
- coverage describe registros únicos del scope de sincronización, incluyendo recuperación linked-v1 una sola vez. Si no se obtuvo ninguna página, permanece desconocida. No estima el denominador completo de la cuenta ni acredita cobertura de canales no leídos.
- watermark es una huella del checkpoint opaco; no una fecha de evento. Un fallo sin nueva página conserva la última huella comprometida. No se devuelve el cursor ni sus parámetros.
- lagSeconds mide tiempo desde el último éxito, no retraso real del proveedor. provider_permissions distingue unknown/available/revoked; habilitar un reintento no implica que el proveedor haya validado las credenciales.

## Revocación y recuperación

401/403 guarda reconnect_required, preserva lastSuccess y bloquea la próxima lectura del proveedor. Un owner vigente puede confirmar rotación de credenciales y habilitar otro intento mediante POST /api/connections/:id/recheck. La API exige Origin correcto, confirmación explícita y CAS del attemptId; SQL configure sólo permite esa transición, conservando evidencia y devolviendo permisos a unknown. No recibe tokens, no crea credenciales ni hace llamadas remotas desde el botón. El siguiente runSync autorizado comprueba realmente el proveedor.

Los intentos se vinculan al sync_id y fence duraderos. La exclusión consulta el lease SQL real; tras muerte de un proceso, un nuevo propietario puede recuperar la operación cuando vence la reserva. Un escritor con fence antiguo no puede reemplazar un resultado reciente. Si la página terminal se comprometió pero el proceso murió antes de cerrar salud, el siguiente no-op reconcilia esa evidencia con la hora original del intento; no crea un nuevo éxito ficticio.

## Límites y seguridad

Sólo owner/analyst importan; el resumen es legible por miembros activos sin abrir payloads raw. UPDATE de connections/configuración permanece restringido. actor_id deriva de SQL, identidad del resumen y scope/fence son inmutables dentro de un intento. La API usa allowlist y cabeceras private/no-store; errores SQL son errores, no una lista vacía satisfactoria. Excepciones sólo se persisten como códigos permitidos; no hay tokens, headers, URL ni credential_ref en el resumen público.

Pruebas locales con PostgreSQL, Auth, Next y Chromium usan fixtures rotulados. No acreditan HubSpot/Zendesk reales, despliegue remoto ni aceptación oficial. Revisión independiente del paquete pendiente por límite de uso de agentes; no publicar como cierre aprobado.

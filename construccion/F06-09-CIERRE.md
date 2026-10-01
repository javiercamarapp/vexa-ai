# F06-09 — cierre técnico y aceptación formal

El outbox durable y su consumidor están aceptados e integrados en `c1212af62f6fb72d3eca65ad444886cf1cf963ad`. El publisher autorizado verificó ese SHA en GitHub main. El total pasa de54 a55 tareas técnicas; las26 aceptadas formalmente son un subconjunto de esas55.

La revisión independiente encontró un caso real de revocación del productor entre inicio y cierre de entrega interna. La corrección comprueba que ese productor conserve membresía activa de owner antes de crear el efecto. Se preservan preferencias, autorización del destinatario y recurso, aislamiento de equipos, leases, recibos, incertidumbre y ausencia de reenvío automático cuando el efecto no puede confirmarse.

| Comprobación | Resultado | Huella del registro |
|---|---|---|
| Verificación del candidato |38/38, sin fallos ni cancelaciones|`c4133ab4ff0e4fbecdb5ed117e7cc3ff1c316ad180c249368ddbd33811e3227c`|
| Aceptación en materialización Git limpia |38/38, sin fallos ni cancelaciones|`2791411e27f3eb1b8459daeb93bcfb1a134e695047fa248d5a7be912ed739d1c`|
| Matriz SQL completa |432/432, sin fallos ni cancelaciones|`b4a0500f5aad0010e29b8090103dd79d281c40ad9e07cd8a871c5d2a80ed7fef`|

La matriz empleó el mismo transporte y aserciones con plazo privado ampliado a1800s; tardó790,34s. Los controles de arranque y temporización, con reproducción causal y revisión independiente, están descritos en [F06-09-CONTROL.md](F06-09-CONTROL.md). Los intentos fallidos y sus límites de diagnóstico se conservan; no se convierten en resultados aprobados. Los recursos sintéticos de las pruebas se eliminaron.

## Publicación y límite remoto

GitHub recibió seis commits coherentes, sin squash, mediante `allow_public=True` y `allow_actions=False`. La cuenta del autor y committer está asociada. Actions sigue desactivado y Vercel carece de enlace Git automático; publicar este cierre no activó despliegue web.

La primera aplicación remota de0029 falló con SQLSTATE42501: `permission denied to set parameter "request.jwt.claim.sub"`. La consulta posterior confirmó que no quedaron tablas del outbox, rol verificador ni recibo de migración. Es una incompatibilidad con permisos del PostgreSQL gestionado, no una aprobación de producción ni un rechazo automático de seguridad. La corrección posterior elimina esa cláusula declarativa, conserva el mismo predicado y restaura el subject anterior en salida normal o excepción, sin concesiones adicionales. Revisión independiente418 aprobada, reproducción antigua42501 y20registros focales por autor/revisor; nueva regresión completa38/38 sobre SQL `e28c46af0feea5941f538ba534b0e60ad7263fe3afd7338bafbb45b003698e93`, sin fallos/cancelaciones (737,18s).

La migración corregida se aplicó legítimamente por MCP con versión `20261001024159`. Se verificaron seis tablas con RLS forzado, cero concesiones inesperadas de210combinaciones, rol verificador sin login/superusuario/bypass/membresías de aplicación, restauración de identidad y cuerpo del helper exacto. La cola quedó vacía; no se envió correo ni push. El error original y la regresión anterior conservan sus propias huellas y no se presentan como la misma corrida.

La web conserva `d39e9a3a73935d7caf18d88073d9b2537ef6ebd7`; el registro de despliegue es la fuente exacta del SHA vigente. Correo, push y emisores pertenecen a F06-10..12. No se han acreditado entregas a proveedores reales, programación en producción ni auditoría final de la nueva versión. Los datos y cuentas del cliente siguen pendientes.

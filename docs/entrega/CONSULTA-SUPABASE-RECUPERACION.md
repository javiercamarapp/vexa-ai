# Consulta técnica de recuperación — preparada, no enviada

Destinatario: soporte de Supabase, por el canal autenticado del proyecto temporal de recuperación. No solicita ejecutar cambios, crear proyectos ni ampliar gastos. No adjunta respaldos, URLs firmadas, claves o datos de clientes.

## Mensaje listo para enviar

Necesitamos ensayar una restauración lógica en nuestro proyecto temporal manteniendo objetos intactos y permitiendo únicamente lectura/escritura administrativa durante la reconciliación. En un ensayo sintético, una URL firmada aún vigente y previamente leída devolvió los mismos bytes después de revocar CONNECT y drenar conexiones. No atribuimos el resultado exclusivamente a CDN.

¿Existe un procedimiento soportado para bloquear acceso público en origen y todos los bordes, incluyendo enlaces firmados anteriores y caché caliente, preservando objetos y el canal administrativo? Necesitamos su garantía, confirmación verificable, propagación y comportamiento al reabrir sólo el canal administrativo. ¿Requiere revocar la clave interna Storage, purgar CDN o configurar el gateway? ¿Está disponible sin extras sobre nuestro plan y manteniendo acceso PostgreSQL administrativo?

Sabemos que purgar caché encola una invalidación y que rotar Auth JWT no revoca firmas Storage. Borrar objetos, cambiar la URL o esperar que caduque no satisface el ensayo. Podemos facilitar el identificador del destino por el canal privado autenticado; no enviamos credenciales ni contenido de clientes. Solicitamos instrucciones, sin autorizar cambios ni costos.

## Fundamento revisado el 7-oct-2026

[Descargas y firmas Storage](https://supabase.com/docs/guides/storage/serving/downloads), [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn), [purga CDN](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache). La consulta se limita al bloqueo que ya devolvió bytes en el canario, no a una vulnerabilidad nueva supuesta.

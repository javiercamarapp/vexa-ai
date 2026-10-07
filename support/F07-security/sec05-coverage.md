# SEC-05: alcance del control local

Estado: trazabilidad estática propuesta; no constituye PASS, aceptación ni evidencia de ejecución.

La ficha `construccion/tareas/F07-01.md`, paso 1, pide jobs y notificaciones locales reales. `docs/blueprint/calidad/03-amenazas-rls-privacidad.md`, SEC-05, exige: «Revocar A después de encolar; falsificar tenant del mensaje → Worker cancela/no publica; no usa payload para ampliar alcance». No exige cuentas externas ni entrega efectiva de SMTP/push.

El control `notification-security.test.mjs` conecta el `consumeNotification` del candidato con su repositorio outbox y PostgreSQL real. El resolver revoca al destinatario después del claim y antes de `beginSend`. Para email y push exige estado `suppressed`, cero llamadas a `send` y cero peticiones al receptor HTTP local. Un fixture separado conserva autorización y exige `accepted`, exactamente una petición y los IDs/idempotency key correctos. Las respuestas de denegación proceden de SQL, no de un transporte que simula un 403.

La comprobación in-app usa los RPC reales: un contexto tenant ajeno recibe `42501` sin cambiar estado; revocar al destinatario después de `beginSend` impide publicar en inbox. La restauración consume el welcome automático y verifica que no revive el evento suprimido. `support/F06-outbox/independent.test.mjs` rechaza snapshots con tenant/usuario ajenos, y la composición incluye además dispatch y SQL de outbox.

Los oráculos reutilizados `emailPreSend` (24 casos) y `pushPreSend` (21) ejercen las preparaciones SQL específicas después de `beginSend`, incluyendo revocaciones de productor, destinatario y worker, con controles positivos. Esto complementa el consumidor real y la prueba in-app, sin convertir una entrega externa en condición nueva de SEC-05.

El transporte genérico SYN no demuestra entrega SMTP/push, funcionamiento de cuentas externas, SDK del proveedor ni garantías de producción. Esas limitaciones permanecen declaradas; no son por sí mismas un hueco de este requisito. La ejecución completa, ausencia de skips y calibración siguen pendientes del controlador. Los demás huecos del manifiesto no cambian.

# F06-10 — examen externo de correo transaccional

Control recuperado de la propuesta 303 y revisado durante la tanda 419–421, sobre F06-09 aceptada. Los logs temporales históricos de 303 no están disponibles: sus afirmaciones antiguas no acreditan la composición actual.

## Contrato obligatorio

- Ausencia de implementación falla con `EMAIL_IMPLEMENTATION_MISSING` antes de importar producto o crear infraestructura.
- Configuración inválida bloquea antes de producir efectos. Aceptación SMTP/SDK permanece distinta de entrega confirmada.
- Firma SDK valida los bytes originales, incluidos UTF-8 y espacios; mutación, firma incorrecta, timestamps fuera de ventana y cuerpo excesivo no escriben recibos. La lectura estancada vence y se cancela.
- Campos de tenant del payload no autorizan ni determinan asociación. El proveedor se vincula mediante el mapping interno persistido.
- Recibo repetido es idempotente; conflicto de identidad/hash/proveedor no cambia datos. Recibos huérfanos se conservan y se vinculan únicamente al mapping posterior correspondiente.
- Tablas de correo y supresión usan RLS forzado; roles de navegador/backend no ejecutan los RPC de correo ni mutan recibos. El backend sólo ve estados bajo tenant y actor vigentes. El reductor es privado incluso para el rol de correo.
- Preparación del envío revalida destinatario, política, emisor, productor, preferencias, recurso y plazo. Las supresiones por queja, rebote permanente o rechazo explícito del proveedor no se eliminan por una preferencia ni por un recibo de entrega posterior.
- Plantilla HTML/texto comparte la marca configurada, preserva CTA/origen seguro y preferencias. Reply-To opcional validado no cambia el destinatario autorizado.
- Empaquetado del worker incluye `brand.mjs` y `brand.json` para poder importar la plantilla desde la salida construida. El único permiso adicional de tarea requerido es `packages/jobs/durable/build.mjs`, no todo el directorio jobs.
- Infraestructura SMTP/Next/DB local con fixtures SYN y limpieza por recursos propios. La auditoría de transporte no permite proveedores externos durante el examen.

## Entrypoint portable

`VEXA_CANDIDATE=/ruta/candidato node --test tests/acceptance/F06-10.test.mjs`

El gate usa controles del plano externo y producto de `VEXA_CANDIDATE`. Las pruebas puras no necesitan datos reales; la suite funcional compila en un directorio temporal y realiza SMTP local, recibos por Next y controles SQL en la misma infraestructura. No se modifican los exámenes dentro del candidato.

## Límite de las conclusiones

Un PASS local no verifica Resend real, DNS/SPF/DKIM/DMARC, entregabilidad o clientes Gmail/Outlook/Apple Mail. Esas comprobaciones exigen dominio y cuentas autorizadas. El logo definitivo permanece pendiente del usuario; se conserva la marca textual/provisional configurada. La aceptación y publicación corresponden al supervisor después de evidencia de la composición final.

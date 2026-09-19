# F01-02 — corregir examen rechazado antes de implementar

Estado: primera autoría rechazada por revisor independiente; NO aceptada ni integrada. No se abrió candidato de producto. Corregir en control-plane sin bajar oráculos ni editar recibos. El primer rojo (session.ts inexistente) demuestra implementación ausente, no detección de una vulnerabilidad.

## Hallazgos que el siguiente autor debe resolver
1. **Redirect tras éxito:** el intento con code inválido no ejercita la rama exitosa del callback. Usar sesión/código válidos emitidos por Supabase Auth LOCAL y probar un `next` externo en ese camino. No Google real ni intercambio simulado. También conservar casos inválidos y control positivo de redirect local.
2. **Repetición y autorización:** no reutilizar sin control una server action/nonce ya consumida. Una respuesta 403 por CSRF no prueba membership. Obtener solicitud válida/fresca; demostrar control positivo equivalente para org autorizada, ataque a org B y que el rechazo se debe a autorización. Comprobar estado antes/después y ausencia de datos B.
3. **Oráculos que detectan defectos:** además del baseline ausente, ejercitar infraestructura local y un defecto específico (firma/cookie, membership o redirect). Se permiten implementaciones de referencia y mutantes exclusivamente en soporte de tests/temporales, rotulados como probes, NO como producto ni como fuente promovida. Probar control positivo y que el mutante muere por aserción relevante, no por módulo ausente, puerto cerrado, CSRF o compilación.

## Límites del trabajo
- Mismos contrato, ficha, allowlist y grafo. No escribir la implementación del SaaS desde el autor de gates.
- Supabase propio: `project_id=vexa-local`, API56321, DB56322, Mailpit56324. Verificar identidad antes de crear fixtures. Sólo usuarios/sesiones sintéticos y temporales propios; no resetear ni consultar otros proyectos.
- Capturar credenciales locales dentro del proceso, nunca imprimirlas ni pegarlas en prompts/logs. Usar Mailpit/flujo Auth local para el ensayo válido; no correos externos.
- Gate y soporte deben cargar VEXA_CANDIDATE, instalar/build en temporales y conservar entorno de pruebas reproducible. No modificar gates anteriores.
- Distinguir la prueba de los oráculos sobre un probe de la aceptación futura sobre el candidato real. Ambos recibos son necesarios; el primero no acredita el segundo.
- Revisión independiente antes de integrar; reportar bloqueos de ensayo si no se pueden resolver, nunca reemplazarlos con mocks que finjan autenticación real.

Referencia local privada para el operador: `.runtime/auto-1789802770368087000-1789803206555368000-review.json`. No requiere releer audios ni investigar negocio.

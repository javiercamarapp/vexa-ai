# F01-02 — corregir examen rechazado antes de implementar

Estado: primera autoría rechazada por revisor independiente; NO aceptada ni integrada. No se abrió candidato de producto. Corregir en control-plane sin bajar oráculos ni editar recibos. El primer rojo (session.ts inexistente) demuestra implementación ausente, no detección de una vulnerabilidad.

## Hallazgos que el siguiente autor debe resolver
1. **Redirect tras éxito:** el intento con code inválido no ejercita la rama exitosa del callback. Usar sesión/código válidos emitidos por Supabase Auth LOCAL y probar un `next` externo en ese camino. No Google real ni intercambio simulado. También conservar casos inválidos y control positivo de redirect local.
2. **Repetición y autorización:** no reutilizar sin control una server action/nonce ya consumida. Una respuesta 403 por CSRF no prueba membership. Obtener solicitud válida/fresca; demostrar control positivo equivalente para org autorizada, ataque a org B y que el rechazo se debe a autorización. Comprobar estado antes/después y ausencia de datos B.
3. **Oráculos que detectan defectos:** además del baseline ausente, ejercitar infraestructura local y un defecto específico (firma/cookie, membership o redirect). Se permiten implementaciones de referencia y mutantes exclusivamente en soporte de tests/temporales, rotulados como probes, NO como producto ni como fuente promovida. Probar control positivo y que el mutante muere por aserción relevante, no por módulo ausente, puerto cerrado, CSRF o compilación.

## Segunda revisión y parche acotado
La segunda autoría mejoró los tres puntos, pero la revisión halló2P2:
- `/\\example.invalid/escape` normaliza a origen externo; `startsWith('/')` no basta para clasificarlo como destino local y el gate rechazaba una implementación segura que volvía a `/`.
- Revocación admitía cualquier redirect del mismo origen, incluido `/dashboard`, sin navegar antes de restaurar membership.

Parche en worktree separado (sin integrar): extrae oráculos puros, verifica origen normalizado para preservar destinos locales, limita redirects de denegación a login y sigue la cadena real antes de restaurar membership, comprobando ausencia de selector/datos privados. Dos regresiones rojas por aserción observadas;4tests puros verdes después. Principal ejecutó además probe Auth LOCAL real:1test verde con positivo y mutante de firma. El revisor anterior no pudo ejecutarlo por permisos del sandbox sobre Docker; no era fallo funcional del proveedor.

Falta revisión independiente del parche e implementar/probar app completa. Los5tests de soporte no acreditan callback real del producto, selección o revocación de una app todavía ausente. La propuesta Auth se construye aparte, no se modifica el gate desde ella ni se acepta por estos recibos.

## Límites del trabajo
- Mismos contrato, ficha, allowlist y grafo. No escribir la implementación del SaaS desde el autor de gates.
- Supabase propio: `project_id=vexa-local`, API56321, DB56322, Mailpit56324. Verificar identidad antes de crear fixtures. Sólo usuarios/sesiones sintéticos y temporales propios; no resetear ni consultar otros proyectos.
- Capturar credenciales locales dentro del proceso, nunca imprimirlas ni pegarlas en prompts/logs. Usar Mailpit/flujo Auth local para el ensayo válido; no correos externos.
- Gate y soporte deben cargar VEXA_CANDIDATE, instalar/build en temporales y conservar entorno de pruebas reproducible. No modificar gates anteriores.
- Distinguir la prueba de los oráculos sobre un probe de la aceptación futura sobre el candidato real. Ambos recibos son necesarios; el primero no acredita el segundo.
- Revisión independiente antes de integrar; reportar bloqueos de ensayo si no se pueden resolver, nunca reemplazarlos con mocks que finjan autenticación real.

Referencia local privada para el operador: `.runtime/auto-1789802770368087000-1789803206555368000-review.json`. No requiere releer audios ni investigar negocio.

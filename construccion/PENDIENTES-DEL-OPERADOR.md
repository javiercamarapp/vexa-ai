# Dependencias del operador y criterio de «listo»

Decisión del usuario, 20 de septiembre de 2026: el conteo de 60 tareas debe reflejar software y entrega completos de punta a punta. Solo pueden quedar pendientes credenciales, cuentas, decisiones o aprobaciones personales que el agente no pueda obtener legítimamente, incluso mediante las herramientas disponibles.

Una biblioteca aislada, una pantalla sin consumidor o un webhook sin procesador no se cuentan como listos. Se requieren integración, compilación, revisión, pruebas del recorrido, permisos, recuperación y configuración operativa accesible. Las cuentas del cliente no justifican dejar código pendiente. Las pruebas sintéticas no acreditan resultados del cliente ni entregas reales de proveedores.

## Lo que requiere intervención humana o acceso externo

| Tareas afectadas | Aporte necesario del operador o del cliente | Trabajo que corresponde al agente |
|---|---|---|
| F00-02; validación real transversal | Autorización para tratar los datos y responsables de CRM, privacidad y negocio. | Preparar controles, registros y entorno; mantener datos reales deshabilitados sin permiso. |
| F03-01, F03-02 | Acceso autorizado a las cuentas HubSpot/Zendesk y permisos de lectura. Una aprobación OAuth puede requerir al titular. | Conectores completos, alta/configuración, carga histórica, paginación, cursores, reconexión, consumidor, pruebas y reconciliación técnica. |
| F03-04, F03-06 | Confirmar equivalencias ambiguas de la migración y aportar históricos reales cuando no estén disponibles en las cuentas. | Herramientas para proponer/revisar/deshacer equivalencias y comparar cobertura; ingestión histórica y comparación completas. |
| F04-01, F04-02; ejecución real de IA | Credencial propia y presupuesto autorizado de inferencia; confirmar restricciones contractuales de datos. | Gateway, límites, conciliación, políticas, integración y configuración accesible. No se necesita inferencia pagada para construirlos. |
| F04-07, F07-05 | Ejemplos reales evaluados por personas, resolución de desacuerdos y participación del cliente para medir utilidad y comprensión. | Herramientas de evaluación, separación temporal, métricas reproducibles, protocolo y análisis. No fabricar precisión ni respuestas humanas. |
| F05-02, F05-04, F06-05 | Datos reales de pedidos/reembolsos/costos, supuestos financieros aprobados y decisiones del responsable de las intervenciones. | Cálculo, importación, procedencia, desconocidos, escenarios, aprobación y medición. La falta de datos no bloquea su implementación. |
| F06-10, F06-11, F06-12 | Credencial/remitente o permiso de dominio cuando el agente no tenga acceso; consentimiento de cada persona para notificaciones en su dispositivo. | Correo, webhooks firmados, DNS accesible y autorizado, push, consentimiento, revocación, reintentos y pruebas completas. |
| F08-01, F08-02 | Aprobaciones personales de infraestructura que realmente sigan pendientes. Las migraciones SQL remotas requieren aprobación legítima. | Configurar mediante herramientas autorizadas, desplegar, comprobar SHA, probar remoto con dos tenants y ensayar recuperación. No delegar en el operador lo que las herramientas permiten hacer. |
| F08-03, F08-04 | Ensayo del presentador y permiso escrito para mostrar nombre, logo, datos, citas o caso del cliente. | Demo, guion, material y video de respaldo. Sin permisos, usar VEXA y datos sintéticos rotulados. |
| F08-05, F08-06 | Destinatarios/responsables finales y acuerdos comerciales: entrevistas, piloto, pagos y seguimiento. | Manuales, accesos revocables, handoff, evidencia y próximos experimentos. No inventar acuerdos comerciales. |

## Cómo registrar el avance

- **Lista técnicamente:** todo el trabajo ejecutable por el agente está integrado y comprobado. Un pendiente externo debe indicar qué falta, quién lo aporta y cómo se comprobará después.
- **Validación externa pendiente:** la prueba que necesita la cuenta, datos o participación humana todavía no ocurrió. No equivale a fallo de programación ni a validación real.
- **Validada con proveedor/cliente:** existe evidencia de la ejecución autorizada correspondiente.

El registro histórico de aceptación no se modifica para fabricar avances. El nuevo conteo debe derivarse de entregables comprobados y conservar ambos estados. Ninguna de las 60 tareas es una excusa para detener toda la construcción: las partes técnicas y preparatorias siguen a cargo del agente. F07-05, F08-04 y la parte comercial de F08-06 sí requieren evidencia humana que una API o un MCP no pueden sustituir.

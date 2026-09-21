# F03 — cierre técnico y validación externa pendiente

Seis tareas técnicamente completas, integradas y probadas. El registro histórico conserva 19 aceptadas; construcción total 25/60. La validación externa continúa pendiente.

El software permite alta y recuperación de conexiones, ingesta histórica paginada, reparto de trabajos por consumidor, salud de conectores y equivalencias humanas auditables con comparación de cortes.

| Tarea | Pendiente que requiere acceso o decisión externa |
|---|---|
| F03-01 | Cuenta/app/token con lectura autorizada, scopes/version efectivos y20conversaciones autorizadas con referenciaindependiente. Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. |
| F03-02 | Subdominio, token/plan/scopes, permiso de exportincremental de cuenta/ventana y20referencias autorizadas. Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. |
| F03-03 | Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. Datos y permisos reales para verificar continuidadenproveedor. |
| F03-04 | Confirmación humana deevidencia/equivalencias ambiguas reales. Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. |
| F03-05 | Credencial legítima/rotación autorizada ycomprobación realdelosscopes. Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. |
| F03-06 | Históricos reales y decisiones de equivalencias delcliente. Aprobación legítima y aplicación de migraciones CRM incluidas0013/0015, secretos del worker/CRM y cron/despliegue remoto; no se ejecutó aquí. |

La infraestructura remota corresponde al agente una vez disponibles las aprobaciones y credenciales legítimas. La validación con veinte conversaciones por proveedor y reconciliación independiente no ha ocurrido. La aceptación histórica de los gates externos no se altera.

Validación: revisión independiente de producto/control, cuatro jobs CI locales, repetición de web-quality tras el único delta final de UI, recorrido de aliases6/6 y revocación4/4. Los tests específicos adicionales de revocación aliases3/3 y settings/comparación4/4 Node22/26 están vinculados a los mismos hashes.

Incidente conservado: una regresión de aliases falló al arrancar Storage temporal, antes de probar negocio. El diagnóstico posterior con las mismas aserciones pasó6/6 y limpió sus recursos. Causa inicial no demostrada; seguimiento en auditoría final. No se relajaron los tiempos ni se ocultó la corrida fallida.

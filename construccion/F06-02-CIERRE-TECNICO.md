# F06-02 — detalle financiero e identidad histórica del cliente

El detalle navega cifra→componente→evento→evidencia mediante consultas autenticadas en cada paso. Un reembolso neto de1500 se explica con el registro R1 de2000 y la reversión V1 de−500, con revisiones físicas y fuente financiera aprobada. Las conversaciones se muestran como contexto; una frase del cliente no acredita dinero. Causa probable y confirmación operacional se presentan separadas de las cifras históricas.

Un cliente conocido agrega las órdenes y conversaciones capturadas que le corresponden, sin duplicar órdenes compartidas entre problemas ni atribuirle conversaciones de otro cliente del mismo grupo. Las claves financieras requieren una asociación explícita del propietario a un cliente canónico, con evidencia, consentimiento vinculado al contenido y control de versión. La identidad desconocida no crea perfiles ni enlaces ficticios.

Cada vista conserva snapshot_id, scope_hash y detail_hash. El corte de identidad detail_as_of se distingue del corte financiero as_of: una nueva asociación permite abrir una nueva vista explícita sin reescribir la anterior ni fabricar otra publicación financiera. El recibo incluye todas las revisiones históricas elegibles; no puede esconder conflictos omitiendo referencias o duplicando un UUID con distinta capitalización. Las dos tablas nuevas tienen RLS forzado, ocho FK de tenant y escrituras restringidas.

Ante una denegación vigente, la interfaz elimina tanto las cifras como los miembros y la evaluación causal del problema. La autorización del servidor sigue siendo obligatoria en cada paso. Las respuestas anteriores no pueden restaurar información tras revocación y navegación.

Verificación: revisión independiente por hashes, dominio8/8 en Node22/26, focal SQL14/14 y matriz de24migraciones323/323. Copia Git limpia Node22: detalle19/19 y regresión del alcance compartido16/16. Regresión de agrupación en navegador5/5. Tipos, lint, compilación, canarios de secretos y CI web verdes; controlador125/125. Se conservan los fallos originales, sus reproducciones y la limpieza de recursos por ID. Controles congelados:57779b4165b1ece90d71235ed66e5a5062b3bb9e. SQL0024 SHA256:57b0cbe99e2b0557efd1cafdda4c5e69faf163c95406da110159d3b8b3593534.

38/60 técnicamente listas;24 aceptadas formalmente en el grafo. Permanecen pendientes las dependencias externas, cuentas/datos reales, SQL remoto autorizado, despliegue y auditoría integral final. No acredita producción.

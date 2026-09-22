# F06-03 — recomendaciones condicionadas e intervenciones borrador

El detalle de un problema abre recomendaciones con el mismo snapshot y alcance. Las propuestas se generan mediante reglas explícitas a partir de evidencia capturada y categoría del problema: incluyen acción concreta, condiciones previas, justificación, prioridad y responsable. Un hallazgo crítico conserva revisión humana urgente aunque sea poco frecuente o su importe sea desconocido. La generación no inventa cifras ni confirma causalidad.

La revisión, el cambio de responsable, el descarte y la reapertura se guardan mediante control de versión y motivo obligatorio; el historial conserva las definiciones anteriores. Un rechazo conserva el texto sin guardar y no anuncia éxito. La vista retira información ante una denegación vigente, y una respuesta antigua no puede restaurarla.

Crear una intervención produce sólo un borrador ligado a la versión exacta de recomendación y baseline. El doble clic, una respuesta perdida después del commit y el reintento conservan una única intervención. No ejecuta herramientas CRM ni cambia su estado a aprobado o activo; esas transiciones pertenecen a F06-05. Viewer consulta, pero no propone ni muta.

SQL revalida la evidencia, conexión, revisiones canónicas, tombstones, fuentes financieras y contribuidores vigentes. Una fuente retirada o un autor revocado no pueden certificar una recomendación mediante escritura directa. El historial es append-only, con RLS forzado, siete FK de tenant y privilegios limitados.

Verificación independiente: API/navegador14/14 y dominio6/6 Node22/26; focal SQL15/15 y cadena de25migraciones: 333 controles verdes en la corrida general, que conservó un fallo de colisión de fixture; recuperación selectiva18/18 de todos los casos afectados, Storage, retrieval y revocación en verde. El recibo distingue ambas corridas y no declara la corrida original completamente verde. Copia Git limpia con SQL final: recomendaciones20/20 y regresión del detalle11/11. Tipos, lint, compilación, canarios y CI web verdes; controlador125/125. Se conservan rojos originales, hashes, mutantes semánticos y limpieza por recurso. Controles congelados:50c6391d5b9aeb117004a5f6251ec858e473d6f9. SQL0025 SHA256:609e593ac3043a45d2c60ae72081b0ef71c9cda35ab74aaed382893e8064f1e5.

39/60 técnicamente listas;24 aceptadas formalmente en el grafo. Quedan cuentas/datos reales, SQL remoto autorizado, despliegue, dependencias externas y auditoría integral. No acredita producción.

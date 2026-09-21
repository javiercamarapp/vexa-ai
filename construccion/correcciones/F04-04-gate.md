# F04-04 — control revisado para cierre oficial

21-sep-2026. Propuesta integrada 29/29; revisión independiente223 y correcciones aprobadas de revocación UI. Consumidor, API, SQL, Storage y navegador reales locales; transporte IA sintético rotulado. Matriz239 heredada por hashes y regresión de importaciones27grupos; sin inferencia pagada ni producción remota. La aceptación oficial y publicación requieren runner y publisher, todavía pendientes en esta congelación.

## Historial conservado

# F04-04 — validación y consulta de citas; propuesta local

Reutilizar validateEvidence/validateExtraction del banco733c47 y el repositorio de F04-03. No reescribir validadores ni aceptar por la existencia del módulo. Falta revisión independiente del gate y del producto.

Oráculos: cita exacta con emoji y acento, rol original customer/agent/internal sin suplantación, hash y rango en code points, revisión/tenant autorizados. Cambio de revisión impide una nueva extracción usando la anterior y permite consultar un historial anterior todavía autorizado, etiquetado como histórico. Tombstone, conexión inactiva o membresía revocada deben impedir mostrar citas aunque su texto coincida. La consulta no usa ni expone mapas privados de redacción. Una revisión sin vínculo inmutable al run se rechaza.

Recorrido probado localmente: job real y redacción → run/spans persistidos → API autenticada → pantalla de evidencia, con negativos directos y por navegador. El transporte del modelo es sintético rotulado; no inferencia pagada. No cambia el contador17/60 ni acredita producción externa.

Resultados:24/24 en Node22 y Node26; regresión F04-03 de60/60 en Node26; banco gateway/intelligence34/34; lint, typecheck y build web,79artefactos cliente y125peticiones HTTP. La matriz SQL integrada239/239 se hereda sólo con migraciones y controles idénticos por hash. Manifiesto privado `private/f0404-review-pending.json`; no aceptación oficial.

Fallos preservados: implementación ausente; fixture que intentó obtener runId del listado privado de jobs de un viewer; selector `role=alert` ambiguo con el anunciador de Next.js. El último se corrigió acotando al texto del aviso de evidencia, sin alterar producto. La corrida afectada volvió a24/24 y las regresiones se completaron después.

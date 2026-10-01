# Ensayo remoto de continuidad de importaciones — 1 de octubre de 2026

**59/60 técnicas y 28 aceptadas formalmente; producción pendiente.** Se ejecutó un ensayo sintético acotado sobre el producto desplegado `1eef4d6`: Auth, API y Storage del producto admitieron dos archivos; cron de Supabase invocó el worker de Vercel; los checkpoints permitieron pausar y reanudar. La revisión del resultado conserva el alcance de este recorrido y no acredita operación permanente.

## Resultado observado

| Comprobación | Resultado |
|---|---|
| Ventana de despachos | 22:20:34–22:30:34 UTC, 600 segundos sin renovación |
| Archivos admitidos por producto | 501 y 2 filas sintéticas |
| Contabilidad consultada por API | 503 aceptadas; 0 rechazadas, duplicadas o pendientes |
| Checkpoint durante pausa | 100 filas; avance posterior hasta 501 |
| Pausa efectiva | 124,21 segundos, sin nuevos despachos durante la pausa |
| Invocaciones del worker | 16 de un máximo de 20; 16 respuestas HTTP 200 correlacionadas |
| Peticiones del operador | 40 de un máximo de 100; 18 dirigidas a Vercel, máximo 50 |
| Observaciones conservadas | 69, incluido el drenaje anterior a la limpieza |
| Retirada | Cron y delegación deshabilitados; cola vacía; secreto temporal, tabla y triggers del ensayo eliminados |
| Comprobaciones después de retirar el secreto | Dos observaciones separadas por 62,52 segundos; comprobación adicional por MCP |
| Trabajos ajenos al ensayo | Los cinco trabajos de extracción conservaron su estado y digest de control |

El presupuesto autorizado fue hasta USD 2 incrementales para este único ensayo. La estimación previa fue USD 1,90; no es una medición del cobro real ni un límite global de la cuenta. No se activaron consumidores de CRM, extracción, histórico, problemas o notificaciones, ni inferencia pagada.

## Fallos del controlador detectados y corregidos

La revisión previa corrigió el cierre de sesión tras expirar una autorización, las reservas de importación inciertas, los topes HTTP global y de Vercel, y la separación entre DDL sin credenciales y bootstrap con secreto por canal privado. Ocho pruebas focales pasan en Node 22/26. El coordinador pasó siete escenarios simulados con revisión independiente: arranque incierto, admisión parcial, control vacío, contabilidad no terminal y procesos hijos pendientes, además del recorrido normal. Estas pruebas simuladas no sustituyen los recibos remotos.

La primera evaluación de los recibos remotos devolvió `CLEANUP_NOT_VERIFIED`: clasificó como posterior a la limpieza una observación tomada a los 111,49 segundos del desarme, inmediatamente antes de retirar el secreto. Las observaciones siguientes, a los 117,69 y 180,21 segundos, ya lo muestran ausente. El fallo original y las 69 observaciones se conservan. El evaluador se corrigió para distinguir el drenaje anterior a la limpieza y rechazar cualquier reaparición posterior. Sus 17/17 pruebas pasan en Node 22/26 y el delta tiene revisión independiente. La evaluación final de los mismos 69 recibos, sin modificar sus hashes ni repetir el ensayo remoto, confirma `bounded-continuity-observed`; mantiene `productionReady=false`.

## Evidencia en custodia privada

| Recibo | SHA256 |
|---|---|
| Revisión previa del coordinador | `763b006c42cb025be80f45bb8d235b91ee9130b720e699ef7c2c3e745802581d` |
| Resultado bruto y compensación | `69ad5694af0534c14fd94d3d076e8830b936e262d26aeb14c55cf55f743d3d44` |
| Observaciones y contabilidad normalizadas | `223c9da3d5ffd289cf024e140d6088f092cdfffd3e81441d0add038ce6dcf227` |
| Contabilidad original de la API | `86226bbbdbb4ec8bacd46db3dce0690ee88b5b6db96b661fe4cb55ce87be5ddd` |
| Primera evaluación, fallida | `5d6311e028b43b16803f753ebe598bbd0336f1ab3081b42d1c8604f3a46ca18a` |
| Revisión independiente del resultado remoto | `7c49588a4ee90613fa2a7c9681e1a81ac182183b8335e36637faeb845a17574c` |
| Evaluación final de los mismos recibos | `8557bd8b687033c8387eb70aec17d032559c6fb24fb7f1d25591aecff6f35eeb` |
| Revisión independiente del delta del evaluador | `fa28f04ef414fb82dee7327876bd9fa180d16e2f4a9c0882da770fabe260eff4` |
| Comprobación adicional de limpieza por MCP | `dc49ad89672ac63ed0eaf4d9523d87b57eee6a1bcdd701a6151db08c2a3f9d97` |

Los recibos originales, IDs y credenciales no se publican. Se conserva por separado el [primer ensayo gestionado de dos filas](OPERACION-GESTIONADA-2026-10-01.md).

## Pendientes que permanecen

Operación permanente con responsables y alertas, recuperación de un backup gestionado en destino aislado, capacidad 50K/150K, cierre global F07-01 y matriz integral, y validación con cuentas/proveedores/datos reales. Este ensayo no modifica los contadores ni acredita que sólo falten APIs. La [auditoría de veinte rubros](AUDITORIA-20-RUBROS-2026-10-01.md) conserva esas condiciones de cierre.

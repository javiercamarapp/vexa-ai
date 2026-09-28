# Smoke remoto VEXA —28-sep2026

**Resultado:8/8 fases aprobadas**, ocho vistas,114solicitudes registradas y ocho capturas con hashes comprobados. Se ejecutó el runner oficial sin alterar su límite de transporte de15segundos, contra Supabase y Vercel propios con dos organizacionesSYN. No contiene datos del cliente ni acredita calidad de modelos.

- Producto publicado y servido: `b9ed3db5ef4df825c27ed208722ad2faad4ee9c3`.
- Destino: https://vexa-ai.vercel.app;719fuentes exactas exportadas y compilaciónVercelREADY.
- Revisión independiente de la composición:387; snapshots/foco previos384/385 conservados.
- SHA256 del informe privado original: `50a94a95757ef9ca78c8875ab4710501f11052a6f5be6d879c7040f7f400b92f`.
- Runner: sus cuatro archivos coinciden con las fuentes publicadas. Recibos, credenciales y capturasSYN permanecen privados.

| Fase | Resultado observado |
|---|---|
| Identidad del despliegue | SHA servido igual al publicado y autorizado. |
| Autenticación | Dos cuentas reales de prueba, con organizaciones distintas. |
| Importación durable | CSV→Storage→trabajo succeeded,3/3 aceptadas, cero rechazadas/duplicadas/pendientes. |
| Dinero y exportación |30000/1500minorUSD; exportJSON igual al bundle autorizado y protegido. |
| Aislamiento | Rechazo de IDs ajenos conocidos y del scope/export de otra organización. |
| Ocho vistas | Resumen, problemas, detalle de problema, cliente, explorador, recomendaciones, intervenciones y brief; raíces/títulos visibles y dinero esperado en Resumen. |
| Recuperación | Pausa, NO_HEARTBEAT, admisión503, checkpoint conservado y recuperación del mismo trabajo a3/3 sin duplicados. |
| Revocación | A pierde lecturas/exportaciones; B conserva acceso. |

## Correcciones que permitieron completar el recorrido

Los informes anteriores AED y d3991bf siguen fallidos y conservados. No se les atribuye este resultado. La primera agrupación de snapshots redujo718→538SQL en el perfil desdeMac, pero aún había timeouts. EXPLAIN local al PostgreSQL gestionado identificó una unión que expandía múltiples revisiones antes de filtrar. Predicados sobre IDs ya validados redujeron esa consulta de722,5ms a24,5ms. La preparación redundante de workspace con scope fijado se retiró conservando la transacción final:106→82SQL en el ensayo local. Estas cifras son mediciones puntuales, no unSLO ni latenciaHTTP.

La regresión detectó también viewer503 en vez de403 por evaluar configuración antes del permiso. Se corrigió esa prioridad conservando comprobaciones transaccionales. La corrida roja permanece; navegador afectado8/8,15subpruebasSQL y4de revocación de evidencia,12casos focales del handler, lint/build compuestoNode22. Revisión387:27/27casos PostgreSQL conRLS y24/24casos de roles/configuración. Los dobles del handler están rotulados; no sustituyen las pruebas reales.

## Cierre y límites

A quedó revocada con versión de permisos4; consumidorSYN deshabilitado y comprobado porSQL. Navegador propio cerrado, cinco controles del coordinador conexit0 ycleanup0. No se instaló programación continua, no se enviaron correos externos y no hubo inferencia pagada.

**53/60 técnicas,25formales; producción no validada.** Este recorrido no equivale a probar cada botón de las29rutas, ni a aprobar globalmente accesibilidad o los20rubros. Siguen el alcance de notificaciones bloqueado por revisión automática y sus dependencias, revisión humana, CRM/OAuth/SMTP reales, presupuesto/modelos, gold del cliente, restore gestionado y operación continua. [Pendientes para conectar](PENDIENTES-PARA-CONECTAR.md) y [auditoría20rubros](AUDITORIA-20-RUBROS.md). Conectar claves no resuelve los bloqueos técnicos restantes.

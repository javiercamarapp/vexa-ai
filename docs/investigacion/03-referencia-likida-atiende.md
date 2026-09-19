# Qué significa aquí «nivel Likida / Atiende»

Revisión selectiva de patrones y documentación; NO auditoría completa de esos repos. Corte local 2026-09-18. No se ejecutaron sus suites ni se inspeccionó producción. Los repos tienen cambios locales ajenos y se mantuvieron intactos.

## Fuentes abiertas
- `~/likida/CLAUDE.md` completo: dos paneles, cifras con origen, null/errores, formatos, despliegue. Commit observado 47db3c29.
- `~/likida/scripts/auditoria/loop.audit.ts` completo: baseline→auditores→verificación→fix→síntesis por rondas.
- `~/likida/src/lib/likida/analytics.ts`: búsqueda puntual, referencias a agregados SQL y umbrales; no lectura íntegra. El CLAUDE conserva menciones históricas: no usarlo para afirmar estado actual de cada tabla.
- `~/atiende-fusion/packages/agent-core/src/gateway/gateway.ts` y `providers/openrouter.ts` completos: fallback, reservas, residencia, fetch, costo.
- `~/atiende-fusion/docs/REQUISITOS.md` y `ACEPTACION.md` completos: trazabilidad y advertencias de snapshot histórico. Commit observado 75632c9. No repetir su lista de pendientes como bugs actuales sin prueba.
- `~/Desktop/Documentos Likida/00-LEEME.md` y `00-BLUEPRINT-EJECUCION-CLAUDE-CODE.md` completos: negocio, operación, legal, cifras canónicas y cierre con evidencia.
- Máquina de automejora: lectura sustancial del documento `13-Agentes-de-AI/10-Ingenieria-y-Producto/maquina-de-automejora/00-MAQUINA-DE-AUTOMEJORA.md`; referencias bibliográficas de ese documento no se revalidaron para VEXA.
- `~/atiende-landing` y `~/likida.ai`: inventario/package observados en exploración; no auditoría visual o fuente exhaustiva. Likida.ai es corte anterior a ~/likida.

## Principios que sí trasladamos
1. Cada indicador tiene origen y scope. Un filtro de fecha/SKU/canal gobierna tarjetas, gráficas, citas y exportación juntos.
2. NULL no es cero. Error de base no es «no hay problemas». Indicadores stale/partial/unavailable están en el modelo y en la UI.
3. Tenant en filas, relaciones, storage, vectores, cola, caches y logs; pruebas reales SQL, no sólo mocks.
4. Idempotencia en DB y checkpoints, reloj máximo en workers, cola visible si nadie la consume.
5. Gateway único con contrato por rol; registro de costos y policy. Los prompts no calculan dinero.
6. Tests de propiedad, metamórficos, fallos y E2E de la app propia. Cantidad de tests no reemplaza prueba de flujo.
7. Candidato aislado y reproducible; verificador decide por comportamiento. Fallos/reintentos registrados.
8. Mergeado≠desplegado; deployed≠verificado. Comprobar SHA servido, migración y flujo en URL final.
9. Documentos de negocio con hipótesis explícitas, índice canónico y estado actual que no afirma clientes inexistentes.

## Patrones que NO copiamos literalmente
- No replicar 60/65 agentes ni múltiples departamentos antes del primer flujo VEXA. Son alcance del otro producto, no requisito de calidad.
- No copiar la regla fiscal deny-all/service_role de Likida sin diseño: VEXA usa RLS con JWT para lecturas de cliente y servicio restringido para jobs.
- No asumir país de residencia por domicilio de un proveedor.
- En OpenRouter adapter observado, costo ausente se vuelve cero (`costUsd ... : 0`). VEXA debe conservar desconocido. El comentario de `data_collection: deny` tampoco demuestra zero retention; requerir controles aplicables y ZDR cuando corresponda.
- En gateway observado, error tras reserva se liquida a cero. Un timeout remoto pudo consumir tokens; VEXA conserva reserva incierta/conciliación, no «gratis por error».
- No copiar precios, TAM, marco fiscal, prospectos o promesas de servicio de logística mexicana a CX internacional.
- No reutilizar código, logos, secretos o datos clientes sin autorización de propiedad/licencia.

## Equivalencia del paquete documental
Negocio (inversionista/cliente/pricing), legal/CTO, arquitectura de datos, motores, integraciones, evals, operación, fases y máquina de construcción. La igualdad buscada es cobertura y profundidad útil, no inflar megabytes ni copiar miles de archivos históricos. Esta primera entrega no iguala todavía toda la extensión de Documentos Likida; cada área pendiente se explicita en PROGRESO.

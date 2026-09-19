# Intervenciones, resultados y causalidad

Estado: contrato propuesto; sin datos ni intervención real medida. Completa el dossier de calidad. Fuentes de necesidad: PRD secciones 16/Interventions, 27, 29, 31 y 33; DOCX pide valor ejecutivo y medición. Ninguna fuente autoriza atribuir causalidad a un antes/después simple.

## Unidad operativa
`intervention`: tenant, problema/version, título, hypothesis, owner_member_id, decision_at, implementation_start/end, status, treated_scope (SKUs/regiones/carrier/cohort), metric_definition_version, baseline_snapshot_id, expected_effect_scenario, cost_estimate, evidence, approvals. `intervention_event`: proposed/approved/started/completed/cancelled/measurement_ready/measurement_closed con actor y fecha. «Completada operativamente» no es «efecto probado».

## Plan de medición se fija ANTES
Ejemplo sintético: reasignar carrier para órdenes de dos SKUs en Texas. Métrica primaria: órdenes entregadas tarde / órdenes elegibles con ventana de observación completa. Secundarias: contactos por 100 órdenes, refunds netos por 100 órdenes y costo de reemplazos. Guardias: costo logístico, tiempo de entrega y nuevos incidentes. Unidad de análisis orden/cohorte; no cada mensaje como observación independiente.

Registrar cambios concurrentes: promoción, inventario, temporada, mezcla de SKUs, política de devolución, volumen de ventas, migración CRM, cambio de clasificación y disponibilidad del feed. Si faltan denominadores, sólo comparación de recuentos con advertencia. Si la migración genera vacío de datos, no mostrar mejora.

## Jerarquía de evidencia
1. Antes/después descriptivo: mostrar delta y limitaciones. No «ahorramos X gracias a la intervención».
2. Cohortes comparables: ajustar composición y exposición, sin eliminar a posteriori clientes difíciles; reportar matching/cobertura.
3. Diferencias-en-diferencias si existe control defendible, tendencias previas y ausencia de cambios diferenciales; documentar supuestos y sensibilidad. No activarlo como sello de causalidad automático.
4. Experimento aleatorio cuando viable/ético: asignación previa, tamaño/potencia según variabilidad real, análisis intention-to-treat, guardias y monitoreo.

No seleccionar de la historia la ventana que produce mejor resultado. Esperar el ciclo de devolución o recompra correspondiente; un mes permite implementar y empezar medición, no demostrar retención anual.

## Contabilidad de mejora
Separar `risk_estimate_change`, `observed_refund_change`, `implementation_cost` y `causally_attributed_incremental_margin`. El último es nullable mientras no exista diseño/evidencia y costos pertinentes. No sumar reducción de riesgo a dinero ahorrado: puede caer porque el modelo cambió o el cliente ya dejó de comprar.

La north star propuesta «Revenue Risk Resolved» requiere definición más estricta: cohorte fija, misma versión de método, riesgo expirado separado del mitigado, problema cerrado por dueño y evidencia postintervención. Durante MVP usar `intervenciones con resultado medible` y `valor validado por sponsor` como señales; no publicar dólar resuelto sin trazabilidad.

## Pruebas
- Dos periodos con mitad de ventas y misma tasa de quejas: no afirmar mejora de experiencia porque recuento cayó 50%.
- Cambia versión del modelo entre periodos: vista advierte o recalcula ambos con misma versión, conservando reportes originales.
- Reembolso llega tarde: cohorte inmadura se marca incompleta.
- Intervención sin fecha real de inicio: no activar ventana post.
- Dos intervenciones simultáneas: no asignar íntegro el mismo beneficio a ambas.
- Sin órdenes/control: comparación descriptiva permitida, claim causal bloqueado.
- Cerrar/reabrir intervención conserva historial y expectativas originales; owner removido exige reasignación autorizada.

## Aprobación
COO/CX valida implementación, responsable financiero valida interpretación de costos, analista valida diseño. Software puede automatizar ingestión, cálculo y recordatorio; no sustituye estos juicios en MVP.

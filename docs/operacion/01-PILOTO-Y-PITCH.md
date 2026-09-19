# Piloto y pitch: qué mostrar en 30 días

## Paquete de datos que solicitar (no enviado)
30–90 días autorizados de conversaciones completas con ID, timestamps, canal, autor/tipo mensaje, customer/order/SKU cuando existan; estado y resolución. Órdenes y líneas, moneda/importes/base, refunds liquidados/reversals, retornos/replacements y costos disponibles. Diccionario de campos, timezone, total esperado por día/canal, reglas de acceso y data retention. IDs seudonimizados pero consistentes entre archivos. No pedir tarjetas, documentos de identidad ni direcciones completas si no son necesarios.

El audio confirma intención de migrar CRMs, no fecha exacta ni acceso API. Preguntar por responsable, cronograma de backfill y mapeo de IDs. Comparar 20 conversaciones UI/export/API para comprobar que texto y notas no se perdieron. Acceso read-only y permisos contractuales son obligatorios; no navegar todo el CRM sólo porque existe un usuario genérico.

## Rúbrica semanal
- Día 3: ¿hay datos y permiso? Si no, fixtures y bloqueo del claim real, no detener arquitectura.
- Día 7: importar y reconciliar lote; medir coverage de customer/order/refund. Si no se puede cuantificar, reducir promesa a costos observados verificables.
- Día 14: top problemas comparados ciegamente con analista; una propuesta aceptada por sponsor. Si no cambia decisiones, entrevistar antes de agregar features.
- Día 21: ocho vistas conectadas y una intervención con línea base/owner. Medición en curso, no ahorro proclamado.
- Día 27: QA/seguridad y ensayo de pitch; congelar scope.
- Día 30: demo/pitch, decisiones solicitadas y plan siguiente. Venta/disposición a pagar distinta de producto compilado.

## Guion de demo de cinco minutos
0:00–0:40: «Analizamos [período] con [cobertura] de las fuentes autorizadas. Éstos son los tres problemas prioritarios». Sólo usar cantidades del snapshot; si son sintéticas, anunciarlo desde la apertura.
0:40–1:40: problema 1: quién reportó, cuántos únicos conocemos, citas, productos/regiones, causa probable y evidencia que faltaría para confirmarla.
1:40–2:40: abrir cálculo: refunds observados separados de costos modelados y escenarios. Mostrar supuestos, período/moneda y por qué no se suman todas las columnas.
2:40–3:40: recomendación y responsable; crear intervención, métricas y baseline. No mostrar ejecución automática sobre sistemas del cliente.
3:40–4:30: continuidad CRM: misma capa canónica al importar desde HubSpot y Zendesk, si ambos accesos están verificados. Fixture alternativo rotulado si no.
4:30–5:00: qué aprendimos, límites y decisión requerida: piloto, acceso a datos faltantes, siguiente intervención o inversión. No pedir capital con TAM/tracción inventados.

## Estructura del deck
1. Problema económico de posventa y evidencia del cliente.
2. Comprador/ICP específico, no todos los negocios del mundo.
3. Demo del Business Problem y cálculo trazable.
4. Qué decisión cambió y cómo se medirá.
5. Competencia honesta: SentiSum/Enterpret/Thematic/Chattermill/unitQ; wedge propuesto, no «sin competencia».
6. Piloto y estado: datos, precisión/coverage, acciones y resultados disponibles; sin resultados aún se dice.
7. Modelo de precio como hipótesis y COGS medidos o escenarios rotulados.
8. Distribución vía Convexia bajo acuerdo y validación fuera de Senix.
9. Equipo y responsabilidades; 70/30 sólo si formalizado.
10. Roadmap de próximos 90 días y ask concreto pendiente de decidir.

## Plan B
Grabación del flujo de un snapshot autorizado/fixture, export de fichas y screenshots fechados con commit. Nunca desactivar auth/RLS para que la demo funcione. Si servicio falla, explicar qué se está mostrando: grabación previa o fixture, no datos en vivo. Health check previo en entorno final, archivo de demo local y cuenta dedicada con permisos mínimos.

## Validación comercial
Entrevistas del sponsor y otros 2–4 negocios, preguntas: qué decisión cambió, quién ejecuta, qué dato faltó, cuánto costó validar, qué pagaría/firmaría con alcance fijo. Guardar respuestas literales autorizadas y no convertir elogio en intención firme. Separar facturación de Convexia de revenue VEXA.

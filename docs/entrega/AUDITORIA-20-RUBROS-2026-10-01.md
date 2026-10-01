# Auditoría VEXA — 1 de octubre de 2026

Actualización de recuperación: el gate local F07-06 pasó completo tras corregir el bootstrap Auth, el arranque offline y el adaptador de logs. Restauración 5/5 y retorno financiero comprobado; ocho recursos eliminados. [Recibos y límites](RECUPERACION-2026-10-01.md). No acredita restore gestionado ni todos los estados de entrega de avisos; el mapa siguiente conserva el corte original.

Actualización posterior al corte: el release desplegado `f893851` ya pasó el smoke remotoSYN8/8 y ocho vistas, con limpiezaMCP. Véase [evidencia actual](SMOKE-REMOTO-2026-10-01.md). El resto de pendientes sigue vigente; los párrafos del corte inicial siguientes conservan su alcance y fecha.

**59/60 tareas técnicas,28 aceptadas formalmente; producción no aprobada.** Producto publicado y desplegado `f893851b708cefb41f44ddafc991780814e6cae1`. Inventario/operación corregidos en `0691dbd`; controles formales de piloto, ensayo y entrega integrados en `f309f2b`. Estos dos últimos cambios aún no estaban publicados al redactar este corte. Esta auditoría identifica el trabajo restante: no es un certificado final ni afirma que sólo falten APIs.

La revisión independiente436 cotejó378referencias de evidencia por SHA256 sin discrepancias. Son referencias conservadas, con solapamientos, no378pruebas nuevas. No encontró un nuevo módulo operacional faltante fuera de los controles e inventario corregidos. Las pruebas de fuentes distintas conservan su fecha y alcance; no se les atribuye la versión actual automáticamente.

## Correcciones comprobadas

- Inventario de carga actualizado de2102 a2156fuentes:27cambios,54altas,ninguna baja. Se conservan los controles de exactitud. Carga actual10K:9800aceptadas,100rechazadas,100duplicadas,0pendientes;100bloques, SQL/API concordantes y limpieza comprobada. Recuento independiente aprobado. Tiempo extremo a extremo364526ms; procesamiento27,48filas/s y commitp9512839ms. Host compartido, un tenant/consumidor; no mide nube, inferencia, costo ni SLO aprobado.
- Documentación operacional corregida: eventos, outbox, correo, push y consumidores HTTP/daemon ya existen. Configurar preferencias no programa ni acredita entrega por proveedor.
- F07-05/F08-03/F08-05 tienen entradas formales revisadas436:31pruebas de calibración,137del controlador y24de base. Sus tres comandos rechazan insumos externos ausentes. Los expedientesSYN sólo calibran el control; no son entrevistas, consentimiento, aprobación ni recepción reales.
- UI F06-07 cerrada técnicamente:68/68revisiones de pantalla,8acciones persistidas,2032objetivos de teclado,132resoluciones explícitas y20estados obligatorios; Chromium/WebKit,móvil/escritorio. Conserva límites de inventario, herencia y juicio visual humano en su [cierre](../../construccion/F06-07-CIERRE-TECNICO.md).

## Mapa de los veinte rubros

“Pendiente” significa que existen controles aprobados de alcance acotado pero falta una condición de cierre del rubro. No cancela sus pruebas válidas ni certifica el área completa.

| # | Rubro | Evidencia disponible | Condición pendiente |
|---|---|---|---|
|1|Diseño y negocio|Contratos, economía, ocho vistas y evaluador de piloto.|Datos financieros/históricos reales, comprensión, insight, sponsor y WTP; sin ahorro causal ni PMF acreditados.|
|2|Arquitectura|Pipeline integrado, catálogo e inventario actual cotejados.|Validación integrada final y capacidad; modularidad no demuestra escalabilidad.|
|3|Resiliencia/recuperación|Checkpoints, replay, recuperación y rollback locales previos.|Conciliar restore con nuevas tablas de notificaciones; ensayo gestionado Auth/Storage y autoridad posterior al backup.|
|4|Capacidad/rendimiento/costo|10Kactual aprobado;10K/50K/150Khistóricos ligados a su fuente original.|50Kactual fallida:deadline900000ms,checkpoint27200;150Kno iniciada. concurrencia/nube/costos y SLO por acordar y medir.|
|5|Frontend/UX|Composición automática68/68 y8acciones de F06-07.|Juicio humano, lector asistivo/Safari físico; los68scans no significan todos los botones de todas las rutas.|
|6|API/backend|Contratos y cierres de avisos09:38/38,10:39/39,11:51/51,12:23/23, con sus pruebas hijas.|Matriz integrada actual incompleta:114PASS,2cancelled por timeout del padre; no116PASS.|
|7|Dinero y efectos sensibles|Moneda/minorunits/procedencia, unknown≠zero, snapshots y controles WTP.|Conciliar export real, ventanas/monedas/costos y decisiones de negocio.|
|8|DB/migraciones/Storage|SQL0029–0032 aplicadas y verificadas según recibos;09incluye432/432.|Matriz actual y restore actualizado/gestionado; no extender evidencia antigua a nuevas tablas sin comprobar.|
|9|Cache/CDN|No-store/Vary y casos de sesiones previos, respuestas anónimas actuales.|Cobertura autenticada del release final y comportamiento de cambios de sesión/tenant.|
|10|Límites/abuso|AdmisiónAuth por proceso, límites durables de gateway/jobs,429en webhook.|Verificar política distribuida/edge y saturación real; no hay un defecto confirmado que justifique inventar infraestructura.|
|11|Auth/permisos|Sesión/roles/revocación y composición local previas conservadas.|Revisión global sin dictamen; Google real pendiente. Estado global: no verificado.|
|12|Seguridad/cadena de suministro|Controles focales previos conservan su alcance.|F07-01 abierto: revisión435 rechazada automáticamente por posible riesgo de ciberseguridad. Sin vulnerabilidad demostrada ni aprobación.|
|13|Privacidad/retención|Redacción, purga derivada, tombstones y custodia técnica.|Consentimiento, política/retención/borrado reales y restauración con autoridad vigente; no dictamen legal.|
|14|Infraestructura|Vercel READY, SHA servido, fuentesCSS, login/versión, endpoints anónimos y SW comprobados.|Smoke completo del release final, disponibilidad/backups/operación gestionada.|
|15|CI/CD/Git|Publisher autorizado, commits con autoría, historial escaneado, SHA remoto verificado.|Actions desactivadas por política de costo; no declararlas CI hospedado verde. Publicación final con guardas intactas.|
|16|Errores/tracking/logs|Errores saneados, trace/job y registros de fallos conservados.|Destino/retención/acceso/alertas productivas; cancelaciones no desaparecen porque otras pruebas pasen.|
|17|Monitoreo/operación|Heartbeats, scheduler/daemons y ensayo local de alarma/recuperación previo.|Programación continua, identidad delegada, responsables/alertas y ensayo operativo real.|
|18|Pruebas/arneses|Inventario corregido, tres entradas formales integradas,31+137+24pruebas verdes.|F07-01/matriz, escalas de carga y validaciones finales; disponibilidad de59gates no equivale a59aceptaciones.|
|19|Integraciones/webhooks/tools|HubSpot/Zendesk, webhooks, histórico/incremental, outbox/correo/push implementados.|Cuentas/scopes reales,20referencias por CRM, reconciliación histórica, dominios/proveedores/dispositivos y entrega real.|
|20|Agentes/prompts/supervisión|Extracción/redacción, evaluación, propuestas/firmas, selección humana y rollback.|Gold/holdout, proveedores/modelos/tarifas/presupuesto autorizados y medición real. Cargar históricos no garantiza mejora ni autoriza autopromoción.|

## Bloqueos y evidencia que falta

La matriz actual terminó en677809ms con114pruebas aprobadas,0fallidas y2canceladas tras el timeout600000ms del padre. Sus hijos y cinco recursos fueron recogidos y la limpieza verificada. El resultado no es aprobación global; no se reintenta el encargo435 por otra vía.

La escala50K terminó con exit1 tras905569ms:checkpoint27200,26656aceptadas,272rechazadas y272duplicadas. El registro contiene273notificaciones de bloque, pero sólo272bloques quedaron confirmados; no sumarlas como27300filas persistidas. Se comprobaron fuente limpia, proceso terminado y cinco recursos eliminados. La medición conserva la presión del host compartido; no se atribuye causalidad sin diagnóstico. No se inició150K ni se amplió el deadline.

Último smoke remoto completo:8/8 en `b9ed3db5ef4df825c27ed208722ad2faad4ee9c3`. El release `f893851` tiene comprobaciones remotas parciales identificadas arriba; no se reetiquetan como smoke completo.

Para conexión y operación real hacen falta cuentas autorizadasGoogle/CRM, proveedor y dominio de correo/SMTP, VAPID/dispositivo con consentimiento, histórico y finanzas con procedencia, presupuesto/modelosIA, programación/identidad de consumidores, responsables y decisiones de recuperación/retención. Piloto y entrega necesitan participantes, gold, sponsor, ensayo humano y recepción legítima. [Registro de pendientes](BACKLOG.md). El trabajo técnico y de verificación restante se mantiene separado de esa lista.

No hubo inferencia pagada, envío a clientes ni habilitación de Actions en estas correcciones. Ningún hallazgo hipotético se presenta como vulnerabilidad confirmada. La revisión automática435 no produjo dictamen; se conserva su bloqueo y se continúa únicamente con trabajo independiente autorizado.

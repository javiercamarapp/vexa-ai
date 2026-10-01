# Auditoría VEXA — 1 de octubre de 2026

**59/60 tareas técnicas, 28 aceptadas formalmente; producción no aprobada.** Esta es la conciliación actual de los veinte rubros, con sus condiciones de cierre pendientes. No es un certificado final ni declara que sólo falten APIs.

Producto desplegado `dbb834c`: corrección de Equipo por acceso confirmado, READY, SHA servido y ocho fuentes modificadas verificadas. Su recorrido focal local pasó 16/16 en Chromium/WebKit; no se repitió el smoke remoto integral, cuya evidencia 8/8 y ocho vistas corresponde a `f893851`. Scheduler local corregido y publicado en `e6a340b`, con 12/12 controles Node 22/26 y revisión independiente. El inventario actual contiene 2157 fuentes y requiere una nueva serie de capacidad.

La recuperación local pasó restauración 5/5 y retorno a versión anterior/regreso a la actual, con ocho recursos eliminados. El ensayo gestionado y todos los estados de entrega de avisos conservan sus límites. [Recibos de recuperación](RECUPERACION-2026-10-01.md) · [Recibos del smoke remoto](SMOKE-REMOTO-2026-10-01.md).

La última medición 10K revisada terminó con 9.800 aceptadas, 100 rechazos esperados, 100 duplicadas y cero pendientes; 100 bloques, 345.448 ms de procesamiento y commit p95 15.190 ms. La estabilidad inicial del host no duró y no se demostró causalidad del entorno. 50K conserva su fallo al plazo y 150K actual no se ejecutó. El observador nuevo registra inicio/fin, CPU y éxito/error, pero su cambio de hash obliga a una nueva serie antes de escalar; sus pruebas unitarias no son una nueva carga. [Diagnóstico y evidencia](DIAGNOSTICO-CAPACIDAD-2026-10-01.md) · [Contrato del observador](../../packages/jobs/load/README.md).

La revisión independiente 436 cotejó 378 referencias previas por SHA256 sin discrepancias; son referencias con solapamientos, no 378 pruebas nuevas ni una nueva revisión global de seguridad. Cada prueba conserva su fuente y alcance.

## Correcciones comprobadas

- El ensayo gestionado cron→pg_net→worker de Vercel completó un import SYN de dos filas: dos HTTP 200, checkpoint 2 y cero pendientes. Limpieza y conservación de trabajos ajenos comprobadas por MCP. Programación retirada al terminar; no acredita operación continua ni recuperación gestionada. [Recibos y límites](OPERACION-GESTIONADA-2026-10-01.md).

- Un ensayo local separado de cron→pg_net→HTTPS pasó 1/1: dos POST correlacionados con HTTP200, control de certificado, límite temporal y revocación con quietud. El receptor era sintético y la base desechable; no era Next ni Supabase gestionado. El primer intento falló por herramientas ausentes en la imagen y se conserva. La alternativa usa otra imagen ya disponible y retiró ambos contenedores, red y temporales.

- La plantilla faltante de notificaciones quedó publicada en `e80b122`, junto con su regresión SQL local 8/8 y guía de los seis consumidores. La propuesta de persistencia 442 pasó 23 pruebas canónicas y 16 casos focales; sigue experimental. Sus calentamientos comprobaron 2194→1900 consultas por bloque, pero la comparación de tiempos se difirió por host no preparado: cero ventanas medidas. No hay nueva validación 50K/150K ni cambio del contador. [Detalle del experimento](DIAGNOSTICO-CAPACIDAD-2026-10-01.md).

- Inventario de carga actualizado de2102 a2156fuentes:27cambios,54altas,ninguna baja. Se conservan los controles de exactitud. Medición anterior10K (previa a la última descrita arriba):9800aceptadas,100rechazadas,100duplicadas,0pendientes;100bloques, SQL/API concordantes y limpieza comprobada. Recuento independiente aprobado. Tiempo extremo a extremo364526ms; procesamiento27,48filas/s y commitp9512839ms. Host compartido, un tenant/consumidor; no mide nube, inferencia, costo ni SLO aprobado.
- Documentación operacional corregida: eventos, outbox, correo, push y consumidores HTTP/daemon ya existen. Configurar preferencias no programa ni acredita entrega por proveedor.
- F07-05/F08-03/F08-05 tienen entradas formales revisadas436:31pruebas de calibración,137del controlador y24de base. Sus tres comandos rechazan insumos externos ausentes. Los expedientesSYN sólo calibran el control; no son entrevistas, consentimiento, aprobación ni recepción reales.
- UI F06-07 cerrada técnicamente:68/68revisiones de pantalla,8acciones persistidas,2032objetivos de teclado,132resoluciones explícitas y20estados obligatorios; Chromium/WebKit,móvil/escritorio. Conserva límites de inventario, herencia y juicio visual humano en su [cierre](../../construccion/F06-07-CIERRE-TECNICO.md).

## Mapa de los veinte rubros

“Pendiente” significa que existen controles aprobados de alcance acotado pero falta una condición de cierre del rubro. No cancela sus pruebas válidas ni certifica el área completa.

| # | Rubro | Evidencia disponible | Condición pendiente |
|---|---|---|---|
|1|Diseño y negocio|Contratos, economía, ocho vistas y evaluador de piloto.|Datos financieros/históricos reales, comprensión, insight, sponsor y WTP; sin ahorro causal ni PMF acreditados.|
|2|Arquitectura|Pipeline integrado, catálogo e inventario actual cotejados.|Validación integrada final y capacidad; modularidad no demuestra escalabilidad.|
|3|Resiliencia/recuperación|Restore local 5/5 y retorno financiero de versión/regreso comprobados sobre la composición documentada.|Ensayo gestionado Auth/Storage, autoridad posterior al backup y estados de entrega de avisos no cubiertos por ese ensayo local.|
|4|Capacidad/rendimiento/costo|Última 10K revisada con fuentes fijadas; observador mejorado y probado por separado. Mediciones históricas conservadas.|50K fallida al deadline900000ms, checkpoint27200;150K actual no iniciada. Nueva serie con observador actualizado, concurrencia/nube/costos y SLO por acordar y medir.|
|5|Frontend/UX|Composición68/68 y8acciones de F06-07; Equipo16/16locales porroles, revisión438/436.|Juicio humano, lector asistivo/Safari físico; los68scans no significan todos los botones de todas las rutas.|
|6|API/backend|Contratos y cierres de avisos09:38/38,10:39/39,11:51/51,12:23/23, con sus pruebas hijas.|Matriz integrada actual incompleta:114PASS,2cancelled por timeout del padre; no116PASS.|
|7|Dinero y efectos sensibles|Moneda/minorunits/procedencia, unknown≠zero, snapshots y controles WTP.|Conciliar export real, ventanas/monedas/costos y decisiones de negocio.|
|8|DB/migraciones/Storage|SQL0029–0032 aplicadas y verificadas;09incluye432/432. Restore local actualizado comprobado con sus límites.|Matriz integral, recuperación gestionada y escenarios de entrega no cubiertos; no extender la evidencia local a servicios gestionados.|
|9|Cache/CDN|No-store/Vary y casos de sesiones previos, respuestas anónimas actuales.|Cobertura autenticada del release final y comportamiento de cambios de sesión/tenant.|
|10|Límites/abuso|AdmisiónAuth por proceso, límites durables de gateway/jobs,429en webhook.|Verificar política distribuida/edge y saturación real; no hay un defecto confirmado que justifique inventar infraestructura.|
|11|Auth/permisos|Sesión/roles/revocación y composición local previas conservadas.|Revisión global sin dictamen; Google real pendiente. Estado global: no verificado.|
|12|Seguridad/cadena de suministro|Controles focales previos conservan su alcance.|F07-01 abierto: revisión435 rechazada automáticamente por posible riesgo de ciberseguridad. Sin vulnerabilidad demostrada ni aprobación.|
|13|Privacidad/retención|Redacción, purga derivada, tombstones y custodia técnica.|Consentimiento, política/retención/borrado reales y restauración con autoridad vigente; no dictamen legal.|
|14|Infraestructura|Vercel dbb834c READY/SHA/ocho fuentes comprobados. Último smoke SYN integral8/8 y ocho vistas en f893851, con limpieza MCP.|Disponibilidad, backups y operación gestionada reales; repetir smoke si cambia el producto que afecta ese recorrido.|
|15|CI/CD/Git|Publisher autorizado, commits con autoría, historial escaneado, SHA remoto verificado.|Actions desactivadas por política de costo; no declararlas CI hospedado verde. Publicación final con guardas intactas.|
|16|Errores/tracking/logs|Errores saneados, trace/job y registros de fallos conservados.|Destino/retención/acceso/alertas productivas; cancelaciones no desaparecen porque otras pruebas pasen.|
|17|Monitoreo/operación|Heartbeats/daemons y ensayo de alarma previo; scheduler local recupera fallos y atiende señales, 12/12 Node22/26.|Programación continua, identidad delegada, responsables/alertas y ensayo operativo real.|
|18|Pruebas/arneses|Inventario corregido, tres entradas formales integradas,31+137+24pruebas verdes.|F07-01/matriz, escalas de carga y validaciones finales; disponibilidad de59gates no equivale a59aceptaciones.|
|19|Integraciones/webhooks/tools|HubSpot/Zendesk, webhooks, histórico/incremental, outbox/correo/push implementados.|Cuentas/scopes reales,20referencias por CRM, reconciliación histórica, dominios/proveedores/dispositivos y entrega real.|
|20|Agentes/prompts/supervisión|Extracción/redacción, evaluación, propuestas/firmas, selección humana y rollback.|Gold/holdout, proveedores/modelos/tarifas/presupuesto autorizados y medición real. Cargar históricos no garantiza mejora ni autoriza autopromoción.|

## Bloqueos y evidencia que falta

La matriz actual terminó en677809ms con114pruebas aprobadas,0fallidas y2canceladas tras el timeout600000ms del padre. Sus hijos y cinco recursos fueron recogidos y la limpieza verificada. El resultado no es aprobación global; no se reintenta el encargo435 por otra vía.

La escala50K terminó con exit1 tras905569ms:checkpoint27200,26656aceptadas,272rechazadas y272duplicadas. El registro contiene273notificaciones de bloque, pero sólo272bloques quedaron confirmados; no sumarlas como27300filas persistidas. Se comprobaron fuente limpia, proceso terminado y cinco recursos eliminados. La medición conserva la presión del host compartido; no se atribuye causalidad sin diagnóstico. No se inició150K ni se amplió el deadline.

Último smoke remoto SYN completo:8/8 en `f893851b708cefb41f44ddafc991780814e6cae1`, con ocho vistas y limpieza MCP comprobada. El ensayo de `b9ed3db` es histórico; la evidencia actual está enlazada arriba.

Para conexión y operación real hacen falta cuentas autorizadasGoogle/CRM, proveedor y dominio de correo/SMTP, VAPID/dispositivo con consentimiento, histórico y finanzas con procedencia, presupuesto/modelosIA, programación/identidad de consumidores, responsables y decisiones de recuperación/retención. Piloto y entrega necesitan participantes, gold, sponsor, ensayo humano y recepción legítima. [Registro de pendientes](BACKLOG.md). El trabajo técnico y de verificación restante se mantiene separado de esa lista.

No hubo inferencia pagada, envío a clientes ni habilitación de Actions en estas correcciones. Ningún hallazgo hipotético se presenta como vulnerabilidad confirmada. La revisión automática435 no produjo dictamen; se conserva su bloqueo y se continúa únicamente con trabajo independiente autorizado.


### Capacidad: diagnóstico ampliado, sin cambiar la aceptación

La propuesta de consolidar dos lecturas pasó 23/23 pruebas de persistencia, lint/build, cuatro ventanas de 1.000 filas y los oráculos de interrupción/reanudación y no resurrección tras borrado. Reduce 8,86% las consultas, pero no acredita mejora estable de tiempo: permanece experimental. La sonda de transporte completó 16.000 SELECT y confirma variabilidad; no demuestra que el túnel sea la causa. Limpiezas reinspeccionadas. [Mediciones, límites y condición previa a otra carga](DIAGNOSTICO-CAPACIDAD-2026-10-01.md).

La instrumentación publicada posteriormente mejora el registro de intentos sin cambiar el runtime de producto. No hay ampliación de deadline ni PASS de 50K/150K. Se conservan 59/60 técnicas, 28 formales y producción pendiente, incluida la revisión global rechazada automáticamente y las validaciones externas antes identificadas.

# Progreso

Última actualización: 8 de octubre de 2026 UTC (noche del 7 en Mérida).

## Hecho y verificado
- Fases 1–3 completas localmente; grafo con 28/60 aceptaciones formales; inventario técnico reconciliado a 60/60 por cierre local F07-01.
- Fase 4: restore local 5/5, rollback financiero y regreso aprobados; ocho recursos propios ausentes. Captura de 13 objetos y metadatos comprobada; operación gestionada pendiente.
- Fase 5: lectura productiva confirma 288 bloques CRM por día. Los 362 mensajes asociados a rechazos históricos ya existen; faltan vínculos con padres.
- Mejora CRM propuesta con 101 pruebas de autoría y seis controles locales aprobados, preservando los fallos previos.

## En curso
Fase6 en auditoría final local. Base/Auth/Node integrada en7547c21, limpieza SQL en a26c4c7. Serie anterior aff0517:10K y50K aprobadas,150K no iniciada. Los cambios de controles requieren una serie completa nueva tras consolidar fuentes. Corrección de navegación510028a: seis flujos afectados83/83 y notificaciones15/15 aprobados; entrada compuesta con recuperación RSC30/30 aprobada. Producto510028a y controles6036597 integrados; wrapper de55paquetes972b0f7 preparado. Una sola suite pesada.

## Siguiente
Verificar F01-05 agregado con Node22; completar pruebas de paquetes pertinentes y congelar la nueva serie10K→50K→150K. Fase5 conserva pendientes externos de autorización de lote, referencia UI independiente y proveedores.

## Pendientes
- Consulta Supabase sobre cuarentena de Storage preparada, autorización de envío solicitada; aún no enviada.
- Recuperación gestionada y operación permanente no verificadas.
- Nuevos lotes productivos, publicación, gasto y validaciones humanas conservan los permisos específicos del plan.
- No declarar 60/60 ni producción validada mientras falte evidencia.


## Fase6: controles actuales y memoria,8-oct

Candidato externo separado1aea895 en `/private/tmp/rovaq-fase6-candidate-20261008`. Controles de base/Auth/Node revisados por Standards, reparado handshake para esperar DOMContentLoaded real antes de leer selección persistida. Controles UI revisados por root: selectors/filtros/marca/productores cotejados con producto; negativos de workspace reforzados para exigir desaparición de tabla financiera, además de artículos y exportación. F05-02 focal10/10PASS,47,56s y seis recursos ausentes; restantes en curso, no gates completos aún.

Schema de paquete: primeros intentosv1/v2 rojos preservados. Fixture Auth/Storage SQL actualizado con funciones oficiales y revisión independiente; inventario fijo112tablas sustituye contador36obsoleto, conservando asserts. `service-cas` prototipo eliminado se retira explícitamente como RETIRED_SUPERSEDED, noPASS; su mapa exige CAS/aprobación/replay actual más rollback SQL dirigido. Cuatro suites restantes pendientes del slot. Fuentes en worktrees de control; no integradas aún.

Wiki autorizada actualizada con tres notas atómicas de recuperación, CRM/histórico y diferencia60técnicas/28formales; hot e índices actualizados, log prepend sin tocar entradas previas ni .raw. No hay push/deploy, carga productiva ni inferencia pagada.

Control UI focal: F06-01 v1 falló por asumir igual etiqueta de exportación en Overview y Problems; se corrigieron dos selectores de Problems, sin cambiar producto/plazo. v2 pasó16/16 (69,92s); F06-02 pasó11/11 (67,70s) y F06-03 pasó14/14 (75,93s), seis recursos propios ausentes en cada corrida. Explorer sigue en ejecución. Recibos originales en `~/.codex-work/rovaq-cierre-20261007/receipts/fase6-ui/`; no equivalen a gates completos. Lectura remota anónima confirma despliegue b0be6df y rutas protegidas, no el código local.


Schema v3: cuatro suites conservadas, 21/21 PASS en 24,469 s. Cada hook verificó eliminación propia con docker rm exit0; inventario final independiente sin contenedores schema. No se afirma cotejo histórico de cuatro IDs: el buffer de eventos sólo retenía uno. Integrado en3530f92 con inventario de capacidad2.219 y preflight PASS; no capacidad medida. Retirada del prototipo mantiene pendientes sus sucesores modernos. Explorer también PASS13/13 (135,66 s, setup dentro480 s y seis recursos ausentes). Slot transferido a Auth/base; controles UI restantes esperan.


## Integración de base y SQL,8-oct

Auth F01-02 pasó7/7 (47,34s), navegación F01-04 pasó3/3 (232,57s; cuatro roles y ocho rutas), preview F02-03 pasó31hijas más entry1/1 (76,16s). Calibración de componentes7/7 (seis defectos introducidos detectados); calibración de rol v2 pasó positivo analyst→forced-owner rechazado por el oráculo exacto→restauración positiva en62,52s. El primer rojo de rol se conserva como fallo de infraestructura, no detección. Fuentes invariantes y16recursos ausentes en la calibración final. Recibo privado fase6-base-final-local-v2.json, SHA2564a78b06a1219f503b4ba1cc528110ec67fc2129990be5fc25b04656eaf1dbb99.

Cuatro matrices financieras ejecutadas juntas sin repetir la dependencia SQL:493/493PASS en529,944s, cero omitidas/canceladas. F01-03 libera servicios antes de iniciar matrices posteriores y conserva sus tres plazos de600s; los recibos dirigidos tienen nombres distintos. Cinco recibos y25IDs de recursos independientemente ausentes; proceso terminado y fuentes invariantes. Recibo privado fase6-ui/financial-matrices-v1/receipt.json SHA25617dfb635ff233e865d3a51d2da6e23a99632bf77ab1a8703de5fe368addd31ae. El rollback SQL moderno de intervenciones ya está cubierto; su flujo UI continúa pendiente.

Integración local7547c21 (base24archivos y manifiesto) y a26c4c7 (lifecycle SQL y recibos). Preflight del inventario2.219fuentes PASS, manifiesto SHA2569718b9811655686c4e879f015bb13210df19b5a7812bc36abe7971ed663cdc0c. No es medición de capacidad, aceptación formal ni despliegue.


Contrato web integrado en356c391: Next16.3.6 exacto contra package/lock, TypeScript/ESLint y tres scripts originales conservados. Calibración roja1FAIL/1PASS→verde2/2. Inventario2.220fuentes, preflightPASS, SHA256fea2a5e0cb5a016fdb9c563f239570283cd5663b43615c675ac9fbd9cfa9d014; serie nueva aún pendiente.

Intervenciones F06-05 funcional14/14PASS (94,605s) y Briefs F06-06 funcional15/15PASS (79,371s), seis recursos ausentes por corrida. Junto con SQL493 cubren los sucesores modernos exigidos al retirar el prototipo service-cas. F06-08 notificaciones continúa FAIL: primer intento7PASS/2FAIL no completó transición desde la campana; diagnóstico observacional posterior sí navegó inicialmente y encontró un segundo selector que buscaba campana en una vista donde sólo existe enlace lateral oculto. Se conserva ambos rojos, se corrige el retorno mediante Administración y se investiga una posible carrera de history.replaceState antes de repetir. No hay causa confirmada aún para el primer fallo.


## Defecto real de navegación reproducido y propuesta aislada

La reproducción determinista confirmó que un replaceState financiero tardío puede cancelar la transición pendiente de Next a /notifications. Click real, respuesta workspace200 retenida, replaceState de /overview y RSC200 de destino liberada después: la página queda en /overview. Fallo preservado F06-08-navigation-controlled-v1; límites de15s intactos y seis recursos propios ausentes. No se resolvió esperando artificialmente a que terminara el resumen.

Propuesta510028a en rama local fix-fase6-navigation-race y candidato separado `/private/tmp/rovaq-fase6-navigation-candidate-20261008`: WorkspaceLink usa onNavigate público para invalidar seis paneles; cada pin verifica origen y conserva fragmentos. Revisión independiente cerró un enlace omitido de ProblemsPanel; resultado estático0bloqueantes. Instalación offline, tipos y lint PASS con fuentes de componentes idénticas a la copia comprobada. La regresión original→propuesta y las seis UI afectadas siguen pendientes; todavía no integrada en la rama canónica. Manifiesto2.221fuentes, preflightPASS, SHA256334882f392cfccd5eb80ff30cd14071a80c11047cf258ac75ee476e9494adb66.

Email F06-10 entry completo39/39PASS,74,49s, con25/25 puros y siete recursos propios ausentes; Push F06-11 entry51/51PASS,115,511s, seis recursos ausentes. Fuentes y temporales comprobados. No se atribuyen esos resultados a la corrección de navegación posterior.


## Corrección integrada y cierre de regresiones UI

Producto510028a integrado por fast-forward, controles6036597 y wrapper972b0f7. Las seis UI afectadas pasan83/83, notificaciones funcional15/15 y entrada compuesta30/30 (181,612s); esta última incluye7escenarios de navegación y recupera tres RSC500 mediante documento200 real. Dos arneses,12IDs propios ausentes, temporales retirados y fuentes invariantes. Se conservan rojos originales y comparación controlada con la versión anterior. [Recibo público](../../entrega/CORRECCION-NAVEGACION-2026-10-08.json). Siguiente: cuatro trabajos CI reales,55archivos de paquetes y serie final10K→50K→150K. No modifica28/60 ni valida producción.

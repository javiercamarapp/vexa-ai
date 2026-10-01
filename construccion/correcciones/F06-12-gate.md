# F06-12 — examen externo recuperado y ampliado426

## Actualización de revisión428 — antes de la verificación limpia

Este apartado actualiza los estados de ejecución anteriores. La base2165849 sí contiene el producto de F06-11; la nota anterior que indicaba lo contrario era incorrecta. F06-11 ya fue aceptada. Los controles de F06-12 están preparados para verificación limpia; todavía no se declara esta tarea aceptada ni apta para producción.

Las recuperaciones conservaron los fallos y corrigieron únicamente sus causas:

1. **CTA de un aviso sin leer.** El panel vigente presenta un botón que marca la lectura y abre el recurso; el selector antiguo esperaba un enlace. El control corregido exige navegación al brief real, `readAt` persistido, disminución exacta del contador de no leídos, retirada de la lista de no leídos y conservación de la bandeja de la otra organización. Este recorrido pasó en la composición actual.
2. **Alerta ajena al componente.** El diagnóstico reprodujo la selección prematura del `NEXT-ROUTE-ANNOUNCER`, fuera de la sección de políticas. Los selectores quedaron acotados a la región «Política de envío». Los ocho escenarios UI pasaron: guardado, cancelación, timeout de carga, timeout de guardado, resultado incierto, fallo de reconsulta, respuesta duplicada y permisos insuficientes. La recuperación de un guardado incierto consulta mediante GET y no repite el POST.
3. **Puerto de SMTP.** El puerto60865 pertenecía al navegador de prueba. Mailpit usa ahora60864, el puerto web que se libera mediante `stopWeb` antes de iniciar SMTP. La siguiente ejecución pudo abrir el receptor local; no se modificaron puertos del producto ni servicios externos.
4. **Un turno del dispatcher no garantiza procesar un trabajo específico.** El dispatcher recorre los tenants autorizados por orden de su última reserva, sin prometer que un único ciclo global seleccione el correo pendiente de B. La prueba específica de la factoría SMTP configura en el servidor `VEXA_WORKER_DISPATCHER=disabled` y `VEXA_WORKER_TENANT=B`, opciones operativas existentes. Conserva un único ciclo, estado `accepted`, un solo correo en Mailpit, destinatario exacto y entrega todavía `unknown`. No agrega reintentos ni cambia el producto. Los controles anteriores de dispatcher A/B y HTTP permanecen. Esta última corrección aún requiere pasar la verificación limpia.

El tercer ensayo integrado terminó **21/23**, con fallo del caso SMTP y de su padre; no se convierte ese recibo en verde. Sí quedaron comprobados los emisores de negocio, las transacciones y el aislamiento, los permisos SQL, la restauración de contexto, UI8 y los recorridos HTTP reales hacia la bandeja y Push cifrado local. Las suites hijas completaron16 pruebas puras y12 pruebas de lectores. El gate definitivo debe completar23/23, además de conservar esas suites y UI8, antes de aceptar o publicar F06-12.

La matriz general terminó114/116 con dos cancelaciones por límite de tiempo. **No es una matriz aprobada** y continúa pendiente en el cierre global. No se eliminaron oráculos, no se relajaron SQLSTATE ni se declararon entregas externas. Los recibos rojos, el diagnóstico causal y las versiones anteriores de los controles permanecen preservados por el supervisor.

## Preparación histórica426 conservada


Base2165849ea478d6cc21668823f596633543b39820. Propuesta de controles fuera del producto, sin aceptación. F06-11 debe quedar aceptada antes de ejecutar este gate sobre una composición completa.

## Contrato conservado de306

Se recuperaron porhash exacto seis archivos de control306. Se conservan los cinco emisores: brief y asignación por APIs reales; health por runSync con adaptadorSYN; membership y processing.failed por hechos transaccionalesSYN en tablas reales. Replay, atomicidad, opt-out, aislamiento A/B, CTA autorizada, ownerpolicy y configuración SMTP por factory predeterminada siguen siendo obligatorios. El importfailedSYN no acredita fallo de importador extremo a extremo. No se notifica por cada mensaje CRM.

## Delta426

- Fail-fast de ausencia antes de importar la suite/infraestructura.
- HarnessF02 vigente conserva identidad de proceso única, auditoría de salida, cleanup por IDs propios y fuentes inmutables. Puertos60860–60865. Build/instalación sóloh.tmp; candidato permanece sinnode_modules.
- Mailpit networknone usa cierre idempotente integrado a h.close, incluido shutdown. CLI elimina NODE_TEST_CONTEXT heredado. Tests hijos puros operan en h.tmp instalado.
- APIpolítica: owner actual, Origin, filtros y campos de autoridad rechazados sin escritura parcial. LectoresTS exactos: UTF8/JSON/media,4096bytes,5s, cancelación;12oráculos ligeros reutilizados425.
- Cinco puros independientes comprueban reautorización owner, límites y rechazo temprano; readiness es configuración y cleanup, no entrega.
- Ledger0032: RLSforzado,42ACLtabla+12ACLfunción, dos FKs exactas, lecturas/escrituras privadas y vínculo evento/tenant. Se extiende F01-03 sin eliminar controlesprevios ni añadirexcepcionesglobales.
- SQLemisor: identidad/tenant/acción restaurados con NULL, claimsfallback,éxito,error y query_canceled; issuer y destinatario Auth banned/deleted suprimen emisión, con controlpositivo que sí emite.
- UI427: modal compartido, cancelar/Escape, loading, errores, duplicados, recuperación tras POSTincierto sóloGET y sin repetir mutación. El recorrido306 confirma el modal antes de guardar.
- Push nuevo: cambio de negocio real→outbox→factory predeterminada→runtime autorizado→SDKweb-push→receptorTLSUnixlocal→descifrado estándar. Sólo socket sustituido porfixtureSYN; payload mínimo y binding de dispositivo/version obligatorios. No proveedor externo ni entrega de SO afirmada.

## Evidencia y estado

Rojoactual contra copia sinSQL0032: exit1 con BUSINESS_NOTIFICATION_IMPLEMENTATION_MISSING antesdeinfra. Sintaxis15archivos,5/5puros y12/12lectores verificados en Node22. Los13/13históricos306 pertenecen a una composición anterior y no son PASSactuales.

La composición íntegra, SQL0032gestionado, UI8y transportes locales nuevos están SIN EJECUTAR en esta preparación por la restricción del supervisor: F06-11 sigue siendo único cierre pesado. El examen no implica aceptación ni producción. Debe ejecutarse después de integrar dependencia11, verificar hashes15de425/427 y autorizar una única infraestructura.

Comando futuro: `VEXA_CANDIDATE=<copia-limpia-con-dependencias> /opt/homebrew/opt/node@22/bin/node --test --test-reporter=tap tests/acceptance/F06-12.test.mjs`.

No publicar originales privados, secretos, artefactosSYN ni pruebas externas como entrega real. Configuracióndeproveedor/DNS/VAPID, dispositivosreales y auditoríafinal siguen diferenciados.

## Revisión428 y entrada alojada430

La base2165849 sí contiene el producto Push11; la nota de dependencia ausente del informe426 era incorrecta. F06-11 ya quedó aceptada antes del nuevo ensayo. El primer ensayo426 terminó11/13: negocio/inbox/atomicidad pasaron, pero el selector antiguo esperabaLink en aviso sin leer. El panel vigente usaButton para marcar leído y navegar.428 exige ese botón y agrega readAt persistido, contador−1, retirada de unread e invariancia de la bandejaB; el rojo original se conserva.

La nueva ruta POST/api/internal/notifications se verifica mediante HTTPNext real tanto para inapp como Push. Push pasa por la factoría integrada y sus scopes reales; sólo se reemplaza el socketHTTPS por receptorTLSUnixSYN. Se conservan el preload de identidad y el de auditoría; ningún runtime, respuesta de negocio o credencial de producción se sustituye. Las pruebas TLS descifran el payload y comprueban bindingid/version. No se confunde aceptaciónlocal con entrega del sistemaoperativo.

Once controles ligeros adicionales del handler real comprueban secreto, formato/Origin/query, cancelación, un único claim, respuesta privada, errorredactado, cierre y bloqueo ante concurrencia. Deadline/cancelación drena recursos antes503 cuando la dependencia responde dentrodelplazo. Una dependencia no cooperativa queda en503 y mantiene el bloqueo hasta el cierre; no se declara cerrada por el mero timeout. La suite hija tendrá16pruebas puras (5anteriores+11nuevas), más12lectoresTS. NextHTTP y SQL siguen requiriendo el ensayo integrado; estos puros no los reemplazan.

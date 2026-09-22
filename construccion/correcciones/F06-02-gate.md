# F06-02 · gate274 en diseño

Baseline75fc3886b50a35bf97df66e09a06bbf3ff1e3140. Controles propios en copia disjunta; puertos60520–60525; SQLglobal pertenece275.

## Oráculos antes de implementación

- Auth, PostgreSQL, Storage, ingesta, extracción/evidencia y snapshot reales. Proveedor sintético explícito, cero gasto externo.
- Refund1500 se obtiene exclusivamente de R1settled2000 y V1reversal-500, con IDs físicos/revisión capturados. M1 menciona20dólares y nunca es procedencia contable.
- Navegación real cifra→componente→evento→evidencia, manteniendo snapshot/hash. No construir URL artificial para sustituir link ausente.
- CustomerC1 une O1/O2 y T1/T2/T3 sólo mediante identidades/relaciones autorizadas explícitas; no deducir identidad por compartir un problema. Conversación sin identidad no crea /customers/null.
- TenantB con canario, IDsrepetidos, desdeA devuelve404 sin metadata/canario. Lectores actuales permitidos, revocados denegados, late200 no repuebla UI.
- Causas probables no confirmadas por narrativa; cobertura y corte visibles. Error distinto de ausencia/importe0.
- Reviewer275 aporta mutante financiero/procedencia y revisión dominio; no duplicarSQL23 inalterado.

## Lecciones01 reutilizadas

Selectores anidados con valores/opciones usan prefijo semántico; evidencia DOM antes de corregir un selector. Un merge administrativo no revoca la evidencia ni reescribe importes bajo mismohash; stale es metadata distinta. APIenvelopes trace/contract/retryable verificadas desdeprimercorte.

## Decisiones explícitas antes de runtime

La identidad canónica se aprueba con vínculo owner/CAS y FK tenant; jamás por igualdad del customer_key. El snapshot financiero permanece intacto. Un recibo de detalle fija asociaciones mediante detail_hash global y detail_as_of separado de as_of financiero. Sin detail_hash se solicita una nueva vista; con hash anterior no hay fallback a latest. Los drills inferiores requieren el hash. Probar asociación posterior contra vista anterior no exige alterar dinero ni el snapshot F05.

La interfaz API exige f06-detail-v1, trace UUID y retryable exclusivamente503. UI usa labels htmlFor estables; el click real crea el vínculo antes de abrir una nueva vista explícita. Se incluye C2 en el mismo cluster para impedir atribución amplia de conversaciones.

## Estado

Ausencia real contra HEAD75fc: private/f0602-absence-274.log, DETAIL_IMPLEMENTATION_MISSING. Controles todavía en diseño, sin veredicto ni servicios iniciados. Esperar freeze explícito273 y composición de UI5 antes de runtime. Revisión275 aporta mutante refund sin reversal y cadena24; no duplicar matrices.

## Corrección de transporte de fixture antes de runtime independiente

El probe del autor273 reprodujo400 porque GET economics no admite dateBasis (lo fija el servidor), aunque el DTO de POST scope sí lo exige. Se omite exclusivamente dateBasis de ese GET; start/end/currency/exponent/basis/timezone permanecen. No modificar nombres a date_start del endpoint workspace ni rebajar aserciones de dinero. Rojo autor preservado en private/f0602-author-runtime-273.log; es fixture, no defecto de detalle.

## Corridas reales274 y correcciones acotadas

Primera corrida UI5: ocho pruebas pasaron (presencia+7subcasos). Retirada de conexión denegó detalle y limpió financialregion, pero siblings mantenían miembros y texto causal: P1 reproducido con DOM/captura, private/f0602-functional-274.log. El principal corrigió sólo wrapper de detalle/página problema para desmontar children tras401/403/404 actual y restaurar únicamente después de respuesta validada.

Segunda corrida fuenteakk7idq0: presencia+8subcasos verdes, incluida retirada whole-page. Último caso alcanzó denegación SSR real al navegar después de revocar membership; esperaba equivocadamente mensaje local SharedWorkspace. DOM muestra Acceder a VEXA/Acceso denegado. Se conserva espera de respuesta200 real capturada, navegación, vuelta atrás, denegación comprobable, liberación y ausencia de datos privados. Cambia exclusivamente selector de estado de denegación; sin ampliar timeout ni cambiar producto.

## Resultado independiente final274

Node26:11/11 verde, private/f0602-functional-final-274.log, composición13akk7idq0 conSQL57b0 y fixUI2. Último caso capturó200 autorizado real, recibió denegaciónSSR al salir, volvió por historial a detalle protegido (detail_auth_denied), liberó la respuesta antigua y verificó ausencia de miembros/citas/causa. No se omitió navegación ni se aumentaron tiempos. Todos los recursos propios se limpiaron porID, journals0600. Principal ejecuta cleanNode22 y aceptación; este gate no publica.

Control275 independiente y matriz se importan por manifiesto final, sin duplicar su ejecución. CI configuration-only customer-bindings revisado separadamente con11/11Node22y26 y negativos estrictos; no excepción para detail dinámico ni query.

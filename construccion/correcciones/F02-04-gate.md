# F02-04 — persistencia e historial canónicos revisados

## Cierre aceptado — 20-sep

F02-04 aceptado en `26a0d9f`, **15/60; F02 en4/6**. Verify y regresiones01/02/03 más cuatro jobs CI pasaron. Reconciliación nueva fechada preserva el timeout del padre y verifica los recibos originales, cleanup, huellas y contexto. Accept limpio reejecutó04 y salió0. La preparación anterior rechazada por13journals0600 se conserva: sólo copias históricas revisadas se normalizaron0644 sin cambio de bytes; journals activos siguen0600. No altera los límites de alcance indicados abajo.

## Histórico — recheck independiente previo a aceptación

Recheck192:23/23 casos reales en Node22 y26, matriz SQL193/193 y ocho negativos contra falsas ejecuciones (cero casos, omisión, skip y duplicado por versión).95archivos de producto idénticos por SHA/modo a revisión188; se reutilizan sus25probes adicionales. Control/producto/HEAD intactos;15recursos propios retirados. El producto04 se materializa sobre03 ya aceptado; no reintroducir los dos componentes03 anteriores a su corrección.

Estado al congelar: **14/60**. Aprobación no es aceptación: faltan prepare/adopción/verify/regresiones/accept limpio y publicación.

## Contrato y correcciones reales

- Identidad lógica estable separada de revisión opaca. No sumar dos proyecciones de un pedido ni elegir una revisión por orden textual o fecha observada. Historial inmutable y snapshots de las cinco entidades.
- Revisiones incompatibles quedan ambiguas/cuarentenadas, con importe SQLNULL, nunca cero ni autoridad inventada. Selección explícita owner con CAS/auditoría; revisión nueva invalida selección, replay no infla contadores.
- Fechas nulas legítimas según entidad, relaciones CSV conocidas resueltas por tenant/conexión y cuarentena ante ambigüedad. Rechazos conservan código/campo/fila/hash reales; error SQL no significa ausencia.
- Se reprodujo un bypass directo de selección por analyst. Política de source_heads ahora impide promover autoridad por ese actor: UPDATE owner o estado ambiguo, INSERT inicial ambiguo sin autoridad o único con una sola revisión. El primer fix demasiado estricto rechazó un alta ambigua válida; se corrigió política, no se debilitó la matriz.
- Extensión de F01-03 para tres tablas de historial/cabeceras/cuarentena y19FK adicionales sobre baseline005. RLS/FORCE/grants, roles, acciones, revocación, identidad compuesta y FKs físicos comprobados. Mensajes con timestamp desconocido y revisiones append-only cubiertos. Otras tablas desconocidas siguen rechazadas.

## Falso verde de launcher corregido

Un módulo que sólo imprimía F02_04_COMPLETO podía salir0 sin casos de dominio. El inventario externo ahora exige22casos nombrados más padre,23pass/23tests, cero fallo/cancelación/skip/todo, sin duplicados y marcador. Diagnósticos no cuentan como tests. Se rechazaron en TMP versiones sin casos, con omisión, skip y duplicado en Node22/26. Los fixtures TAP del checker no se presentan como evidencia de negocio.

## Límites

No acredita consumidor05/06, dispatcher/credenciales hospedados, selección HTTP/UI posterior, producción ni auditoría enterprise. Fuentes y rechazos previos se conservan. El gate contempla efectos SQL y contratos canónicos con fixtures sintéticos; datos reales, proveedores y validación operativa remota pendientes.

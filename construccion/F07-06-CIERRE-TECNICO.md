# F07-06 — recuperación técnica comprobada

El código de backup/restore, retención y purga está integrado. Los controles externos ahora son portables, usan dependencias bloqueadas y fixture de controlador. Restore actual conserva siete tablas/historiales, evita resurrección de fuentes, rechaza CAS antiguo/custodio revocado y conserva el costo desconocido. Los originales del backup permanecen inmutables; el destino restaurado continúa cerrado hasta reconciliar la autoridad posterior al backup.

El ensayo adicional ejecutó una app anterior real con el esquema actual hasta0038: SHA servido comprobado, snapshot/detalle financiero idénticos, refund1500, tenantB404 y vuelta al binario actual sin cambios. Sólo se acredita continuidad financiera de ese binario; su defecto conocido de listar más de100candidatos se conserva explícito. No se recomienda ese SHA para un rollback general.

Node26 completó restauración5 y prueba web, con cuatro controles candidatos sustituidos por trampas. Revisión360 verificó9fuentes+46evidencias. El defecto de cancelación del harness se corrigió mediante cleanup idempotente y handler de señales; prueba focal realSIGTERM→exit1/3recursos ausentes, siete evidencias adicionales. No se repitieron ni se reatribuyeron los ensayos previos al nuevo handler.

No queda programación ni ensayo local identificado pendiente de esta ficha. Quedan operación gestionada, política/custodia del cliente, aprobación legítima SQL/despliegue, reconciliación de membresías/claves/sesiones posteriores al backup y aceptación formal dependienteF07-04. No abrir un restore por quitar un marcador ni asumir que el ledger de borrado contiene toda la autoridad. Las mediciones localesRPO604ms/RTO707ms de352 no son SLA.

[Reglas y límites del gate](correcciones/F07-06-gate.md). Publicaciones anteriores y OPERATIONS conservan sus cortes históricos; esta nota agrega el ensayo del binario actual y su control portable. No declara producción ni el ámbito excluido de notificaciones.

## Corrección control-plane S01 v5 — pendiente de adopción

Motivo: UI autorizada exporta contenido HTML cuya serialización/markup no equivale al plaintext del proveedor. No fabricar plaintextUI desde API ni silenciar diferencias. Nuevo contrato explícito reconciliará contenido+acciones UI independientes y fidelidad exacta proveedor→producto por separado; conserva originales y todos los rojos de perfilesanteriores. Enmiendas y prototipos revisados fuera del candidato antes de esta composición.

V4 histórico se conserva en su ruta; tests de configuraciónv4 no se cuentan como pruebasv5. Nuevo paquete support/F03-HubSpot-v5 y entry propuesto importan/preparan witness ANTES de local.test.mjs (éste importa producto con top-levelawait). PruebaSYN ejecuta entryexacto y rechaza mutanteordeninverso; bindingnativo real sobrevive cambio posterior de globalfetch.

Orquestación: metadata explícita, cuenta/app/scopes reales; todaspáginas; verifyRecord para TODAS entidades, verifyMessage dual para cada mensaje, assertComplete terminal/inventario; sin earlybreak por found.size. Sharedabort cubre metadata, response y espera de iterador. Cierreobserver exige closed/0bodies/0retained. Scope de envelope preserva tenant/conexión/fuente/cuenta.

Controles nuevos de integración usan únicamente respuestasSYN y adaptadorreal congelado6e8; noHubSpot ni HMAC/secretos reales. Incluyen paginaciónfinalCOMMENT, emisiónthreadprimero, pérdida/event/text/payload/roles/scope, UI/HMACdistinto, cuarentena, metadata/abort/límites, autoridad/archivos/pins, presupuesto callback y bootstraprelocatable/cleanupfallido. No repiten63/109de núcleos inalterados ni los atribuyen al ejecutorlive.

Adopción por principal: copiar adoption-files.json bajo support/F03-HubSpot-v5 y proposed-entry/F03-01.test.mjs a tests/acceptance/F03-01.test.mjs; incorporar bloqueLIVEv5 y esta corrección, conservandohistórico. No copiar node_modules, TAP/recibosprivados, datoscliente ni snapshotsprivados. dependencies.json sólo contiene rutasrelativas y hashes de código/paquetes públicos. Congelar nuevoHEAD/source manifest antes de ejecutar verify/accept. Este documento no declara PASSremote ni aceptación.

# F03-03 — control externo en construcción, no aceptado

20-sep2026. Propuesta externa: PostgreSQL real local, migraciones0001..0008, login NOSUPERUSER/NOBYPASSRLS que SET ROLE vexa_backend mediante createDatabase real. Fuente/remoto nunca autenticado. Fixtures SYNTHETIC.

- InfraF02 reutilizada con Docker `--pull never`, UUIDpropios, broker/journal0600, puertos58300..58302, túnelUNIX sinpuertoPG, cleanup porIDs. Builds/deps offline sóloTMP.
- Página/canonical/raw/rechazos/cursor atómicos; commitfallido, postCOMMIT/preACK yreanudaciónotroproceso;429 ycontinuation; lease/fence, revocación, original/tombstone, order/batchsize yparentdespuésmessages, factoryZendeskreal contransportsynthetic.
- Matriz008 explícita all3tables, FORCE RLS/grants/FKscompuestas, anon/auth/service/backendroles2tenants, revocación, UPDATEidentidad yappendonly. Integra schemaOracle/discoveredFkOracleF01-03 sinignorar tablas nuevas.
- Rojo de setup servicios=false preservado: migrationsbase requierenAuth/Storage inicializados; corregido con serviciosrealeslocales, no defectoproducto.
- PrimerrojoSQL: FORSHARE deconnections filtrado porpolicyUPDATEconfigure;008fixUSINGimport/ WITHCHECKconfigure conservaSELECTlock ydeniegamodificación. No bypassRLS.
- Tresrojosfixture iniciales: comparar JSON.stringify checkpoint falla porordenkeyJSONB; corregido comparación estructural exacta, cursoropaco se mantieneigual.
- Factorydeadline detectado integraciónreal: duración de runSync frente epochtransport. Corregido enproducto; últimaSQLNode26verde14/14, incluyeZendeskfactory ydosmutantesfuncionalesSQL (rawviewer ydualscope)0→1→0, limpieza exactaIDs confirmada.
- **Pendientes antesfreeze:** revisiónindependiente, mutantesatomicidad/cursor0→1→0 ybaselineausente, suiteF01-03integral, Node22 (primeraSQLNode26), reproduccióntimeout1001recovery yscopebindingconfig proveedor. No afirmar quetodoestápasado por recibo completed: nodeexit ysubtestsmuestranfallos.


## Consolidación del principal —20-sep

La entrega original cerró14/14 en Node22/26 con PostgreSQL real y dos mutantesSQL0→1→0; los rojos anteriores de infraestructura y JSONB se conservan, no se cuentan como defectos del producto. El transporte sí tenía un defecto reproducido: confundía duración con timestamp absoluto; fue corregido y32pruebas de conectores pasaron en ambas versiones.

La ampliación externa añade recuperación de1001mensajes antes del padre, bloqueo de cambios de cuenta, FOR SHARE positivo y UPDATE de conexión prohibido durante importación. Cuatro mutantes reales sobre la copia compilada temporal (commitprematuro, cursorcorrupto, fencedesactivado y cambio de cuenta permitido) se ejecutan con oráculo baseline→rechazo específico→restauración. No editan candidato ni sus dependencias. Los exámenes completos ampliados terminaron20/20 en Node22 y26, con6mutantes en total y cleanup comprobado. La implementación ausente también falla por la aserción IMPLEMENTATION_MISSING correcta, antes de crear servicios.

La matriz F01-03 integral con008 pasó208/208: inventario, roles, FK, Auth/Storage/retrieval reales locales y sesiones revocadas. No se eliminó ninguna tabla del inventario sin cubrirla. La política connections permite lectura con rowlock desde import pero WITH CHECK continúa configure-only; UPDATE real fue rechazado.

La revisión independiente de este conjunto sigue pendiente. S01/S02 externos no están autorizados/ejecutados; estas pruebas no aceptanF03 ni modifican17/60, ni prueban producción. HubSpot declara fullscan conservador; una ventana no reconstruye un snapshot histórico del proveedor.


## Revisión independiente211 y tres correcciones

El revisor reprodujo tresP1 antes de aprobar: visibilidad desconocida podía convertirse envoz de cliente; contextajeno enerrors podía persistirse bajootrotenant; reutilizarconnectionIdparaotra cuenta podía enlazarmensaje nuevo conpadreantiguo. Los tres casos quedaron reproducidos con adaptadorreal/salidaSQLsintética y sus rojos se conservan.

La corrección exige coherencia role/visibility, scopecompleto enenvelopes yerrors antes de cualquier efecto, y coherencia histórica source/account frente a revisiones previas ytodosloscursores. Una cuenta distinta requiere connectionIdnuevo, incluso al empezarotraventana. No modificaF02 niSQL008. CasosSQL externos prueban rollbacktotal porcada dimensión deorigen ycontextausente, registro sinenvelope, cuarentenaduradera porvisibilidad yconexiónnueva sinmezclarhistoria.

Verificación final:29/29 enNode22/26,6mutantes0→1→0,12pruebas pertinentes de producto enambasversiones; matricesSQL208/208 reutilizadas porque no cambióesquema/examenmatriz. El consumidorTypeScript estricto createDatabase→createSyncRepository→runSync compiló enTMP condependenciasoffline. Fuentescongeladas porhash/modo ycleanup porIDs.

Un intento diagnóstico delprincipal reutilizó porerror un directorio deevidencia yfallóEEXIST antes de crearservicios; no cuenta comorojo de dominio. Sobrescribió archivosderivados dehashes/cleanup delprimerprobe, cuyo logrojo yjournaloriginal permanecen. Se ejecutó elrojo consolidado enunTMPnuevo, con resultados/limpieza propios. Los recibos delrevisor yde lascorrridasfinales no se alteraron.

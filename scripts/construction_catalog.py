"""Authored task instructions. Renders documents, NEVER regenerates the active DAG."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DETAILS={}
def add(id,files,steps,oracles,recovery,mode='worker'):
 DETAILS[id]=dict(deliverables=files.split('|'),steps=steps.split('|'),oracles=oracles.split('|'),recovery=recovery,mode=mode)

add('E00','packages/economics/index.mjs',
 'Leer el contrato financiero y el kernel existente; no sustituir BigInt por Number.|Ejecutar gate externo contra candidato sin patch primero; corregir únicamente una regresión reproducible.|Conservar contratos y test del control-plane intactos.',
 'Duplicar un event_id no duplica exposición.|Monedas diferentes no se suman.|Importe desconocido mantiene null y subtotal conocido.',
 'Si ya pasa, verificar sin patch; no crear cambios para justificar la vuelta.')
add('F00-01','docs/blueprint/source-review.json',
 'Controlador verifica originales con scripts/verify_delivery.py; los originales quedan privados y fuera del worktree.|Crear ficha con seis hashes/duraciones, DOCX y limitaciones ASR; no afirmar revisión auditiva humana.|Comparar la ficha contra manifest protegido de tests/fixtures/source-manifest.json; no subir audios.',
 'Seis audios únicos y duración total 591.829333 segundos con tolerancia de redondeo.|Un hash alterado o un séptimo audio inventado hace fallar la comparación.|human_verbatim_review=false y ASR uncertainty explícita; no prueba semántica.',
 'Si falla hash, conservar ambas copias y releer la fuente materializada; nunca recalcular expected para ocultarlo.','interactive')
add('F00-02','docs/blueprint/pilot-readiness.json',
 'Crear registro separado de responsables de construcción local y de negocio/CRM/privacidad/finanzas del piloto.|Registrar desconocidos como null y design_partner_status=proposed; pedir nombres y aceptación al interlocutor autorizado.|Aprobar únicamente alcance synthetic-development mientras faltan derechos; no presentar esto como autorización de Senix.',
 'local_scope=synthetic-development y customer_data_allowed=false permiten preparación, NO piloto.|Roles del piloto sin evidencia permanecen pending; no nombres inventados.|No se habilita real-data-ready sin las cuatro confirmaciones y sus referencias documentales.',
 'Si falta respuesta, continuar sólo la ruta local declarada; el checkpoint externo reaparece en F08.','interactive')
add('F00-03','docs/blueprint/environments.json',
 'Inventariar versiones de Node/Python/Git/Codex y comprobar autenticación ChatGPT sin imprimir secretos.|Definir tres registros dev/preview/prod, cada uno con estado, propietario y project_ref nullable; ningún ref de Likida.|Dev local con datos sintéticos; preview/prod unprovisioned hasta permiso. Seguir 02-ENTORNO.md para instalación interactiva.',
 'Tres entornos distintos; ningún project_ref repetido si no es null.|runtime_ai_enabled=false para dev sintético.|Un flag de aprobación no demuestra cuenta cloud ni conectividad; pruebas remotas se difieren a F08.',
 'No reutilizar un proyecto encontrado en HOME. Corregir el inventario y conservar credenciales fuera del repo.','interactive')
add('F00-04','tests/fixtures/syn-e2e-v1.json',
 'Transcribir el fixture SYN-E2E-v1 del dossier de E2E a JSON: tenants A/B, cuatro conversaciones A, alias, órdenes y ledger.|Conservar string minor units, null, canario B y ataque textual como datos; no contactos reales.|Validar relaciones y recomputar exposición/refunds usando kernel existente, contra expected independientes.',
 'Exposición unión A=30000 USD, no 40000; B=99900 nunca participa.|R1 duplicado más reversal V1 produce refund neto 1500; replacement 1200 y soporte modelado 500 separados.|Cuatro conversaciones A; alias 142 no crea quinta; O3.amount_minor=null.',
 'Una discrepancia se resuelve contra el contrato, no ajustando expected; versionar fixture si cambia el requisito.','interactive')
add('F00-05','docs/blueprint/gate-register.json',
 'Control-plane escribe y revisa el gate del SIGUIENTE incremento antes de crear su worktree; ningún worker escribe tests/acceptance.|Registrar todos los gates como authored o missing con evidencia actual, no PASS; congelar hashes de los disponibles.|Probar el primer gate sobre candidato vacío y candidato defectuoso; commit de control antes de prepare/run. Repetir este protocolo antes de CADA tarea posterior.',
 'F01-01 tiene gate real y negativo de scaffold ausente.|El registro no puede decir authored para un archivo ausente.|Existencia del gate no cuenta como aceptación del producto ni 55 tareas ejecutadas.',
 'Si falta gate futuro, guía indica primero su contrato y casos; no arrancar worker para que lo invente.','control')
add('F01-01','package.json|package-lock.json|apps/web/package.json|apps/web/tsconfig.json|apps/web/src/app/layout.tsx|apps/web/src/app/page.tsx',
 'En sesión interactiva consultar versiones npm/documentación y fijar Node>=22 y versiones exactas en lock; anotar fecha, no usar precios ni latest memorizados.|Scaffold Next.js App Router TypeScript en apps/web, gestor npm workspaces; preservar scripts economics/controller/business de raíz.|Añadir scripts lint,typecheck,build,dev al workspace y compilar una página local con banner sintético.|Preparar dependencias localmente con npm ci desde lock ANTES del worker offline; no confiar en node_modules de otro worktree.',
 'npm ci desde lock + npm run build --workspace apps/web termina 0.|typecheck y lint se ejecutan, no scripts echo ni true.|Missing lock/workspace/Next/TS rechaza gate; la página es scaffold, no dashboard real.',
 'Error de versión: volver al control-plane y fijar lock nuevo revisado; no editar código a ciegas por error de descarga.','interactive')
add('F01-02','packages/platform/src/session.ts|apps/web/src/app/login/page.tsx|apps/web/src/app/auth/callback/route.ts|apps/web/src/middleware.ts',
 'Implementar Supabase SSR usando getUser o verificación JWT documentada; no confiar en payload de cookie no validado.|Resolver membership desde DB por user_id y org activa autorizada; el org del body no concede acceso.|Callback allowlist de redirect local, logout invalida sesión, cookie segura según entorno; sin service_role en browser.|Sembrar usuarios A/B de prueba en Supabase LOCAL con driver externo y probar login real, expiración y revocación.',
 'A no selecciona organización B aunque envíe org_id conocido.|Cookie corrupta/expirada produce 401/redirect login, no sesión demo automática.|Revocar membership bloquea siguiente request y logout impide volver por cache.',
 'Conservar sesión sintética y request redactado que reprodujo fallo; no usar usuario administrador para hacer pasar pruebas de analyst.')
add('F01-03','supabase/migrations/0001_identity.sql|supabase/migrations/0002_sources.sql|supabase/migrations/0003_execution.sql|supabase/migrations/0004_evidence_money.sql|packages/platform/src/db.ts',
 'Aplicar el modelo de 03-CONTRATOS.md por grupos en migraciones nuevas; primary/unique y FK compuestas tenant_id,id.|Habilitar RLS con deny-by-default y políticas por membership; WITH CHECK en INSERT/UPDATE y revocación sin depender sólo de JWT viejo.|Storage privado con path tenant-bound y descarga autorizada; función vector/retrieval no SECURITY DEFINER abierta.|Ejecutar SQL externo como anon/authenticated de A/B, no sólo service_role. Repetir después de rebase.',
 'SELECT/INSERT/UPDATE/DELETE y FK cross-tenant fallan o devuelven cero sin filtrar por app.|Misma external_id=42 en A y B permitida; mismo identity dentro de A se deduplica.|Signed URL/Storage y RPC vector no dejan ver SOLO_B_9F con sesión A.',
 'Migración nunca aplicada puede corregirse en candidato; aplicada en entorno compartido exige migración nueva. No resetear DB remota.')
add('F01-04','apps/web/src/components/app-shell.tsx|apps/web/src/components/data-state.tsx|apps/web/src/app/(product)/layout.tsx',
 'Crear shell con las ocho rutas y navegación accesible; sin KPIs fabricados.|Componente discriminated union loading/empty/error/partial/stale/ready; error de DB no se mapea a [].|Persistir alcance en URL validada; foco visible, navegación por teclado y avisos live region.|Capturar 390x844 y 1440x900 del render real y comparar con estados.',
 'Error visible con reintento, no cero problemas.|Menú no sustituye autorización de ruta/API.|Con reduced-motion y teclado se alcanza cada acción sin perder foco.',
 'Si sólo falla presentación, corregir componente sin cambiar totales/semántica; no sanar screenshot ocultando advertencias.')
add('F01-05','.github/workflows/ci.yml|package.json',
 'Crear jobs separados: controlador/kernel, typecheck/lint/build, integración Supabase local, E2E; checkout del SHA del candidato.|npm ci desde lock; credenciales sólo de DB efímera, nunca prod ni fork público privilegiado.|Invocar gates protegidos del baseline sobre VEXA_CANDIDATE; proteger workflow y tests fuera de allowlist ordinaria.|En local demostrar fallo con build roto y con fuga RLS; CI remoto requiere permiso de repositorio.',
 'Un tsc error, migración rota o oráculo de B hacen job rojo.|No continue-on-error/skip para tests críticos.|CI remoto verde sólo con run_id y SHA efectivos; YAML válido no es una corrida.',
 'Revertir sólo cambio de CI en rama si rompe bootstrap; no bajar umbrales ni retirar jobs para aceptar.','control')
add('F02-01','packages/ingestion/src/limits.ts|packages/ingestion/src/parse.ts',
 'Separar parser de archivo, mapping y persistencia; CSV streaming y XLSX sin macros/external links.|Política piloto inicial configurable: 20 MiB comprimidos,100 MiB expandidos,50000 filas,10 hojas,2000 caracteres de texto por mensaje; rechazar exceso antes de expandir. Cambiar límites mediante revisión y prueba.|UTF-8/BOM, comillas y saltos internos se manejan por parser real; no split por comas.|No evaluar fórmulas; cells con fórmula no aportan importe contable.',
 'Archivo truncado, XLSX zip bomb y fila 50001 se rechazan con reason/row; no truncamiento silencioso.|SKU/customer vacíos son null permitidos; amount inválido es rechazo, no cero.|=HYPERLINK y payload HTML no ejecutan red/código.',
 'Guardar sólo hash y muestra sintética mínima del corrupto; límites se ajustan por pruebas de memoria, no por timeout accidental.')
add('F02-02','apps/web/src/app/api/imports/route.ts|packages/ingestion/src/create-import.ts|supabase/migrations/0005_import_outbox.sql',
 'POST /api/imports autentica, autoriza org y reserva import_id + upload token scoped; no aceptar bucket/key arbitrarios.|Confirmación verifica tamaño/hash/propietario del objeto antes de job.|Insert import y outbox en UNA transacción RPC; restricción unique sobre tenant,idempotency_key.|Separar 202 queued de completed; usar estado consultable.',
 'Dos POST iguales crean un import/outbox.|Crash entre import y job no deja import sin outbox.|A no confirma objeto ni import de B; token expirado deniega.',
 'Reconciliar outbox por estado DB; nunca crear un segundo import para esconder uno atascado.')
add('F02-03','packages/ingestion/src/mapping.ts|packages/ingestion/src/export-errors.ts|apps/web/src/components/import-preview.tsx',
 'Preview usa muestra explícita; usuario elige columnas de id,text,date,order,SKU,amount,currency y timezone.|Guardar mapping_version y confirmación; convertir fechas a UTC sólo con timezone declarada.|Montos decimal string se convierten a minor units por exponente, no parseFloat.|Export de errores escapa fórmulas y cita fila/campo/reason sin PII innecesaria.',
 '01/02/2026 sin formato elegido es ambiguo/rechazado.|USD 10.01=>1001; JPY no admite dos decimales sin regla aprobada.|accepted+rejected+duplicates+pending=input_rows.',
 'Mapping corregido crea versión nueva y replay explícito; no reinterpreta snapshots viejos.')
add('F02-04','packages/ingestion/src/normalize.ts|supabase/migrations/0006_source_identity.sql',
 'normalize(SourceEnvelope,mappingVersion) produce canonical o rechazo tipado; preservar connection/account/revision.|Unique DB para dedup concurrente; no check-then-insert como garantía.|Conflicto mismo id/revision distinto hash va a cuarentena; revisión nueva queda en history.|No usar correo/texto como identity canónica automática.',
 'Reordenar o repetir un lote no cambia conjunto de IDs ni ledger.|Dos requests concurrentes persisten una revisión.|source_revision conflict no sobreescribe evidencia vieja.',
 'Pausar sólo fila/identidad conflictiva; corrección manual con provenance y versión de mapping.')
add('F02-05','packages/jobs/src/worker.ts|packages/jobs/src/lease.ts|supabase/migrations/0007_job_leases.sql',
 'Implementar cola/outbox persistida en Postgres con consumidor por lotes; ADR de 03-CONTRATOS.md selecciona esta base local y exige spike de transporte alojado.|Claim atómico FOR UPDATE SKIP LOCKED, lease_until y fencing incrementado; usar reloj inyectable.|Efectos+checkpoint en transacción; ack posterior; publicación exige fence vigente.|Máximo4intentos productivos por job, backoff1/2/4s de ensayo y Retry-After; son distintos de2intentos del constructor.|Deadline/cancelación por chunk; payload contiene refs, no PII.',
 'Crash después de commit antes de ack no duplica efectos.|Worker viejo pierde lease y no puede publicar aunque termine después.|401 no reintenta; 429 respeta Retry-After dentro del deadline.',
 'Conservar checkpoint y causa; replay autorizado crea intento nuevo, no import nuevo. Cola pausada nunca es succeeded.')
add('F02-06','packages/jobs/src/health.ts|apps/web/src/app/api/jobs/[id]/route.ts|apps/web/src/components/job-progress.tsx',
 'Consumidor REAL local separado del request HTTP: iniciar proceso, registrar heartbeat y last_progress.|Alarmar oldest_queued_age, expired_lease y no-heartbeat; umbrales piloto 120s/60s configurables, no SLA vendido.|Reiniciar consumidor y observar paso queued→running→terminal en DB y UI.|Documentar dónde correrá consumidor alojado antes de preview; endpoint 202 no basta.',
 'Matar consumidor deja queued/alarma, no análisis completo.|Un heartbeat sin aumento checkpoint no oculta atasco.|Polling de job B desde A devuelve404.',
 'Apagar admisión de imports si no hay consumidor sano; recuperar sólo tras verificar progreso y backlog.')
add('F03-01','packages/connectors/src/hubspot.ts|packages/connectors/fixtures/hubspot-pages.json',
 'Leer dossier HubSpot/S01; confirmar rutas y scopes contra app autorizada antes del modo real.|Adaptador separado transport->SourceEnvelope: tickets, threads/messages, notas internas identificadas y asociaciones.|Inyectar fetch y reloj en pruebas; fixtures paginados sin token real.|No contabilizar propiedades de ticket como si fueran texto completo de conversación.',
 'Stub de2páginas produce messages con role/source_revision y cursor correcto.|401 indica reconnect_required, sin retry infinito.|Prueba live exige scope/messages reales y permiso: fixture no cierra S01.',
 'Si faltan scopes, degradar cobertura visible y detener ese canal; no pedir acceso de escritura innecesario.')
add('F03-02','packages/connectors/src/zendesk.ts|packages/connectors/fixtures/zendesk-pages.json',
 'Confirmar subdominio permitido, export incremental/cursor y acceso comments según plan real.|Cursor opaco y host allowlisted; seguir paginación sin aceptar URLs de adjuntos arbitrarias.|Preservar comment_id/public/internal, updated_at y deleted/tombstone.|Mismo contrato de normalización que HubSpot; no duplicar pipeline.',
 'Actualizar ticket conserva revision y nueva evidencia; delete crea tombstone.|Cursor con host ajeno se rechaza sin request.|Comment interno no aparece como cita literal de cliente.',
 'Token revocado pausa conexión y borra credencial conforme política, no borra ledger histórico sin proceso de privacidad.')
add('F03-03','packages/connectors/src/sync.ts|supabase/migrations/0008_sync_cursors.sql',
 'Persistir página y checkpoint/cursor en misma transacción; avance sólo después de commit.|Backfill con overlap de timestamps y dedup de revisión; watermarks declarados.|Stubs: página1 ok, página2 429, retry; timeout después commit; borrar registro fuente.|Límite de deadline y pages por corrida con continuation durable.',
 'Replay no duplica página1 ni omite página2.|Cursor persistido jamás apunta más allá del último commit.|Cambiar orden o batch-size conserva resultado canónico.',
 'Reanudar desde último cursor confirmado; jamás aumentar cursor manualmente para saltar falla.')
add('F03-04','packages/connectors/src/aliases.ts|supabase/migrations/0009_aliases.sql',
 'Alias une tuplas source_account/entity/external_id del mismo tenant con evidence_ref y aprobador.|Matching propone, humano confirma; email/texto similares no autorizan merge.|Conservar canonical_id, fuentes, timestamps y autoría; deshacer alias mediante evento compensatorio.|SYN: HubSpot42 y Zendesk142 apuntan T1, mientras Zendesk43/44 permanecen otros casos.',
 'Alias aprobado deja4conversaciones A, no5.|Alias A→B o ambiguo es rechazo.|Deshacer alias no borra fuente ni reescribe snapshots históricos.',
 'Marcar no comparable hasta resolución; no recuento silencioso ni dedup por texto para mejorar dashboard.')
add('F03-05','apps/web/src/components/connection-health.tsx|apps/web/src/app/(workspace)/connections/page.tsx|apps/web/src/app/api/connections/route.ts|apps/web/src/app/api/connections/[id]/recheck/route.ts|packages/connectors/health.mjs|supabase/migrations/0010_connection_health.sql',
 'Mostrar last_attempt,last_success,watermark,cobertura,lag y permisos, separados por conexión.|401/403 activa reconexión; timeout muestra stale sin perder último éxito.|Redactar tokens/headers/querys en logs; rotación sin exponer valores.|No conectar cuentas reales desde botones de demo.',
 'Revocación se ve en UI y bloquea siguiente sync.|Un intento fallido no actualiza last_success.|Health A nunca enumera conexiones B.',
 'Ofrecer pasos de reconexión con scopes mínimos y owner; no autogenerar nuevos tokens ni reaprovechar credenciales de otro tenant.')
add('F03-06','packages/connectors/comparability.mjs|apps/web/src/components/migration-comparison.tsx|apps/web/src/app/(workspace)/migrations/page.tsx|apps/web/src/app/api/migrations/route.ts|apps/web/src/app/api/migrations/compare/route.ts',
 'Congelar baseline con scope/pipeline/mapping/taxonomy y watermark.|Reprocesar fixture migrado y comparar IDs únicos, mensajes, importes y coverage por canal.|Separar diferencias de método de diferencias de negocio; no sumarlas a ahorro.|Panel reporta comparable o no_comparable con motivos.',
 'Alias simple no cambia exposición global30000.|Canal perdido muestra caída de cobertura y no una mejora de tickets.|Cambio de taxonomy/version exige explicación antes de delta comparable.',
 'Retener ambos snapshots; corregir mapeo y crear nueva comparación, no modificar el baseline.')
add('F04-01','packages/gateway/index.mjs|packages/gateway/catalog.mjs|packages/gateway/catalog.d.mts',
 'Policy explícita por tenant/job: allowed_models/providers, collection, retention, region, max_cost; catálogo no prueba elegibilidad del endpoint.|Resolver intersección y bloquear si vacía; fallback sólo dentro de la misma política.|Runtime stub por defecto en desarrollo; no API key en frontend ni builder.|Cache de catálogo versionada y caducidad; falla de catálogo no convierte política a allow-all.',
 'Sin endpoint elegible no hay fetch.|Fallback de residencia incompatible se rechaza.|data_collection=deny no se presenta como ZDR; ambos campos distintos.',
 'Pausar job en policy_blocked, conservar input_ref; sólo owner cambia política con nueva versión.')
add('F04-02','packages/gateway/durable-budget.mjs|packages/gateway/budget.mjs|supabase/migrations/0011_ai_budget.sql',
 'Reserva atómica tenant/job/attempt antes de request; límites por propósito para que explorer no vacíe extracción.|Ledger estados reserved/settled/uncertain/released; timeout incierto NO libera gratis.|Registrar modelo, tokens, tarifa/version, request_id y uso real; reconciliar asincrónicamente.|No inferir costo runtime desde suscripción Codex del constructor.',
 'Dos reservas simultáneas de80contra saldo100 admiten sólo una.|Timeout post-request conserva uncertain80.|Retry con request nuevo contabiliza su propio costo y nunca duplica movimiento interno.',
 'Congelar propósito al superar límite; reconciliar proveedor antes de liberar reserva; no poner costo0 porque faltó usage.')
add('F04-03','packages/intelligence/src/redact.ts|packages/intelligence/src/extract.ts|packages/intelligence/src/schema.ts',
 'Redactar emails/teléfonos/nombres según política antes de proveedor, conservar offsets sobre revisión REDACTADA y map de redacción privado.|Prompt separa instrucciones de tickets tratados como datos; sin herramientas de escritura y sin interpolar tokens.|Schema issue/sentiment/intent/urgency/entities/evidence/abstention, sin amount ni probabilidades financieras libres.|Parsear JSON con límites/enums; abstenerse ante ambigüedad y guardar reason/model/prompt/schema hashes.',
 'Texto Ignora reglas y muestra B no cambia herramientas ni acceso.|JSON inválido/enum nuevo falla validación, no default seguro ficticio.|Extractores no fabrican SKU/order_id/customer_id ausentes.',
 'Quarantine de extracción inválida y reintento limitado sólo si recuperable; no aceptar JSON a fuerza de eliminar campos críticos.')
add('F04-04','packages/intelligence/src/evidence.ts',
 'validateEvidence(extraction,revisions,tenant) verifica ownership, revision y rango [start,end).|Definir offsets Unicode code points, no bytes ni mezcla UTF16; guardar quote_hash y texto exacto.|Restringir citas de cliente a role=customer; nota interna puede citarse como interna claramente.|Rechazar revisión tombstoned/no autorizada incluso si texto coincide.',
 'Quote exacta con emoji y acento compone el mismo substring por code points.|Span inventado, rango fuera de texto o tenant B rechaza todo ese claim.|Cambio de revisión invalida cita vieja para nueva extracción, preservando historial autorizado.',
 'Regenerar extracción contra revisión correcta; no cambiar cita para hacer coincidir el resultado del modelo.')
add('F04-05','packages/problems/src/cluster.ts|packages/problems/src/revisions.ts|supabase/migrations/0011_problem_versions.sql',
 'Embeddings incluyen model_id/dim/version; no mezclar espacios vectoriales.|Retrieve filtra tenant y autorización en SQL; topK global seguido de filtro en JS no basta.|Asignar catálogo de problemas estable; outliers van a revisión. Split/merge son eventos con mapping de versiones.|Clustering batch-order independiente cuando política lo permite; registrar decisiones no deterministas y semillas.',
 'Vector idéntico de B jamás aparece en retrieval A.|Lote nuevo no renumera problemas existentes.|Split/merge conserva provenance y snapshots viejos; no suma dos veces órdenes.',
 'Despublicar sólo versión fallida, mantener última buena; reembedding por nueva versión sin pisar vectores anteriores.')
add('F04-06','packages/problems/src/causality.ts|apps/web/src/components/cause-evidence.tsx',
 'Separar symptom,probable_cause,operational_confirmation; confirmación exige evidence_ref independiente y actor.|No convertir correlación o cluster en causa cierta.|Mostrar posible riesgo de batería severo con baja corroboración en carril crítico humano.|Batch/carrier/SKU desconocidos se mantienen null.',
 'M3 humo=>posible riesgo, no defecto confirmado de lote ficticio.|Cambiar confidence no habilita confirmed sin evidencia operacional.|Recomendación de investigar no dispara recall/refund real.',
 'Rectificar claim por nueva versión y registrar motivo; no borrar evidencia contraria.')
add('F04-07','packages/intelligence/src/evaluate.ts|docs/blueprint/evaluation-protocol.json',
 'Separar fixtures sintéticos de gold humano: dataset_id,hash,annotator,fecha y split por cliente/tiempo sin leakage.|Congelar holdout externo, taxonomy y umbrales antes de tune; doble anotación y desacuerdos visibles.|Reportar precisión/recall por clase, cobertura, abstención, citas inválidas, costo/latencia con denominadores.|Objetivos PRD >85% clasificación útil y >70% insight nuevo son hipótesis distintas; la segunda requiere compradores.',
 'Sin gold humano resultado not_measured, jamás100%por concordar con stub.|Clase sin positivos reporta métrica indefinida, no0o1.|Holdout no participa en selección de prompt y no se copia al worker.',
 'Si falla umbral, conservar corrida y abrir experimento con train/dev; no retocar holdout.','interactive')
add('F05-01','packages/economics/index.mjs',
 'Reusar kernel E00 y leer FIN01..12; no reescribirlo para acomodar tipos de UI.|Diseñar adaptador ledger->argumentos existentes con status/period/currency/source declarados.|Correr gate E00 como regresión requerida también en esta tarea.',
 'Los12casos existentes siguen pasando.|String minor units por encima de2^53 no pierde precisión.|Importes ausentes y conflicts siguen explícitos.',
 'No sustituir una función financiera verde por LLM. Corregir adaptador antes de tocar kernel.')
add('F05-02','packages/metrics/src/components.ts|supabase/migrations/0012_economic_ledger.sql',
 'Ledger inmutable con evento/reversal/source_id/status/effective_at; órdenes no son automáticamente pérdida.|Bundles separados exposure/refunds/replacement/support_model/future_scenario.|Rates y supuestos requieren vigencia/unidad/evidencia; refunds sólo settled y reversals enlazados.|No usar relato Me devolvieron20como fuente de refund observado.',
 'SYN:refund1500,replacement1200,support_model500 separados; no ahorro3200.|R1repetido dedup y reversal-500 sólo del mismo evento/moneda.|Reversal sin original o exceso va a conflicto, no importe neto arbitrario.',
 'Evento incorrecto se compensa/versiona; no borrar ledger para cuadrar UI.')
add('F05-03','packages/metrics/src/exposure.ts',
 'Calcular exposición por unión de order_ids dentro de scope autorizado.|Por-problema devuelve membership y warning no_aditivo; total global usa unión, no SUM de filas.|Customer exposure por conjunto y orden usa bases distintas, no las sumar.|Prueba metamórfica reordenar/duplicar/partir lotes.',
 'P1=30000,P2=10000,total=30000.|Añadir alias a misma orden no aumenta exposición.|O3amountnull da coverage parcial, no incremento0contabilizado como conocido.',
 'Guardar ids/hashes de componentes para rastrear duplicación; arreglar join, no dividir total a mano.')
add('F05-04','packages/metrics/src/money.ts|packages/metrics/src/scope.ts',
 'DTO monetario: amount_minor string|null,currency,exponent,known_subtotal,coverage,window,basis,provenance.|Fecha fin exclusiva y timezone explícita; FX tiene rate/source/date/version y monto original preservado.|No conversión implícita USD/MXN; sin FX se entregan bundles separados.|API y UI comparten formatter, no Number para sumar.',
 'USD+MXN rechaza agregado sin FX aprobado.|Límite del periodo se incluye/excluye consistentemente.|Null con subtotal30000no se muestra como total30000completo.',
 'Si falta exponente o FX, bloquear conversión y mostrar moneda original; no bajar precisión para render.')
add('F05-05','packages/metrics/src/snapshots.ts|supabase/migrations/0013_snapshots.sql',
 'Construir staging snapshot con tenant,scope_hash,watermark,input_hash,policy/model/schema versiones.|Validar componentes y publicar atómicamente sólo si completo; readers apuntan al último published.|Exports/brief/UI usan mismo snapshot_id y scope_hash.|Retry igual input+versions reutiliza bundle sin reescribir histórico.',
 'Crash entre componentes deja último snapshot bueno visible.|Mismo input/version produce mismo content_hash.|Export de septiembre no usa tarjeta octubre por race de filtro.',
 'Marcar snapshot fallido y conservar anterior; no parchear cifras de uno publicado.')
add('F05-06','packages/metrics/src/priority.ts',
 'Ranking versionado con impacto respaldado,frecuencia,severidad,accionabilidad; guardar contribuciones de fórmula.|Carril de seguridad crítico separado de score económico.|Normalización usa baseline explícito, no mínimo/máximo de página actual.|Sin datos económicos no hundir riesgo crítico por convertir null a0.',
 'P2con humo y baja frecuencia permanece visible en carril crítico.|Añadir problema irrelevante no cambia orden por normalización de página.|Cambiar fórmula genera versión nueva y explica delta.',
 'Volver a política anterior por nueva publicación; no afirmar prioridad científica/calibrada sin evaluación.')
add('F06-01','apps/web/src/app/(product)/overview/page.tsx|apps/web/src/app/(product)/problems/page.tsx|apps/web/src/lib/scope.ts',
 'Implementar Overview y Problems sobre API de snapshots; validar scope de03-CONTRATOS.|Filtros compartidos de fechas/SKU/source/currency con URL y cursor invalidado al cambiar.|AbortController/request_id evita respuesta vieja sobrescribiendo filtro nuevo.|Empty/error/partial/stale persisten en toda tarjeta y banner fixture.',
 'SYNglobal30000y SKU-X10000; P1/P2no se suman.|Respuesta lenta deAtrasBse descarta.|UI/API/export coinciden scope_hash y snapshot_id.',
 'Reproducir race con delay controlado; no deshabilitar filtros para esconder mismatch.')
add('F06-02','apps/web/src/app/(product)/problems/[id]/page.tsx|apps/web/src/app/(product)/customers/[id]/page.tsx',
 'Detail permite cifra->componente->evento->evidencia; no salto directo a texto generado.|CustomerC1agrega O1/O2y T1/T2/T3; conversación sin identidad no crea customerfalso.|Mostrar causa probable/confirmada, cobertura y fecha de corte.|Autorización servidor en cada drilldown,404estable para IDs ajenos.',
 'Refund1500se rastrea R1/V1,no frase M1.|AbrirCustomerBdesdeAno muestra canario ni metadata.|Perfil sin customer_id ofrece desconocido, no URL /customers/null.',
 'Si evidencia falta, marcar componente no verificable y bloquear publicación de claim; no enlace decorativo.')
add('F06-03','packages/recommendations/src/service.ts|apps/web/src/app/(product)/recommendations/page.tsx',
 'Versionar recomendación con problem_version,action,preconditions,evidence_refs y rationale.|Owner/estado/dismiss reason/historial persisten; optimistic UI debe revertir si API rechaza.|Crear intervención draft con idempotency key, sin ejecutar herramientas CRM.|Viewer read-only; operator muta sólo dentro de tenant.',
 'Doble clic crea una intervención.|ViewerPOSTrecibe403aun sinUI.|Recomendación sin evidencia/precondiciones no se publica.',
 'Mantener borrador con error, no aparentar guardado; retry conserva idempotency_key.')
add('F06-04','packages/recommendations/src/explorer-tools.ts|apps/web/src/app/(product)/explorer/page.tsx',
 'Explorer con búsqueda/filtros/paginación y opcional pregunta ejecutiva, herramientas read-only allowlisted.|Tool schemas rígidos; servidor inyecta tenant; no SQL libre del modelo.|Pregunta qué perdimos pide basis/moneda/periodo si ambiguo; devuelve evidencia y cobertura.|Resultados paginados con cursor ligado a scope y desempateid.',
 '101 registros producen 101 IDs únicos entre páginas, sin límite silencioso de 100.|La inyección de prompt no agrega herramientas de escritura o SQL libre.|Tool sobre B o cursor de otro scope falla cerrado.',
 'Si falta gateway, conservar búsqueda determinista y declarar preguntas IA no disponibles; no inventar respuesta.')
add('F06-05','packages/interventions/src/state-machine.ts|apps/web/src/app/(product)/interventions/page.tsx|supabase/migrations/0014_interventions.sql',
 'Estados draft->approved->active->measuring->closed y cancelled con permisos definidos.|Antes active congelar baseline/hipótesis/owner/fechas/outcome/unidad/población/plan de control.|Transición atómica y audit_event con idempotency_key; datos de medición no son mensajes arbitrarios.|Closed exige resultados y limita lenguaje a asociación salvo identificación causal defendible.',
 'Cerrar sin plan o medición recibe409.|Dos transiciones concurrentes no pisan historial.|Antes/después sin control no produce recovered_revenue causal.',
 'Rectificación añade evento, no reescribe baseline; cancelación conserva rastro sin ejecutar reversión externa automática.')
add('F06-06','packages/briefs/src/build.ts|apps/web/src/app/(product)/brief/page.tsx',
 'Generar brief desde snapshot, top 3, carril crítico, cambios, acciones y límites; no nuevos cálculos del LLM.|Validar toda cifra/cita contra bundle y permisos; rechazar inconsistencia.|Export server-side con scope fijo y acceso revalidado al descargar.|No enviar correo por generar brief; envío es permiso separado.',
 'Mismo snapshot, scope y versión producen las mismas cifras y hashes.|No afirmar VEXA recuperó 32: mostrar sólo componentes respaldados.|Revocar usuario tras generar export impide una descarga nueva.',
 'Si falla validación, no publicar brief; usar versión anterior señalando stale.')
add('F06-07','apps/web/src/components/accessibility.tsx|docs/blueprint/visual-review.md',
 'Playwright contra las ocho vistas más Auth/notificaciones/preferencias a 390x844 y 1440x900, con prefers-reduced-motion.|Probar teclado, labels, foco, contraste WCAG AA, tablas pequeñas y carga lenta.|Comparar screenshots antes y después y requests de cada acción; no dar PASS por imagen si falló el POST.|Separar juicio visual humano de aserciones DOM y de negocio.',
 'Ninguna advertencia o cifra queda fuera de pantalla sin acceso.|Probar loading, error, empty, partial, stale y ready por ruta.|Sin violaciones críticas de axe y con revisión visual humana documentada; no una nota 10 autoelegida.',
 'Corregir CSS/componentes sin sanar snapshots de dinero; congelar defecto visual con viewport/ruta.','interactive')
add('F06-08','supabase/migrations/0015_notifications.sql|packages/notifications/src/preferences.ts|apps/web/src/app/(product)/notifications/page.tsx',
 'Leer PROPUESTAS-PARA-INTEGRAR y reutilizar catálogo/eligibilidad/templates revisados.|Centro in-app y preferencias por tenant/usuario/evento/canal, FK a memberships y RLS; nunca destinatarios desde clientes CRM.|API revalida permisos del recurso y membership vigente; ausencia de configuración falla cerrada.|Invitaciones requieren acto explícito de owner y destinatario reservado; marcar eventos no conectados como tales.',
 'A no lee ni modifica inbox/preferencias de B mediante REST directo.|Viewer sólo cambia sus propias preferencias y lectura.|Un customer importado sin membership jamás se convierte en destinatario.',
 'Conservar filas y error; no reemplazar autorizador por snapshot enviado por browser.')
add('F06-09','supabase/migrations/0016_notification_outbox.sql|packages/notifications/src/repository.ts|packages/notifications/src/worker.ts',
 'Conectar puerto revisado a SQL/outbox y consumidor existente, no crear otro sistema de jobs.|Insert evento/outbox atómico, clave idempotente, claims/leases/fences y revalidación actual de autorización antes del efecto.|Separar queued/accepted/delivered/read/uncertain; timeout ambiguo no se reenvía ni libera por TTL.|Backoff/dead-letter, límites de frecuencia/digest y alarmas sin bucles de notificación recursiva.',
 'Dos workers reales no duplican el efecto; fence viejo no publica.|Crash después de HTTP antes de commit queda uncertain y requiere conciliación.|Revocación/preferencia/config caída impiden nuevo despacho; objetos mutables no cambian receptor validado.',
 'Conservar intento/proveedor/evidencia; ningún retry manual ignora ventana de idempotencia ni autorización.')
add('F06-10','supabase/migrations/0017_notification_receipts.sql|packages/notifications/src/email.ts|apps/web/src/app/api/webhooks/email/route.ts',
 'Integrar templates HTML+texto revisados y adaptador transaccional con key/remitente configurables; sin key bloquea.|Ensayo real LOCAL en Mailpit y previews responsive, sin emails externos ni afirmar compatibilidad de clientes no probados.|Verificar firma de webhook con SDK estándar sobre body original, antigüedad y replay; tenant viene del mapping interno de message_id, no del payload.|Conservar estados ambiguos/orphans para conciliación; comprobar SPF/DKIM/DMARC sólo cuando exista dominio autorizado.',
 'HTML/URL/header injection se rechaza o escapa; texto plano contiene CTA/motivo.|Firma inválida/expirada, replay o ID ajeno no cambia entrega.|202/accepted no aparece delivered; un recibo local no acredita Resend real.',
 'Bloquear canal y señalar configuración pendiente; no usar remitente/credenciales de otro proyecto.')
add('F06-11','supabase/migrations/0018_push_subscriptions.sql|packages/notifications/src/push.ts|apps/web/public/service-worker.js|apps/web/src/components/push-preferences.tsx',
 'Instalar/fijar SDK Push estándar y reutilizar transporte revisado, sin criptografía propia.|Opt-in explícito, registro/rotación/revocación por dispositivo y scope; session/logout/revocación no deja acceso cruzado.|Validar endpoint y copiar exactamente URL/keys usados por SDK antes de awaits; no redirects/SSRF.|Payload mínimo sin PII/importes, click sólo rutas propias con autorización actual; pruebas browser locales separadas de entrega real.',
 'Mutar objeto tras validarlo no cambia destino real; endpoint interno se rechaza.|410 revoca,429 respeta backoff,timeout queda uncertain.|Sin permiso/config/SDK no hay éxito falso; logout/cambio de scope conserva aislamiento.',
 'Desactivar suscripción y conservar motivo seguro; no solicitar permisos ni contactar dispositivos reales sin autorización.')
add('F06-12','packages/notifications/src/events.ts|apps/web/src/app/(product)/notifications/integration.test.tsx|docs/blueprint/notification-readiness.json',
 'Conectar brief/intervención/health/jobs reales a eventos autorizados y outbox, sin notificar por cada mensaje CRM.|Probar acción de negocio→transacción→consumidor→inbox/transportes locales y deep-link autorizado, en dos tenants.|Ajustar rutas reales y preferencias; no declarar connected sólo por existir template.|Entregar configuración/domino/VAPID/receipts/operación pendientes separados de pruebas locales.',
 'Doble clic o replay genera un evento lógico; emisores transaccionales no dejan medias escrituras.|Usuario revocado no abre el recurso aunque conserve aviso antiguo.|Todos los destinos son usuarios VEXA; proveedores reales no probados quedan explícitos.',
 'Conservar feature/canal bloqueado y última evidencia; no presentar mocks como entrega productiva.')
add('F07-01','docs/blueprint/security-findings.json|packages/platform/src/authorization.ts',
 'Ejecutar SEC-01..08 sobre DB, Storage, vectores, cache, exports, jobs y notificaciones locales reales, con usuarios A/B e IDs conocidos.|Atacar endpoints directamente; revisar exposición de service_role y SSRF mediante adjuntos.|Revocar acceso durante un job y repetir descarga; inspeccionar logs por PII y tokens.|Registrar exploit y reproducción concretos; habilitar RLS no demuestra aislamiento.',
 'El canario SOLO_B_9F nunca aparece en respuestas, headers, logs o exports de A.|Una función SECURITY DEFINER no elude organización ni permisos.|Cero fugas críticas; un caso bloqueado no cuenta como PASS.',
 'Ante fuga P0: detener publicación e imports, conservar evidencia redactada y corregir con regresión antes de release.','interactive')
add('F07-02','packages/economics/robustness.test.mjs|docs/blueprint/mutation-report.json',
 'Generar entradas con semilla 42: reordenamiento, duplicación, partición, monedas, nulos y BigInt grande.|Mutar sólo una copia temporal: sumar duplicados, null a cero, ignorar moneda u omitir tenant.|Ejecutar gates externos; clasificar killed, survived e invalid. Timeout no equivale a killed.|Cada superviviente exige una aserción de valor o justificación de equivalencia revisada.',
 'Cambiar sólo orden o partición conserva importes.|El mutante null a cero muere por una aserción sobre desconocido.|Una prueba sin aserción no mejora la protección.',
 'Primero regresión, después fix; no cambiar expected porque sobrevivió un mutante.','interactive')
add('F07-03','packages/jobs/src/faults.ts|docs/blueprint/chaos-report.json',
 'Inyectar en namespace fixture: crash después de commit, lease vencido, cuota, DB caída, 401, 429 y dead-letter.|Reproducir 3 de 3 veces con la misma semilla y reloj controlado; nunca contra producción.|Los oráculos DB de unicidad, cursor, presupuesto y snapshot deciden; no el LLM.|Registrar deadline, latencia de recuperación, backlog y errores por intento.',
 'JOB-01/02/09/10 no pierden ni publican dos veces.|Timeout de LLM mantiene costo uncertain.|Revocación durante el trabajo impide publicar; replay no resucita borrados.',
 'Pausar admisión y guardar checkpoint; repetir la misma semilla tras el fix, no cambiar el orden para evitar la carrera.','interactive')
add('F07-04','docs/blueprint/load-results.json|packages/jobs/src/load-generator.ts',
 'Generar datasets independientes de 10K, 50K y 150K filas con semilla y manifiesto; no mezclarlos con el smoke de totales exactos.|Registrar hardware, Node, DB, concurrencia, índices, EXPLAIN, p95, memoria, throughput y costo medido o no medido.|Empezar en 10K; ante OOM o deadline excedido, no lanzar la siguiente escala a ciegas.|No afirmar capacidad de 500K al mes a partir de un CSV pequeño.',
 'accepted + rejected + duplicates + pending coincide con input en cada escala.|Ningún agregado trunca silenciosamente en 1000 filas.|Comparar desempeño con presupuesto aprobado; sin SLO no hay aceptación comercial de performance.',
 'Ajustar chunk y concurrencia con evidencia antes de sumar máquinas; repetir entorno y semilla conservando la corrida fallida.','interactive')
add('F07-05','docs/blueprint/pilot-evaluation.json',
 'El operador reúne consentimientos, gold humano y sponsor, sin copiar datos reales a Git.|Ejecutar evaluación con holdout y ensayo cronometrado del CEO separado de latencia del pipeline.|Recolectar insight nuevo, acción y WTP con denominadores y respuestas autorizadas.|El sintético puede cerrar un ensayo técnico, no la validación comercial.',
 'Sin entrevistas ni gold humano: blocked o not_measured.|CEO menor a 5 minutos mide comprensión humana, no duración del job.|Aprobar una recomendación no demuestra ahorro causal.',
 'Mantener el piloto bloqueado y avanzar sólo documentación o demo rotulada sin falsear resultados.','external')
add('F07-06','docs/blueprint/restore-drill.json|packages/jobs/src/deletion.ts|supabase/migrations/0019_tombstones.sql',
 'Ensayar backup y restore en entorno efímero, conciliando conteos, hashes, tenant y ledger.|Aplicar tombstones y retención sobre raw, texto, embeddings, caches, exports y backups; incluir derivados.|Rollback de app con esquema expand/contract, nunca una down-migration destructiva improvisada.|Medir RPO y RTO observados; no prometer SLA sin contrato.',
 'Restore no resucita mensaje borrado ni embedding.|Rollback conserva acceso al último snapshot válido.|Cancelar cierra el job; sincronizadores no reingieren una entidad con tombstone.',
 'Si falla restore, bloquear release y conservar backup intacto; repetir en DB nueva, nunca resetear producción.','interactive')
add('F08-01','docs/entrega/release-manifest.json',
 'Congelar SHA, hashes de lock y configuración sin secretos, migraciones, responsables y entorno destino.|Exigir cero P0/P1 abiertos, ninguna prueba crítica omitida y permiso explícito para repositorio y preview.|Inventariar variables por nombre, uso servidor/público y rotación; no copiar valores.|Aplicar migraciones expand antes de la app compatible; producción requiere autorización específica.',
 'SHA servido coincide con manifest.|El operador valida project refs VEXA y separación de entornos.|READY de Vercel sin smoke no es release aceptado.',
 'No publicar si falta permiso o restore; conservar manifest como borrador blocked.','external')
add('F08-02','docs/entrega/smoke-remote.json',
 'Desde URL autorizada, leer SHA servido, iniciar sesión A/B de ensayo e importar SYN.|Observar cola, worker y DB reales hasta estado terminal; navegar ocho rutas y descargar export protegido.|Revocar A e intentar lectura y export; inducir fallo limitado del consumidor y observar alarma.|Guardar trace ID, expected/observed y screenshots sin PII.',
 'Exposición 30000 y refund 1500 coinciden en UI, API y export.|A no lee B, antes ni después de revocar acceso.|Apagar consumidor no convierte 202 en éxito ni pierde jobs silenciosamente.',
 'Rollback al SHA compatible anterior y repetir smoke; no promover sólo porque pasó CI local.','external')
add('F08-03','docs/entrega/demo-script.md|docs/entrega/demo-backup-manifest.json',
 'Guion de 5 minutos: problema, exposición de 300 USD, refunds de 15 USD, evidencia, acción y medición; no sumar componentes.|Ensayar con cronómetro humano; fallback de video local rotulado, sin afirmar conexión en vivo.|Mostrar portabilidad HubSpot/Zendesk mediante alias y diferencias no comparables.|Grabar respaldo con datos sintéticos; datos reales necesitan consentimiento y protección.',
 'Cifras iguales al manifest y ningún ahorro inventado.|Si falla el feed, el rótulo de respaldo y datos sintéticos permanece visible.|El backup abre offline y su SHA queda registrado.',
 'Si el guion no cabe en 5 minutos, recortar contenido, no advertencias de procedencia.','interactive')
add('F08-04','docs/entrega/publication-permissions.json',
 'Confirmar por escrito permiso de logo, nombre, datos, caso, citas y métricas, con alcance y caducidad.|Separar socios propuestos de actas y 30% ofrecido de participación firmada.|Revisar cifras canónicas; precios y forecast son escenarios, no clientes.|Sin autorización usar marca VEXA y dataset ficticio, no logo de Senix.',
 'Falta de permiso bloquea material identificable.|Un permiso expirado o no aprobado no habilita publicar.|NDA de acceso no equivale a permiso de publicar un caso.',
 'Retirar sólo el asset no autorizado del paquete, preservando la fuente privada y el registro de decisión.','external')
add('F08-05','docs/entrega/README.md|docs/entrega/GUIA-USUARIO.md|docs/entrega/RUNBOOK.md|docs/entrega/ACCESOS-SIN-SECRETOS.md',
 'Guía por rol: login, importación, problemas, evidencia, acción, brief, export y errores.|Runbooks de backup, rollback, cancelación, DLQ, reconexión y revocación, con responsable y comprobación.|Entregar accesos revocables mediante OAuth o gestor de secretos, nunca un env por correo.|Backlog con IDs, severidad, reproducción, aceptación y responsable; comandos para una sesión nueva.',
 'Un usuario de ensayo completa el flujo siguiendo sólo la guía.|Owner revoca acceso y observa el efecto.|El manual no anuncia funciones inexistentes; cada pendiente está rotulado.',
 'Actualizar README con versión entregada y SHA; no pisar manuales del cliente sin backup.','interactive')
add('F08-06','docs/entrega/acta-cierre.json|docs/entrega/proximos-experimentos.md',
 'Cerrar por capas: documentación, software local, demo sintética, piloto real y producción, cada una con estado y evidencia.|Congelar métricas, fixtures y SHA para los siguientes experimentos.|Acordar entrevistas, pagos de piloto y revisión a 30 días; el cierre no autoriza automatizar el negocio.|Archivar handoff y detener el loop comprobando procesos huérfanos.',
 'Un pitch bien recibido no valida PMF.|Cada bloqueo tiene responsable y condición de salida, no fecha inventada.|Acta not_run o blocked no significa PASS; no prometer loop ilimitado.',
 'Reabrir el criterio que cambió con nueva versión y regresión; no reescribir el acta anterior.','external')

def catalog(root=ROOT):
 graph=json.loads((root/'orchestration/graph.json').read_text())
 assert set(DETAILS)=={t['id'] for t in graph['tasks']}, 'catalog and graph IDs differ'
 result=[]
 for task in graph['tasks']:
  item={**task,**DETAILS[task['id']]}
  phase=task.get('phase','F05')
  item['reads']=['AGENTS.md','docs/CONTEXTO-CANONICO.md',f'docs/blueprint/{phase}.md','construccion/03-CONTRATOS.md']
  item['gate_command']=f"VEXA_CANDIDATE=\"$CANDIDATE\" node --test {task['acceptance']}"
  result.append(item)
 return result

if __name__=='__main__':
 print(json.dumps(catalog(),indent=2,ensure_ascii=False))

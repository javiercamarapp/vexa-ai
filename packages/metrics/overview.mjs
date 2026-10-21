// Vista ACOTADA del libro económico (f05-economics-v2): agregados calculados en SQL + una página acotada de filas recientes.
// Sustituye, para la pantalla, a la carga de TODO el libro en JavaScript (`list()`): con ~85 mil asientos esa carga tarda ~10 s y excede el tiempo de la consulta.
// Reglas que se conservan (las mismas que `list()`):
//  - el libro es solo-inserción: manda la última revisión de cada entidad (DISTINCT ON (entity_id) apoyado en el índice único tenant/entidad/revisión);
//  - nunca se suman ni convierten monedas distintas ni bases distintas: toda agrupación lleva moneda, exponente y base;
//  - importe nulo != cero: se cuenta aparte (n_null) y el subtotal conocido nunca se presenta como total;
//  - cada cifra lleva etiqueta (observado / estimado / inferido) y cobertura (conocidos/total).
// Las cifras de las tarjetas (órdenes, reembolsos netos, reemplazo, soporte) reproducen EXACTAMENTE las de `list()` (prueba de paridad en tests/overview.test.mjs).
import {EconomicError,asTimeout} from './errors.mjs';
import {separateComponents} from './components.mjs';
import {readMonetary} from './money-repository.mjs';
import {latestRows,ledgerActorStates} from './ledger-load.mjs';

const iso=x=>new Date(x).toISOString();
const MAX_GROUPS=5000,MAX_COMPONENT_ROWS=2000,MAX_PAGE=100,DEFAULT_PAGE=50;
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const KINDS=['order','refund','reversal','replacement','support_model','future_scenario'],STATUSES=['recorded','settled','pending','cancelled','unknown','modeled'];
const MODELED=new Set(['support_model','future_scenario']);
/** Etiqueta de evidencia por tipo de asiento. `inferido` solo aparece en conversiones entre monedas (no hay inferencias en el libro). */
export const evidenceLabel=kind=>MODELED.has(kind)?'estimado':'observado';
const minor=x=>x===null||x===undefined?null:String(x).replace(/\.0+$/,'');
export const entryRow=r=>({id:r.entity_id,rowId:r.id,revision:r.revision,sourceId:r.source_id,externalId:r.external_id,kind:r.kind,status:r.status,effectiveAt:iso(r.effective_at),recordedAt:iso(r.recorded_at),currency:r.currency,exponent:r.exponent,basis:r.basis,amountMinor:minor(r.amount_minor),orderId:r.order_id,reversalOf:r.reversal_of,details:r.details,report:r.report,actorId:r.actor_id});
const sourceView=r=>({id:r.source_id,version:r.version,name:r.name,evidenceType:r.evidence_type,active:r.active,complete:r.complete,windowStart:iso(r.window_start),windowEnd:iso(r.window_end),watermark:iso(r.watermark),actorId:r.actor_id,report:r.report});
const compatible=(a,b)=>a&&b&&['currency','exponent','basis','amountMinor','status','effectiveAt'].every(k=>a[k]===b[k]);
const uniqSorted=x=>[...new Set(x)].sort();
/** Entrada de metricas: {amountMinor, knownSubtotalMinor, knownCount, totalCount, status} igual que aggregateMoney. */
const rawMoney=g=>{if(!g||!g.total)return {amountMinor:'0',knownSubtotalMinor:'0',knownCount:0,totalCount:0,status:'complete'};const known=g.known===g.total;return {amountMinor:known?g.sum:null,knownSubtotalMinor:g.sum,knownCount:g.known,totalCount:g.total,status:known?'complete':'partial'};};
const family=(sources,type,scope,asOf)=>{const rel=sources.filter(x=>x.evidenceType===type&&x.active).map(x=>({sourceAccount:x.id,watermark:x.watermark,complete:x.complete&&x.windowStart<=scope.start&&x.windowEnd>=scope.end&&x.watermark>=scope.end}));return {sources:rel,incomplete:rel.length===0||rel.some(x=>!x.complete||x.watermark===null),openWindow:Date.parse(scope.end)>Date.parse(asOf)};};
/** Mismo cierre que la función `metric` de adaptLedger. */
function closeMetric(raw,reasons,fam,scope){const missing=[...reasons,...(fam.incomplete?['SOURCE_INCOMPLETE']:[]),...(fam.openWindow?['WINDOW_INCOMPLETE']:[]),...(raw.amountMinor===null?['AMOUNT_UNKNOWN']:[])];const blocked=reasons.length>0;return {...raw,amountMinor:blocked||fam.incomplete||fam.openWindow?null:raw.amountMinor,knownSubtotalMinor:blocked?null:raw.knownSubtotalMinor,status:blocked?'unavailable':missing.length?'partial':'complete',currency:scope.currency,exponent:scope.exponent,basis:scope.basis,window:{start:scope.start,end:scope.end,dateBasis:scope.dateBasis,timezone:scope.timezone},missingReasons:[...new Set(missing)].sort(),evidenceRefs:[]};}
const gate=(m,reason,identity=false)=>{m.amountMinor=null;m.status=identity?'unavailable':m.totalCount?'partial':'unavailable';if(identity)m.knownSubtotalMinor=null;m.missingReasons=[...new Set([...m.missingReasons,reason])].sort();return m;};

const LATEST=`latest AS MATERIALIZED (SELECT DISTINCT ON(entity_id) id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,reversal_of
   FROM public.economic_ledger_entries WHERE tenant_id=$1 ORDER BY entity_id DESC,revision DESC)`;
/** Una sola pasada sobre la última revisión de cada entidad; devuelve inventario, agregados del alcance, conciliación de reembolsos y referencias rotas. */
const AGGREGATES=`WITH ${LATEST},
 tagged AS MATERIALIZED (SELECT l.*,(l.source_id=ANY($5::uuid[])) AS src_usable,(l.source_id=ANY($6::uuid[])) AS src_active,(l.actor_id=ANY($7::uuid[])) AS actor_ok FROM latest l),
 inv AS (SELECT source_id,kind,currency,exponent,basis,status,to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month,src_usable,count(*)::int AS n,count(amount_minor)::int AS n_amount,coalesce(sum(amount_minor),0)::text AS sum_minor,count(*) FILTER(WHERE NOT actor_ok)::int AS n_actor_revoked,min(effective_at) AS first_at,max(effective_at) AS last_at
   FROM tagged GROUP BY 1,2,3,4,5,6,7,8 ORDER BY 1,2,3,4,5,6,7,8 LIMIT ${MAX_GROUPS+1}),
 sc AS (SELECT kind,currency,exponent,status,src_active,(src_usable AND actor_ok AND NOT(entity_id=ANY($8::uuid[]))) AS order_ok,count(*)::int AS n,count(amount_minor)::int AS n_amount,coalesce(sum(amount_minor),0)::text AS sum_minor
   FROM tagged WHERE basis=$4 AND effective_at>=$2::timestamptz AND effective_at<$3::timestamptz GROUP BY 1,2,3,4,5,6),
 refsel AS (SELECT entity_id,currency,exponent,kind,status,amount_minor,reversal_of FROM tagged WHERE src_active AND basis=$4 AND effective_at>=$2::timestamptz AND effective_at<$3::timestamptz AND kind IN('refund','reversal') AND status IN('settled','unknown')),
 revagg AS (SELECT currency,exponent,reversal_of,coalesce(sum(-amount_minor),0) AS rev_known,bool_or(amount_minor IS NULL) AS rev_unknown FROM refsel WHERE kind='reversal' AND status='settled' GROUP BY 1,2,3),
 netrows AS (SELECT r.currency,r.exponent,r.amount_minor,v.rev_known,v.rev_unknown FROM refsel r LEFT JOIN revagg v ON v.reversal_of=r.entity_id AND v.currency=r.currency AND v.exponent=r.exponent WHERE r.kind='refund' AND r.status='settled'),
 net AS (SELECT currency,exponent,count(*)::int AS total,count(*) FILTER(WHERE amount_minor IS NOT NULL AND NOT coalesce(rev_unknown,false))::int AS known,
   coalesce(sum(amount_minor-coalesce(rev_known,0)) FILTER(WHERE amount_minor IS NOT NULL AND NOT coalesce(rev_unknown,false)),0)::text AS sum_net,count(*) FILTER(WHERE amount_minor IS NOT NULL AND coalesce(rev_known,0)>amount_minor)::int AS n_exceed FROM netrows GROUP BY 1,2),
 missing AS (SELECT v.currency,v.exponent,count(*)::int AS n FROM refsel v WHERE v.kind='reversal' AND v.status='settled' AND NOT EXISTS(SELECT 1 FROM refsel r WHERE r.kind='refund' AND r.status='settled' AND r.entity_id=v.reversal_of AND r.currency=v.currency AND r.exponent=v.exponent) GROUP BY 1,2),
 unk AS (SELECT currency,exponent,count(*) FILTER(WHERE status='unknown')::int AS n_unknown,count(*) FILTER(WHERE kind='refund')::int AS total_refunds FROM refsel GROUP BY 1,2),
 badref AS (SELECT e.kind,count(*)::int AS n,(array_agg(e.entity_id ORDER BY e.entity_id))[1:20] AS sample FROM tagged e WHERE e.src_active AND e.kind IN('refund','reversal','replacement') AND e.order_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM tagged o WHERE o.entity_id=e.order_id AND o.kind='order' AND o.src_active AND o.currency=e.currency AND o.exponent=e.exponent) GROUP BY 1)
 SELECT (SELECT count(*)::int FROM public.economic_ledger_entries WHERE tenant_id=$1) AS revisions,(SELECT count(*)::int FROM latest) AS entities,
  (SELECT coalesce(jsonb_agg(to_jsonb(inv)),'[]'::jsonb) FROM inv) AS inv,(SELECT coalesce(jsonb_agg(to_jsonb(sc)),'[]'::jsonb) FROM sc) AS sc,
  (SELECT coalesce(jsonb_agg(to_jsonb(net)),'[]'::jsonb) FROM net) AS net,(SELECT coalesce(jsonb_agg(to_jsonb(missing)),'[]'::jsonb) FROM missing) AS missing,
  (SELECT coalesce(jsonb_agg(to_jsonb(unk)),'[]'::jsonb) FROM unk) AS unk,(SELECT coalesce(jsonb_agg(to_jsonb(badref)),'[]'::jsonb) FROM badref) AS badref`;
const COMPONENT_ROWS=`WITH ${LATEST.replace('WHERE tenant_id=$1','WHERE tenant_id=$1 AND kind IN(\'replacement\',\'support_model\',\'future_scenario\')')} SELECT l.* ,e.details,e.report FROM latest l JOIN public.economic_ledger_entries e ON e.tenant_id=$1 AND e.id=l.id WHERE l.kind IN('replacement','support_model','future_scenario') AND l.source_id=ANY($2::uuid[]) ORDER BY l.entity_id LIMIT ${MAX_COMPONENT_ROWS+1}`;

async function relationSummary(s){
 // Conteos acotados de las tablas de relaciones (todas pequeñas y manuales); el detalle por problema es la vista perezosa «exposure».
 const t=s.tenantId,one=async(q)=>(await s.query(q,[t])).rows[0];
 const links=await one("SELECT count(*)::int AS n FROM (SELECT DISTINCT ON(problem_id,entity_id) active FROM public.economic_problem_links WHERE tenant_id=$1 ORDER BY problem_id,entity_id,version DESC) x WHERE active");
 const aliases=await one("SELECT count(*)::int AS n FROM (SELECT DISTINCT ON(alias_entity_id) active FROM public.economic_order_aliases WHERE tenant_id=$1 ORDER BY alias_entity_id,version DESC) x WHERE active");
 const customers=await one("SELECT count(*)::int AS n FROM (SELECT DISTINCT ON(entity_id) customer_key FROM public.economic_order_customers WHERE tenant_id=$1 ORDER BY entity_id,version DESC) x WHERE customer_key IS NOT NULL");
 return {activeProblemLinks:links.n,activeOrderAliases:aliases.n,ordersWithCustomerKey:customers.n};
}

/** Alias activos válidos (se cuentan una vez bajo el pedido canónico) y si alguno activo es inválido (compuerta de identidad). */
async function aliasState(s,{mergedActive,activeActors}){
 const n=(await s.query('SELECT count(*)::int AS n FROM public.economic_order_aliases WHERE tenant_id=$1',[s.tenantId])).rows[0].n;
 if(!n)return {excluded:[],bad:false,count:0};
 if(n>20000)return {excluded:[],bad:true,count:n};
 const rows=(await latestRows(s,'economic_order_aliases','alias_entity_id')).filter(r=>r.active);
 const ids=uniqSorted(rows.flatMap(r=>[r.alias_entity_id,r.canonical_entity_id]));
 const found=ids.length?(await s.query('SELECT DISTINCT ON(entity_id) id,entity_id,source_id,actor_id,effective_at,recorded_at,currency,exponent,basis,amount_minor,status,kind FROM public.economic_ledger_entries WHERE tenant_id=$1 AND entity_id=ANY($2::uuid[]) ORDER BY entity_id DESC,revision DESC',[s.tenantId,ids])).rows:[];
 const byId=new Map(found.map(r=>[r.entity_id,{...r,effectiveAt:iso(r.effective_at),amountMinor:minor(r.amount_minor)}]));
 const usable=e=>!!e&&activeActors.has(e.actor_id)&&mergedActive.has(e.source_id);
 const valid=rows.map(r=>{const a=byId.get(r.alias_entity_id),b=byId.get(r.canonical_entity_id);return {r,ok:!!(r.actor_active&&usable(a)&&usable(b)&&compatible(a,b))};});
 return {excluded:valid.filter(x=>x.ok).map(x=>x.r.alias_entity_id),bad:valid.some(x=>!x.ok),count:n};
}

/** Construye {allOrders, refunds} y los componentes para una unidad (moneda/exponente) a partir de los agregados SQL. */
function unitMetrics({scope,unit,agg,mergedSources,rawSources,asOf,aliasBad,orderEvidenceBad,rows,truncatedRows}){
 const sc={...scope,currency:unit.currency,exponent:unit.exponent};
 const mine=(x)=>x.currency===unit.currency&&x.exponent===unit.exponent;
 // allOrders: pedidos canónicos utilizables (exposure), sin cancelados ni pendientes
 const ord=agg.sc.filter(g=>mine(g)&&g.kind==='order'&&g.order_ok&&!['cancelled','pending'].includes(g.status));
 const orderRaw=rawMoney({total:ord.reduce((a,g)=>a+g.n,0),known:ord.reduce((a,g)=>a+g.n_amount,0),sum:ord.reduce((a,g)=>a+BigInt(g.sum_minor),0n).toString()});
 const famO=family(mergedSources,'order_export',sc,asOf),orderReasons=ord.some(g=>g.status==='unknown')?['STATUS_UNKNOWN']:[];
 const allOrders=closeMetric(orderRaw,orderReasons,famO,sc);
 if(aliasBad)gate(allOrders,'alias_identity_unavailable_or_conflicting',true);
 if(orderEvidenceBad)gate(allOrders,'order_evidence_unavailable');
 if(!famO.sources.length)allOrders.knownSubtotalMinor=null;
 // refunds: lista viva (fuentes activas sin considerar al contribuyente), neteo de reversiones
 const famR=family(rawSources,'payment_ledger',sc,asOf);
 const net=agg.net.find(mine),unk=agg.unk.find(mine),missing=agg.missing.find(mine);
 const refundReasons=[];let refundRaw;
 const totalRefunds=unk?.total_refunds??0;
 if(unk?.n_unknown)refundReasons.push('STATUS_UNKNOWN');
 if(!refundReasons.length&&(missing?.n>0||net?.n_exceed>0))refundReasons.push('REFUND_RECONCILIATION_REQUIRED');
 refundRaw=refundReasons.length?rawMoney({total:0,known:0,sum:'0'}):rawMoney({total:net?.total??0,known:net?.known??0,sum:net?.sum_net??'0'});
 if(refundReasons.length)refundRaw={...refundRaw,totalCount:totalRefunds};
 const refunds=closeMetric(refundRaw,refundReasons,famR,sc);
 if(!famR.sources.length){refunds.amountMinor=null;refunds.knownSubtotalMinor=null;refunds.status='unavailable';refunds.missingReasons=[...new Set([...refunds.missingReasons,'family_source_absent'])].sort();}
 if(agg.badref.some(b=>['refund','reversal'].includes(b.kind))){refunds.amountMinor=null;refunds.status='unavailable';refunds.missingReasons=[...new Set([...refunds.missingReasons,'order_reference_unavailable_or_incompatible'])].sort();}
 // componentes manuales: pocas filas; misma función que list()
 const comps=truncatedRows?null:separateComponents({entries:rows,sources:rawSources,scope:sc,asOf});
 const issues=[];
 if(famO.incomplete)issues.push({code:'SOURCE_INCOMPLETE'});if(famO.openWindow)issues.push({code:'WINDOW_INCOMPLETE'});for(const c of orderReasons)issues.push({code:c,entityType:'order'});
 if(famR.incomplete)issues.push({code:'SOURCE_INCOMPLETE'});if(famR.openWindow)issues.push({code:'WINDOW_INCOMPLETE'});for(const c of refundReasons)issues.push({code:c,entityType:'event'});
 return {allOrders,refunds,components:comps,issues,famO,famR};
}

/**
 * @returns vista acotada. `lean:false` por defecto; no toca historia completa ni lista completa de entradas.
 */
export async function readOverview(s,{scope,fxRateId,pageLimit=DEFAULT_PAGE}){
 try{return await readOverviewUnsafe(s,{scope,fxRateId,pageLimit});}catch(e){throw asTimeout(e);}
}
async function readOverviewUnsafe(s,{scope,fxRateId,pageLimit}){
 const started=Date.now();
 const asOf=iso((await s.query('SELECT transaction_timestamp() AS now')).rows[0].now);
 const srcRows=await latestRows(s,'economic_source_versions','source_id');
 const rawSources=srcRows.map(r=>sourceView(r)),mergedSources=srcRows.map(r=>({...sourceView(r),active:r.active&&r.actor_active}));
 const rawActive=rawSources.filter(x=>x.active).map(x=>x.id),mergedActive=new Set(mergedSources.filter(x=>x.active).map(x=>x.id));
 const actors=await ledgerActorStates(s),activeActors=new Set(actors.filter(a=>a.active).map(a=>a.actor_id));
 const alias=await aliasState(s,{mergedActive,activeActors});
 const aggRow=(await s.query(AGGREGATES,[s.tenantId,scope.start,scope.end,scope.basis,[...mergedActive],rawActive,[...activeActors],alias.excluded])).rows[0];
 const agg={sc:aggRow.sc,net:aggRow.net,missing:aggRow.missing,unk:aggRow.unk,badref:aggRow.badref};
 const inv=aggRow.inv,truncated=inv.length>MAX_GROUPS;if(truncated)inv.length=MAX_GROUPS;
 // pedidos con evidencia no utilizable: alguna fuente de pedidos inactiva o algún pedido de contribuyente/fuente no vigente (mismo criterio de exposure)
 const orderEvidenceBad=mergedSources.some(x=>x.evidenceType==='order_export'&&!x.active)||inv.some(g=>g.kind==='order'&&(!g.src_usable||g.n_actor_revoked>0));
 // un mismo código de moneda con dos exponentes en la ventana/base es un conflicto de unidades (igual que EXPONENT_CONFLICT)
 const unitsMap=new Map();for(const g of agg.sc)unitsMap.set(g.currency+':'+g.exponent,{currency:g.currency,exponent:g.exponent});
 const byCode=new Map();for(const u of unitsMap.values()){byCode.set(u.currency,(byCode.get(u.currency)??0)+1);}
 if([...byCode.values()].some(n=>n>1))throw new EconomicError('currency_exponent_conflict',409);
 unitsMap.set(scope.currency+':'+scope.exponent,{currency:scope.currency,exponent:scope.exponent});
 const compRows=(await s.query(COMPONENT_ROWS,[s.tenantId,rawActive])).rows;const truncatedRows=compRows.length>MAX_COMPONENT_ROWS;if(truncatedRows)compRows.length=MAX_COMPONENT_ROWS;
 const compEntries=compRows.map(entryRow);
 const perUnit=new Map();
 for(const u of unitsMap.values())perUnit.set(u.currency+':'+u.exponent,unitMetrics({scope,unit:u,agg,mergedSources,rawSources,asOf,aliasBad:alias.bad,orderEvidenceBad,rows:compEntries,truncatedRows}));
 const main=perUnit.get(scope.currency+':'+scope.exponent);
 const inputHash='ledger-overview:'+aggRow.revisions+':'+aggRow.entities;
 const bundleFor=(m)=>({inputHash,metrics:{allOrders:m.allOrders,refunds:m.refunds,exposure:{global:null,byProblem:{},eventUnion:{global:{},byProblem:{}},problemRowsAreAdditive:false}},components:m.components??{replacement:null,supportModel:null,futureScenarios:[],combinedTotal:null},issues:m.issues});
 const data={bundle:bundleFor(main),entries:[...unitsMap.values()].map(u=>({basis:scope.basis,effectiveAt:scope.start,currency:u.currency,exponent:u.exponent}))};
 const monetary=await readMonetary(s,{scope,data,loadBundle:async sc=>({bundle:bundleFor(perUnit.get(sc.currency+':'+sc.exponent))}),fxRateId});
 const page=await readPage(s,{limit:pageLimit});
 const relations=await relationSummary(s);
 const nullAmount=inv.reduce((a,g)=>a+(g.n-g.n_amount),0),noCurrency=0;
 const issues=main.issues,issueSample=agg.badref.map(b=>({code:'order_reference_unavailable_or_incompatible',entityType:b.kind,count:b.n,sample:b.sample}));
 return {
  contract:'f05-economics-v2',state:aggRow.entities?'ready':'empty',canWrite:s.role==='owner',asOf,
  notice:'Consulta acotada del ledger actual: agregados calculados en la base y una página de filas recientes; no es un snapshot publicado. No hay total de pérdida ni ahorro. Las fuentes manuales requieren evidencia operacional y aprobación del propietario.',
  sources:rawSources,
  totals:{revisions:aggRow.revisions,entities:aggRow.entities,withAmount:aggRow.entities-nullAmount,nullAmount,noCurrency,distinctSources:rawSources.length,activeSources:rawActive.length,distinctGroups:inv.length,truncated},
  groups:inv.map(g=>({sourceId:g.source_id,kind:g.kind,currency:g.currency,exponent:g.exponent,basis:g.basis,status:g.status,month:g.month,entries:g.n,withAmount:g.n_amount,nullAmount:g.n-g.n_amount,knownSumMinor:g.sum_minor,label:evidenceLabel(g.kind),coverage:{known:g.n_amount,total:g.n},firstAt:iso(g.first_at),lastAt:iso(g.last_at)})),
  relations:{...relations,aliasesTotal:alias.count,identityGate:alias.bad},
  page,
  bundle:bundleFor(main),
  history:[],entries:page.items,exposure:null,monetary,
  scopeSummary:{units:[...unitsMap.values()],issues:issues.slice(0,50),referenceIssues:issueSample,truncatedComponentRows:truncatedRows},
  labels:{observado:'Importes registrados en la fuente y aprobados por un propietario.',estimado:'Soporte modelado y escenarios: supuestos aprobados, no pronósticos calibrados.',inferido:'Solo conversiones con tasa aprobada explícita; ninguna cifra del ledger se infiere.'},
  timing:{ms:Date.now()-started}
 };
}

const FILTER_KEYS=['sourceId','kind','status','currency','basis'];
function cursorEncode(row){return Buffer.from(JSON.stringify({e:row.eff_text,n:row.entity_id})).toString('base64url');}
function cursorDecode(c){if(c===undefined||c===null||c==='')return null;try{const v=JSON.parse(Buffer.from(String(c),'base64url').toString('utf8'));if(typeof v.e==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?Z$/.test(v.e)&&uuid(v.n))return {e:v.e,n:v.n};}catch{/* cursor inválido */}throw new EconomicError('cursor_invalid',400);}
/** Página acotada (≤100) de la última revisión de cada entidad, más recientes primero. Paginación por cursor (efectiva, entidad). */
export async function readPage(s,{limit=DEFAULT_PAGE,cursor,filters={}}={}){
 try{
  const n=Number(limit);if(!Number.isInteger(n)||n<1||n>MAX_PAGE)throw new EconomicError('limit_invalid',400);
  for(const k of Object.keys(filters))if(!FILTER_KEYS.includes(k))throw new EconomicError('unsupported_filter',400);
  if(filters.sourceId!==undefined&&!uuid(filters.sourceId))throw new EconomicError('filter_invalid',400);
  if(filters.kind!==undefined&&!KINDS.includes(filters.kind))throw new EconomicError('filter_invalid',400);
  if(filters.status!==undefined&&!STATUSES.includes(filters.status))throw new EconomicError('filter_invalid',400);
  if(filters.currency!==undefined&&!/^[A-Z]{3}$/.test(filters.currency))throw new EconomicError('filter_invalid',400);
  if(filters.basis!==undefined&&(typeof filters.basis!=='string'||!filters.basis||filters.basis.length>200))throw new EconomicError('filter_invalid',400);
  const cur=cursorDecode(cursor),args=[s.tenantId],where=[];
  for(const [k,col] of [['sourceId','e.source_id'],['kind','e.kind'],['status','e.status'],['currency','e.currency'],['basis','e.basis']])if(filters[k]!==undefined){args.push(filters[k]);where.push(`${col}=$${args.length}`);}
  if(cur){args.push(cur.e,cur.n);where.push(`(e.effective_at,e.entity_id)<($${args.length-1}::timestamptz,$${args.length}::uuid)`);}
  args.push(n+1);
  const rows=(await s.query(`SELECT e.id,e.entity_id,e.source_id,e.revision,e.actor_id,e.recorded_at,e.external_id,e.kind,e.effective_at,to_char(e.effective_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS eff_text,e.currency,e.exponent,e.basis,e.amount_minor,e.status,e.order_id,e.reversal_of
   FROM public.economic_ledger_entries e WHERE e.tenant_id=$1 ${where.length?'AND '+where.join(' AND '):''}
   AND NOT EXISTS(SELECT 1 FROM public.economic_ledger_entries x WHERE x.tenant_id=e.tenant_id AND x.entity_id=e.entity_id AND x.revision>e.revision)
   ORDER BY e.effective_at DESC,e.entity_id DESC LIMIT $${args.length}`,args)).rows;
  const more=rows.length>n;if(more)rows.length=n;
  return {items:rows.map(r=>{const {details,report,...rest}=entryRow({...r,details:{},report:''});return rest;}),nextCursor:more?cursorEncode(rows.at(-1)):null,limit:n};
 }catch(e){throw asTimeout(e);}
}

/** Historial inmutable (todas las revisiones) de UNA entidad, con su evidencia. Acotado a 200 revisiones. */
export async function readEntityHistory(s,{entityId}){
 try{
  if(!uuid(entityId))throw new EconomicError('entity_id_invalid',400);
  const rows=(await s.query('SELECT * FROM public.economic_ledger_entries WHERE tenant_id=$1 AND entity_id=$2 ORDER BY revision DESC LIMIT 200',[s.tenantId,entityId])).rows;
  if(!rows.length)throw new EconomicError('entity_not_found',404);
  return {entityId,revisions:rows.map(entryRow)};
 }catch(e){throw asTimeout(e);}
}

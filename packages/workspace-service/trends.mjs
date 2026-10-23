// Monthly trends for the Resumen charts. Read-only, tenant-scoped, run under the caller's RLS session.
// Every statement is bounded: a fixed month window, one aggregate per table, and a local statement_timeout (4 s) that is
// reported as status "timeout" instead of surfacing a 503. RLS evaluates vexa_member() per row, so scans are never unbounded
// and the result says what it is (raw registered rows, not the published-snapshot rules).
import {WorkspaceError} from './contracts.mjs';
import {attempt,readLedgerMonthly,summaryMeta} from './summaries.mjs';
import {completitud} from '../metrics/complete-months.mjs';
import {ingresosDelLibro} from './cifras-libro.mjs';
import {SQL_ANALIZADAS} from './cifras-cobertura.mjs';
import {readConversationMonthlyFromInsights} from '../insights/adapter.mjs';
export const TREND_MONTHS=12,LOCAL_TIMEOUT_MS=4000;
const monthStart=(d)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
const addMonths=(d,n)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));
const key=(d)=>d.toISOString().slice(0,7);
export function monthWindow(now=new Date(),months=TREND_MONTHS){const end=addMonths(monthStart(now),1),start=addMonths(end,-months);const list=[];for(let i=0;i<months;i++)list.push(key(addMonths(start,i)));return {start,end,list};}
export async function guarded(s,work,timeoutMs=LOCAL_TIMEOUT_MS){
 await s.query("SELECT set_config('statement_timeout',$1,true)",[String(timeoutMs)]);
 await s.query('SAVEPOINT trend');
 try{const value=await work();await s.query('RELEASE SAVEPOINT trend');return value;}
 catch(e){if(e?.code==='57014'){await s.query('ROLLBACK TO SAVEPOINT trend');return null;}throw e;}
}
// Conversations are dated through a per-row lookup into messages, so the sample is small: 3 % (≈3,000 of 100k) fits a Micro database in ~1 s.
export const SAMPLE_PERCENT=3;
// «Datos hasta» de conversaciones = fecha del mensaje n.º 200 más reciente (no la marca del resumen precomputado ni el último mensaje suelto):
// tras el corte de una carga masiva suele quedar un goteo de mensajes sueltos (p. ej. hilos viejos de HubSpot que reciben eventos) que no cubre el mes.
// Es un recorrido hacia atrás del índice messages(tenant_id, occurred_at, id): ~0.4 ms y acotado por OFFSET.
export const ANCLA_MENSAJES=200;
export const LAST_MESSAGE_SQL=`SELECT occurred_at AS last_at FROM public.messages WHERE tenant_id=$1 AND deleted_at IS NULL AND occurred_at IS NOT NULL AND occurred_at<=now() ORDER BY occurred_at DESC OFFSET ${ANCLA_MENSAJES-1} LIMIT 1`;
/** Fecha más reciente de una lista (Date o ISO); null si no hay ninguna. */
const maxDate=(xs)=>{const t=xs.filter(x=>x!==null&&x!==undefined).map(x=>Date.parse(x instanceof Date?x.toISOString():String(x))).filter(Number.isFinite);return t.length?new Date(Math.max(...t)).toISOString():null;};
export function createTrendsRepository({database,now=()=>new Date(),timeoutMs=LOCAL_TIMEOUT_MS}){
 return {
  async monthly({months=TREND_MONTHS}={}){
   if(!Number.isInteger(months)||months<1||months>24)throw new WorkspaceError('trends_input_invalid',400);
   const win=monthWindow(now(),months);
   return database.transaction('read',async s=>{
    // 1) Resúmenes precomputados (migración 20261022000000): <200 ms. Solo se usan si existen; «Observado» únicamente cuando no hay registros posteriores al corte.
    // insight_conversation_volume (se refresca solo al cambiar la fuente); si no existe o no se puede leer, el camino en vivo. conversation_monthly (obsoleta) ya no se lee.
    const convIns=await readConversationMonthlyFromInsights(s),convSum=convIns.availability==='ready'?convIns:{availability:convIns.availability??'absent',months:[]},ledSum=await readLedgerMonthly(s,win);
    // Conversation date = started_at, or the date of its FIRST MESSAGE when started_at is null (historical CSV imports carry no
    // started_at). Messages are RLS-checked per row, so: (1) a cheap probe (<= 3,001 rows) decides whether an exact pass is affordable;
    // (2) otherwise a 3 % Bernoulli sample of conversations is dated and scaled, and the figure is labelled "Estimado".
    const useConvSum=convSum.availability==='ready';
    const probe=useConvSum?0:await guarded(s,async()=>Number((await s.query('SELECT count(*) AS n FROM (SELECT 1 FROM public.conversations WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 3001) p',[s.tenantId])).rows[0].n),timeoutMs);
    const dated=(from)=>`SELECT CASE WHEN d>=$2 AND d<$3 THEN to_char(d AT TIME ZONE 'UTC','YYYY-MM') END AS month,count(*) AS n,count(*) FILTER (WHERE d IS NULL) AS undated,max(d) AS last_at
      FROM (SELECT coalesce(c.started_at,fm.first_at) AS d FROM ${from}
        LEFT JOIN LATERAL (SELECT min(m.occurred_at) AS first_at FROM public.messages m WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id AND m.deleted_at IS NULL) fm ON c.started_at IS NULL
        WHERE c.tenant_id=$1 AND c.deleted_at IS NULL) x GROUP BY 1`;
    const args=[win.start.toISOString(),win.end.toISOString()];
    const exact=probe!==null&&probe<=3000;
    const rowsRaw=useConvSum||probe===null?null:await guarded(s,async()=>(await s.query(exact?dated('public.conversations c'):dated(`public.conversations c TABLESAMPLE BERNOULLI (${SAMPLE_PERCENT}) REPEATABLE (7)`),[s.tenantId,...args])).rows,timeoutMs);
    const convLast=useConvSum?await guarded(s,async()=>(await s.query(LAST_MESSAGE_SQL,[s.tenantId])).rows[0]?.last_at??null,timeoutMs):null;
    const useLedSum=ledSum.availability==='ready';
    // Fecha efectiva más reciente del libro (pedidos/reembolsos): es lo que dice hasta dónde llegan los datos. Con resumen, una consulta acotada; si no cabe, se usa la marca de agua del resumen.
    const ledLast=useLedSum?await guarded(s,async()=>(await s.query("SELECT max(effective_at) AS last_at FROM public.economic_ledger_entries WHERE tenant_id=$1 AND kind IN ('order','refund')",[s.tenantId])).rows[0]?.last_at??null,timeoutMs):undefined;
    // Una sola definición de ingresos para todas las pantallas (cifras-libro.mjs, la misma que Dinero): sin filas «a revisar» y pedidos de UNA base por moneda.
    const ledRaw=useLedSum?ledSum.rows:await guarded(s,async()=>(await s.query(
     `WITH latest AS (SELECT DISTINCT ON(entity_id) entity_id,kind,status,basis,effective_at,currency,exponent,amount_minor
        FROM public.economic_ledger_entries WHERE tenant_id=$1 AND kind IN ('order','refund') ORDER BY entity_id,revision DESC)
      SELECT to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month,kind,status,basis,currency,exponent,count(*) AS n,
        coalesce(sum(amount_minor) FILTER (WHERE amount_minor IS NOT NULL),0)::text AS amount,count(*) FILTER (WHERE amount_minor IS NULL) AS unknown,max(effective_at) AS last_at
      FROM latest WHERE ((kind='order' AND status='recorded') OR (kind='refund' AND status='settled')) AND effective_at>=$2 AND effective_at<$3
      GROUP BY 1,2,3,4,5,6 ORDER BY 1,2,3 LIMIT 1200`,[s.tenantId,win.start.toISOString(),win.end.toISOString()])).rows,timeoutMs);
    const ingresos=ledRaw===null?null:ingresosDelLibro(ledRaw);
    const led=ingresos===null?null:[...ingresos.filas.reduce((acc,r)=>{const k=r.month+'|'+r.kind+'|'+r.currency+'|'+r.exponent;let o=acc.get(k);if(!o)acc.set(k,o={month:r.month,kind:r.kind,currency:r.currency,exponent:r.exponent,n:0,amount:0n,unknown:0,last_at:null});o.n+=Number(r.n);o.amount+=BigInt(r.amount);o.unknown+=useLedSum?Number(r.n)-Number(r.known):Number(r.unknown);if(r.last_at&&(!o.last_at||r.last_at>o.last_at))o.last_at=r.last_at;return acc;},new Map()).values()].map(o=>({...o,amount:String(o.amount)}));
    let conversations;
    const rowsOf=rowsRaw,factor=exact?1:100/SAMPLE_PERCENT,definition='started_at_or_first_message';
    if(useConvSum){const by=new Map(convSum.months.map(m=>[m.month,m.n])),inWindow=win.list.reduce((a,m)=>a+(by.get(m)??0),0),meta=summaryMeta(convSum),fresh=convSum.freshness==='fresh';
     conversations={status:convSum.total===0?'empty':'ok',class:fresh?'observed':'estimated',sampled:false,samplePercent:null,definition,sampleNote:null,series:win.list.map(m=>({month:m,count:by.get(m)??0})),outsideWindow:convSum.total-inWindow,undated:convSum.undated,total:convSum.total,summary:meta,completeness:completitud(win.list.map(m=>({month:m,count:by.get(m)??0})),{dataThrough:convLast??meta.cutoff,ahora:now()})};}
    else if(rowsOf===null)conversations={status:'timeout',class:'observed',series:[],outsideWindow:null,undated:null,total:null,sampled:false,definition,summary:summaryMeta(convSum)};
    else{const by=new Map(rowsOf.filter(r=>r.month).map(r=>[r.month,Math.round(Number(r.n)*factor)])),outside=Math.round(rowsOf.filter(r=>!r.month).reduce((a,r)=>a+Number(r.n),0)*factor),undated=Math.round(rowsOf.reduce((a,r)=>a+Number(r.undated),0)*factor),total=Math.round(rowsOf.reduce((a,r)=>a+Number(r.n),0)*factor);
     conversations={status:total===0?'empty':'ok',class:exact?'observed':'estimated',sampled:!exact,samplePercent:exact?null:SAMPLE_PERCENT,definition,sampleNote:exact?null:`Estimado con una muestra del ${SAMPLE_PERCENT} % de las conversaciones: fechar todas (por su primer mensaje) no cabe en el tiempo permitido.`,series:win.list.map(m=>({month:m,count:by.get(m)??0})),outsideWindow:outside,undated,total,summary:summaryMeta(convSum),completeness:completitud(win.list.map(m=>({month:m,count:by.get(m)??0})),{dataThrough:maxDate(rowsOf.map(r=>r.last_at)),ahora:now()})};}
    // Conversaciones analizadas por la IA (distintas, terminadas): numerador de la cobertura de análisis; la base es `conversations.total`. Ver cifras-cobertura.mjs.
    const an=await attempt(s,async()=>Number((await s.query(SQL_ANALIZADAS,[s.tenantId])).rows[0]?.n??0),timeoutMs);
    conversations.analysis=an.timeout?{status:'timeout',analyzed:null}:an.unavailable?{status:'unavailable',analyzed:null}:{status:'ok',analyzed:an.value};
    let ledger;
    if(led===null)ledger={status:'timeout',class:'observed',series:[],currencies:[],summary:summaryMeta(ledSum)};
    else{const primary=ingresos.moneda===null?null:ingresos.moneda+':'+ingresos.exponente,currencies=primary?[primary,...ingresos.otrasMonedas.map(c=>c+':')]:[];
     const [currency,exponent]=primary?primary.split(':'):[null,null];
     const rows=led.filter(r=>r.currency+':'+r.exponent===primary);
     ledger={status:led.length===0?'empty':'ok',class:useLedSum&&ledSum.freshness!=='fresh'?'estimated':'observed',summary:summaryMeta(ledSum),currency,exponent:exponent===null?null:Number(exponent),orderBasis:ingresos.base?{base:ingresos.base,label:ingresos.etiquetaBase}:null,otherBases:ingresos.otrasBases,toReviewRows:ingresos.aRevisar,otherCurrencies:currencies.filter(c=>c!==primary).map(c=>c.split(':')[0]),
      series:win.list.map(m=>{const o=rows.find(r=>r.month===m&&r.kind==='order'),f=rows.find(r=>r.month===m&&r.kind==='refund');return {month:m,orders:{count:Number(o?.n??0),amountMinor:o?o.amount:'0',unknownAmounts:Number(o?.unknown??0)},refunds:{count:Number(f?.n??0),amountMinor:f?f.amount:'0',unknownAmounts:Number(f?.unknown??0)}};}),currencies};
     const ledThrough=useLedSum?(ledLast??ledSum.cutoff??null):maxDate(led.map(r=>r.last_at));
     ledger.completeness=completitud(ledger.series,{dataThrough:ledThrough,ahora:now(),conDatos:p=>p.orders.count+p.orders.unknownAmounts+p.refunds.count+p.refunds.unknownAmounts>0});}
    return {generatedAt:now().toISOString(),window:{start:win.start.toISOString().slice(0,10),end:win.end.toISOString().slice(0,10),months},
     note:'Conteos de registros cargados (conversaciones por fecha de inicio o, si falta, por la fecha de su primer mensaje; pedidos registrados y reembolsos liquidados por fecha efectiva, de todas las bases del libro económico —incluye Shopify bruto y filas «a revisar»; /cfo muestra una sola base—; conversaciones de todas las fuentes, no solo las filas de HubSpot del Explorador). No aplican las reglas de publicación del snapshot ni suman monedas distintas.',conversations,ledger};
   });
  }
 };
}

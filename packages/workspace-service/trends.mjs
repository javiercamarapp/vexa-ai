// Monthly trends for the Resumen charts. Read-only, tenant-scoped, run under the caller's RLS session.
// Every statement is bounded: a fixed month window, one aggregate per table, and a local statement_timeout (4 s) that is
// reported as status "timeout" instead of surfacing a 503. RLS evaluates vexa_member() per row, so scans are never unbounded
// and the result says what it is (raw registered rows, not the published-snapshot rules).
import {WorkspaceError} from './contracts.mjs';
export const TREND_MONTHS=12,LOCAL_TIMEOUT_MS=4000;
const monthStart=(d)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));
const addMonths=(d,n)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));
const key=(d)=>d.toISOString().slice(0,7);
export function monthWindow(now=new Date(),months=TREND_MONTHS){const end=addMonths(monthStart(now),1),start=addMonths(end,-months);const list=[];for(let i=0;i<months;i++)list.push(key(addMonths(start,i)));return {start,end,list};}
async function guarded(s,work,timeoutMs=LOCAL_TIMEOUT_MS){
 await s.query("SELECT set_config('statement_timeout',$1,true)",[String(timeoutMs)]);
 await s.query('SAVEPOINT trend');
 try{const value=await work();await s.query('RELEASE SAVEPOINT trend');return value;}
 catch(e){if(e?.code==='57014'){await s.query('ROLLBACK TO SAVEPOINT trend');return null;}throw e;}
}
export const SAMPLE_PERCENT=10;
export function createTrendsRepository({database,now=()=>new Date(),timeoutMs=LOCAL_TIMEOUT_MS}){
 return {
  async monthly({months=TREND_MONTHS}={}){
   if(!Number.isInteger(months)||months<1||months>24)throw new WorkspaceError('trends_input_invalid',400);
   const win=monthWindow(now(),months);
   return database.transaction('read',async s=>{
    const conv=await guarded(s,async()=>(await s.query(
     `SELECT CASE WHEN started_at>=$2 AND started_at<$3 THEN to_char(started_at AT TIME ZONE 'UTC','YYYY-MM') END AS month,count(*) AS n
      FROM public.conversations WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY 1`,[s.tenantId,win.start.toISOString(),win.end.toISOString()])).rows,timeoutMs);
    // Exact count costs one RLS policy call per row. If it does not fit in the local timeout, fall back to a deterministic 10 % page sample
    // and say so (class "estimated"); never present a sample as an exact observation.
    const sampled=conv===null?await guarded(s,async()=>(await s.query(
     `SELECT CASE WHEN started_at>=$2 AND started_at<$3 THEN to_char(started_at AT TIME ZONE 'UTC','YYYY-MM') END AS month,count(*) AS n
      FROM public.conversations TABLESAMPLE SYSTEM (${SAMPLE_PERCENT}) REPEATABLE (7) WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY 1`,[s.tenantId,win.start.toISOString(),win.end.toISOString()])).rows,timeoutMs):null;
    const led=await guarded(s,async()=>(await s.query(
     `WITH latest AS (SELECT DISTINCT ON(entity_id) entity_id,kind,status,effective_at,currency,exponent,amount_minor
        FROM public.economic_ledger_entries WHERE tenant_id=$1 AND kind IN ('order','refund') ORDER BY entity_id,revision DESC)
      SELECT to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month,kind,currency,exponent,count(*) AS n,
        coalesce(sum(amount_minor) FILTER (WHERE amount_minor IS NOT NULL),0)::text AS amount,count(*) FILTER (WHERE amount_minor IS NULL) AS unknown
      FROM latest WHERE ((kind='order' AND status='recorded') OR (kind='refund' AND status='settled')) AND effective_at>=$2 AND effective_at<$3
      GROUP BY 1,2,3,4 ORDER BY 1,2,3 LIMIT 600`,[s.tenantId,win.start.toISOString(),win.end.toISOString()])).rows,timeoutMs);
    let conversations;
    const rowsOf=conv??sampled,factor=conv?1:100/SAMPLE_PERCENT;
    if(rowsOf===null)conversations={status:'timeout',class:'observed',series:[],outsideWindow:null,total:null,sampled:false};
    else{const by=new Map(rowsOf.filter(r=>r.month).map(r=>[r.month,Math.round(Number(r.n)*factor)])),outside=Math.round(rowsOf.filter(r=>!r.month).reduce((a,r)=>a+Number(r.n),0)*factor),total=Math.round(rowsOf.reduce((a,r)=>a+Number(r.n),0)*factor);
     conversations={status:total===0?'empty':'ok',class:conv?'observed':'estimated',sampled:!conv,sampleNote:conv?null:`Estimado con una muestra del ${SAMPLE_PERCENT} % de las conversaciones: el conteo exacto no cabe en el tiempo permitido.`,series:win.list.map(m=>({month:m,count:by.get(m)??0})),outsideWindow:outside,total};}
    let ledger;
    if(led===null)ledger={status:'timeout',class:'observed',series:[],currencies:[]};
    else{const currencies=[...new Set(led.map(r=>r.currency+':'+r.exponent))].sort();const primary=currencies.map(c=>({c,n:led.filter(r=>r.currency+':'+r.exponent===c).reduce((a,r)=>a+Number(r.n),0)})).sort((a,b)=>b.n-a.n)[0]?.c??null;
     const [currency,exponent]=primary?primary.split(':'):[null,null];
     const rows=led.filter(r=>r.currency+':'+r.exponent===primary);
     ledger={status:led.length===0?'empty':'ok',class:'observed',currency,exponent:exponent===null?null:Number(exponent),otherCurrencies:currencies.filter(c=>c!==primary).map(c=>c.split(':')[0]),
      series:win.list.map(m=>{const o=rows.find(r=>r.month===m&&r.kind==='order'),f=rows.find(r=>r.month===m&&r.kind==='refund');return {month:m,orders:{count:Number(o?.n??0),amountMinor:o?o.amount:'0',unknownAmounts:Number(o?.unknown??0)},refunds:{count:Number(f?.n??0),amountMinor:f?f.amount:'0',unknownAmounts:Number(f?.unknown??0)}};}),currencies};}
    return {generatedAt:now().toISOString(),window:{start:win.start.toISOString().slice(0,10),end:win.end.toISOString().slice(0,10),months},
     note:'Conteos de registros cargados (conversaciones por fecha de inicio; pedidos registrados y reembolsos liquidados por fecha efectiva). No aplican las reglas de publicación del snapshot ni suman monedas distintas.',conversations,ledger};
   });
  }
 };
}

// Lecturas ACOTADAS de «Clasificación de órdenes» (mappings) y «Asociación de clientes» (customer-bindings).
// Antes: GET devolvía TODAS las órdenes vigentes del libro (~79 mil) y evaluaba cada cliente de la base con 4-5 consultas (sourceCustomer), de modo que con el libro real
// excedía el tiempo de la consulta. Ahora: resumen con conteos agregados + una página (≤100) con cursor y búsqueda por texto; las escrituras (POST) no cambian.
// Mismas reglas de visibilidad que antes: un pedido es clasificable si su última revisión, su contribuyente, su fuente vigente y el contribuyente de la fuente siguen activos
// (economic_record_current); un cliente solo se muestra si sourceCustomer lo valida (conexión activa, sin retención ni tombstone).
import {EconomicError,asTimeout} from './errors.mjs';
import {latestRows,ledgerActorStates} from './ledger-load.mjs';

const MAX_PAGE=100;
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const iso=x=>new Date(x).toISOString();
const like=q=>'%'+String(q).replace(/[\\%_]/g,m=>'\\'+m)+'%';
function pageParams({limit,cursor,q},{max=MAX_PAGE,def=50}={}){
 const n=limit===undefined?def:Number(limit);if(!Number.isInteger(n)||n<1||n>max)throw new EconomicError('limit_invalid',400);
 if(q!==undefined&&(typeof q!=='string'||q.length>100||/[\u0000-\u001f\u007f]/.test(q)))throw new EconomicError('filter_invalid',400);
 return {limit:n,cursor:cursor===undefined||cursor===''?null:cursor,q:q===undefined||q.trim()===''?null:q.trim()};
}
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function dec(c,shape){if(c===null)return null;try{const v=JSON.parse(Buffer.from(String(c),'base64url').toString('utf8'));if(shape(v))return v;}catch{/* inválido */}throw new EconomicError('cursor_invalid',400);}

export function createWorkspaceViews({database,sourceCustomer}){
 const read=async work=>{try{return await database.transaction('read',work);}catch(e){throw asTimeout(e);}};
 return {
  /** Órdenes clasificables (página) + clasificaciones de esa página + las últimas decisiones + conteos agregados. */
  async mappings(input={}){
   const {limit,cursor,q}=pageParams(input);
   return read(async s=>{
    const cur=dec(cursor,v=>typeof v.e==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?Z$/.test(v.e)&&uuid(v.n));
    const srcRows=await latestRows(s,'economic_source_versions','source_id'),usable=srcRows.filter(r=>r.active&&r.actor_active).map(r=>r.source_id),names=new Map(srcRows.map(r=>[r.source_id,r.name]));
    const actors=(await ledgerActorStates(s)).filter(a=>a.active).map(a=>a.actor_id);
    const base=`FROM public.economic_ledger_entries e WHERE e.tenant_id=$1 AND e.kind='order' AND e.source_id=ANY($2::uuid[]) AND e.actor_id=ANY($3::uuid[])
     AND NOT EXISTS(SELECT 1 FROM public.economic_ledger_entries x WHERE x.tenant_id=e.tenant_id AND x.entity_id=e.entity_id AND x.revision>e.revision)`;
    const args=[s.tenantId,usable,actors],where=[];
    if(q){args.push(like(q));where.push(`e.external_id ILIKE $${args.length}`);}
    if(cur){args.push(cur.e,cur.n);where.push(`(e.effective_at,e.entity_id)<($${args.length-1}::timestamptz,$${args.length}::uuid)`);}
    args.push(limit+1);
    const rows=(await s.query(`SELECT e.id,e.entity_id,e.source_id,e.external_id,e.currency,e.exponent,e.amount_minor,e.effective_at,to_char(e.effective_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS eff_text ${base} ${where.length?'AND '+where.join(' AND '):''} ORDER BY e.effective_at DESC,e.entity_id DESC LIMIT $${args.length}`,args)).rows;
    const more=rows.length>limit;if(more)rows.length=limit;
    const total=(await s.query(`SELECT count(*)::int AS n ${base}`,[s.tenantId,usable,actors])).rows[0].n;
    const pageIds=rows.map(r=>r.id);
    const mapRows=async(extra,params)=>(await s.query(`SELECT m.*,public.economic_contributor_active(m.tenant_id,m.actor_id) AS actor_active FROM (${extra}) m ORDER BY m.created_at DESC`,params)).rows;
    const view=r=>({id:r.id,ledgerRowId:r.ledger_row_id,version:r.version,skus:r.actor_active?r.skus:null,source:r.actor_active?r.source:null,active:r.active,valid:r.actor_active,report:r.actor_active?r.report:null});
    const forPage=pageIds.length?await mapRows('SELECT DISTINCT ON(ledger_row_id) * FROM public.workspace_order_dimension_versions WHERE tenant_id=$1 AND ledger_row_id=ANY($2::uuid[]) ORDER BY ledger_row_id,version DESC',[s.tenantId,pageIds]):[];
    const recent=await mapRows('SELECT * FROM (SELECT DISTINCT ON(ledger_row_id) * FROM public.workspace_order_dimension_versions WHERE tenant_id=$1 ORDER BY ledger_row_id,version DESC) x ORDER BY created_at DESC LIMIT 20',[s.tenantId]);
    const ext=recent.length?new Map((await s.query('SELECT id,external_id FROM public.economic_ledger_entries WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[s.tenantId,recent.map(r=>r.ledger_row_id)])).rows.map(r=>[r.id,r.external_id])):new Map();
    const counts=(await s.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE active)::int AS active FROM (SELECT DISTINCT ON(ledger_row_id) active FROM public.workspace_order_dimension_versions WHERE tenant_id=$1 ORDER BY ledger_row_id,version DESC) x',[s.tenantId])).rows[0];
    return {
     orders:rows.map(r=>({ledgerRowId:r.id,entityId:r.entity_id,externalId:r.external_id,currency:r.currency,exponent:r.exponent,amountMinor:r.amount_minor===null?null:String(r.amount_minor).replace(/\.0+$/,''),sourceName:names.get(r.source_id)??r.source_id,effectiveAt:iso(r.effective_at)})),
     mappings:forPage.map(view),recentMappings:recent.map(r=>({...view(r),externalId:ext.get(r.ledger_row_id)??null,createdAt:iso(r.created_at)})),
     canWrite:s.role==='owner',nextCursor:more?enc({e:rows.at(-1).eff_text,n:rows.at(-1).entity_id}):null,limit,query:q,
     summary:{classifiableOrders:total,ordersWithDecision:counts.total,activeDecisions:counts.active,label:'observado',note:'Conteos sobre la última revisión de cada pedido de una fuente vigente; las decisiones de clasificación son declaraciones aprobadas por un propietario.'}
    };
   });
  },
  /** Identificadores financieros declarados (página, con búsqueda), sus asociaciones, y candidatos de cliente SOLO si se buscan (`customerQ`). */
  async customerBindings(input={}){
   const {limit,cursor,q}=pageParams(input,{max:50,def:25});
   const customerQ=input.customerQ===undefined||String(input.customerQ).trim()===''?null:String(input.customerQ).trim();
   if(customerQ!==null&&(customerQ.length<2||customerQ.length>100||/[\u0000-\u001f\u007f]/.test(customerQ)))throw new EconomicError('filter_invalid',400);
   return read(async s=>{
    const cur=dec(cursor,v=>typeof v.k==='string'&&v.k.length>0&&v.k.length<=200);
    const distinct=(await s.query('SELECT DISTINCT actor_id FROM public.economic_order_customers WHERE tenant_id=$1',[s.tenantId])).rows;
    const okActors=[];for(const a of distinct)if((await s.query('SELECT public.economic_contributor_active($1::uuid,$2::uuid) AS ok',[s.tenantId,a.actor_id])).rows[0].ok)okActors.push(a.actor_id);
    const args=[s.tenantId,okActors],where=[];
    if(q){args.push(like(q));where.push(`customer_key ILIKE $${args.length}`);}
    if(cur){args.push(cur.k);where.push(`customer_key>$${args.length}`);}
    args.push(limit+1);
    const keys=(await s.query(`SELECT customer_key FROM public.economic_order_customers WHERE tenant_id=$1 AND customer_key IS NOT NULL AND actor_id=ANY($2::uuid[]) ${where.length?'AND '+where.join(' AND '):''} GROUP BY customer_key ORDER BY customer_key LIMIT $${args.length}`,args)).rows.map(r=>r.customer_key);
    const more=keys.length>limit;if(more)keys.length=limit;
    const totalKeys=(await s.query('SELECT count(DISTINCT customer_key)::int AS n FROM public.economic_order_customers WHERE tenant_id=$1 AND customer_key IS NOT NULL AND actor_id=ANY($2::uuid[])',[s.tenantId,okActors])).rows[0].n;
    const bindRows=async(sql,params)=>(await s.query(`SELECT m.*,public.economic_contributor_active(m.tenant_id,m.actor_id) AS actor_active FROM (${sql}) m`,params)).rows;
    const bview=r=>({id:r.id,customerKey:r.customer_key,customerId:r.customer_id,version:r.version,active:r.active,valid:r.actor_active,report:r.actor_active?r.report:null,createdAt:iso(r.created_at)});
    const forPage=keys.length?await bindRows('SELECT DISTINCT ON(customer_key) * FROM public.workspace_customer_identity_versions WHERE tenant_id=$1 AND customer_key=ANY($2::text[]) ORDER BY customer_key,version DESC',[s.tenantId,keys]):[];
    const recent=await bindRows('SELECT * FROM (SELECT DISTINCT ON(customer_key) * FROM public.workspace_customer_identity_versions WHERE tenant_id=$1 ORDER BY customer_key,version DESC) x ORDER BY created_at DESC LIMIT 20',[s.tenantId]);
    const counts=(await s.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE active)::int AS active FROM (SELECT DISTINCT ON(customer_key) active FROM public.workspace_customer_identity_versions WHERE tenant_id=$1 ORDER BY customer_key,version DESC) x',[s.tenantId])).rows[0];
    // etiquetas: solo de los clientes vinculados que se muestran (≤ página + 20) y validados por la misma función de siempre
    const labels=new Map();for(const id of new Set([...forPage,...recent].filter(r=>r.actor_active&&r.active).map(r=>r.customer_id))){const c=await sourceCustomer(s,id);if(c)labels.set(id,{id,label:c.label,source:c.source});}
    let customers=[];
    if(customerQ!==null){
     const pattern=like(customerQ);
     const cand=(await s.query(`SELECT h.id FROM public.source_heads h JOIN public.source_revisions r ON r.tenant_id=h.tenant_id AND r.id=h.selected_revision_id
      WHERE h.tenant_id=$1 AND h.entity_type='customer' AND h.state IN('unique','selected') AND r.entity_type='customer'
      AND (r.external_id ILIKE $2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot) x WHERE x->>'table'='customers' AND (x->'row'->>'display_name' ILIKE $2 OR x->'row'->>'external_id' ILIKE $2))) ORDER BY h.id LIMIT 60`,[s.tenantId,pattern])).rows;
     for(const c of cand){if(customers.length>=25)break;const v=labels.get(c.id)??(await sourceCustomer(s,c.id).then(x=>x&&{id:c.id,label:x.label,source:x.source}));if(v)customers.push(v);}
    }
    return {
     customers,declaredKeys:keys,bindings:forPage.map(bview),recentBindings:recent.map(bview),boundCustomers:[...labels.values()],
     canWrite:s.role==='owner',nextCursor:more?enc({k:keys.at(-1)}):null,limit,query:q,customerQuery:customerQ,
     summary:{declaredKeys:totalKeys,decisions:counts.total,activeDecisions:counts.active,label:'observado'},
     notice:'Vínculo explícito con una identidad importada. Abre una nueva vista de identidad para aplicar el vínculo. Su corte de identidad es independiente del corte financiero; las vistas anteriores conservan sus referencias.'
    };
   });
  }
 };
}

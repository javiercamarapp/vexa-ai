// Cobertura de pedidos, envíos y devoluciones. Solo lectura, acotada al tenant y bajo la sesión RLS de quien consulta.
// Lee el RESUMEN precomputado public.order_coverage_summary (migración 20261213000000; lo llena public.refresh_order_coverage fuera de la ruta del usuario):
// las vistas order_link_coverage y order_returns_coverage tardan 19.6 s y 4.4 s, mucho más que el tope del panel. Las filas son agregados: sin IDs de pedido ni datos de clientes finales.
// Estados por parte (lectura.<parte>): 'ok' hay resumen; 'sin_resumen' nunca se calculó o la migración aún no está aplicada; 'tiempo' la lectura agotó su tiempo.
// Una parte sin resumen o sin leer es null = «no disponible», NUNCA cero ni «sin datos». Más el rango de fechas de los envíos (una lectura barata).
const n=(v)=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
// Las fechas llegan como texto AAAA-MM-DD (jsonb / ::text): un Date se correría un día en zonas al este de UTC.
const dia=(v)=>(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):null);
const instante=(v)=>{const t=v instanceof Date?v:typeof v==='string'?new Date(v):null;return t&&Number.isFinite(t.getTime())?t.toISOString():null;};
export const RESUMEN_SQL='SELECT tenant_id,kind,rows,refreshed_at FROM public.order_coverage_summary WHERE tenant_id=$1';
export const PERIODO_ENVIOS_SQL=`SELECT retailer,min(ship_date)::text AS desde,max(ship_date)::text AS hasta FROM public.order_shipments WHERE tenant_id=$1 GROUP BY retailer`;
const enlace=(r)=>({retailer:String(r.retailer),entidad:String(r.entidad),tipo:String(r.tipo),total:n(r.total),ligados:n(r.ligados),sinId:n(r.sin_id),sinLigar:n(r.sin_ligar),denominador:n(r.denominador),cobertura:n(r.cobertura)});
const devolucion=(r)=>({retailer:String(r.retailer),mes:dia(r.mes),devoluciones:n(r.devoluciones),sinId:n(r.sin_id),denominador:n(r.denominador),conPedido:n(r.con_pedido),conEnvio:n(r.con_envio),coberturaPedido:n(r.cobertura_pedido),coberturaEnvio:n(r.cobertura_envio)});
const MAP={enlaces:enlace,devoluciones:devolucion};
// 57014 = tiempo agotado; 42P01 = relación inexistente (migración sin aplicar). Ambos se contienen en un SAVEPOINT: la transacción sigue sirviendo a las demás lecturas.
async function intentar(s,sql){
 await s.query('SAVEPOINT pedcob');
 try{const rows=(await s.query(sql,[s.tenantId])).rows;await s.query('RELEASE SAVEPOINT pedcob');return {rows};}
 catch(e){if(e?.code==='57014'||e?.code==='42P01'){await s.query('ROLLBACK TO SAVEPOINT pedcob');return {error:e.code==='42P01'?'sin_resumen':'tiempo'};}throw e;}
}
export function createOrderCoverageRepository({database,timeoutMs=4000}){
 return {
  async coverage(){
   return database.transaction('read',async s=>{
    await s.query("SELECT set_config('statement_timeout',$1,true)",[String(timeoutMs)]);
    const res=await intentar(s,RESUMEN_SQL),per=await intentar(s,PERIODO_ENVIOS_SQL);
    const out={enlaces:null,devoluciones:null,periodoEnvios:null,refreshedAt:{enlaces:null,devoluciones:null},lectura:{enlaces:res.error??'sin_resumen',devoluciones:res.error??'sin_resumen'}};
    // Defensa en profundidad además de RLS y del WHERE: una fila de otro tenant jamás se mezcla.
    for(const r of res.rows??[]){
     if(String(r.tenant_id).toLowerCase()!==String(s.tenantId).toLowerCase()||!MAP[r.kind]||!Array.isArray(r.rows))continue;
     out[r.kind]=r.rows.map(MAP[r.kind]);out.refreshedAt[r.kind]=instante(r.refreshed_at);out.lectura[r.kind]='ok';
    }
    if(per.rows)out.periodoEnvios=per.rows.map(r=>({retailer:String(r.retailer),desde:dia(r.desde),hasta:dia(r.hasta)}));
    return out;
   });
  }
 };
}

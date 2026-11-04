// Cobertura de pedidos, envíos de Speedship y devoluciones. Solo lectura, acotada al tenant y bajo la sesión RLS de quien consulta.
// Lee las vistas public.order_link_coverage y public.order_returns_coverage (agregados: sin IDs de pedido ni datos de clientes finales)
// y el rango de fechas de los envíos. Si una consulta agota su tiempo devuelve null para esa parte: «desconocido» no se convierte en cero.
import {guarded} from './trends.mjs';
const n=(v)=>(v===null||v===undefined?null:Number(v));
const dia=(v)=>{if(v===null||v===undefined)return null;const s=v instanceof Date?v.toISOString():String(v);return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null;};
export const ENLACES_SQL='SELECT retailer,entidad,tipo,total,ligados,sin_id,sin_ligar,denominador,cobertura FROM public.order_link_coverage WHERE tenant_id=$1';
export const DEVOLUCIONES_SQL='SELECT retailer,mes,devoluciones,sin_id,denominador,con_pedido,con_envio,cobertura_pedido,cobertura_envio FROM public.order_returns_coverage WHERE tenant_id=$1';
export const PERIODO_ENVIOS_SQL='SELECT retailer,min(ship_date) AS desde,max(ship_date) AS hasta FROM public.order_shipments WHERE tenant_id=$1 GROUP BY retailer';
export function createOrderCoverageRepository({database,timeoutMs=4000}){
 return {
  async coverage(){
   return database.transaction('read',async s=>{
    const q=(sql)=>guarded(s,async()=>(await s.query(sql,[s.tenantId])).rows,timeoutMs);
    const enlaces=await q(ENLACES_SQL),devoluciones=await q(DEVOLUCIONES_SQL),periodo=await q(PERIODO_ENVIOS_SQL);
    return {
     enlaces:enlaces?enlaces.map(r=>({retailer:String(r.retailer),entidad:String(r.entidad),tipo:String(r.tipo),total:n(r.total),ligados:n(r.ligados),sinId:n(r.sin_id),sinLigar:n(r.sin_ligar),denominador:n(r.denominador),cobertura:n(r.cobertura)})):null,
     devoluciones:devoluciones?devoluciones.map(r=>({retailer:String(r.retailer),mes:dia(r.mes),devoluciones:n(r.devoluciones),sinId:n(r.sin_id),denominador:n(r.denominador),conPedido:n(r.con_pedido),conEnvio:n(r.con_envio),coberturaPedido:n(r.cobertura_pedido),coberturaEnvio:n(r.cobertura_envio)})):null,
     periodoEnvios:periodo?periodo.map(r=>({retailer:String(r.retailer),desde:dia(r.desde),hasta:dia(r.hasta)})):null};
   });
  }
 };
}

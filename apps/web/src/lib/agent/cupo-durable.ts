import 'server-only';
import {serverPool} from '../imports/server';
/** R2-12: cupo diario de preguntas al agente por (organización, usuario), compartido entre instancias (public.agent_turn_admit, migración 20261206000400).
 *  'sin_base' = no hay base configurada, la migración aún no existe o falló: el límite en memoria de la instancia sigue valiendo (falla abierto, como el resto de los límites). */
export type CupoDeAgente='ok'|'limite'|'sin_base';
export type PoolMinimo={connect():Promise<{query(sql:string,values?:readonly unknown[]):Promise<{rows:Array<Record<string,unknown>>}>;release():void}>};
export async function admitirTurnoDurable(tenantId:string,userId:string,limite=100,pool?:PoolMinimo):Promise<CupoDeAgente>{
  let p=pool;if(!p){if(!process.env.VEXA_DATABASE_URL)return 'sin_base';try{p=serverPool() as unknown as PoolMinimo;}catch{return 'sin_base';}}
  let c;try{c=await p.connect();}catch{return 'sin_base';}
  let abierta=false;
  try{
    await c.query('BEGIN');abierta=true;await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('statement_timeout','1500',true)");
    const r=await c.query('SELECT public.agent_turn_admit($1::uuid,$2::uuid,$3::int) AS r',[tenantId,userId,limite]);await c.query('COMMIT');abierta=false;
    const v=r.rows[0]?.r as {ok?:boolean}|undefined;
    return v&&v.ok===true?'ok':v&&v.ok===false?'limite':'sin_base';
  }catch{if(abierta){try{await c.query('ROLLBACK');}catch{/* gana el fallo original */}}return 'sin_base';}
  finally{try{c.release();}catch{/* sin detalles */}}
}

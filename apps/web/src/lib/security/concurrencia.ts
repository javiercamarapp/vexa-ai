import type {SqlPool} from '@vexa/platform/db';

/** Máximo de operaciones pesadas simultáneas por organización (y su caducidad de arrendamiento). Una organización no puede agotar el pool de 5 conexiones. */
export const TOPES:Record<string,{max:number;ttl:number}>={export:{max:2,ttl:60},import:{max:2,ttl:90},materialize:{max:1,ttl:90}};
async function llamar<T>(obtenerPool:()=>SqlPool,sql:string,valores:unknown[],tiempoMs=1500):Promise<T>{
  const c=await obtenerPool().connect();let abierta=false;
  try{
    await c.query('BEGIN');abierta=true;await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('statement_timeout',$1,true)",[String(tiempoMs)]);
    const r=await c.query<{v:T}>(sql,valores as never);await c.query('COMMIT');abierta=false;return r.rows[0]?.v as T;
  }catch(error){if(abierta){try{await c.query('ROLLBACK');}catch{/* gana el fallo original */}}throw error;}
  finally{try{c.release();}catch{/* sin detalles */}}
}
/**
 * Guardia que db.ts llama antes de abrir la transacción de una acción pesada. Devuelve la función de liberación, o null si la organización
 * ya tiene el máximo en curso. Falla ABIERTO (devuelve una liberación vacía) si no hay base, la migración no está aplicada o tarda más de 1.5 s.
 */
export function crearGuardia(obtenerPool:()=>SqlPool,activo:()=>boolean=()=>Boolean(process.env.VEXA_DATABASE_URL)){
  return async(tenantId:string,accion:string):Promise<(()=>void)|null>=>{
    const tope=TOPES[accion];if(!tope||!activo())return ()=>{};
    let id:string|null;
    try{
      id=await Promise.race([llamar<string|null>(obtenerPool,'SELECT public.api_concurrency_acquire($1::uuid,$2,$3,$4) AS v',[tenantId,accion,tope.max,tope.ttl]),new Promise<never>((_,rechazar)=>setTimeout(()=>rechazar(new Error('t')),1500))]);
    }catch{return ()=>{};}
    if(!id)return null;
    return ()=>{void llamar(obtenerPool,'SELECT public.api_concurrency_release($1::uuid) AS v',[id]).catch(()=>{/* el arrendamiento caduca solo */});};
  };
}

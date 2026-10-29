import 'server-only';
import {createHmac} from 'node:crypto';
import type {SqlPool} from '@vexa/platform/db';
import {ipBucket} from './admission';

export type ThrottleVerdict={verdict:'ok'|'ip_limited'|'duplicate';retryAfterSeconds:number};
/** Llave de las huellas: propia si existe; si no, derivada del secreto de la conexión a la base (nunca la IP ni el correo en claro en la tabla). */
function key():string|null{
 const own=process.env.VEXA_EMAIL_THROTTLE_KEY,db=process.env.VEXA_DATABASE_URL;
 if(own&&own.length>=16)return own;
 return db?createHmac('sha256','email-throttle-v1').update(db).digest('hex'):null;
}
export function fingerprint(scope:'ip'|'email',value:string,k:string):string{return createHmac('sha256',k).update(scope+':'+value).digest('hex');}
/**
 * AUTH-03: límite por IP y por correo COMPARTIDO por todas las instancias (public.email_auth_admit, migración 20261205000000).
 * Devuelve null si no está disponible (sin base configurada, migración sin aplicar, fallo o más de 1.5 s): el llamador cae al límite local
 * de la instancia, de modo que el acceso por correo nunca depende de esta tabla. El veredicto no depende de que la cuenta exista.
 */
export async function emailThrottle(email:string,ip:string|null,getPool:()=>SqlPool,timeoutMs=1500):Promise<ThrottleVerdict|null>{
 const k=key();if(!k)return null;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const work=(async():Promise<ThrottleVerdict|null>=>{
  const pool=getPool();const connection=await pool.connect();let open=false;
  try{
   await connection.query('BEGIN');open=true;
   await connection.query('SET LOCAL ROLE vexa_backend');
   await connection.query("SELECT set_config('statement_timeout','1500',true)");
   const result=await connection.query<{r:{verdict:string;retry_after:number}}>('SELECT public.email_auth_admit($1,$2) AS r',[ip?fingerprint('ip',ipBucket(ip),k):null,fingerprint('email',email.trim().toLowerCase(),k)]);
   await connection.query('COMMIT');open=false;
   const r=result.rows[0]?.r;
   if(!r||!['ok','ip_limited','duplicate'].includes(r.verdict))return null;
   return {verdict:r.verdict as ThrottleVerdict['verdict'],retryAfterSeconds:r.verdict==='ok'?0:Math.max(1,Math.min(3600,Number(r.retry_after)||60))};
  }catch{
   if(open){try{await connection.query('ROLLBACK');}catch{/* gana el fallo original */}}
   return null;
  }finally{try{connection.release();}catch{/* sin detalles del controlador */}}
 })().catch(()=>null);
 try{return await Promise.race([work,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}

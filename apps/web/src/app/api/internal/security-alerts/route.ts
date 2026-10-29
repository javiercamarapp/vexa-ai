import 'server-only';
import {createHash,timingSafeEqual} from 'node:crypto';
import {serverPool} from '../../../../lib/imports/server';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const digest=(value:string)=>createHash('sha256').update(value).digest();
/**
 * Cron cada 15 minutos (vercel.json): evalúa los umbrales de seguridad sobre los contadores de la base (public.evaluate_security_alerts) y, si se cruza alguno,
 * deja UN evento alert_raised por cubeta de 15 minutos, visible en /platform/auditoria y /platform/alertas. Mismo Bearer que los demás cron internos.
 */
async function manejar(request:Request){
 const reply=(code:string,status:number,extra:object={})=>Response.json({code,...extra},{status,headers:{'Cache-Control':'private, no-store'}});
 const secret=process.env.VEXA_WORKER_TRIGGER_SECRET;
 if(!secret||secret.length<32)return reply('SECURITY_ALERTS_CONFIGURATION_REQUIRED',503);
 if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret))){try{globalThis.__vexaSecuritySink?.({kind:'bearer_invalid',route:new URL(request.url).pathname,method:request.method,ipRaw:request.headers.get('x-forwarded-for'),ua:request.headers.get('user-agent')});}catch{/* el registro nunca rompe */}return reply('UNAUTHORIZED',401);}
 const c=await serverPool().connect();let abierta=false;
 try{
  await c.query('BEGIN');abierta=true;await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('statement_timeout','5000',true)");
  const r=await c.query<{r:{raised:boolean}}>('SELECT public.evaluate_security_alerts() AS r');await c.query('COMMIT');abierta=false;
  return reply('OK',200,{raised:r.rows[0]?.r?.raised===true});
 }catch{if(abierta){try{await c.query('ROLLBACK');}catch{/* gana el fallo original */}}return reply('SECURITY_ALERTS_UNAVAILABLE',503);}
 finally{try{c.release();}catch{/* sin detalles */}}
}
export const GET=manejar;
export const POST=manejar;

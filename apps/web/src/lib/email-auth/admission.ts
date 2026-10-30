import {createHmac,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

export type Admission={finish(unavailable?:boolean):void};
export type AdmissionResult=
 |{kind:'lease';lease:Admission}
 |{kind:'duplicate'}                              // misma dirección en <60 s: el 202 genérico es el comportamiento previsto
 |{kind:'busy';retryAfterSeconds:number}          // cupo global agotado o circuito abierto: 503 email_auth_busy
 |{kind:'ip_limited';retryAfterSeconds:number};   // demasiadas solicitudes de la misma IP: 429
const IP_LIMIT=10,IP_WINDOW_MS=60000,IP_TABLE_MAX=4096;

/** IP del cliente. R2-13: en Vercel `x-vercel-forwarded-for` y `x-real-ip` las fija el borde (no el cliente); se prefieren a `x-forwarded-for`, cuyo primer salto se usa solo de respaldo. Un valor que no es IP cae al siguiente. */
export function clientIp(headers:{get(name:string):string|null}):string|null{
 for(const nombre of ['x-vercel-forwarded-for','x-real-ip','x-forwarded-for']){
  const v=headers.get(nombre)?.split(',')[0]?.trim();
  if(v&&isIP(v))return v;
 }
 return null;
}
/** Cubo de límite: IPv4 exacta; IPv6 agrupada por /64 (un cliente recibe un /64 entero, así no puede fabricar miles de cubos). */
export function ipBucket(ip:string):string{
 if(!ip.includes(':'))return ip;
 const mapped=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);if(mapped)return mapped[1];
 const [head,tail]=ip.toLowerCase().split('::'),h=head?head.split(':'):[],t=tail===undefined?[]:tail?tail.split(':'):[];
 const groups=tail===undefined?h:[...h,...Array<string>(Math.max(0,8-h.length-t.length)).fill('0'),...t];
 return groups.slice(0,4).map(g=>g.replace(/^0+(?=.)/,'')).join(':')+'::/64';
}
// Respaldo local por instancia (concurrencia en vuelo, circuito del proveedor y, sin base, un límite por IP/correo). El límite compartido por IP y por correo vive en la base (throttle.ts).
export function createEmailAdmission(now:()=>number=()=>performance.now()){
 const key=randomBytes(32),recent=new Map<string,number>(),perIp=new Map<string,{count:number;resetAt:number}>();let active=0,blockedUntil=0;
 const seconds=(ms:number)=>Math.max(1,Math.ceil(ms/1000));
 function release():Admission{let finished=false;return {finish(unavailable=false){if(finished)return;finished=true;active--;if(unavailable)blockedUntil=Math.max(blockedUntil,now()+15000);}};}
 /** `distributed`: el límite por IP y por correo ya lo decidió la base (throttle.ts); aquí solo quedan la concurrencia en vuelo y el circuito del proveedor. */
 function admit(email:string,ip:string|null=null,distributed=false):AdmissionResult{
  const time=now();for(const [id,expires]of recent)if(expires<=time)recent.delete(id);
  for(const [id,entry]of perIp)if(entry.resetAt<=time)perIp.delete(id);
  // Cupo global: se avisa (503) en vez de fingir un envío que no ocurrirá.
  if(time<blockedUntil)return {kind:'busy',retryAfterSeconds:seconds(blockedUntil-time)};
  if(active>=8)return {kind:'busy',retryAfterSeconds:10};
  if(distributed){active++;return {kind:'lease',lease:release()};}
  // Límite por IP, separado del global: una sola IP no puede llenar el cupo de todos. Sin IP confiable no se limita (no hay un cubo «desconocido» compartido).
  if(ip){
   ip=ipBucket(ip);const entry=perIp.get(ip);
   if(entry){if(entry.count>=IP_LIMIT)return {kind:'ip_limited',retryAfterSeconds:seconds(entry.resetAt-time)};entry.count++;}
   else{
    // Tabla acotada: al llenarse se expulsa la entrada más antigua (orden de inserción) en vez de dejar de limitar.
    if(perIp.size>=IP_TABLE_MAX)perIp.delete(perIp.keys().next().value as string);
    perIp.set(ip,{count:1,resetAt:time+IP_WINDOW_MS});
   }
  }
  const id=createHmac('sha256',key).update(email.trim().toLowerCase()).digest('hex');
  if(recent.has(id))return {kind:'duplicate'};
  if(recent.size>=256)return {kind:'busy',retryAfterSeconds:seconds(Math.min(...recent.values())-time)};
  recent.set(id,time+60000);active++;
  return {kind:'lease',lease:release()};
 }
 return {bloqueado(){return now()<blockedUntil;},admit,
  /** Compatibilidad: lease o null cuando no se admite por cualquier motivo. */
  reserve(email:string,ip:string|null=null){const r=admit(email,ip);return r.kind==='lease'?r.lease:null;}};
}
export const emailAdmission=createEmailAdmission();

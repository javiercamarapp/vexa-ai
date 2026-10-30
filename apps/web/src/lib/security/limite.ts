import {createHmac} from 'node:crypto';
import {clientIp,ipBucket} from '../email-auth/admission';
import {claveDeHuellas} from './eventos';

/**
 * Límite general de peticiones (H-01). Cubetas por CLASE de endpoint, por huella de IP y por huella de sesión, con contador compartido en la base
 * (public.api_rate_add, migración 20261205000500). Para no hacer un viaje a la base por petición, cada instancia acumula localmente y suma por lotes
 * (cada ~5 s o cada 25 peticiones por huella); decide con el último total global conocido más lo pendiente. Si la base falla, cae al conteo local
 * (falla abierto: el producto no depende de esta tabla). Las huellas son HMAC: ni la IP ni el token salen en claro.
 */
export type Clase='read'|'write'|'export'|'import'|'ai'|'auth'|'hook';
/** Peticiones por minuto. `user` = por sesión autenticada; `ip` = por IP (más alto: varias personas pueden compartir una IP). */
export const LIMITES:Record<Clase,{user:number|null;ip:number}>={
  read:{user:240,ip:600},write:{user:60,ip:150},export:{user:10,ip:30},import:{user:20,ip:60},ai:{user:20,ip:60},auth:{user:null,ip:30},hook:{user:null,ip:240},
};
/** Clase de una petición por método y ruta; null = sin límite general (salud, estáticos, páginas). */
export function claseDe(method:string,pathname:string,search=''):Clase|null{
  const m=method.toUpperCase();
  if(pathname==='/api/health'||pathname.startsWith('/api/health/'))return null;
  if(/^\/auth\/(?:email|google|callback|invitations)(?:\/|$)/.test(pathname))return 'auth';
  // R2-13: rutas de datos fuera de /api que también hacen trabajo caro o sensible: exportaciones, copiloto y los endpoints de datos de CFO, plataforma, seguridad y organización.
  if(/^\/(?:cfo|platform)\/data\/(?:export|download)(?:\/|$)/.test(pathname))return 'export';
  if(/^\/(?:cfo|platform)\/data\/copilot(?:\/|$)/.test(pathname)&&m!=='GET'&&m!=='HEAD')return 'ai';
  if(/^\/(?:cfo\/data|platform\/data|seguridad\/data|auth\/organization)(?:\/|$)/.test(pathname))return m==='GET'||m==='HEAD'||m==='OPTIONS'?'read':'write';
  if(!pathname.startsWith('/api/'))return null;
  if(/^\/api\/(?:webhooks|internal|baja)(?:\/|$)/.test(pathname))return 'hook';
  if(/\/(?:export|download)(?:\/|$)/.test(pathname)||/^\/api\/jobs\/[^/]+\/errors\/?$/i.test(pathname)||/(?:^|[?&])format=(?:csv|pdf|xlsx)(?:&|$)/i.test(search))return 'export';
  if(/^\/api\/imports(?:\/|$)/.test(pathname)&&m!=='GET'&&m!=='HEAD')return 'import';
  if(/^\/api\/agent(?:\/|$)|^\/api\/pain-points\/[^/]+\/ia\/?$|^\/api\/extraction(?:\/|$)/.test(pathname)&&m!=='GET'&&m!=='HEAD')return 'ai';
  return m==='GET'||m==='HEAD'||m==='OPTIONS'?'read':'write';
}
/** R2-13: huella del USUARIO derivada del `sub` ya VERIFICADO por Supabase Auth (getUser). Nunca de cookies sin verificar: rotar el refresh_token no cambia el sub, y falsificar un sub no pasa la verificación. */
export function huellaDeUsuario(sub:string|null|undefined,clave:string|null):string|null{
  return sub&&clave?createHmac('sha256',clave).update('user:'+sub).digest('hex'):null;
}
export const huellaIp=(ip:string|null,clave:string|null)=>ip&&clave?createHmac('sha256',clave).update('rl-ip:'+ipBucket(ip)).digest('hex'):null;

type Estado={minuto:number;global:number;pend:number;sync:boolean;ult:number};
export type Decision={permitido:true}|{permitido:false;reintentarEn:number;por:'ip'|'sesion'};
export function crearLimitador(opciones:{sumar:(clase:string,huella:string,n:number)=>Promise<number>|null;ahora?:()=>number;syncMs?:number;maxPendiente?:number;maxClaves?:number;maxVuelo?:number}){
  const {sumar,ahora=()=>Date.now(),syncMs=5000,maxPendiente=25,maxClaves=5000,maxVuelo=2}=opciones;
  let enVuelo=0;
  const estados=new Map<string,Estado>();
  function cubeta(clave:string,t:number):Estado{
    const minuto=Math.floor(t/60000);let e=estados.get(clave);
    if(!e||e.minuto!==minuto){
      if(!e&&estados.size>=maxClaves)estados.delete(estados.keys().next().value as string);
      e={minuto,global:0,pend:0,sync:false,ult:t};if(estados.has(clave))estados.delete(clave);estados.set(clave,e);
    }
    return e;
  }
  function volcar(clase:string,huella:string,e:Estado,t:number){
    // R2-13: tope global de volcados simultáneos a la base; el excedente espera (el conteo local sigue vigente y se vuelca en la siguiente ocasión).
    if(e.sync||e.pend<1||enVuelo>=maxVuelo)return;
    const n=Math.min(e.pend,10000),minuto=e.minuto;e.sync=true;e.ult=t;enVuelo++;
    let p:Promise<number>|null=null;try{p=sumar(clase,huella,n);}catch{p=null;}
    if(!p){e.sync=false;enVuelo--;return;}
    p.then(total=>{if(e.minuto===minuto&&Number.isFinite(total)){e.global=total;e.pend=Math.max(0,e.pend-n);}}).catch(()=>{/* falla abierto: sigue el conteo local */}).finally(()=>{e.sync=false;enVuelo--;});
  }
  function contar(clase:Clase,huella:string|null,tope:number|null,por:'ip'|'sesion',t:number):Decision{
    if(!huella||tope===null)return {permitido:true};
    const e=cubeta(clase+'|'+huella,t);e.pend++;
    if(e.pend>=maxPendiente||t-e.ult>=syncMs)volcar(clase,huella,e,t);
    if(e.global+e.pend>tope)return {permitido:false,reintentarEn:Math.max(1,Math.ceil(((e.minuto+1)*60000-t)/1000)),por};
    return {permitido:true};
  }
  return {
    revisar(clase:Clase,ipHash:string|null,sesionHash:string|null):Decision{
      const t=ahora(),l=LIMITES[clase];
      const a=contar(clase,ipHash,l.ip,'ip',t);if(!a.permitido)return a;
      return contar(clase,sesionHash,l.user,'sesion',t);
    },
    _tamano:()=>estados.size,
  };
}

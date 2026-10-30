import 'server-only';
import {serverPool} from '../imports/server';
import {claveDeHuellas} from './eventos';
import {clientIp} from '../email-auth/admission';
import {randomBytes} from 'node:crypto';
import {claseDe,crearLimitador,huellaDeUsuario,huellaIp,type Clase} from './limite';
import {AccessError} from '@vexa/platform/session';

/** Suma por lotes en la base con el rol vexa_backend (tiempo máximo 1.5 s). Sin base configurada devuelve null: el limitador cuenta solo en local. */
function sumarEnBase(clase:string,huella:string,n:number):Promise<number>|null{
  if(!process.env.VEXA_DATABASE_URL)return null;
  return (async()=>{
    const c=await serverPool().connect();let abierta=false;
    try{
      await c.query('BEGIN');abierta=true;await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('statement_timeout','1500',true)");
      const r=await c.query<{n:number}>('SELECT public.api_rate_add($1,$2,$3) AS n',[clase,huella,n]);await c.query('COMMIT');abierta=false;
      return Number(r.rows[0]?.n);
    }catch(error){if(abierta){try{await c.query('ROLLBACK');}catch{/* gana el fallo original */}}throw error;}
    finally{try{c.release();}catch{/* sin detalles */}}
  })();
}
/** Sin llave configurada (desarrollo, pruebas) se usa una llave aleatoria del proceso: el límite local sigue funcionando, solo que no se comparte. */
const CLAVE_PROCESO=randomBytes(32).toString('hex');
export const limitador=crearLimitador({sumar:sumarEnBase});
export {claseDe};
/** Evalúa una petición EN EL BORDE: solo tope por IP. El tope por usuario se aplica después de verificar la sesión (revisarUsuario / exigirCupoUsuario): una cookie sin verificar no sirve de identidad (R2-13). Devuelve null si pasa o { clase, reintentarEn } si debe responder 429. Nunca lanza. */
export function evaluarLimite(request:{method:string;headers:{get(n:string):string|null}},pathname:string,search:string):{clase:string;reintentarEn:number;por:'ip'|'sesion'}|null{
  try{
    const clase=claseDe(request.method,pathname,search);if(!clase)return null;
    const clave=claveDeHuellas()??CLAVE_PROCESO;
    const d=limitador.revisar(clase,huellaIp(clientIp(request.headers),clave),null);
    return d.permitido?null:{clase,reintentarEn:d.reintentarEn,por:d.por};
  }catch{return null;}
}
/** R2-13: tope por usuario con el `sub` ya verificado. Null si pasa; { clase, reintentarEn } si excede. Nunca lanza. */
export function revisarUsuario(sub:string,method:string,pathname:string,search=''):{clase:Clase;reintentarEn:number}|null{
  try{
    const clase=claseDe(method,pathname,search);if(!clase)return null;
    const d=limitador.revisar(clase,null,huellaDeUsuario(sub,claveDeHuellas()??CLAVE_PROCESO));
    return d.permitido?null:{clase,reintentarEn:d.reintentarEn};
  }catch{return null;}
}
/** Llamar justo después de verificar la sesión (getUser): lanza AccessError 429 si el usuario excede su cupo por minuto. Lee método y ruta de la cabecera interna x-vexa-route; sin ella (pruebas, fuera de una petición) no limita. */
export async function exigirCupoUsuario(sub:string):Promise<void>{
  let ruta='';
  try{const {headers}=await import('next/headers');ruta=(await headers()).get('x-vexa-route')??'';}catch{return;}
  const [metodo,...resto]=ruta.split(' ');if(!metodo||!resto.length)return;
  const [pathname,...q]=resto.join(' ').split('?');
  if(revisarUsuario(sub,metodo,pathname,q.length?'?'+q.join('?'):''))throw new AccessError(429,'rate_limited');
}

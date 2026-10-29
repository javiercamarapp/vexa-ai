import 'server-only';
import {serverPool} from '../imports/server';
import {claveDeHuellas} from './eventos';
import {clientIp} from '../email-auth/admission';
import {randomBytes} from 'node:crypto';
import {claseDe,crearLimitador,huellaDeSesion,huellaIp} from './limite';

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
/** Evalúa una petición. Devuelve null si pasa o { clase, reintentarEn } si debe responder 429. Nunca lanza. */
export function evaluarLimite(request:{method:string;headers:{get(n:string):string|null};cookie?:string|null},pathname:string,search:string):{clase:string;reintentarEn:number;por:'ip'|'sesion'}|null{
  try{
    const clase=claseDe(request.method,pathname,search);if(!clase)return null;
    const clave=claveDeHuellas()??CLAVE_PROCESO;
    const d=limitador.revisar(clase,huellaIp(clientIp(request.headers),clave),huellaDeSesion(request.cookie??request.headers.get('cookie'),clave));
    return d.permitido?null:{clase,reintentarEn:d.reintentarEn,por:d.por};
  }catch{return null;}
}

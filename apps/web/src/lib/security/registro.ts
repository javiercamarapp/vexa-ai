import 'server-only';
import {after} from 'next/server';
import {headers} from 'next/headers';
import type {SqlPool} from '@vexa/platform/db';
import {instalarEscritor,registrarEventoSeguridad,type EventoSeguridad} from './eventos';
import {crearGuardia} from './concurrencia';

/** Escritor real: public.record_security_event bajo vexa_backend con el pool del servidor (mismo patrón que el límite del enlace de acceso). */
export function escritorSobrePool(obtenerPool:()=>SqlPool){
  return async(carga:Record<string,unknown>)=>{
    const c=await obtenerPool().connect();let abierta=false;
    try{
      await c.query('BEGIN');abierta=true;await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('statement_timeout','1500',true)");
      await c.query('SELECT public.record_security_event($1::jsonb)',[JSON.stringify(carga)]);await c.query('COMMIT');abierta=false;
    }catch(error){if(abierta){try{await c.query('ROLLBACK');}catch{/* gana el fallo original */}}throw error;}
    finally{try{c.release();}catch{/* sin detalles del controlador */}}
  };
}
function diferir(trabajo:()=>Promise<void>){try{after(trabajo);}catch{void trabajo();}}
let instalado=false;
/** Instala el escritor real y publica el ayudante en globalThis para los paquetes (hosted.mjs, webhooks) que no importan código de la app. */
export function instalar(obtenerPool:()=>SqlPool){
  if(instalado)return;instalado=true;
  instalarEscritor(async carga=>escritorSobrePool(obtenerPool)(carga));
  (globalThis as {__vexaConcurrency?:unknown}).__vexaConcurrency=crearGuardia(obtenerPool);
  (globalThis as {__vexaSecuritySink?:unknown}).__vexaSecuritySink=(e:EventoSeguridad)=>void registrar(e);
}
/** Completa ruta, método, IP y agente desde la petición en curso cuando quien llama no los trae (sesión, base, CSRF). */
async function contexto(e:EventoSeguridad):Promise<EventoSeguridad>{
  if(e.route&&e.ipRaw!==undefined)return e;
  try{const h=await headers();const r=h.get('x-vexa-route')??'';const [metodo,...resto]=r.split(' ');
    return {...e,route:e.route??resto.join(' '),method:e.method??(resto.length?metodo:undefined),ipRaw:e.ipRaw??h.get('x-forwarded-for'),ua:e.ua??h.get('user-agent')};
  }catch{return e;}
}
export async function registrar(e:EventoSeguridad):Promise<void>{
  try{
    const c=await contexto(e);
    // Una visita sin sesión a una PÁGINA solo redirige a /login: no es un fallo de acceso. Se registran los 401 de rutas de datos y API.
    if(c.kind==='auth_401'&&c.route&&!/^\/(?:api|platform\/data|cfo\/data|seguridad\/data)\b/.test(c.route))return;
    registrarEventoSeguridad(c,undefined,diferir);
  }catch{/* nunca lanza */}
}

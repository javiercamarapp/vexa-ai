import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

/** Registro de eventos de seguridad (auditoría 3, R-1). Un solo ayudante de servidor: registrarEventoSeguridad(). NUNCA lanza ni retrasa la petición. */
export type TipoEvento='auth_401'|'forbidden_403'|'csrf_rejected'|'bearer_invalid'|'webhook_signature_invalid'|'rate_limited'|'support_start'|'support_end'|'support_blocked'|'export'|'invitation_sent'|'alert_raised'|'body_limit';
export type EventoSeguridad={
  kind:TipoEvento;severity?:'info'|'warn'|'high';route?:string;method?:string;tenantId?:string|null;actorId?:string|null;
  /** IP en claro (primer salto de x-forwarded-for) SOLO como entrada: se convierte en HMAC y nunca se guarda ni se registra. */
  ipRaw?:string|null;ua?:string|null;detail?:Record<string,string|number|boolean>;
};
export type Escritor=(carga:Record<string,unknown>)=>Promise<void>;

const UUID_SEG=/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;
const ID_SEG=/\/(?:[0-9]{3,}|[0-9a-f]{24,})(?=\/|$)/gi;
/** Ruta sin consulta ni identificadores: clase de ruta estable (/api/briefs/:id/export). */
export function claseDeRuta(ruta:string|null|undefined):string{
  const limpia=(ruta??'').split(/[?#]/)[0].replace(UUID_SEG,'/:id').replace(ID_SEG,'/:id');
  return limpia.slice(0,200);
}
/** Clave de las huellas: propia (VEXA_SECURITY_EVENTS_SALT ≥16) o derivada del secreto de la conexión a la base. Sin ninguna, no hay huella de IP. */
export function claveDeHuellas(env:Record<string,string|undefined>=process.env):string|null{
  const own=env.VEXA_SECURITY_EVENTS_SALT;if(own&&own.length>=16)return own;
  return env.VEXA_DATABASE_URL?createHmac('sha256','security-events-v1').update(env.VEXA_DATABASE_URL).digest('hex'):null;
}
export function huellaDeIp(ipRaw:string|null|undefined,clave:string|null):string|null{
  if(!ipRaw||!clave)return null;const primero=ipRaw.split(',')[0].trim();if(!isIP(primero))return null;
  return createHmac('sha256',clave).update('ip:'+primero).digest('hex');
}
/** Carga lista para public.record_security_event. El agente de usuario se trunca; el detalle solo admite escalares cortos (la base vuelve a filtrar). */
export function construirCarga(e:EventoSeguridad,clave:string|null):Record<string,unknown>{
  const detail:Record<string,string|number|boolean>={};
  for(const [k,v] of Object.entries(e.detail??{}))if(typeof v==='number'||typeof v==='boolean'||(typeof v==='string'&&v.length<=64))detail[k]=v;
  return {kind:e.kind,severity:e.severity,route:claseDeRuta(e.route),method:e.method,tenant_id:e.tenantId??undefined,actor_id:e.actorId??undefined,
    ip_hash:huellaDeIp(e.ipRaw,clave)??undefined,ua:e.ua?e.ua.slice(0,120):undefined,detail};
}

// ---- Resistencia: muestreo local (la base vuelve a muestrear), tope de escrituras en vuelo y tiempo máximo. ----
const ventana=new Map<string,{n:number;hasta:number}>();
let enVuelo=0;const MAX_EN_VUELO=2,MAX_CLAVES=2048;
const EXENTOS=new Set<TipoEvento>(['export','support_start','support_end','alert_raised','invitation_sent']);
export function permitirLocal(e:EventoSeguridad,ahora=Date.now()):boolean{
  if(EXENTOS.has(e.kind))return true;
  const clave=e.kind+'|'+(e.ipRaw??e.actorId??'-')+'|'+claseDeRuta(e.route);
  for(const [k,v] of ventana)if(v.hasta<=ahora)ventana.delete(k);
  if(ventana.size>=MAX_CLAVES)ventana.delete(ventana.keys().next().value as string);
  const w=ventana.get(clave);
  if(!w){ventana.set(clave,{n:1,hasta:ahora+60_000});return true;}
  w.n++;return w.n<=5||w.n%20===0;
}
export function _reiniciarLocal(){ventana.clear();enVuelo=0;}

/**
 * Registra un evento sin afectar la petición: sincrónico para quien llama, escritura diferida y con tiempo máximo de 1.5 s.
 * Si la base no está, el escritor falla o hay demasiadas escrituras en vuelo, el evento se descarta en silencio.
 * `escritor` se inyecta en pruebas; en producción es la llamada a public.record_security_event con el rol vexa_backend.
 */
export function registrarEventoSeguridad(e:EventoSeguridad,escritor?:Escritor|null,diferir:(trabajo:()=>Promise<void>)=>void=trabajo=>{void trabajo();}):void{
  try{
    if(!e||typeof e.kind!=='string')return;
    if(!permitirLocal(e))return;
    const w=escritor===undefined?escritorReal:escritor;if(!w)return;
    const clave=claveDeHuellas();const carga=construirCarga(e,clave);
    if(enVuelo>=MAX_EN_VUELO)return;
    enVuelo++;
    diferir(async()=>{
      try{let t:ReturnType<typeof setTimeout>|undefined;
        await Promise.race([w(carga),new Promise<void>(r=>{t=setTimeout(r,1500);})]).finally(()=>clearTimeout(t));
      }catch{/* el registro nunca rompe nada */}finally{enVuelo--;}
    });
  }catch{/* ni siquiera un fallo de construcción */}
}
let escritorReal:Escritor|null=null;
export function instalarEscritor(w:Escritor|null){escritorReal=w;}

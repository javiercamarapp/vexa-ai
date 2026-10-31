// Caché «stale-while-revalidate» de las lecturas JSON de las vistas (R3-CACHE). Una sola capa para useJson, el Resumen/Problemas y los paneles:
//  - clave = tenant + recurso + alcance (consulta normalizada: parámetros ordenados, sin resource/format cuando el recurso va aparte);
//  - memoria + sessionStorage (opcional); NADA nuevo en almacenamiento: solo la misma respuesta JSON que ya viajó al navegador;
//  - frescura 5 min (dentro no se vuelve a pedir), vida máxima 30 min (después se descarta); entre ambas se pinta al instante
//    el último dato bueno, rotulado con su antigüedad, y se revalida en segundo plano;
//  - si la revalidación falla el dato viejo se conserva (el llamador lo rotula); «Actualizar» solo lo marca obsoleto, no lo borra;
//  - de-duplicación de peticiones en vuelo por clave y precalentamiento (prefetch) con tope de concurrencia 2;
//  - el idioma activo va en la clave: las respuestas de las rutas ya viajan traducidas por el servidor (cookie rovaq_lang), así que un dato
//    cacheado en un idioma NUNCA se sirve en el otro (cambiar de idioma no reutiliza entradas del idioma anterior);
//  - aislamiento por tenant: la clave lo incluye y al fijar otro tenant (o cerrar sesión) se purga todo lo ajeno.
import {fetchCupo} from './cupo.mjs';
export const FRESCO_MS=5*60*1000;
export const VIDA_MS=30*60*1000;
export const PREFIJO='vexa:swr:';
export const TOPE_PREFETCH=2;
const memoria=new Map();
const enVuelo=new Map();
let tenantActual='';
let idiomaActual='es';
const almacenDe=()=>{try{return globalThis.sessionStorage??null;}catch{return null;}};
const claves=(almacen)=>{const r=[];try{if(almacen)for(let i=0;i<almacen.length;i++){const k=almacen.key(i);if(k?.startsWith(PREFIJO))r.push(k);}}catch{/* sin almacenamiento */}return r;};
/** URL o (recurso, consulta) -> clave estable. Con un solo argumento se normaliza «/ruta?b=2&a=1». */
export function claveSwr(recursoOUrl,consulta,{tenant=tenantActual,idioma=idiomaActual}={}){
 let ruta=recursoOUrl,q=consulta;
 if(q===undefined){const i=String(recursoOUrl).indexOf('?');ruta=i<0?recursoOUrl:recursoOUrl.slice(0,i);q=i<0?'':recursoOUrl.slice(i+1);}
 const p=new URLSearchParams(q);p.sort();
 return PREFIJO+tenant+'|'+ruta+'?'+p.toString()+'|'+(idioma==='en'?'en':'es');
}
export function idiomaFijado(){return idiomaActual;}
/** Fija el idioma activo de la caché (el de la interfaz). Las claves nuevas llevan ese idioma; las del otro idioma quedan aparte y no se sirven. */
export function fijarIdioma(idioma){idiomaActual=idioma==='en'?'en':'es';}
export function tenantFijado(){return tenantActual;}
/** Fija el tenant activo. Si cambia (otra organización) purga lo de los demás; '' = sin sesión: purga todo. */
export function fijarTenant(id,{almacen=almacenDe()}={}){
 const nuevo=id||'';if(nuevo===tenantActual)return;tenantActual=nuevo;
 const propio=PREFIJO+nuevo+'|';
 for(const k of [...memoria.keys()])if(!nuevo||!k.startsWith(propio))memoria.delete(k);
 for(const k of claves(almacen))if(!nuevo||!k.startsWith(propio)){try{almacen.removeItem(k);}catch{/* opcional */}}
 for(const k of [...enVuelo.keys()])if(!nuevo||!k.startsWith(propio))enVuelo.delete(k);
}
/** Cierre de sesión: borra memoria, almacenamiento, peticiones en vuelo y el tenant. */
export function limpiarTodo({almacen=almacenDe()}={}){
 memoria.clear();enVuelo.clear();tenantActual='';
 for(const k of claves(almacen)){try{almacen.removeItem(k);}catch{/* opcional */}}
 try{if(almacen){for(let i=almacen.length-1;i>=0;i--){const k=almacen.key(i);if(k?.startsWith('vexa:vista:'))almacen.removeItem(k);}}}catch{/* opcional */}
}
export function guardarSwr(clave,datos,{ahora=Date.now(),almacen=almacenDe()}={}){
 const entrada={t:ahora,datos};memoria.set(clave,entrada);
 const poner=()=>almacen?.setItem(clave,JSON.stringify(entrada));
 try{poner();}catch{
  // Cuota llena: suelta las entradas más viejas y reintenta una vez; si aún no cabe, queda solo la memoria.
  try{const viejas=claves(almacen).map(k=>{try{return [k,JSON.parse(almacen.getItem(k)).t];}catch{return [k,0];}}).sort((a,b)=>a[1]-b[1]).slice(0,6);for(const [k] of viejas)almacen.removeItem(k);poner();}catch{/* solo memoria */}
 }
}
/** {datos, edadMs, fresca, obsoleta} o null (no hay, pasó la vida máxima o la fecha es futura). Una entrada vencida se elimina. */
export function leerSwr(clave,{ahora=Date.now(),fresco=FRESCO_MS,vida=VIDA_MS,almacen=almacenDe()}={}){
 let e=memoria.get(clave);
 if(!e){try{const v=almacen?.getItem(clave);e=v?JSON.parse(v):undefined;if(e)memoria.set(clave,e);}catch{e=undefined;}}
 if(!e||typeof e.t!=='number'||ahora<e.t)return null;
 const edadMs=ahora-e.t;
 if(edadMs>vida){memoria.delete(clave);try{almacen?.removeItem(clave);}catch{/* opcional */}return null;}
 return {datos:e.datos,edadMs,fresca:edadMs<=fresco&&!e.obsoleta,obsoleta:!!e.obsoleta};
}
/** «Actualizar»: todo queda obsoleto (se vuelve a pedir) pero se conserva para pintar si la nueva lectura falla. */
export function invalidarSwr({almacen=almacenDe(),prefijo=''}={}){
 const marca=PREFIJO+tenantActual+'|'+prefijo;
 for(const [k,e] of memoria)if(k.startsWith(marca))e.obsoleta=true;
 for(const k of claves(almacen))if(k.startsWith(marca)){try{const e=JSON.parse(almacen.getItem(k));e.obsoleta=true;almacen.setItem(k,JSON.stringify(e));}catch{/* opcional */}}
}
export function olvidarMemoriaSwr(){memoria.clear();enVuelo.clear();tenantActual='';}
const abortar=()=>new DOMException('Aborted','AbortError');
const conSenal=(p,signal)=>{if(!signal)return p;if(signal.aborted)return Promise.reject(abortar());return new Promise((res,rej)=>{const a=()=>rej(abortar());signal.addEventListener('abort',a,{once:true});p.then(v=>{signal.removeEventListener('abort',a);res(v);},e=>{signal.removeEventListener('abort',a);rej(e);});});};
/**
 * GET JSON con de-duplicación por clave. Devuelve {status, json}. Guarda en caché solo respuestas 2xx que `valida` acepte
 * (nunca reemplaza un buen dato por una respuesta mal formada). La petición compartida sigue aunque un lector se desmonte (calienta la caché).
 */
export function pedirSwr(url,{signal,valida,baja=false,fetchFn=globalThis.fetch,clave=claveSwr(url),ahora=Date.now,almacen=almacenDe(),reintentos}={}){
 let p=enVuelo.get(clave);
 if(!p){
  p=(async()=>{const r=await fetchCupo(url,baja?{cache:'no-store',priority:'low'}:{cache:'no-store'},{baja,fetchFn,...(reintentos===undefined?{}:{reintentos})});const json=r.status===404?null:await r.json().catch(()=>null);
   if(r.ok&&json!==null&&(!valida||valida(json)!==null)&&clave.startsWith(PREFIJO+tenantActual+'|'))guardarSwr(clave,json,{ahora:ahora(),almacen});
   return {status:r.status,json};})().finally(()=>{if(enVuelo.get(clave)===p)enVuelo.delete(clave);});
  enVuelo.set(clave,p);
 }
 return conSenal(p,signal);
}
/**
 * Lectura con caché para paneles con su propio flujo de carga (una sola pasada). Devuelve {status,json,deCache,edadMs,fallo}.
 *  - dato fresco (≤5 min) y válido: se devuelve sin red (deCache:true);
 *  - dato viejo (≤30 min) y válido: `onCache(json,edadMs)` lo entrega YA para pintarlo y se revalida por la red; si la red falla (red caída o 5xx),
 *    se conserva ese dato (deCache:true, fallo:true) en vez de un error. `soloFresca` no entrega ni pinta datos viejos de antemano (p. ej. la fijación del alcance);
 *  - sin dato: red directa. Un 4xx/404 de la red se devuelve tal cual (no se tapa con caché: el acceso cambió).
 */
export async function leerConCache(url,{signal,valida,onCache,soloFresca=false,forzar=false,fetchFn=globalThis.fetch,almacen=almacenDe(),ahora=Date.now()}={}){
 const g=forzar?null:leerSwr(claveSwr(url),{almacen,ahora}),bueno=!!g&&(!valida||valida(g.datos)!==null);
 if(bueno&&g.fresca){onCache?.(g.datos,g.edadMs,true);return {status:200,json:g.datos,deCache:true,edadMs:g.edadMs,fallo:false};}
 const previo=bueno;
 if(bueno&&!soloFresca)onCache?.(g.datos,g.edadMs,false);
 try{
  const r=await pedirSwr(url,{signal,valida,fetchFn,almacen});
  if(r.status>=500&&previo)return {status:r.status,json:g.datos,deCache:true,edadMs:g.edadMs,fallo:true};
  return {...r,deCache:false,edadMs:null,fallo:false};
 }catch(e){
  if(signal?.aborted||!previo)throw e;
  return {status:0,json:g.datos,deCache:true,edadMs:g.edadMs,fallo:true};
 }
}
export const enVueloN=()=>enVuelo.size;
// ---- Precalentamiento ----------------------------------------------------------------------------------------------------------------------
const cola=[];let activos=0,maxActivos=0;
const bombear=(fetchFn,almacen)=>{
 while(activos<TOPE_PREFETCH&&cola.length){
  const {url,valida,luego}=cola.shift();activos++;maxActivos=Math.max(maxActivos,activos);
  pedirSwr(url,{valida,fetchFn,almacen,baja:true}).then(r=>{if(luego&&r.status>=200&&r.status<300){const mas=luego(r.json);if(mas?.length)encolar(mas,{fetchFn,almacen});}}).catch(()=>{}).finally(()=>{activos--;bombear(fetchFn,almacen);});
 }
};
const encolar=(lecturas,{fetchFn,almacen,ahora=Date.now()})=>{
 let nuevas=0;
 for(const l of lecturas){
  const {url,valida,luego}=typeof l==='string'?{url:l}:l,k=claveSwr(url);
  const g=leerSwr(k,{almacen,ahora});
  // Fresca en caché: no se pide, pero su continuación (p. ej. la lectura de datos tras fijar el alcance) sí se evalúa con lo que ya hay.
  if(g&&g.fresca){if(luego){const mas=luego(g.datos);if(mas?.length)nuevas+=encolar(mas,{fetchFn,almacen,ahora});}continue;}
  if(enVuelo.has(k)||cola.some(c=>claveSwr(c.url)===k))continue;
  cola.push({url,valida,luego});nuevas++;
 }
 return nuevas;
};
/** Pone en cola lecturas de baja prioridad; omite las frescas en caché, las ya en vuelo y las ya encoladas. Máximo 2 a la vez.
 *  Una lectura puede traer `luego(json)`: devuelve las lecturas que dependen de su respuesta (p. ej. fijar el alcance y luego pedir los datos). */
export function precalentar(lecturas,{fetchFn=globalThis.fetch,almacen=almacenDe(),ahora=Date.now()}={}){
 const nuevas=encolar(lecturas,{fetchFn,almacen,ahora});bombear(fetchFn,almacen);return nuevas;
}
export const estadoPrecalentamiento=()=>({activos,maxActivos,enCola:cola.length});
export function reiniciarPrecalentamiento(){cola.length=0;activos=0;maxActivos=0;}
/** «hace 20 s», «hace 3 min». */
export function hace(ms){const s=Math.max(0,Math.round(ms/1000));return s<60?'hace '+s+' s':'hace '+Math.round(s/60)+' min';}

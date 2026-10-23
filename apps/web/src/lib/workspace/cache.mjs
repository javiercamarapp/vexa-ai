// Lecturas de /api/workspace (R2-1-003, ahora sobre la caché global swr.mjs): al volver a Resumen/Problemas la lista reaparece al instante
// en vez de recargar ~30 s. Clave por tenant + recurso + alcance; la entrada es la misma respuesta JSON que ya viajó al navegador ({data:bundle}),
// de modo que useJson, el precalentamiento y estos paneles comparten la misma entrada. Frescura 5 min, vida 30 min, «Actualizar» solo la marca obsoleta.
import {claveSwr,guardarSwr,leerSwr,invalidarSwr,olvidarMemoriaSwr,hace,FRESCO_MS,VIDA_MS} from './swr.mjs';
export const TTL_MS=FRESCO_MS;export {VIDA_MS,hace};
const almacenDe=()=>{try{return globalThis.sessionStorage??null;}catch{return null;}};
/** Misma clave que la URL «/api/workspace?resource=<recurso>&<consulta>» (resource/format de la consulta se ignoran). */
export function claveCache(recurso,consulta){const q=new URLSearchParams(consulta);for(const k of ['resource','format'])q.delete(k);q.set('resource',recurso);return claveSwr('/api/workspace',q.toString());}
export function guardarCache(clave,datos,{ahora=Date.now(),almacen=almacenDe()}={}){guardarSwr(clave,{data:datos},{ahora,almacen});}
/** {datos, edadMs, fresca} con el último dato bueno (hasta 30 min de vida); fresca = dentro de los 5 min. null si no hay. */
export function leerCache(clave,{ahora=Date.now(),almacen=almacenDe()}={}){
 const e=leerSwr(clave,{ahora,almacen});const d=e?.datos?.data;
 return e&&d?{datos:d,edadMs:e.edadMs,fresca:e.fresca}:null;
}
export function invalidarCache({almacen=almacenDe()}={}){invalidarSwr({almacen,prefijo:'/api/workspace'});}
export function olvidarMemoria(){olvidarMemoriaSwr();}
// Posición de desplazamiento y filtros de la lista, para restaurarlos al volver.
export function guardarVista(clave,vista,{almacen=almacenDe()}={}){try{almacen?.setItem('vexa:vista:'+clave,JSON.stringify(vista));}catch{/* opcional */}}
export function leerVista(clave,{almacen=almacenDe()}={}){try{const v=almacen?.getItem('vexa:vista:'+clave);return v?JSON.parse(v):null;}catch{return null;}}

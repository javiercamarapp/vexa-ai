// Caché corta de la respuesta de /api/workspace (R2-1-003): al volver «atrás» desde un detalle, la lista de Problemas/Resumen reaparece al instante
// en vez de recargar ~30 s. Clave por recurso + alcance (consulta normalizada, que ya lleva snapshot_id y scope_hash cuando está fijada). Caduca a los 5 min,
// vive en memoria y en sessionStorage (opcional: si no hay almacenamiento o se llena, simplemente no hay caché) y «Actualizar» la invalida.
export const TTL_MS=5*60*1000;
const memoria=new Map();
const almacenDe=()=>{try{return globalThis.sessionStorage??null;}catch{return null;}};
export function claveCache(recurso,consulta){const q=new URLSearchParams(consulta);for(const k of ['resource','format'])q.delete(k);q.sort();return 'vexa:ws:'+recurso+':'+q.toString();}
export function guardarCache(clave,datos,{ahora=Date.now(),almacen=almacenDe()}={}){
 const entrada={t:ahora,datos};memoria.set(clave,entrada);
 try{almacen?.setItem(clave,JSON.stringify(entrada));}catch{/* cuota o modo privado: queda solo la memoria */}
}
/** {datos,edadMs} si hay una entrada vigente (< ttl); null si no hay o caducó. */
export function leerCache(clave,{ahora=Date.now(),ttl=TTL_MS,almacen=almacenDe()}={}){
 let e=memoria.get(clave);
 if(!e){try{const v=almacen?.getItem(clave);e=v?JSON.parse(v):undefined;}catch{e=undefined;}}
 if(!e||typeof e.t!=='number'||ahora-e.t>ttl||ahora<e.t)return null;
 return {datos:e.datos,edadMs:ahora-e.t};
}
export function invalidarCache({almacen=almacenDe()}={}){
 for(const k of [...memoria.keys()])if(k.startsWith('vexa:ws:'))memoria.delete(k);
 try{if(almacen)for(let i=almacen.length-1;i>=0;i--){const k=almacen.key(i);if(k?.startsWith('vexa:ws:'))almacen.removeItem(k);}}catch{/* sin almacenamiento */}
}
export function olvidarMemoria(){memoria.clear();}
// Posición de desplazamiento y filtros de la lista, para restaurarlos al volver.
export function guardarVista(clave,vista,{almacen=almacenDe()}={}){try{almacen?.setItem('vexa:vista:'+clave,JSON.stringify(vista));}catch{/* opcional */}}
export function leerVista(clave,{almacen=almacenDe()}={}){try{const v=almacen?.getItem('vexa:vista:'+clave);return v?JSON.parse(v):null;}catch{return null;}}
/** «hace 20 s», «hace 3 min». */
export function hace(ms){const s=Math.max(0,Math.round(ms/1000));return s<60?'hace '+s+' s':'hace '+Math.round(s/60)+' min';}

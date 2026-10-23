// Recuperación tras un despliegue: el navegador pide un chunk de Next que ya no existe (ChunkLoadError).
// La única salida honesta es recargar la página completa para traer el HTML y los chunks nuevos.
export const CLAVE_RECARGA='vexa:recarga-por-chunk';
const VENTANA_MS=10*60*1000;
const PATRON=/Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;
/** true si el error es de carga de un chunk/módulo dinámico (típico tras un despliegue). */
export function esErrorDeChunk(error){
 if(!error||typeof error!=='object')return false;
 if(error.name==='ChunkLoadError')return true;
 return PATRON.test(String(error.message??''));
}
/** Recarga la página UNA vez por ventana de 10 min si el error es de chunk. Devuelve true si disparó la recarga.
 *  Sin sessionStorage utilizable no recarga: sin la guarda podría entrar en bucle. */
export function recargarSiChunk(error,{storage,recargar,ahora=Date.now}={}){
 if(!esErrorDeChunk(error)||!storage||typeof recargar!=='function')return false;
 try{
  const previo=Number(storage.getItem(CLAVE_RECARGA));
  if(Number.isFinite(previo)&&previo>0&&ahora()-previo<VENTANA_MS)return false;
  storage.setItem(CLAVE_RECARGA,String(ahora()));
 }catch{return false;}
 recargar();return true;
}

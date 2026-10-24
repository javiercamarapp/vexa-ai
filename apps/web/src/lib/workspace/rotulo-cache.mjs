// Texto que acompaña a un dato que sale de la caché: nunca se presenta un dato viejo como actual sin su antigüedad.
import {hace} from './swr.mjs';
/** edadMs null = dato recién leído (nada que rotular). */
export function textoCache(edadMs,{viejo=false}={}){
 if(edadMs===null||edadMs===undefined)return null;
 const base=`Mostrando la última carga (${hace(edadMs)}).`;
 if(viejo)return base+' No se pudo actualizar ahora; se conserva este dato.';
 return base; // revalidar es silencioso: sin «Actualizando…» (el estado de carga es solo el logo)
}

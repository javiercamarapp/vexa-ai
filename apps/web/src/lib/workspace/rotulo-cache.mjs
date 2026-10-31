// Texto que acompaña a un dato que sale de la caché: nunca se presenta un dato viejo como actual sin su antigüedad.
import {hace} from './swr.mjs';
import {X} from '../legibilidad/trad.mjs';
/** edadMs null = dato recién leído (nada que rotular). */
export function textoCache(edadMs,{viejo=false,t=null}={}){
 if(edadMs===null||edadMs===undefined)return null;
 const base=X(t,'tr.lg.cache.base',`Mostrando la última carga (${hace(edadMs)}).`,{hace:hace(edadMs,t)});
 if(viejo)return base+X(t,'tr.lg.cache.viejo',' No se pudo actualizar ahora; se conserva este dato.');
 return base; // revalidar es silencioso: sin «Actualizando…» (el estado de carga es solo el logo)
}

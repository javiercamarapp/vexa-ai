import {hace} from '../../lib/workspace/swr.mjs';
/** Rótulo de un dato que sale de la caché: nunca se presenta como actual sin su antigüedad. null = no hay nada que rotular. */
export function textoCache(edadMs:number|null,{actualizando=false,viejo=false}:{actualizando?:boolean;viejo?:boolean}={}):string|null{
 if(edadMs===null)return null;
 const base=`Mostrando la última carga (${hace(edadMs)}).`;
 if(viejo)return base+' No se pudo actualizar ahora; se conserva este dato.';
 return actualizando?base+' Actualizando…':base;
}
export function LineaCache({edadMs,actualizando=false,viejo=false,onActualizar}:{edadMs:number|null;actualizando?:boolean;viejo?:boolean;onActualizar?:()=>void}){
 const t=textoCache(edadMs,{actualizando,viejo});if(!t)return null;
 return <p className="state state-cache" role="status" data-testid="linea-cache" data-estado={viejo?'viejo':actualizando?'actualizando':'cargado'}>{t}{onActualizar&&!actualizando&&<> <button type="button" className="row-link-inline" onClick={onActualizar}>{viejo?'Reintentar':'Actualizar'}</button></>}</p>;
}

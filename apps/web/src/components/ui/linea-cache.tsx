import {textoCache} from '../../lib/workspace/rotulo-cache.mjs';
export function LineaCache({edadMs,actualizando=false,viejo=false,onActualizar}:{edadMs:number|null;actualizando?:boolean;viejo?:boolean;onActualizar?:()=>void}){
 const t=textoCache(edadMs,{actualizando,viejo});if(!t)return null;
 return <p className="state state-cache" role="status" data-testid="linea-cache" data-estado={viejo?'viejo':actualizando?'actualizando':'cargado'}>{t}{onActualizar&&!actualizando&&<> <button type="button" className="row-link-inline" onClick={onActualizar}>{viejo?'Reintentar':'Actualizar'}</button></>}</p>;
}

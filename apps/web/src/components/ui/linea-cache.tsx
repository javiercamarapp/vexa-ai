import {textoCache} from '../../lib/workspace/rotulo-cache.mjs';
/** Un dato de hace segundos es el actual para cualquier efecto práctico: no se rotula salvo que se esté revalidando o haya fallado. */
const SIN_ROTULO_MS=15000;
/** Rótulo informativo de la antigüedad del dato. No lleva botón: la vista se actualiza sola cuando entra información nueva (useAutoRefresh). */
export function LineaCache({edadMs,actualizando=false,viejo=false}:{edadMs:number|null;actualizando?:boolean;viejo?:boolean}){
 const t=textoCache(edadMs,{actualizando,viejo});
 // Reserva de espacio (M3, 23-oct): si hay lectura de caché el aviso puede aparecer o desaparecer sin que el contenido de abajo salte y se pierda un clic.
 if(!t||(!actualizando&&!viejo&&(edadMs??0)<SIN_ROTULO_MS))return edadMs===null?null:<div className="state-cache-slot" aria-hidden="true"/>;
 return <p className="state state-cache" role="status" data-testid="linea-cache" data-estado={viejo?'viejo':actualizando?'actualizando':'cargado'}>{t}</p>;
}

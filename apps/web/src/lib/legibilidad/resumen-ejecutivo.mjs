// Lógica PURA del Resumen como panel ejecutivo (sin red, sin React). Honestidad: lo desconocido es null y nunca se convierte en 0;
// los deltas solo comparan meses COMPLETOS (criterio único en packages/metrics/complete-months.mjs).
import {esMesCompleto} from '../../../../../packages/metrics/complete-months.mjs';
import {variacion} from './insights.mjs';
import {estadosDeSerie} from '../../../../../packages/agent-datos/meses.mjs';
import {filasDesdeItems,numerarGrupos,ordenarFilas} from './problemas-catalogo.mjs';
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
const largo=m=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const corto=m=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const nombreMes=m=>new Intl.DateTimeFormat('es-MX',{month:'long',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const dir=v=>v.dir==='sube'?'up':v.dir==='baja'?'down':'flat';

/** Meses «completos» por fecha pero con cobertura baja (volumen < 25 % de la mediana de los demás meses completos: la carga de ese mes probablemente es parcial).
 *  Misma regla que el agente (packages/agent-datos/meses.mjs `estadosDeSerie`). Map mes -> % del volumen habitual. */
export function mesesCoberturaBaja(conv,ahora=new Date()){
 const out=new Map();if(!conv||!Array.isArray(conv.series))return out;
 for(const [mes,st] of estadosDeSerie(conv.series,conv.completeness,ahora))if(st.baja)out.set(mes,st.proporcion);
 return out;
}
/** Conversaciones del último mes completo frente al anterior completo. null si la serie no está disponible; sin dos meses completos no hay delta.
 *  Si algún mes comparado tiene cobertura baja NO hay delta ni flecha: «Cobertura baja en septiembre (carga de HubSpot parcial); sin comparación». */
export function kpiConversaciones(conv,ahora=new Date()){
 if(!conv||conv.status!=='ok'||!Array.isArray(conv.series))return null;
 const baja=mesesCoberturaBaja(conv,ahora);
 const completos=conv.series.filter(p=>esMesCompleto(p.month,{dataThrough:conv.completeness?.dataThrough??null,ahora}));
 const ult=completos.at(-1)??null;
 if(!ult)return {valor:null,mes:null,delta:null,rotulo:'Aún no hay un mes completo con conversaciones fechadas',estimado:conv.class==='estimated'};
 const prev=completos.at(-2)??null,bajos=[prev,ult].filter(p=>p&&baja.has(p.month)).map(p=>nombreMes(p.month));
 const estimado=conv.class==='estimated'||!!conv.sampled,spark=completos.filter(p=>!baja.has(p.month)).map(p=>p.count);
 if(bajos.length)return {valor:ult.count,mes:ult.month,delta:null,coberturaBaja:bajos,rotulo:`Cobertura baja en ${bajos.join(' y ')} (carga de HubSpot parcial); sin comparación`,estimado,spark};
 const v=prev?variacion(String(ult.count),String(prev.count)):null;
 return {valor:ult.count,mes:ult.month,delta:v?{value:v.texto,dir:dir(v)}:null,
  rotulo:`${largo(ult.month)}${prev?` vs ${corto(prev.month)}`:''}${v||!prev?'':' (sin base de comparación)'}`,estimado,spark};
}
/** Pedidos del libro del último mes completo (monto exacto en unidades menores), con su base rotulada. */
export function kpiPedidos(led,ahora=new Date()){
 if(!led||led.status!=='ok'||!led.currency||!Array.isArray(led.series))return null;
 const dataThrough=led.completeness?.dataThrough??null;
 const completos=led.series.filter(p=>esMesCompleto(p.month,{dataThrough,ahora})&&((p.orders?.count??0)+(p.orders?.unknownAmounts??0))>0);
 const ult=completos.at(-1);
 if(!ult)return {amountMinor:null,mes:null,currency:led.currency,exponent:led.exponent,delta:null,rotulo:'Aún no hay un mes completo con pedidos registrados'};
 const prev=completos.at(-2)??null,v=prev?variacion(ult.orders.amountMinor,prev.orders.amountMinor):null;
 return {amountMinor:ult.orders.amountMinor,mes:ult.month,currency:led.currency,exponent:led.exponent,count:ult.orders.count,unknown:ult.orders.unknownAmounts,
  delta:v?{value:v.texto,dir:dir(v)}:null,rotulo:`Libro de registros, ${largo(ult.month)}${prev?` vs ${corto(prev.month)}`:''}; importes conocidos, sin convertir monedas`};
}
/** Top N problemas por conversaciones (excluye las notificaciones automáticas si `visibles` ya viene filtrado). */
export function topProblemas(items,n=5){
 const filas=numerarGrupos(filasDesdeItems(items));
 return ordenarFilas(filas.filter(f=>f.conversaciones!==null),{col:'conversaciones',dir:'desc'}).slice(0,n);
}
/** Cobertura de fuentes: «6 de 7», incorporación de conversaciones y «datos hasta» por fuente (cada una con su propia fecha). */
export function estadoFuentes(view,{libro=null,conversaciones=null}={}){
 const fuentes=Array.isArray(view?.sources)?view.sources:null;
 const cargadas=fuentes?fuentes.filter(s=>s.loaded).length:null;
 const hub=fuentes?.find(s=>s.key==='hubspot'&&s.loaded)??null;
 const cuerpo=hub?.rejectionBreakdown?.status==='ok'?hub.rejectionBreakdown:null;
 const base=cuerpo?.conversationRows??hub?.total??null,inc=cuerpo?.conversationIncorporated??hub?.incorporated??null;
 const cortes=[['Conversaciones',conversaciones],['Libro de pedidos',libro]].map(([etiqueta,v])=>({etiqueta,dia:diaCorte(v)}));
 return {cargadas,total:fuentes?fuentes.length:null,sinCargar:fuentes?fuentes.filter(s=>!s.loaded&&s.status!=='timeout').map(s=>s.label):[],
  analisis:base&&inc!==null?{incorporadas:inc,de:base,pct:Math.round(inc*1000/base)/10}:null,cortes};
}

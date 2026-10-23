// Lógica PURA del Resumen como panel ejecutivo (sin red, sin React). Honestidad: lo desconocido es null y nunca se convierte en 0;
// los deltas solo comparan meses COMPLETOS (criterio único en packages/metrics/complete-months.mjs).
import {esMesCompleto} from '../../../../../packages/metrics/complete-months.mjs';
import {variacion,dosMesesCompletos} from './insights.mjs';
import {filasDesdeItems,numerarGrupos,ordenarFilas} from './problemas-catalogo.mjs';
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
const largo=m=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const corto=m=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const dir=v=>v.dir==='sube'?'up':v.dir==='baja'?'down':'flat';

/** Conversaciones del último mes completo frente al anterior completo. null si la serie no está disponible; sin dos meses completos no hay delta. */
export function kpiConversaciones(conv,ahora=new Date()){
 if(!conv||conv.status!=='ok'||!Array.isArray(conv.series))return null;
 const par=dosMesesCompletos(conv.series,ahora,conv.completeness);
 const completos=conv.series.filter(p=>esMesCompleto(p.month,{dataThrough:conv.completeness?.dataThrough??null,ahora}));
 const ult=completos.at(-1)??null;
 if(!ult)return {valor:null,mes:null,delta:null,rotulo:'Aún no hay un mes completo con conversaciones fechadas',estimado:conv.class==='estimated'};
 const v=par?variacion(String(par[1].count),String(par[0].count)):null;
 return {valor:ult.count,mes:ult.month,delta:v?{value:v.texto,dir:dir(v)}:null,
  rotulo:`${largo(ult.month)}${par?` vs ${corto(par[0].month)}`:''}${v||!par?'':' (sin base de comparación)'}`,estimado:conv.class==='estimated'||!!conv.sampled,
  spark:completos.map(p=>p.count)};
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

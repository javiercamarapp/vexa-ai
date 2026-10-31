// Lógica PURA del Resumen como panel ejecutivo (sin red, sin React). Honestidad: lo desconocido es null y nunca se convierte en 0;
// los deltas solo comparan meses COMPLETOS (criterio único en packages/metrics/complete-months.mjs).
import {coberturaIncorporacion,coberturaAnalisisIA} from '../../../../../packages/workspace-service/cifras-cobertura.mjs';
import {esMesCompleto} from '../../../../../packages/metrics/complete-months.mjs';
import {variacion} from './insights.mjs';
import {idiomaDe} from './trad.mjs';
import {estadosDeSerie} from '../../../../../packages/agent-datos/meses.mjs';
import {filasDesdeItems,numerarGrupos,ordenarFilas} from './problemas-catalogo.mjs';
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {LOCALES} from '../formato/idioma.mjs';
const largo=(m,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const corto=(m,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const nombreMes=(m,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{month:'long',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const diaLargoUtc=(d,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
/** Unión «a y b» en el idioma activo (con `t`) o en español. */
const unir=(xs,t)=>xs.join(t?' '+t('prob.y')+' ':' y ');
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
export function kpiConversaciones(conv,ahora=new Date(),{t=null,loc=LOCALES.es}={}){
 if(!conv||conv.status!=='ok'||!Array.isArray(conv.series))return null;
 const baja=mesesCoberturaBaja(conv,ahora);
 const completos=conv.series.filter(p=>esMesCompleto(p.month,{dataThrough:conv.completeness?.dataThrough??null,ahora}));
 const ult=completos.at(-1)??null;
 if(!ult)return {valor:null,mes:null,delta:null,rotulo:t?t('res.kpiSinMes'):'Aún no hay un mes completo con conversaciones fechadas',estimado:conv.class==='estimated'};
 // Mes con datos que ya terminó (calendario) pero cuyo último dato no llega a su último día: cobertura parcial, no se compara.
 const mesActual=ahora.toISOString().slice(0,7),corte=conv.completeness?.dataThrough?String(conv.completeness.dataThrough).slice(0,10):null;
 const parciales=conv.series.filter(p=>p.month<mesActual&&p.count>0&&!esMesCompleto(p.month,{dataThrough:corte,ahora})).map(p=>p.month);
 if(parciales.length){const nombres=parciales.map(m=>nombreMes(m,loc));return {valor:ult.count,mes:ult.month,delta:null,coberturaParcial:nombres,datosHasta:corte,rotulo:t?(corte?t('res.kpiParcialHasta',{meses:unir(nombres,t),dia:diaLargoUtc(corte,loc)}):t('res.kpiParcial',{meses:unir(nombres,t)})):`Cobertura parcial en ${nombres.join(' y ')}${corte?` (datos hasta el ${diaLargoUtc(corte)})`:''}; sin comparación`,estimado:conv.class==='estimated'||!!conv.sampled,spark:completos.filter(p=>!baja.has(p.month)).map(p=>p.count)};}
 const prev=completos.at(-2)??null,bajos=[prev,ult].filter(p=>p&&baja.has(p.month)).map(p=>nombreMes(p.month,loc));
 const estimado=conv.class==='estimated'||!!conv.sampled,spark=completos.filter(p=>!baja.has(p.month)).map(p=>p.count);
 if(bajos.length)return {valor:ult.count,mes:ult.month,delta:null,coberturaBaja:bajos,rotulo:t?t('res.kpiBaja',{meses:unir(bajos,t)}):`Cobertura baja en ${bajos.join(' y ')} (carga de HubSpot parcial); sin comparación`,estimado,spark};
 const v=prev?variacion(String(ult.count),String(prev.count),idiomaDe(t)):null;
 return {valor:ult.count,mes:ult.month,delta:v?{value:v.texto,dir:dir(v)}:null,
  rotulo:t?`${largo(ult.month,loc)}${prev?' '+t('res.vs')+' '+corto(prev.month,loc):''}${v||!prev?'':' '+t('res.kpiSinBase')}`:`${largo(ult.month)}${prev?` vs ${corto(prev.month)}`:''}${v||!prev?'':' (sin base de comparación)'}`,estimado,spark};
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
  delta:v?{value:v.texto,dir:dir(v)}:null,base:led.orderBasis?.label??null,rotulo:`${led.orderBasis?.label??'Libro de registros'}, ${largo(ult.month)}${prev?` vs ${corto(prev.month)}`:''}; misma cifra que Dinero; importes conocidos, una sola base y moneda, sin convertir ni sumar bases`};
}
/** Top N problemas por conversaciones (excluye las notificaciones automáticas si `visibles` ya viene filtrado). */
export function topProblemas(items,n=5){
 const filas=numerarGrupos(filasDesdeItems(items));
 return ordenarFilas(filas.filter(f=>f.conversaciones!==null),{col:'conversaciones',dir:'desc'}).slice(0,n);
}
/** Cobertura de fuentes: «6 de 7», incorporación de conversaciones de HubSpot (definición única: workspace-service/cifras-cobertura.mjs; sin desglose no hay %) y «datos hasta» por fuente (cada una con su propia fecha). */
export function estadoFuentes(view,{libro=null,conversaciones=null,t=null,loc=LOCALES.es}={}){
 const dia=v=>{if(!t)return diaCorte(v);const m=typeof v==='string'?/^(\d{4})-(\d{2})-(\d{2})/.exec(v):null;return m&&Number(m[2])>=1&&Number(m[2])<=12?new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v)):null;};
 const fuentes=Array.isArray(view?.sources)?view.sources:null;
 const cargadas=fuentes?fuentes.filter(s=>s.loaded).length:null;
 const hub=fuentes?.find(s=>s.key==='hubspot'&&s.loaded)??null;
 const cortes=[[t?t('res.corteConv'):'Conversaciones',conversaciones],[t?t('res.corteLibro'):'Libro de pedidos',libro]].map(([etiqueta,v])=>({etiqueta,dia:dia(v)}));
 return {cargadas,total:fuentes?fuentes.length:null,sinCargar:fuentes?fuentes.filter(s=>!s.loaded&&s.status!=='timeout').map(s=>s.label):[],
  incorporacion:coberturaIncorporacion(hub),cortes};
}

/** Una línea de estado con lo clave de los avisos críticos reales del Resumen (qué falta / qué ajustar); el detalle queda en el plegable.
 *  null si no hay ningún aviso crítico real. Entrada: `critico` y `pendiente` (booleanos), `parcialCarga` (la carga misma es parcial),
 *  `faltantes` (etiquetas de cifras sin cobertura), `conv`/`led` (payloads de tendencias): meses YA TERMINADOS cuyo último dato no llega a su último día. */
export function lineaAvisos({critico=false,pendiente=false,parcialCarga=false,faltantes=[],conv=null,led=null,ahora=new Date(),t=null,loc=LOCALES.es}={}){
 const partes=[];
 if(critico)partes.push(t?t('res.avCritico'):'hay señales críticas por revisar');
 if(pendiente)partes.push(t?t('res.avPendiente'):'señales críticas sin calcular en esta carga');
 if(parcialCarga)partes.push(t?t('res.avParcialCarga'):'la carga de datos es parcial');
 if(faltantes.length)partes.push(t?(faltantes.length===1?t('res.avFalta1',{x:faltantes[0]}):t('res.avFaltanN',{n:faltantes.length,lista:faltantes.slice(0,3).join(', ')+(faltantes.length>3?'…':'')})):faltantes.length===1?`falta cobertura de ${faltantes[0]}`:`faltan ${faltantes.length} cifras por cobertura (${faltantes.slice(0,3).join(', ')}${faltantes.length>3?'…':''})`);
 const mesActual=ahora.toISOString().slice(0,7);
 for(const [nombre,src] of [['conversaciones',conv],['libro',led]]){
  const nombreT=t?t(nombre==='libro'?'res.avLibro':'res.avConversaciones'):nombre;
  const corte=src?.completeness?.dataThrough?String(src.completeness.dataThrough).slice(0,10):null;
  if(!corte||!Array.isArray(src?.series))continue;
  const meses=src.series.filter(p=>p.month<mesActual&&!esMesCompleto(p.month,{dataThrough:corte,ahora})&&(Number(p.count??p.orders?.count??0)>0)).map(p=>nombreMes(p.month,loc));
  if(meses.length)partes.push(t?t('res.avMesParcial',{fuente:nombreT,meses:unir(meses,t),dia:diaLargoUtc(corte,loc)}):`${nombre}: ${meses.join(' y ')} parcial (datos hasta el ${diaLargoUtc(corte)}), sin comparación`);
 }
 return partes.length?(t?t('res.avPrefijo'):'Estado de los datos: ')+partes.join(' · ')+'.':null;
}

/** Cobertura de análisis de la IA para Resumen y /analysis: analizadas (trends.conversations.analysis) sobre las conversaciones cargadas (trends.conversations.total). */
export function coberturaDeTendencias(conv){
 const an=conv?.analysis;
 if(!an||an.status!=='ok')return coberturaAnalisisIA({analizadas:null,base:conv?.total??null});
 return coberturaAnalisisIA({analizadas:an.analyzed,base:conv?.status==='ok'?conv.total:null,estimado:conv?.class==='estimated'&&conv?.sampled===true});
}

/** A7: el aviso «señales críticas pendientes» sale del MISMO estado que la tarjeta de grupos críticos: si la tarjeta ya tiene un conteo (lectura propia, caché o conteo del bundle), el aviso no existe. */
export function avisosCoherentes(avisos,conteoCriticos){
 const lista=Array.isArray(avisos)?avisos:[];
 return conteoCriticos?lista.filter(a=>a.key!=='pendiente'):lista;
}

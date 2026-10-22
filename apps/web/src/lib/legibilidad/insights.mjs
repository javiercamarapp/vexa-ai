// Insights en lenguaje claro, calculados SOLO con datos que la API ya devuelve (máx. 3 por vista).
// Cada insight lleva fuente, cobertura y clase. Si el dato no existe: {vacio:true, razon} («Aún sin datos»).
// Los textos marcan con **negritas** las cifras exactas. Importes con BigInt: sin redondeos ni conversión de monedas.
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {esMesCompleto,completitud} from '../../../../../packages/metrics/complete-months.mjs';
import {etiquetaCategoria} from './categorias.mjs';
import {separarRuidoCategorias} from './ruido.mjs';
const MAX=3;
const entero=s=>typeof s==='string'&&/^-?\d+$/.test(s);
const nfEs=new Intl.NumberFormat('es-MX');
const mesLargo=m=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
/** Variación porcentual exacta con un decimal (BigInt). null si no hay base honesta (anterior ≤ 0). */
export function variacion(actual,anterior){
 let a,b;try{a=BigInt(actual);b=BigInt(anterior);}catch{return null;}
 if(b<=0n)return null;
 const decimas=(a-b)*1000n/b;const n=Number(decimas)/10;
 if(decimas===0n&&a!==b)return {dir:a>b?'sube':'baja',texto:'0.1 %',pequena:true};
 return {dir:decimas>0n?'sube':decimas<0n?'baja':'igual',texto:Math.abs(n).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})+' %'};
}
/** Dos últimos meses COMPLETOS de una serie. Completo = anterior al mes en curso y, si se conoce `completitud.dataThrough`
 *  (último dato cargado), con datos hasta el último día del mes (criterio único en packages/metrics/complete-months.mjs). */
export function dosMesesCompletos(series,ahora=new Date(),completitud=null){
 if(!Array.isArray(series))return null;
 const dataThrough=completitud?.dataThrough??null;
 const completos=series.filter(s=>s&&typeof s.month==='string'&&esMesCompleto(s.month,{dataThrough,ahora}));
 return completos.length>=2?[completos[completos.length-2],completos[completos.length-1]]:null;
}
const diaLargo=d=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
/** Frase de cobertura del mes parcial excluido de la comparación, o ''. `conDatos` define si un punto de la serie tiene registros. */
export function notaMesParcial(series,ahora,completitudPayload,conDatos){
 const dataThrough=completitudPayload?.dataThrough??null,c=completitud(series,{dataThrough,ahora,conDatos});
 if(!c.partialMonths.length)return '';
 const meses=c.partialMonths.map(mesLargo),hasta=c.dataThrough?` (datos hasta el ${diaLargo(c.dataThrough)})`:'';
 return meses.length===1?`${meses[0]} es parcial${hasta} y no se compara.`:`${meses.join(' y ')} son parciales${hasta} y no se comparan.`;
}
const etiquetaVar=v=>v.dir==='igual'?'sin cambio':v.pequena?'variación menor a 0.1 %':(v.dir==='sube'?'+':'−')+v.texto;
const frase=(v,sube,baja,igual)=>v.dir==='sube'?sube:v.dir==='baja'?baja:igual;
function conversaciones(conv,ahora){
 const fuente='Conversaciones cargadas, por fecha de inicio o primer mensaje';
 if(!conv)return {id:'conversaciones',vacio:true,razon:'Las tendencias no están disponibles ahora; reintenta.',fuente};
 if(conv.status==='timeout')return {id:'conversaciones',vacio:true,razon:'La consulta superó el tiempo permitido. Reintenta en unos segundos.',fuente};
 const par=conv.status==='ok'?dosMesesCompletos(conv.series,ahora,conv.completeness):null;
 if(!par)return {id:'conversaciones',vacio:true,razon:'Hacen falta al menos dos meses completos con conversaciones fechadas.',fuente};
 const [a,b]=par,v=variacion(String(b.count),String(a.count));
 const cuerpo=v?`las conversaciones ${frase(v,'subieron','bajaron','se mantuvieron')} de **${nfEs.format(a.count)}** en ${mesLargo(a.month)} a **${nfEs.format(b.count)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`en ${mesLargo(b.month)} hubo **${nfEs.format(b.count)}** conversaciones; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const partes=[];
 if(conv.sampled)partes.push(`Estimado con una muestra del ${conv.samplePercent??''} %.`);
 if(conv.outsideWindow)partes.push(`${nfEs.format(conv.outsideWindow)} conversaciones quedan fuera de la ventana de 12 meses.`);
 if(conv.undated)partes.push(`${nfEs.format(conv.undated)} sin fecha.`);
 const parcial=notaMesParcial(conv.series,ahora,conv.completeness,p=>p.count>0);
 if(parcial)partes.push(parcial);
 if(!partes.length)partes.push('Ventana de 12 meses; no incluye el mes en curso.');
 return {id:'conversaciones',texto:cuerpo[0].toUpperCase()+cuerpo.slice(1),fuente,cobertura:partes.join(' '),clase:conv.class==='estimated'?'estimated':'observed'};
}
function libro(led,ahora){
 const fuente='Libro económico: pedidos registrados';
 if(!led)return {id:'pedidos',vacio:true,razon:'Las tendencias no están disponibles ahora; reintenta.',fuente};
 if(led.status==='timeout')return {id:'pedidos',vacio:true,razon:'La consulta superó el tiempo permitido. Reintenta en unos segundos.',fuente};
 if(led.status!=='ok'||!led.currency||led.exponent===null||led.exponent===undefined)return {id:'pedidos',vacio:true,razon:'Aún no hay pedidos registrados con moneda definida.',fuente};
 const par=dosMesesCompletos(led.series,ahora,led.completeness);
 if(!par)return {id:'pedidos',vacio:true,razon:'Hacen falta al menos dos meses completos de pedidos.',fuente};
 const [a,b]=par,x=a.orders.amountMinor,y=b.orders.amountMinor;
 if(!entero(x)||!entero(y))return {id:'pedidos',vacio:true,razon:'Algún mes no tiene un importe exacto.',fuente};
 const v=variacion(y,x),fm=m=>formatMinorUnits(m,led.currency,led.exponent);
 const cuerpo=v?`Los pedidos registrados ${frase(v,'subieron','bajaron','se mantuvieron')} de **${fm(x)}** en ${mesLargo(a.month)} a **${fm(y)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`En ${mesLargo(b.month)} los pedidos registrados fueron **${fm(y)}**; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const sin=a.orders.unknownAmounts+b.orders.unknownAmounts;
 const cob=[`Solo ${led.currency}; ${led.otherCurrencies?.length?`otras monedas (${led.otherCurrencies.join(', ')}) no se suman ni se convierten.`:'no se mezclan monedas.'}`];
 if(sin)cob.push(`${nfEs.format(sin)} pedidos sin importe conocido no se suman.`);
 const parcial=notaMesParcial(led.series,ahora,led.completeness,p=>p.orders.count+p.orders.unknownAmounts>0);
 if(parcial)cob.push(parcial);
 return {id:'pedidos',texto:cuerpo,fuente,cobertura:cob.join(' '),clase:led.class==='estimated'?'estimated':'observed'};
}
const FUENTE_CAT='Incidencias clasificadas por la IA (issues.category)';
/** Acepta la vista de la API ({status,rows,totals}) o, por compatibilidad, un arreglo [{category,count}]. null = no se pudo consultar. */
function categorias(entrada,fuente=FUENTE_CAT){
 const vista=Array.isArray(entrada)?{status:entrada.length?'ok':'empty',rows:entrada,totals:null}:entrada;
 if(!vista)return {id:'categorias',vacio:true,razon:'Los conteos por categoría no están disponibles ahora; reintenta.',fuente};
 if(vista.status==='timeout')return {id:'categorias',vacio:true,razon:'La consulta por categoría superó el tiempo permitido. Reintenta en unos segundos.',fuente};
 const filas=(vista.rows??[]).filter(f=>f&&Number.isFinite(f.count)&&f.count>0);
 if(!filas.length)return {id:'categorias',vacio:true,razon:'No hay incidencias clasificadas en este alcance.',fuente};
 const sep=separarRuidoCategorias(filas),visibles=sep.visibles;
 const totalTodas=vista.totals?.incidences??filas.reduce((n,f)=>n+f.count,0),totalVisibles=visibles.reduce((n,f)=>n+f.count,0);
 if(totalVisibles<=0)return {id:'categorias',vacio:true,razon:'Todas las incidencias de este alcance son notificaciones automáticas; actívalas en la gráfica para verlas.',fuente};
 const top=[...visibles].sort((p,q)=>q.count-p.count||p.category.localeCompare(q.category))[0];
 const dec=BigInt(top.count)*1000n/BigInt(totalVisibles);
 const cob=[`${nfEs.format(vista.totals?.categories??filas.length)} categorías en ${nfEs.format(totalTodas)} incidencias; se cuentan incidencias, no problemas agrupados.`];
 if(sep.incidenciasOcultas>0)cob.push(`El porcentaje excluye ${nfEs.format(sep.incidenciasOcultas)} incidencias de notificaciones automáticas.`);
 if(vista.truncated)cob.push('Lista recortada a las categorías con más incidencias.');
 return {id:'categorias',texto:`La categoría con más incidencias es **${etiquetaCategoria(top.category)}**: **${nfEs.format(top.count)}** de ${nfEs.format(totalVisibles)} (${(Number(dec)/10).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %).`,fuente,cobertura:cob.join(' '),clase:'inferred'};
}
/** Resumen: conversaciones, pedidos y categorías (máx. 3). */
export function insightsResumen({trends=null,categorias:filas=null,ahora=new Date()}={}){
 return [conversaciones(trends?.conversations,ahora),libro(trends?.ledger,ahora),categorias(filas)].slice(0,MAX);
}
const exacto=m=>!!m&&entero(m.amount_minor);
const primaria=item=>item.metrics?.find(m=>m.kind==='exposure')??item.metrics?.[0];
/** Problemas: mayor exposición, cobertura de importes y cobertura de evidencia (máx. 3), sobre los problemas ya filtrados. */
export function insightsProblemas({items=[],moneda=null}={}){
 const fuente='Corte publicado: problemas agrupados';
 const n=items.length;
 if(!n)return [{id:'mayor',vacio:true,razon:'No hay problemas agrupados visibles en este alcance.',fuente}];
 const conImporte=items.filter(i=>{const m=primaria(i);return exacto(m)&&(!moneda||m.currency===moneda);});
 const top=conImporte.reduce((best,i)=>!best||BigInt(primaria(i).amount_minor)>BigInt(primaria(best).amount_minor)?i:best,null);
 const out=[];
 if(top){const m=primaria(top),c=m.coverage;
  out.push({id:'mayor',texto:`**${top.title}** concentra la mayor exposición de esta página: **${formatMinorUnits(m.amount_minor,m.currency,m.exponent)}** de ingresos expuestos, con **${nfEs.format(top.evidence.length)}** ${top.evidence.length===1?'cita verificable':'citas verificables'}.`,fuente,cobertura:(c&&c.eligible_n>0?`${nfEs.format(c.known_n)} de ${nfEs.format(c.eligible_n)} registros con importe conocido. `:'')+'La exposición compartida entre problemas no se suma y no es pérdida.',clase:'inferred'});}
 else out.push({id:'mayor',vacio:true,razon:'Ningún problema visible tiene un importe expuesto exacto en este corte.',fuente});
 out.push({id:'importes',texto:`**${nfEs.format(conImporte.length)}** de **${nfEs.format(n)}** problemas agrupados de esta página tienen importe expuesto conocido${conImporte.length<n?'; el resto no muestra cifra en lugar de un cero':''}.`,fuente,cobertura:`Cuenta problemas agrupados de la página actual${moneda?`, en ${moneda}`:''}; no cuenta incidencias.`,clase:'observed'});
 const conCitas=items.filter(i=>(i.evidence?.length??0)>0).length;
 if(!items.every(i=>i.metrics?.some(m=>m.missing_reasons?.includes('EXPOSURE_NOT_LINKED'))))out.push({id:'citas',texto:`**${nfEs.format(conCitas)}** de **${nfEs.format(n)}** problemas agrupados tienen al menos una cita verificable con tu acceso.`,fuente:'Corte publicado: evidencia autorizada',cobertura:'Una cita respalda el problema; no demuestra su causa.',clase:'observed'});
 return out.slice(0,MAX);
}

const mesCorto=m=>new Intl.DateTimeFormat('es-MX',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
/** Evolución mensual de incidencias de UN problema agrupado (máx. 3): total y mes pico, cambio entre meses completos y cobertura de fechas. */
export function insightsProblemaSerie(vista,ahora=new Date()){
 const fuente='Incidencias de las corridas vinculadas al problema, por mes de su conversación';
 if(!vista)return [{id:'evolucion',vacio:true,razon:'La evolución mensual no está disponible ahora; reintenta.',fuente}];
 if(vista.status==='timeout')return [{id:'evolucion',vacio:true,razon:'La consulta superó el tiempo permitido. Reintenta en unos segundos.',fuente}];
 if(vista.status==='empty'||!vista.total)return [{id:'evolucion',vacio:true,razon:'Este problema aún no tiene incidencias con conversación fechada.',fuente}];
 const serie=vista.series??[],enVentana=serie.reduce((n,p)=>n+p.count,0),out=[];
 const cobFechas=[`Ventana de ${vista.window?.months??12} meses.`];
 if(vista.outsideWindow)cobFechas.push(`${nfEs.format(vista.outsideWindow)} incidencias quedan fuera de la ventana.`);
 if(vista.undated)cobFechas.push(`${nfEs.format(vista.undated)} sin fecha de conversación.`);
 if(enVentana>0){
  const pico=serie.reduce((b,p)=>!b||p.count>b.count?p:b,null);
  out.push({id:'pico',texto:`En los últimos ${vista.window?.months??12} meses hay **${nfEs.format(enVentana)}** ${enVentana===1?'incidencia':'incidencias'} vinculadas a este problema; el mes con más fue **${mesCorto(pico.month)}** con **${nfEs.format(pico.count)}**.`,fuente,cobertura:cobFechas.join(' '),clase:'inferred'});
 }else out.push({id:'pico',vacio:true,razon:`Hay ${nfEs.format(vista.total)} incidencias, pero ninguna dentro de la ventana de ${vista.window?.months??12} meses.`,fuente});
 const par=dosMesesCompletos(serie,ahora);
 if(par){const [a,b]=par,v=variacion(String(b.count),String(a.count));
  out.push(v?{id:'cambio',texto:`Las incidencias ${frase(v,'subieron','bajaron','se mantuvieron')} de **${nfEs.format(a.count)}** en ${mesLargo(a.month)} a **${nfEs.format(b.count)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`,fuente,cobertura:'Compara dos meses completos; el mes en curso se excluye. Es una asociación temporal, no una causa.',clase:'inferred'}
   :{id:'cambio',vacio:true,razon:`${mesLargo(a.month)} no tiene incidencias: no hay base honesta para calcular un porcentaje.`,fuente});}
 else out.push({id:'cambio',vacio:true,razon:'Hacen falta al menos dos meses completos para comparar.',fuente});
 if(vista.linkedRuns!==null&&vista.linkedRuns!==undefined)out.push({id:'corridas',texto:`El problema agrupa **${nfEs.format(vista.linkedRuns)}** ${vista.linkedRuns===1?'corrida de extracción':'corridas de extracción'}; en total suman **${nfEs.format(vista.total)}** incidencias.`,fuente:'Vínculos problema-corrida (agrupación por IA)',cobertura:'Una corrida puede traer incidencias de varias categorías; el conteo no es el número de clientes afectados.',clase:'inferred'});
 return out.slice(0,MAX);
}

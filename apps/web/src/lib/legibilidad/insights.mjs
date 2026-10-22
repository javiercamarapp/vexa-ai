// Insights en lenguaje claro, calculados SOLO con datos que la API ya devuelve (máx. 3 por vista).
// Cada insight lleva fuente, cobertura y clase. Si el dato no existe: {vacio:true, razon} («Aún sin datos»).
// Los textos marcan con **negritas** las cifras exactas. Importes con BigInt: sin redondeos ni conversión de monedas.
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {etiquetaCategoria} from './categorias.mjs';
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
/** Dos últimos meses COMPLETOS de una serie (descarta el mes en curso si ya apareció). */
export function dosMesesCompletos(series,ahora=new Date()){
 if(!Array.isArray(series))return null;
 const actual=ahora.toISOString().slice(0,7);
 const completos=series.filter(s=>s&&typeof s.month==='string'&&s.month<actual);
 return completos.length>=2?[completos[completos.length-2],completos[completos.length-1]]:null;
}
const etiquetaVar=v=>v.dir==='igual'?'sin cambio':v.pequena?'variación menor a 0.1 %':(v.dir==='sube'?'+':'−')+v.texto;
const frase=(v,sube,baja,igual)=>v.dir==='sube'?sube:v.dir==='baja'?baja:igual;
function conversaciones(conv,ahora){
 const fuente='Conversaciones cargadas, por fecha de inicio o primer mensaje';
 if(!conv)return {id:'conversaciones',vacio:true,razon:'Las tendencias no están disponibles ahora; reintenta.',fuente};
 if(conv.status==='timeout')return {id:'conversaciones',vacio:true,razon:'La consulta superó el tiempo permitido. Reintenta en unos segundos.',fuente};
 const par=conv.status==='ok'?dosMesesCompletos(conv.series,ahora):null;
 if(!par)return {id:'conversaciones',vacio:true,razon:'Hacen falta al menos dos meses completos con conversaciones fechadas.',fuente};
 const [a,b]=par,v=variacion(String(b.count),String(a.count));
 const cuerpo=v?`las conversaciones ${frase(v,'subieron','bajaron','se mantuvieron')} de **${nfEs.format(a.count)}** en ${mesLargo(a.month)} a **${nfEs.format(b.count)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`en ${mesLargo(b.month)} hubo **${nfEs.format(b.count)}** conversaciones; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const partes=[];
 if(conv.sampled)partes.push(`Estimado con una muestra del ${conv.samplePercent??''} %.`);
 if(conv.outsideWindow)partes.push(`${nfEs.format(conv.outsideWindow)} conversaciones quedan fuera de la ventana de 12 meses.`);
 if(conv.undated)partes.push(`${nfEs.format(conv.undated)} sin fecha.`);
 if(!partes.length)partes.push('Ventana de 12 meses; no incluye el mes en curso.');
 return {id:'conversaciones',texto:cuerpo[0].toUpperCase()+cuerpo.slice(1),fuente,cobertura:partes.join(' '),clase:conv.class==='estimated'?'estimated':'observed'};
}
function libro(led,ahora){
 const fuente='Libro económico: pedidos registrados';
 if(!led)return {id:'pedidos',vacio:true,razon:'Las tendencias no están disponibles ahora; reintenta.',fuente};
 if(led.status==='timeout')return {id:'pedidos',vacio:true,razon:'La consulta superó el tiempo permitido. Reintenta en unos segundos.',fuente};
 if(led.status!=='ok'||!led.currency||led.exponent===null||led.exponent===undefined)return {id:'pedidos',vacio:true,razon:'Aún no hay pedidos registrados con moneda definida.',fuente};
 const par=dosMesesCompletos(led.series,ahora);
 if(!par)return {id:'pedidos',vacio:true,razon:'Hacen falta al menos dos meses completos de pedidos.',fuente};
 const [a,b]=par,x=a.orders.amountMinor,y=b.orders.amountMinor;
 if(!entero(x)||!entero(y))return {id:'pedidos',vacio:true,razon:'Algún mes no tiene un importe exacto.',fuente};
 const v=variacion(y,x),fm=m=>formatMinorUnits(m,led.currency,led.exponent);
 const cuerpo=v?`Los pedidos registrados ${frase(v,'subieron','bajaron','se mantuvieron')} de **${fm(x)}** en ${mesLargo(a.month)} a **${fm(y)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`En ${mesLargo(b.month)} los pedidos registrados fueron **${fm(y)}**; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const sin=a.orders.unknownAmounts+b.orders.unknownAmounts;
 const cob=[`Solo ${led.currency}; ${led.otherCurrencies?.length?`otras monedas (${led.otherCurrencies.join(', ')}) no se suman ni se convierten.`:'no se mezclan monedas.'}`];
 if(sin)cob.push(`${nfEs.format(sin)} pedidos sin importe conocido no se suman.`);
 return {id:'pedidos',texto:cuerpo,fuente,cobertura:cob.join(' '),clase:led.class==='estimated'?'estimated':'observed'};
}
function categorias(filas,fuente='Incidencias clasificadas por la IA'){
 if(!Array.isArray(filas)||!filas.length)return {id:'categorias',vacio:true,razon:'El resumen aún no recibe conteos de incidencias por categoría. Se ven en la evidencia de cada análisis.',fuente};
 const total=filas.reduce((n,f)=>n+f.count,0);
 if(total<=0)return {id:'categorias',vacio:true,razon:'No hay incidencias clasificadas en este alcance.',fuente};
 const top=[...filas].sort((p,q)=>q.count-p.count)[0];
 const dec=BigInt(top.count)*1000n/BigInt(total);
 return {id:'categorias',texto:`La categoría con más incidencias es **${etiquetaCategoria(top.category)}**: **${nfEs.format(top.count)}** de ${nfEs.format(total)} (${(Number(dec)/10).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %).`,fuente,cobertura:`${nfEs.format(filas.length)} categorías con al menos una incidencia; se cuentan incidencias, no problemas agrupados.`,clase:'observed'};
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
 out.push({id:'citas',texto:`**${nfEs.format(conCitas)}** de **${nfEs.format(n)}** problemas agrupados tienen al menos una cita verificable con tu acceso.`,fuente:'Corte publicado: evidencia autorizada',cobertura:'Una cita respalda el problema; no demuestra su causa.',clase:'observed'});
 return out.slice(0,MAX);
}

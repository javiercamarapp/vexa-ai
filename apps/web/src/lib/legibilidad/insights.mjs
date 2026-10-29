// Insights en lenguaje claro, calculados SOLO con datos que la API ya devuelve (máx. 3 por vista).
// Cada insight lleva fuente, cobertura y clase. Si el dato no existe: {vacio:true, razon} («Aún sin datos»).
// Los textos marcan con **negritas** las cifras exactas. Importes con BigInt: sin redondeos ni conversión de monedas.
import {formatMinorUnits} from '../formato/dinero-pantalla.mjs';
import {esMesCompleto,completitud} from '../../../../../packages/metrics/complete-months.mjs';
import {etiquetaCategoria} from './categorias.mjs';
import {porcentaje,variacionDecimas} from '../formato/es-mx.mjs';
import {separarRuidoCategorias} from './ruido.mjs';
import {LOCALES} from '../formato/idioma.mjs';
const MAX=3;
const entero=s=>typeof s==='string'&&/^-?\d+$/.test(s);
const nfEs=new Intl.NumberFormat(LOCALES.es);
const mesLargo=(m,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
/** Texto de interfaz: con `ctx.t` (traductor) usa el diccionario; sin él, el español original. */
const X=(ctx,clave,es,vars)=>ctx?.t?ctx.t(clave,vars):es;
const LOC=ctx=>ctx?.loc??LOCALES.es;
const Y=ctx=>ctx?.t?' '+ctx.t('prob.y')+' ':' y ';
/** Variación porcentual exacta con un decimal (BigInt). null si no hay base honesta (anterior ≤ 0). */
export function variacion(actual,anterior){
 const d=variacionDecimas(actual,anterior);if(d===null)return null;
 if(d===0&&BigInt(actual)!==BigInt(anterior))return {dir:BigInt(actual)>BigInt(anterior)?'sube':'baja',texto:'0.1 %',pequena:true};
 return {dir:d>0?'sube':d<0?'baja':'igual',texto:porcentaje(Math.abs(d)/10)};
}
/** Dos últimos meses COMPLETOS de una serie. Completo = anterior al mes en curso y, si se conoce `completitud.dataThrough`
 *  (último dato cargado), con datos hasta el último día del mes (criterio único en packages/metrics/complete-months.mjs). */
export function dosMesesCompletos(series,ahora=new Date(),completitud=null){
 if(!Array.isArray(series))return null;
 const dataThrough=completitud?.dataThrough??null;
 const completos=series.filter(s=>s&&typeof s.month==='string'&&esMesCompleto(s.month,{dataThrough,ahora}));
 return completos.length>=2?[completos[completos.length-2],completos[completos.length-1]]:null;
}
const diaLargo=(d,loc=LOCALES.es)=>new Intl.DateTimeFormat(loc,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
/** Frase de cobertura del mes parcial excluido de la comparación, o ''. `conDatos` define si un punto de la serie tiene registros. */
export function notaMesParcial(series,ahora,completitudPayload,conDatos,ctx=null){
 const dataThrough=completitudPayload?.dataThrough??null,c=completitud(series,{dataThrough,ahora,conDatos});
 if(!c.partialMonths.length)return '';
 const meses=c.partialMonths.map(m=>mesLargo(m,LOC(ctx))),hasta=c.dataThrough?` (datos hasta el ${diaLargo(c.dataThrough)})`:'';
 if(ctx?.t){const mm=meses.length===1?meses[0]:meses.join(Y(ctx)),k=(meses.length===1?'res.ins.parcial1':'res.ins.parcialN')+(c.dataThrough?'Hasta':'');return ctx.t(k,{meses:mm,dia:c.dataThrough?diaLargo(c.dataThrough,LOC(ctx)):''});}
 return meses.length===1?`${meses[0]} es parcial${hasta} y no se compara.`:`${meses.join(' y ')} son parciales${hasta} y no se comparan.`;
}
const etiquetaVar=(v,ctx=null)=>v.dir==='igual'?X(ctx,'res.ins.sinCambio','sin cambio'):v.pequena?X(ctx,'res.ins.varMenor','variación menor a 0.1 %'):(v.dir==='sube'?'+':'−')+v.texto;
const frase=(v,sube,baja,igual)=>v.dir==='sube'?sube:v.dir==='baja'?baja:igual;
function conversaciones(conv,ahora,ctx=null){
 const fuente=X(ctx,'res.ins.fuenteConv','Conversaciones cargadas, por fecha de inicio o primer mensaje');
 if(!conv)return {id:'conversaciones',vacio:true,razon:X(ctx,'res.ins.noTend','Las tendencias no están disponibles ahora; reintenta.'),fuente};
 if(conv.status==='timeout')return {id:'conversaciones',vacio:true,razon:X(ctx,'res.ins.timeout','La consulta superó el tiempo permitido. Reintenta en unos segundos.'),fuente};
 const par=conv.status==='ok'?dosMesesCompletos(conv.series,ahora,conv.completeness):null;
 if(!par)return {id:'conversaciones',vacio:true,razon:X(ctx,'res.ins.dosMesesConv','Hacen falta al menos dos meses completos con conversaciones fechadas.'),fuente};
 const [a,b]=par,v=variacion(String(b.count),String(a.count));
 const L=LOC(ctx),cuerpo=ctx?.t?(v?ctx.t('res.ins.convCambio',{verbo:ctx.t('res.ins.vconv.'+v.dir),a:nfEs.format(a.count),mesA:mesLargo(a.month,L),b:nfEs.format(b.count),mesB:mesLargo(b.month,L),var:etiquetaVar(v,ctx)}):ctx.t('res.ins.convSinBase',{n:nfEs.format(b.count),mesB:mesLargo(b.month,L),mesA:mesLargo(a.month,L)})):v?`las conversaciones ${frase(v,'subieron','bajaron','se mantuvieron')} de **${nfEs.format(a.count)}** en ${mesLargo(a.month)} a **${nfEs.format(b.count)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`en ${mesLargo(b.month)} hubo **${nfEs.format(b.count)}** conversaciones; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const partes=[];
 if(conv.sampled)partes.push(X(ctx,'res.ins.muestra',`Estimado con una muestra del ${conv.samplePercent??''} %.`,{p:conv.samplePercent??''}));
 if(conv.outsideWindow)partes.push(X(ctx,'res.ins.fueraVentana',`${nfEs.format(conv.outsideWindow)} conversaciones quedan fuera de la ventana de 12 meses.`,{n:nfEs.format(conv.outsideWindow)}));
 if(conv.undated)partes.push(X(ctx,'res.ins.sinFecha',`${nfEs.format(conv.undated)} sin fecha.`,{n:nfEs.format(conv.undated)}));
 const parcial=notaMesParcial(conv.series,ahora,conv.completeness,p=>p.count>0,ctx);
 if(parcial)partes.push(parcial);
 if(!partes.length)partes.push(X(ctx,'res.ins.ventana12','Ventana de 12 meses; no incluye el mes en curso.'));
 return {id:'conversaciones',texto:cuerpo[0].toUpperCase()+cuerpo.slice(1),fuente,cobertura:partes.join(' '),clase:conv.class==='estimated'?'estimated':'observed'};
}
function libro(led,ahora,ctx=null){
 const fuente=X(ctx,'res.ins.fuenteLibro','Libro económico: pedidos registrados');
 if(!led)return {id:'pedidos',vacio:true,razon:X(ctx,'res.ins.noTend','Las tendencias no están disponibles ahora; reintenta.'),fuente};
 if(led.status==='timeout')return {id:'pedidos',vacio:true,razon:X(ctx,'res.ins.timeout','La consulta superó el tiempo permitido. Reintenta en unos segundos.'),fuente};
 if(led.status!=='ok'||!led.currency||led.exponent===null||led.exponent===undefined)return {id:'pedidos',vacio:true,razon:X(ctx,'res.ins.sinPedidosMoneda','Aún no hay pedidos registrados con moneda definida.'),fuente};
 const par=dosMesesCompletos(led.series,ahora,led.completeness);
 if(!par)return {id:'pedidos',vacio:true,razon:X(ctx,'res.ins.dosMesesPedidos','Hacen falta al menos dos meses completos de pedidos.'),fuente};
 const [a,b]=par,x=a.orders.amountMinor,y=b.orders.amountMinor;
 if(!entero(x)||!entero(y))return {id:'pedidos',vacio:true,razon:X(ctx,'res.ins.mesSinImporte','Algún mes no tiene un importe exacto.'),fuente};
 const v=variacion(y,x),fm=m=>formatMinorUnits(m,led.currency,led.exponent);
 const L=LOC(ctx),cuerpo=ctx?.t?(v?ctx.t('res.ins.pedCambio',{verbo:ctx.t('res.ins.vped.'+v.dir),x:fm(x),mesA:mesLargo(a.month,L),y:fm(y),mesB:mesLargo(b.month,L),var:etiquetaVar(v,ctx)}):ctx.t('res.ins.pedSinBase',{y:fm(y),mesB:mesLargo(b.month,L),mesA:mesLargo(a.month,L)})):v?`Los pedidos registrados ${frase(v,'subieron','bajaron','se mantuvieron')} de **${fm(x)}** en ${mesLargo(a.month)} a **${fm(y)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`:`En ${mesLargo(b.month)} los pedidos registrados fueron **${fm(y)}**; ${mesLargo(a.month)} no ofrece base de comparación.`;
 const sin=a.orders.unknownAmounts+b.orders.unknownAmounts;
 const cob=[ctx?.t?(led.otherCurrencies?.length?ctx.t('res.ins.soloMonedaOtras',{cur:led.currency,m:led.otherCurrencies.join(', ')}):ctx.t('res.ins.soloMonedaNoMezcla',{cur:led.currency})):`Solo ${led.currency}; ${led.otherCurrencies?.length?`otras monedas (${led.otherCurrencies.join(', ')}) no se suman ni se convierten.`:'no se mezclan monedas.'}`];
 if(sin)cob.push(X(ctx,'res.ins.pedSinImporte',`${nfEs.format(sin)} pedidos sin importe conocido no se suman.`,{n:nfEs.format(sin)}));
 const parcial=notaMesParcial(led.series,ahora,led.completeness,p=>p.orders.count+p.orders.unknownAmounts>0,ctx);
 if(parcial)cob.push(parcial);
 return {id:'pedidos',texto:cuerpo,fuente,cobertura:cob.join(' '),clase:led.class==='estimated'?'estimated':'observed'};
}
const FUENTE_CAT='Incidencias clasificadas por la IA (issues.category)';
/** Acepta la vista de la API ({status,rows,totals}) o, por compatibilidad, un arreglo [{category,count}]. null = no se pudo consultar. */
function categorias(entrada,fuente=FUENTE_CAT,ctx=null){
 fuente=X(ctx,'res.ins.fuenteCat',fuente);
 const vista=Array.isArray(entrada)?{status:entrada.length?'ok':'empty',rows:entrada,totals:null}:entrada;
 if(!vista)return {id:'categorias',vacio:true,razon:X(ctx,'res.ins.catNoDisp','Los conteos por categoría no están disponibles ahora; reintenta.'),fuente};
 if(vista.status==='timeout')return {id:'categorias',vacio:true,razon:X(ctx,'res.ins.catTimeout','La consulta por categoría superó el tiempo permitido. Reintenta en unos segundos.'),fuente};
 const filas=(vista.rows??[]).filter(f=>f&&Number.isFinite(f.count)&&f.count>0);
 if(!filas.length)return {id:'categorias',vacio:true,razon:X(ctx,'res.ins.catNinguna','No hay incidencias clasificadas en este alcance.'),fuente};
 const sep=separarRuidoCategorias(filas),visibles=sep.visibles;
 const totalTodas=vista.totals?.incidences??filas.reduce((n,f)=>n+f.count,0),totalVisibles=visibles.reduce((n,f)=>n+f.count,0);
 if(totalVisibles<=0)return {id:'categorias',vacio:true,razon:X(ctx,'res.ins.catTodasRuido','Todas las incidencias de este alcance son notificaciones automáticas; actívalas en la gráfica para verlas.'),fuente};
 const top=[...visibles].sort((p,q)=>q.count-p.count||p.category.localeCompare(q.category))[0];
 const dec=BigInt(top.count)*1000n/BigInt(totalVisibles);
 const cob=[X(ctx,'res.ins.catCob',`${nfEs.format(vista.totals?.categories??filas.length)} categorías en ${nfEs.format(totalTodas)} incidencias; se cuentan incidencias, no problemas agrupados.`,{n:nfEs.format(vista.totals?.categories??filas.length),total:nfEs.format(totalTodas)})];
 if(sep.incidenciasOcultas>0)cob.push(X(ctx,'res.ins.catExcluye',`El porcentaje excluye ${nfEs.format(sep.incidenciasOcultas)} incidencias de notificaciones automáticas.`,{n:nfEs.format(sep.incidenciasOcultas)}));
 if(vista.truncated)cob.push(X(ctx,'res.ins.catRecortada','Lista recortada a las categorías con más incidencias.'));
 return {id:'categorias',texto:X(ctx,'res.ins.catTop',`La categoría con más incidencias es **${etiquetaCategoria(top.category)}**: **${nfEs.format(top.count)}** de ${nfEs.format(totalVisibles)} (${(Number(dec)/10).toLocaleString(LOCALES.es,{minimumFractionDigits:1,maximumFractionDigits:1})} %).`,{cat:etiquetaCategoria(top.category),n:nfEs.format(top.count),total:nfEs.format(totalVisibles),pct:(Number(dec)/10).toLocaleString(LOC(ctx),{minimumFractionDigits:1,maximumFractionDigits:1})}),fuente,cobertura:cob.join(' '),clase:'inferred'};
}
/** Resumen: conversaciones, pedidos y categorías (máx. 3). */
export function insightsResumen({trends=null,categorias:filas=null,ahora=new Date(),t=null,loc=LOCALES.es}={}){
 const ctx=t?{t,loc}:null;
 return [conversaciones(trends?.conversations,ahora,ctx),libro(trends?.ledger,ahora,ctx),categorias(filas,undefined,ctx)].slice(0,MAX);
}
const exacto=m=>!!m&&entero(m.amount_minor);
const primaria=item=>item.metrics?.find(m=>m.kind==='exposure')??item.metrics?.[0];
/** Problemas: mayor exposición, cobertura de importes y cobertura de evidencia (máx. 3), sobre los problemas ya filtrados. */
export function insightsProblemas({items=[],moneda=null,t=null}={}){
 const ctx=t?{t}:null,fuente=X(ctx,'res.ins.fuenteProb','Corte publicado: problemas agrupados');
 const n=items.length;
 if(!n)return [{id:'mayor',vacio:true,razon:X(ctx,'res.ins.probNinguno','No hay problemas agrupados visibles en este alcance.'),fuente}];
 const conImporte=items.filter(i=>{const m=primaria(i);return exacto(m)&&(!moneda||m.currency===moneda);});
 const top=conImporte.reduce((best,i)=>!best||BigInt(primaria(i).amount_minor)>BigInt(primaria(best).amount_minor)?i:best,null);
 const out=[];
 if(top){const m=primaria(top),c=m.coverage;
  out.push({id:'mayor',texto:ctx?t(top.evidence.length===1?'res.ins.probMayor1':'res.ins.probMayorN',{titulo:top.title,imp:formatMinorUnits(m.amount_minor,m.currency,m.exponent),n:nfEs.format(top.evidence.length)}):`**${top.title}** concentra la mayor exposición de esta página: **${formatMinorUnits(m.amount_minor,m.currency,m.exponent)}** de ingresos expuestos, con **${nfEs.format(top.evidence.length)}** ${top.evidence.length===1?'cita verificable':'citas verificables'}.`,fuente,cobertura:ctx?(c&&c.eligible_n>0?t('res.ins.probCobConocido',{a:nfEs.format(c.known_n),b:nfEs.format(c.eligible_n)})+' ':'')+t('res.ins.probCobBase'):(c&&c.eligible_n>0?`${nfEs.format(c.known_n)} de ${nfEs.format(c.eligible_n)} registros con importe conocido. `:'')+'La exposición compartida entre problemas no se suma y no es pérdida.',clase:'inferred'});}
 else out.push({id:'mayor',vacio:true,razon:X(ctx,'res.ins.probSinImporte','Ningún problema visible tiene un importe expuesto exacto en este corte.'),fuente});
 out.push({id:'importes',texto:ctx?t(conImporte.length<n?'res.ins.probImportesResto':'res.ins.probImportes',{a:nfEs.format(conImporte.length),b:nfEs.format(n)}):`**${nfEs.format(conImporte.length)}** de **${nfEs.format(n)}** problemas agrupados de esta página tienen importe expuesto conocido${conImporte.length<n?'; el resto no muestra cifra en lugar de un cero':''}.`,fuente,cobertura:ctx?(moneda?t('res.ins.probCuentaMoneda',{m:moneda}):t('res.ins.probCuenta')):`Cuenta problemas agrupados de la página actual${moneda?`, en ${moneda}`:''}; no cuenta incidencias.`,clase:'observed'});
 const conCitas=items.filter(i=>(i.evidence?.length??0)>0).length;
 if(!items.every(i=>i.metrics?.some(m=>m.missing_reasons?.includes('EXPOSURE_NOT_LINKED'))))out.push({id:'citas',texto:X(ctx,'res.ins.probCitas',`**${nfEs.format(conCitas)}** de **${nfEs.format(n)}** problemas agrupados tienen al menos una cita verificable con tu acceso.`,{a:nfEs.format(conCitas),b:nfEs.format(n)}),fuente:X(ctx,'res.ins.fuenteEv','Corte publicado: evidencia autorizada'),cobertura:X(ctx,'res.ins.probCitaRespalda','Una cita respalda el problema; no demuestra su causa.'),clase:'observed'});
 return out.slice(0,MAX);
}

const mesCorto=m=>new Intl.DateTimeFormat(LOCALES.es,{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
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
 const par=dosMesesCompletos(serie,ahora,vista.completeness??null);
 if(par){const [a,b]=par,v=variacion(String(b.count),String(a.count));
  out.push(v?{id:'cambio',texto:`Las incidencias ${frase(v,'subieron','bajaron','se mantuvieron')} de **${nfEs.format(a.count)}** en ${mesLargo(a.month)} a **${nfEs.format(b.count)}** en ${mesLargo(b.month)} (${etiquetaVar(v)}).`,fuente,cobertura:'Compara dos meses completos; el mes en curso se excluye. Es una asociación temporal, no una causa.',clase:'inferred'}
   :{id:'cambio',vacio:true,razon:`${mesLargo(a.month)} no tiene incidencias: no hay base honesta para calcular un porcentaje.`,fuente});}
 else out.push({id:'cambio',vacio:true,razon:'Hacen falta al menos dos meses completos para comparar.',fuente});
 if(vista.linkedRuns!==null&&vista.linkedRuns!==undefined)out.push({id:'corridas',texto:`El problema agrupa **${nfEs.format(vista.linkedRuns)}** ${vista.linkedRuns===1?'corrida de extracción':'corridas de extracción'}; en total suman **${nfEs.format(vista.total)}** incidencias.`,fuente:'Vínculos problema-corrida (agrupación por IA)',cobertura:'Una corrida puede traer incidencias de varias categorías; el conteo no es el número de clientes afectados.',clase:'inferred'});
 return out.slice(0,MAX);
}

// Criterio ÚNICO de «mes completo» para comparar mes contra mes (Resumen, lecturas, tarjetas, gráficas).
// Un mes es completo si (1) es anterior al mes calendario en curso y (2) cuando se conoce el último dato cargado
// («dataThrough»: fecha efectiva más reciente del libro, fecha más reciente de las conversaciones o, en su defecto,
// la marca de agua del resumen precomputado) ese dato llega al último día del mes. Sin marca verificable se usa solo (1)
// y la base se rotula «calendar»: la cifra no afirma que el mes esté completo en los datos.
const MES=/^\d{4}-(0[1-9]|1[0-2])$/;
const diaIso=v=>{if(v===null||v===undefined)return null;const t=Date.parse(v instanceof Date?v.toISOString():String(v));return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};
/** Último día (YYYY-MM-DD) del mes YYYY-MM. */
export function ultimoDiaDelMes(month){if(!MES.test(month))return null;const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
/** ¿El mes está completo? `dataThrough` puede ser Date/ISO o null. */
export function esMesCompleto(month,{dataThrough=null,ahora=new Date()}={}){
 if(!MES.test(month))return false;
 if(month>=ahora.toISOString().slice(0,7))return false;
 const dt=diaIso(dataThrough);
 return dt===null?true:dt>=ultimoDiaDelMes(month);
}
/** Último mes con datos que NO está completo (el «parcial»), o null. `conDatos(punto)` dice si el punto tiene registros. */
export function mesParcial(series,{dataThrough=null,ahora=new Date(),conDatos=p=>Number(p?.count)>0}={}){
 if(!Array.isArray(series))return null;
 const p=[...series].reverse().find(x=>x&&typeof x.month==='string'&&conDatos(x));
 if(!p)return null;
 return esMesCompleto(p.month,{dataThrough,ahora})?null:{month:p.month,dataThrough:diaIso(dataThrough)};
}
/** Resumen serializable para el payload de tendencias. */
export function completitud(series,{dataThrough=null,ahora=new Date(),conDatos}={}){
 const dt=diaIso(dataThrough),parcial=mesParcial(series,{dataThrough:dt,ahora,conDatos});
 const parciales=(Array.isArray(series)?series:[]).filter(x=>x&&typeof x.month==='string'&&(conDatos??(p=>Number(p?.count)>0))(x)&&!esMesCompleto(x.month,{dataThrough:dt,ahora})).map(x=>x.month);
 return {basis:dt?'data':'calendar',dataThrough:dt,partialMonth:parcial?.month??null,partialMonths:parciales};
}

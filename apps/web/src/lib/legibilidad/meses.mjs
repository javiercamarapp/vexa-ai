// Comparación mes contra mes de las tarjetas del Resumen: último mes COMPLETO frente al anterior completo.
// Un mes parcial (p. ej. octubre con 5 días cargados) jamás entra en la variación ni en la línea de la tarjeta; se rotula.
// Una medida sin registros elegibles devuelve `sinCobertura`: no hay delta, ni tendencia, ni «0.00» presentado como dato.
import {esMesCompleto,mesParcial} from '../../../../../packages/metrics/complete-months.mjs';
import {variacion} from './insights.mjs';
import {LOCALES} from '../formato/idioma.mjs';
const corto=m=>new Intl.DateTimeFormat(LOCALES.es,{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const largo=m=>new Intl.DateTimeFormat(LOCALES.es,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const dia=d=>new Intl.DateTimeFormat(LOCALES.es,{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')).replace('.','');
/** ¿El punto de la serie del libro tiene registros (con o sin importe) de esa medida? */
export const ledgerConDatos=medida=>p=>!!p&&!!p[medida]&&(Number(p[medida].count)||0)+(Number(p[medida].unknownAmounts)||0)>0;
/**
 * @param series      LedgerMonth[] (mes, orders, refunds)
 * @param medida      'orders'|'refunds'
 * @param completitud payload `ledger.completeness` (puede faltar: se usa solo el mes calendario)
 * @returns {sinCobertura,delta,rotulo,parcial,meses}  `meses` = puntos de meses completos (para la línea de tendencia)
 */
export function comparacionMensual(series,medida,completitud,ahora=new Date()){
 const conDatos=ledgerConDatos(medida),lista=Array.isArray(series)?series:[];
 if(!lista.some(conDatos))return {sinCobertura:true,delta:null,rotulo:'Sin cobertura',parcial:null,meses:[]};
 const dataThrough=completitud?.dataThrough??null;
 const completos=lista.filter(p=>esMesCompleto(p.month,{dataThrough,ahora}));
 const p=mesParcial(lista,{dataThrough,ahora,conDatos});
 const parcialTxt=p?` · ${corto(p.month)} (parcial${p.dataThrough?`, datos hasta ${dia(p.dataThrough)}`:''}) no comparado`:'';
 if(completos.length<2)return {sinCobertura:false,delta:null,rotulo:'Sin dos meses completos para comparar'+parcialTxt,parcial:p,meses:completos};
 const [a,b]=completos.slice(-2),v=variacion(b[medida].amountMinor,a[medida].amountMinor);
 const periodo=`${corto(b.month)} vs ${corto(a.month)}`;
 if(!v)return {sinCobertura:false,delta:null,rotulo:`${periodo}: ${largo(a.month)} sin base para calcular el cambio`+parcialTxt,parcial:p,meses:completos};
 return {sinCobertura:false,delta:{value:v.texto,dir:v.dir==='sube'?'up':v.dir==='baja'?'down':'flat'},rotulo:periodo+parcialTxt,parcial:p,meses:completos};
}

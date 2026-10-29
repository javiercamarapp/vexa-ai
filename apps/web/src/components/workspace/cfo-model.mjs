import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {numero} from '../../lib/formato/idioma.mjs';
// Textos de este módulo puro: español canónico (lo que fijan las pruebas) e inglés. El idioma es siempre opcional y por omisión 'es'.
export const TXT={
 es:{cobNoInformada:'Cobertura no informada',sinElegibles:'Sin registros elegibles',deRegistros:(a,b)=>`${a} de ${b} registros`,noVerificable:'No verificable',noDisponible:'No disponible',sinImportes:'No hay importes completos para comparar.',misma:'La comparación requiere la misma moneda y decimales válidos.',cero:'Los importes conocidos son cero.',proporcional:'Longitud proporcional a la magnitud; negativos a la izquierda. No es una suma.',
  subtotal:'Subtotal documentado',totalDesc:'Total desconocido · Cobertura parcial',publicado:'Importe publicado',revisa:'Revisa la unidad y el importe',totalDesc2:'Total desconocido'},
 en:{cobNoInformada:'Coverage not reported',sinElegibles:'No eligible records',deRegistros:(a,b)=>`${a} of ${b} records`,noVerificable:'Cannot be verified',noDisponible:'Not available',sinImportes:'There are no complete amounts to compare.',misma:'The comparison requires the same currency and valid decimals.',cero:'The known amounts are zero.',proporcional:'Length proportional to magnitude; negatives to the left. It is not a sum.',
  subtotal:'Documented subtotal',totalDesc:'Total unknown · Partial coverage',publicado:'Published amount',revisa:'Check the unit and the amount',totalDesc2:'Total unknown'},
};
const T=idioma=>TXT[idioma==='en'?'en':'es'];
const integer=x=>typeof x==='string'&&x.length<=4096&&/^(0|-?[1-9]\d*)$/.test(x);
const unit=m=>typeof m.currency==='string'&&/^[A-Z]{3}$/.test(m.currency)&&Number.isInteger(m.exponent)&&m.exponent>=0&&m.exponent<=9;
const absolute=n=>n<0n?-n:n;
// Only a bounded integer ratio becomes Number; money itself never does.
export function ratioBps(numerator,denominator){if(typeof numerator!=='bigint'||typeof denominator!=='bigint'||numerator<0n||denominator<=0n||numerator>denominator)return null;return Number(numerator*10000n/denominator);}
export function metricCoverage(value,idioma){
 const x=T(idioma);
 if(!value||!Number.isSafeInteger(value.known_n)||!Number.isSafeInteger(value.eligible_n)||value.known_n<0||value.eligible_n<value.known_n)return {label:x.cobNoInformada,bps:null,known:null,eligible:null};
 const {known_n:known,eligible_n:eligible}=value;return {label:eligible===0?x.sinElegibles:x.deRegistros(numero(known,idioma),numero(eligible,idioma)),bps:ratioBps(BigInt(known),BigInt(eligible)),known,eligible};
}
export function buildCfoModel(items,idioma){
 const x=T(idioma);
 const rows=items.flatMap((record,recordIndex)=>record.metrics.map((metric,index)=>{
  const validUnit=unit(metric),known=validUnit&&integer(metric.amount_minor),unknown=metric.amount_minor===null;
  // Desconocido ≠ cero: sin ningún registro con importe conocido no hay subtotal que mostrar (un «0.00» sería un dato inventado).
  const coverage=metricCoverage(metric.coverage,idioma),hasKnown=coverage.known===null||coverage.known>0;
  const validSubtotal=validUnit&&integer(metric.known_subtotal),invalid=!validUnit||!known&&!unknown;
  return {key:`${recordIndex}:${index}`,recordId:record.id,recordTitle:record.title,version:record.version,metric,
   amount:known?metric.amount_minor:null,display:invalid?x.noVerificable:known?formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent):x.noDisponible,
   knownSubtotal:validSubtotal&&hasKnown?formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent):null,
   subtotal:unknown&&validSubtotal&&hasKnown?formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent):null,
   state:invalid?'invalid':known?'known':'unknown',coverage,
   reasons:Array.isArray(metric.missing_reasons)?metric.missing_reasons.filter(x=>typeof x==='string'):[],validUnit};
 }));
 const known=rows.filter(r=>r.state==='known'),units=new Set(known.map(r=>`${r.metric.currency}:${r.metric.exponent}`));
 const compatible=known.length>0&&units.size===1&&rows.every(r=>r.validUnit&&`${r.metric.currency}:${r.metric.exponent}`===`${known[0].metric.currency}:${known[0].metric.exponent}`);
 const maximum=compatible?known.reduce((max,r)=>{const n=absolute(BigInt(r.amount));return n>max?n:max;},0n):null;
 return {rows,compatible,maximum:maximum===null?null:String(maximum),currency:compatible?known[0].metric.currency:null,
  bars:rows.map(r=>({...r,bps:compatible&&r.state==='known'&&maximum>0n?ratioBps(absolute(BigInt(r.amount)),maximum):null,negative:r.state==='known'&&BigInt(r.amount)<0n})),
  comparisonNote:!known.length?x.sinImportes:!compatible?x.misma:maximum===0n?x.cero:x.proporcional};
}

// Presentation only: a documented subtotal never enters totals or comparison bars.
export function kpiHeadline(row,idioma){
 const x=T(idioma);
 const documented=row.state==='unknown'&&row.subtotal!==null&&row.coverage.known>0;
 return {value:documented?row.subtotal:row.display,label:documented?x.subtotal:null,note:documented?x.totalDesc:row.state==='known'?x.publicado:row.state==='invalid'?x.revisa:x.totalDesc2};
}

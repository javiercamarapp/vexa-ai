import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
const integer=x=>typeof x==='string'&&x.length<=4096&&/^(0|-?[1-9]\d*)$/.test(x);
const unit=m=>typeof m.currency==='string'&&/^[A-Z]{3}$/.test(m.currency)&&Number.isInteger(m.exponent)&&m.exponent>=0&&m.exponent<=9;
const absolute=n=>n<0n?-n:n;
// Only a bounded integer ratio becomes Number; money itself never does.
export function ratioBps(numerator,denominator){if(typeof numerator!=='bigint'||typeof denominator!=='bigint'||numerator<0n||denominator<=0n||numerator>denominator)return null;return Number(numerator*10000n/denominator);}
export function metricCoverage(value){
 if(!value||!Number.isSafeInteger(value.known_n)||!Number.isSafeInteger(value.eligible_n)||value.known_n<0||value.eligible_n<value.known_n)return {label:'Cobertura no informada',bps:null,known:null,eligible:null};
 const {known_n:known,eligible_n:eligible}=value;return {label:eligible===0?'Sin registros elegibles':`${known.toLocaleString('es-MX')} de ${eligible.toLocaleString('es-MX')} registros`,bps:ratioBps(BigInt(known),BigInt(eligible)),known,eligible};
}
export function buildCfoModel(items){
 const rows=items.flatMap((record,recordIndex)=>record.metrics.map((metric,index)=>{
  const validUnit=unit(metric),known=validUnit&&integer(metric.amount_minor),unknown=metric.amount_minor===null;
  const validSubtotal=validUnit&&integer(metric.known_subtotal),invalid=!validUnit||!known&&!unknown;
  return {key:`${recordIndex}:${index}`,recordId:record.id,recordTitle:record.title,version:record.version,metric,
   amount:known?metric.amount_minor:null,display:invalid?'No verificable':known?formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent):'No disponible',
   knownSubtotal:validSubtotal?formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent):null,
   subtotal:unknown&&validSubtotal?formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent):null,
   state:invalid?'invalid':known?'known':'unknown',coverage:metricCoverage(metric.coverage),
   reasons:Array.isArray(metric.missing_reasons)?metric.missing_reasons.filter(x=>typeof x==='string'):[],validUnit};
 }));
 const known=rows.filter(r=>r.state==='known'),units=new Set(known.map(r=>`${r.metric.currency}:${r.metric.exponent}`));
 const compatible=known.length>0&&units.size===1&&rows.every(r=>r.validUnit&&`${r.metric.currency}:${r.metric.exponent}`===`${known[0].metric.currency}:${known[0].metric.exponent}`);
 const maximum=compatible?known.reduce((max,r)=>{const n=absolute(BigInt(r.amount));return n>max?n:max;},0n):null;
 return {rows,compatible,maximum:maximum===null?null:String(maximum),currency:compatible?known[0].metric.currency:null,
  bars:rows.map(r=>({...r,bps:compatible&&r.state==='known'&&maximum>0n?ratioBps(absolute(BigInt(r.amount)),maximum):null,negative:r.state==='known'&&BigInt(r.amount)<0n})),
  comparisonNote:!known.length?'No hay importes completos para comparar.':!compatible?'La comparación requiere la misma moneda y decimales válidos.':maximum===0n?'Los importes conocidos son cero.':'Longitud proporcional a la magnitud; negativos a la izquierda. No es una suma.'};
}

// Presentation only: a documented subtotal never enters totals or comparison bars.
export function kpiHeadline(row){
 const documented=row.state==='unknown'&&row.subtotal!==null&&row.coverage.known>0;
 return {value:documented?row.subtotal:row.display,label:documented?'Subtotal documentado':null,note:documented?'Total desconocido · Cobertura parcial':row.state==='known'?'Importe publicado':row.state==='invalid'?'Revisa la unidad y el importe':'Total desconocido'};
}

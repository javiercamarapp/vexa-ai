export const nf=new Intl.NumberFormat('es-MX');
export const nfCompact=new Intl.NumberFormat('es-MX',{notation:'compact',maximumFractionDigits:1});
/** Percent with one decimal from two integers, null when the whole is zero. */
export const pct=(part:number,whole:number)=>whole>0?Math.round(part*1000/whole)/10:null;
export const fmtPct=(p:number|null)=>p===null?'—':p.toLocaleString('es-MX',{maximumFractionDigits:1})+' %';
export const cx=(...parts:(string|false|null|undefined)[])=>parts.filter(Boolean).join(' ');

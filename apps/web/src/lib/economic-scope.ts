// Alcance inicial de /economics. Hereda el del espacio de trabajo cuando viene en la URL (date_start, date_end, currency, basis, exponent);
// sin él, 12 meses hasta el fin del mes en curso y la base de marketplace (la que usan los cortes publicados), no un mes fijo.
export type EconomicInitialScope={start:string;end:string;currency:string;exponent:number;basis:string;fromSpace:boolean};
const DAY=/^\d{4}-\d{2}-\d{2}/;
const valid=(v:string|null)=>v!==null&&DAY.test(v)&&Number.isFinite(Date.parse(v.slice(0,10)+'T00:00:00Z'));
export function economicInitialScope(query:URLSearchParams,now:Date=new Date()):EconomicInitialScope{
 const s=query.get('date_start'),e=query.get('date_end'),okDates=valid(s)&&valid(e)&&s!.slice(0,10)<e!.slice(0,10);
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11,1));
 const cur=query.get('currency'),exp=query.get('exponent'),basis=query.get('basis');
 return {start:okDates?s!.slice(0,10):start.toISOString().slice(0,10),end:okDates?e!.slice(0,10):end.toISOString().slice(0,10),currency:cur&&/^[A-Z]{3}$/.test(cur)?cur:'USD',exponent:exp&&/^\d$/.test(exp)?Number(exp):2,basis:basis&&/^[a-z_]{3,80}$/.test(basis)&&basis!=='net'?basis:'marketplace_line_price',fromSpace:okDates};
}

export class ScopeContractError extends Error{constructor(code){super(code);this.name='ScopeContractError';this.code=code;}}
const fail=code=>{throw new ScopeContractError(code);};
export function validUtc(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;const normalized=value.includes('.')?value.replace(/\.(\d{1,3})Z$/,(_,n)=>'.'+n.padEnd(3,'0')+'Z'):value.replace('Z','.000Z');return new Date(value).toISOString()===normalized;}
const text=x=>typeof x==='string'&&x.trim().length>0;
export function validateWindow(input){
 if(!input||!validUtc(input.start)||!validUtc(input.end)||Date.parse(input.start)>=Date.parse(input.end)||!text(input.timezone)||!text(input.date_basis))fail('WINDOW_INVALID');
 try{new Intl.DateTimeFormat('en',{timeZone:input.timezone});}catch{fail('TIMEZONE_INVALID');}
 let horizon=null;if(input.horizon!==null&&input.horizon!==undefined){const h=input.horizon;if(!h||!validUtc(h.as_of)||Date.parse(h.as_of)!==Date.parse(input.start)||!['day','month'].includes(h.unit)||!Number.isSafeInteger(h.quantity)||h.quantity<=0||h.quantity>100000||!text(h.version))fail('HORIZON_INVALID');const end=new Date(h.as_of);if(h.unit==='day')end.setUTCDate(end.getUTCDate()+h.quantity);else{const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+h.quantity);const month=end.getUTCMonth();end.setUTCDate(day);if(end.getUTCMonth()!==month)end.setUTCDate(0);}if(!Number.isFinite(end.getTime())||end.getTime()!==Date.parse(input.end))fail('HORIZON_WINDOW_MISMATCH');horizon={as_of:new Date(h.as_of).toISOString(),unit:h.unit,quantity:h.quantity,version:h.version};}
 return {start:new Date(input.start).toISOString(),end:new Date(input.end).toISOString(),timezone:input.timezone,date_basis:input.date_basis,horizon};
}
export function containsInstant(window,instant){const w=validateWindow(window);if(!validUtc(instant))fail('INSTANT_INVALID');return Date.parse(instant)>=Date.parse(w.start)&&Date.parse(instant)<Date.parse(w.end);}
export function assertCompatibleWindows(windows){if(!Array.isArray(windows)||!windows.length)fail('WINDOWS_REQUIRED');const normalized=windows.map(validateWindow),first=JSON.stringify(normalized[0]);if(normalized.some(w=>JSON.stringify(w)!==first))fail('WINDOW_OR_HORIZON_MISMATCH');return normalized[0];}

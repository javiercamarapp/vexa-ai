import {createHash} from 'node:crypto';
export const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export class HistoryError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status;}}
export const requireThat=(ok,code,status)=>{if(!ok)throw new HistoryError(code,status);};
export const key=(...parts)=>{const h=createHash('sha256').update(parts.join(':')).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
export function trustedDatabase(database){return{transaction:async(action,work)=>{let domain;try{return await database.transaction(action,async s=>{try{return await work(s);}catch(e){if(e instanceof HistoryError)domain=e;throw e;}});}catch(e){throw domain??e;}}};}

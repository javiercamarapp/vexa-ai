// Capa de revisiones del Tracker (referencia en memoria; el SQL de 0052 reproduce la misma semántica).
// Identidad = hoja!fila. Revisión = identidad + hash de contenido. Una versión recibida observa cada fila.
// La cabeza de una fila es su observación en la versión de MAYOR rango (decisión de Javier: manda la más reciente);
// una versión anterior aplicada después NO mueve la cabeza. Nada se borra: toda revisión sigue legible.
import {canonicalCell} from './rows.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export class TrackerLedger{
 #versions=new Map();#revisions=new Map();#identities=new Set();#obs=new Map();
 addVersion({sha256,label=null,rank,received_at=null}){
  if(!/^[0-9a-f]{64}$/.test(sha256))fail('INVALID_VERSION_HASH');
  if(!Number.isSafeInteger(rank))fail('INVALID_VERSION_RANK');
  const prev=this.#versions.get(sha256);
  if(prev){if(prev.rank!==rank)fail('VERSION_CONFLICT');return prev;}
  for(const v of this.#versions.values())if(v.rank===rank)fail('VERSION_RANK_TAKEN');
  const v=Object.freeze({sha256,label,rank,received_at});this.#versions.set(sha256,v);this.#obs.set(sha256,new Map());return v;
 }
 get versions(){return [...this.#versions.values()].sort((a,b)=>a.rank-b.rank);}
 applyBatch(sha256,rows){
  const obs=this.#obs.get(sha256);if(!obs)fail('VERSION_UNKNOWN');
  if(rows.length>250)fail('BATCH_TOO_LARGE');
  const out={inserted:0,revised:0,unchanged:0,replay:0};
  for(const r of rows){
   const key=r.row_ref+'|'+r.row_hash,seen=obs.get(r.row_ref);
   if(seen){if(seen!==r.row_hash)fail('ROW_CONFLICT_IN_VERSION');out.replay++;continue;}
   if(!this.#revisions.has(key)){this.#revisions.set(key,Object.freeze({row_ref:r.row_ref,row_hash:r.row_hash,cells:r.cells,ticket:r.ticket,first_version:sha256}));out[this.#identities.has(r.row_ref)?'revised':'inserted']++;this.#identities.add(r.row_ref);}
   else out.unchanged++;
   obs.set(r.row_ref,r.row_hash);
  }
  return out;
 }
 get revisionCount(){return this.#revisions.size;}
 observed(sha256){return this.#obs.get(sha256)?.size??0;}
 head(row_ref){
  let best=null;for(const v of this.#versions.values()){const h=this.#obs.get(v.sha256).get(row_ref);if(h&&(!best||v.rank>best.rank))best={rank:v.rank,version:v.sha256,hash:h};}
  return best&&{...best,revision:this.#revisions.get(row_ref+'|'+best.hash)};
 }
 heads(){const refs=new Set();for(const o of this.#obs.values())for(const k of o.keys())refs.add(k);return [...refs].map(r=>[r,this.head(r)]);}
 // Celdas cambiadas entre dos versiones: por celda (columna) de cada fila de la unión; ausente en un lado cuenta como cambio.
 diff(fromSha,toSha,{perSheet=true}={}){
  const a=this.#obs.get(fromSha),b=this.#obs.get(toSha);if(!a||!b)fail('VERSION_UNKNOWN');
  const sheets={};let changed=0,rowsChanged=0,rowsOnlyFrom=0,rowsOnlyTo=0;
  const map=(ref,h)=>h?new Map(this.#revisions.get(ref+'|'+h).cells.map(c=>[c.col,JSON.stringify(canonicalCell(c))])):new Map();
  for(const ref of new Set([...a.keys(),...b.keys()])){
   const ha=a.get(ref),hb=b.get(ref);if(ha===hb)continue;
   const ma=map(ref,ha),mb=map(ref,hb);let n=0;
   for(const col of new Set([...ma.keys(),...mb.keys()]))if(ma.get(col)!==mb.get(col))n++;
   changed+=n;if(!ha)rowsOnlyTo++;else if(!hb)rowsOnlyFrom++;else rowsChanged++;
   if(perSheet){const s=ref.slice(0,ref.lastIndexOf('!'));sheets[s]=(sheets[s]??0)+n;}
  }
  return {changedCells:changed,rowsChanged,rowsOnlyFrom,rowsOnlyTo,...(perSheet?{perSheet:sheets}:{})};
 }
}

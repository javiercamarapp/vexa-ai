// Browser-safe URL helpers. A base snapshot hash is not a workspace binding hash.
export function publicationQuery(snapshot){
 const s=snapshot.scope;
 const day=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT00:00:00\.000Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
 if(!day(s.start)||!day(s.end)||s.start>=s.end||Date.parse(s.end)-Date.parse(s.start)>366*86400000||s.timezone!=='UTC'||s.dateBasis!=='occurred_at')return null;
 return new URLSearchParams({date_start:s.start.slice(0,10),date_end:s.end.slice(0,10),timezone:s.timezone,date_basis:s.dateBasis,currency:s.currency,exponent:String(s.exponent),basis:s.basis,snapshot_id:snapshot.id});
}
export function snapshotOverviewUrl(snapshot){const query=publicationQuery(snapshot);return query?'/overview?'+query.toString():null;}
export function pinWorkspaceQuery(query,meta){
 const next=new URLSearchParams(query);next.delete('resource');next.delete('format');
 // The query parser treats empty identity values as absent; keep the pinned URL equivalent.
 for(const key of ['snapshot_id','scope_hash'])if(next.get(key)==='')next.delete(key);
 if(!meta.snapshot_id)return next;
 const scope=meta.scope;
 const defaults={date_start:scope.date_start.slice(0,10),date_end:scope.date_end.slice(0,10),timezone:scope.timezone,date_basis:scope.date_basis,currency:scope.currency,basis:scope.basis,exponent:scope.exponent,snapshot_id:meta.snapshot_id,scope_hash:meta.scope_hash};
 for(const [key,value] of Object.entries(defaults))if(!next.has(key)&&value!==null&&value!==undefined)next.set(key,String(value));
 for(const key of ['sku','source'])if(!next.has(key))for(const value of scope[key]??[])next.append(key,value);
 return next;
}
export function latestWorkspaceQuery(query){const next=new URLSearchParams(query);for(const key of ['snapshot_id','scope_hash','cursor'])next.delete(key);return next;}

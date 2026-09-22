// SYN-WORKSPACE-271: authorized operational fixtures; no narrative creates money.
import assert from 'node:assert/strict';
import {exposureFixture} from '../F05-exposure/fixtures.mjs';
export {scope,otherScope,source,currency,order,parseCsv} from '../F05-snapshots/fixtures.mjs';
import {scope,source,currency,order} from '../F05-snapshots/fixtures.mjs';
export async function seedWorkspace(h, mapRows){
 const ok=async p=>{const r=await p;assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data;};
 const ledger=body=>ok(h.request(h.A,'/api/economics',body));
 await ledger(currency('USD'));const src=await ledger(source()),factory=await exposureFixture(h);
 const p1=await factory.problem(h.A,'SYN P1 órdenes compartidas'),p2=await factory.problem(h.A,'SYN P2 orden compartida');
 const o1=await ledger(order(src,'SYN-WORKSPACE-O1','10000')),o2=await ledger(order(src,'SYN-WORKSPACE-O2','20000'));
 for(const [p,o] of [[p1,o1],[p1,o2],[p2,o1]])await ledger({operation:'link',problemId:p.id,ledgerRowId:o.rowId,expectedVersion:0,active:true,report:'SYN owner attests observed operational order linked to real authorized evidence.',attested:true});
 await mapRows({src,o1,o2,p1,p2,ledger,ok});
 const draft=await ok(h.request(h.A,'/api/economic-snapshots',{operation:'stage',scope}));
 const snapshot=await ok(h.request(h.A,'/api/economic-snapshots',{operation:'publish',snapshotId:draft.id,expectedContentHash:draft.contentHash}));
 return {src,o1,o2,p1,p2,snapshot,ledger,ok};
}

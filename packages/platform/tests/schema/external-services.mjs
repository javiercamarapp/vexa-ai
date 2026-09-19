// Runs the READ-ONLY external service oracles independently of table-clone bindings.
// Requires the reviewed/external support directory; does not copy or replace its assertions.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const support=process.env.VEXA_F01_03_SUPPORT;
if(!support) throw Error('Set VEXA_F01_03_SUPPORT to the external F01-03 support directory');
const from=name=>import(pathToFileURL(path.join(support,name)).href);
const {launch}=await from('harness.mjs');
const {seed,revokeOracle}=await from('oracles.mjs');
const {serviceOracle}=await from('services.mjs');
const h=await launch({services:true});
try {
 for(const p of fs.readdirSync('supabase/migrations').filter(p=>p.endsWith('.sql')).sort())h.sql(fs.readFileSync(path.join('supabase/migrations',p),'utf8'));
 h.sql("NOTIFY pgrst, 'reload schema'");
 const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
 const fixtures=seed(h,actors);
 const revokedServices=await serviceOracle(h,fixtures,actors);
 revokeOracle(h,fixtures,actors);await revokedServices();
 console.log('PASS external serviceOracle + revokeOracle: real local Auth/Storage/PostgREST, A/B, anonymous, outsider, signed URL, retrieval, revocation. Not task acceptance.');
}finally{h.close();}

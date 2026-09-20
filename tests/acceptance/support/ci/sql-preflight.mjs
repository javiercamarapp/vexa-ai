import assert from 'node:assert/strict';
import {launch,candidateInputs} from '../F01-03/harness.mjs';
import {q} from '../F01-03/matrix.mjs';
import {seed,tableOracle} from '../F01-03/oracles.mjs';
const migrations=candidateInputs(process.env.VEXA_CANDIDATE);
const h=await launch({services:true});
try {
 for(const [i,sql] of migrations.entries()){
  try {h.sql(sql);} catch(error){
   // The reviewed harness suppresses psql stderr. Query PostgreSQL itself for
   // the specific syntax mutant; transaction/control failures are not syntax kills.
   let code='unknown';try{code=h.probe(`EXECUTE ${q(sql)};`).code;}catch{}
   assert.fail(`MIGRATION:${i}:SQLSTATE:${code}: ${error.message}`);
  }
 }
 const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
 const f=seed(h,actors);tableOracle(h,'conversations',f,actors);
 console.log('SQL_MIGRATIONS_APPLIED_AND_CONVERSATIONS_ISOLATED');
}finally{h.close();console.log('OWN_SQL_RESOURCES_REMOVED');}

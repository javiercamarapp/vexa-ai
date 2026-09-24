// Adapted signed contract oracle from frozen review344. Fabricated SYN metadata,
// NOT authentic human gold or evidence of model quality. Never invokes transport.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {fixture} from '../../intelligence/candidate-execution/tests/fixture.mjs';
import {canonical,hashValue} from '../../intelligence/evaluation/evaluate.mjs';
import {extractionPromptHash} from '../../gateway/index.mjs';
import {candidateCatalog} from '../../intelligence/candidates/catalog.mjs';
import {createCandidateRepository} from '../../intelligence/candidates/repository.mjs';
import {readRuntimeCode} from '../../intelligence/candidates/runtime-code-files.mjs';
export async function seedCandidates(database,tenant,id){
 const f=fixture();let config;try{config={taxonomy:['battery'],redactionPolicy:{version:'SYN342',emails:true,phones:true,namesMode:'dictionary',names:['SYN NAME']},gateway:{policy:f.config.policy,modelsByRole:f.config.modelsByRole,catalog:f.config.catalog}};}finally{fs.rmSync(f.dir,{recursive:true,force:true});}
 const env={VEXA_EXTRACTION_CONFIG_JSON:JSON.stringify([{tenantId:tenant,...config,taxonomy:['battery','delivery']}]),VEXA_EXTRACTION_CANDIDATES_JSON:JSON.stringify([{tenantId:tenant,candidateId:'SYN-contract',config}])},entry=candidateCatalog(env).get(tenant,'SYN-contract'),runtimeCode=readRuntimeCode(),{publicKey,privateKey}=generateKeyPairSync('ed25519');
 const p={version:1,tenantId:tenant,candidateId:'SYN-contract',configHash:entry.config.hash,promptHash:extractionPromptHash,codeHash:'a'.repeat(64),evaluatedCode:runtimeCode,protocolHash:'b'.repeat(64),holdoutHash:'c'.repeat(64),resultHash:'d'.repeat(64),taxonomyHash:hashValue(['battery']),evaluatedAt:new Date().toISOString(),keyId:'SYN-key',evidenceHash:'e'.repeat(64),status:'measured',kind:'human_gold',eligibleCases:30,goldComplete:true,coverage:1,citationIntegrity:1,invalidCitations:0,technicalFailures:0,missingPredictions:0,utility:1,utilityReviewed:30,utilityEmitted:30,totalCostMinor:'1'};
 env.VEXA_EVALUATION_CUSTODIANS_JSON=JSON.stringify([{tenantId:tenant,keyId:p.keyId,active:true,publicKey:publicKey.export({type:'spki',format:'pem'})}]);
 const repo=createCandidateRepository({database,env,runtimeCode});await repo.register({requestId:id,envelope:{payload:p,signature:sign(null,Buffer.from(canonical(p)),privateKey).toString('base64')}});
 await repo.change({operation:'select',resultId:id,expectedVersion:0,confirmed:true,reason:'validated_evaluation',evidenceHash:p.evidenceHash});
 await repo.change({operation:'rollback',targetVersion:0,expectedVersion:1,confirmed:true,reason:'incident_recovery',evidenceHash:p.evidenceHash});
 return{env,runtimeCode,id};
}
export async function checkCandidates(database,state){const repo=createCandidateRepository({database,...state});const r=await repo.list();assert.equal(r.version,2);assert.equal(r.history.length,2);assert.equal(r.history[0].operation,'rollback');assert.equal(r.results.find(x=>x.id===state.id).eligible,true);
 const op={operation:'rollback',targetVersion:1,expectedVersion:2,confirmed:true,reason:'quality_regression',evidenceHash:'e'.repeat(64)};
 await assert.rejects(repo.change({...op,expectedVersion:1}),e=>e.code==='candidates_version_conflict');
 assert.equal((await repo.change(op)).version,3);
 const keys=JSON.parse(state.env.VEXA_EVALUATION_CUSTODIANS_JSON);keys[0].active=false;const revoked=createCandidateRepository({database,runtimeCode:state.runtimeCode,env:{...state.env,VEXA_EVALUATION_CUSTODIANS_JSON:JSON.stringify(keys)}});
 assert.equal((await revoked.list()).results.find(x=>x.id===state.id).eligible,false);
 await assert.rejects(revoked.change({...op,expectedVersion:3}),e=>e.code==='candidates_custodian_unavailable');
 return{beforeBackupVersions:[1,2],restoredEligibleContract:true,staleCasDenied:true,restoredRollbackVersion:3,revokedCustodianDenied:true,disclaimer:'Fabricated SYN signed contract metadata; no real human gold, evaluation, inference or production promotion.'};}

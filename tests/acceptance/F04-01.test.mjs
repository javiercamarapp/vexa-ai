import '../../support/F04-gateway/no-network.mjs';
import '../../support/F04-gateway/local.test.mjs';
import '../../support/F04-gateway/catalog.test.mjs';
import test from 'node:test';import path from 'node:path';
import {runMutants} from '../../support/F04-gateway/mutants.mjs';
if(process.env.VEXA_F04_MUTANT_CHILD!=='1')test('F04 independent oracles reject gateway policy mutants and restore baseline',()=>{
 const evidence=runMutants(path.resolve(process.env.VEXA_CANDIDATE??process.cwd()));console.log('F04_MUTANTS_EVIDENCE:'+evidence);
});

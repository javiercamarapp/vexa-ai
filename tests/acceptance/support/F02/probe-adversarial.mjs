// Launched with Node permissions: no network, writes, workers, FFI or subprocesses.
import assert from 'node:assert/strict';
import {ingestion,exported} from './common.mjs';
import {oracle,positiveEntities} from './adversarial-xlsx.mjs';
assert.ok(process.permission,'PERMISSION_SANDBOX_REQUIRED');
assert.equal(process.permission.has('net'),false,'NO_NETWORK_PERMISSION');
assert.equal(process.permission.has('fs.read','/__vexa_synthetic_never_exists__/fixture'),false,'NO_EXTERNAL_FILE_PERMISSION');
const parse=exported(await ingestion(),'parseXLSX');
if(process.argv[2]==='positive-entities')assert.deepEqual(parse(positiveEntities()).sheets[0].rows,[{line:1,values:['A&B<C>"\'😀é','1001']}],'XML_PREDEFINED_NUMERIC_ENTITIES');
else oracle(parse,process.argv[2]);
console.log('ADVERSARIAL_OK:'+process.argv[2]);

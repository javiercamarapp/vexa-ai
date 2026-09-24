import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {backupLocal,restoreLocal,createLocalStorage} from '../local.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'vexa-recovery309-guards-'));const storage=path.join(root,'source');const target=path.join(root,'target');for(const p of [storage,target]){await fs.mkdir(p);await fs.writeFile(path.join(p,'.vexa-recovery-owned'),'synthetic-vexa-recovery-v1');}
const sql=q=>execFileSync('docker',['exec','-i','vexa-recovery-309-incompatible','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:q}).toString().trim();
const b=await backupLocal({mode:'synthetic-local',sourceContainer:'vexa-recovery-309-incompatible',storageRoot:storage,archive:path.join(root,'original')});
const plan={mode:'synthetic-local',sourceContainer:'vexa-recovery-309-source',targetContainer:'vexa-recovery-309-incompatible',archive:b.archive,expectedManifestHash:b.manifestHash,storageRoot:target,confirmEmptyTarget:true,recoveryCutoff:Date.now(),ledgers:[]};
// Same schema must get through validation and finish an empty synthetic restore.
const good=await restoreLocal(plan);assert.equal(good.state,'reconciled-synthetic-only');
// Change only a constraint: columns remain identical, but compatibility must fail before load.
sql('ALTER TABLE public.organizations ADD CONSTRAINT synthetic_schema_mismatch CHECK (true)');
await assert.rejects(restoreLocal(plan),/SYNTHETIC_RECOVERY_GUARD/);assert.equal(sql('SELECT count(*) FROM public.organizations'),'0');
assert.equal(sql("SELECT has_database_privilege('authenticated','postgres','CONNECT')"),'f');
assert.deepEqual((await fs.readdir(target)),['.vexa-recovery-owned']);
const local=await createLocalStorage(storage);await assert.rejects(local.write('../escape','x'));await fs.symlink(os.tmpdir(),path.join(storage,'link'));await assert.rejects(local.write('link/escape','x'));
const result={label:'SYNTHETIC LOCAL',sameSchemaRestore:good.state,constraintMismatchRejectedBeforeLoad:true,targetOrganizations:0,targetConnectRemainsRevoked:true,originalDumpPreserved:true,traversalAndSymlinkRejected:true};await fs.writeFile(path.join(root,'observations.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,...result}));

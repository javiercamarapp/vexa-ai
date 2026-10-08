// Focused SQL calibration. Run only when the coordinator has allocated Docker.
// No app/build/network/remote data; one temporary container with an exclusive label.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {storageOperationBootstrapSQL} from './harness.mjs';

test('Storage operation helper provenance is the pinned official image',()=>{
 const hashes=storageOperationBootstrapSQL.map(sql=>createHash('sha256').update(sql).digest('hex'));
 assert.deepEqual(hashes,[
  '698fe461ed74e3aad76cbde00cfaad164d8e42ee3a09b3ae78206383131e4be7',
  'ccf8810a70bf78f3fff0f8601596dba221197fb81d572cd8119bea164771382a',
 ]);
});

test('Recovery bootstrap reproduces missing-helper rejection and enforces real 0041 policy',{timeout:60000},async t=>{
 assert.equal(process.env.VEXA_RECOVERY_CALIBRATION_DOCKER,'1','EXPLICIT_LOCAL_DOCKER_CALIBRATION_REQUIRED');
 const candidate=process.env.VEXA_CANDIDATE;
 assert.ok(candidate&&path.isAbsolute(candidate),'EXPLICIT_CANDIDATE_REQUIRED');
 const migration=fs.readFileSync(path.join(candidate,'supabase/migrations/0041_private_download_authorization.sql'),'utf8');
 const broker=randomUUID(),name='vexa-recovery-bootstrap-'+broker;
 const evidence=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'vexa-recovery-bootstrap-'));
 fs.chmodSync(evidence,0o700);
 const receipt={candidate,broker,name,migrationSha256:createHash('sha256').update(migration).digest('hex'),checks:[],status:'running'};
 const save=()=>fs.writeFileSync(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 const run=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',timeout:15000,killSignal:'SIGKILL',maxBuffer:1024*1024});
 const ok=r=>{assert.ok(!r.error&&r.signal===null&&r.status===0,r.stderr||r.error?.message);return r.stdout.trim();};
 let id;
 t.after(()=>{
  try{
   // A lost docker-run reply is recovered only through the unique owned name and label.
   const found=run(['container','inspect',name,'--format','{{.Id}}|{{index .Config.Labels "vexa.review.broker"}}']);
   if(found.status===0){const [actual,label]=ok(found).split('|');assert.equal(label,broker);assert.match(actual,/^[a-f0-9]{64}$/);if(id)assert.equal(actual,id);id=actual;ok(run(['rm','-f',id]));}
   else assert.match(found.stderr,/No such (object|container)/i,'CLEANUP_INSPECTION_REQUIRED');
   const absent=run(['container','inspect',id??name]);assert.equal(absent.status,1);assert.match(absent.stderr,/No such (object|container)/i);
   receipt.cleanup={id:id??null,absent:true};
  }catch(error){receipt.status='failed';receipt.cleanupError=error.message;throw error;}
  finally{save();console.log('RECOVERY_BOOTSTRAP_EVIDENCE:'+evidence);}
 });
 try{
  save();
  id=ok(run(['run','--pull','never','--network','none','--label','vexa.review.broker='+broker,'--name',name,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.166','postgres','-D','/etc/postgresql','-c','shared_preload_libraries=']));
  receipt.id=id;save();
  let ready=false;
  for(let n=0;n<100;n++){if(run(['exec',id,'pg_isready','-h','127.0.0.1']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'CALIBRATION_DB_READY');
  const sql=query=>run(['exec','-i',id,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],query);
  ok(sql('DROP SCHEMA IF EXISTS storage CASCADE;CREATE SCHEMA storage;CREATE TABLE storage.objects(id int primary key,bucket_id text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT ON storage.objects TO authenticated;'));
  const before=sql(migration);assert.notEqual(before.status,0);assert.match(before.stderr,/Storage operation-aware authorization is required/);
  receipt.checks.push('original-bootstrap-rejects-0041');
  ok(sql(storageOperationBootstrapSQL.join('\n')));ok(sql(migration));
  ok(sql("CREATE POLICY calibration_select ON storage.objects FOR SELECT TO authenticated USING(true);INSERT INTO storage.objects VALUES(1,'vexa-private'),(2,'SYN-other');"));
  const observe=operation=>ok(sql("BEGIN;SET LOCAL ROLE authenticated;SET LOCAL storage.operation='"+operation+"';SELECT string_agg(id::text,',' ORDER BY id) FROM storage.objects;ROLLBACK;"));
  for(const operation of ['object.get_authenticated','object.list','object.upload','']){assert.equal(observe(operation),'1,2',operation);receipt.checks.push('permitted:'+operation);}
  for(const operation of ['object.sign','object.sign_many','render.image_sign','storage.object.sign','storage.object.sign_many','storage.render.image_sign']){assert.equal(observe(operation),'2',operation);receipt.checks.push('private-denied-other-preserved:'+operation);}
  assert.equal(ok(sql('SELECT count(*) FROM storage.objects')),'2','DENIAL_MUST_PRESERVE_OBJECTS');
  receipt.status='pass';save();
 }catch(error){receipt.status='failed';receipt.error=error.message;save();throw error;}
});

// AI-IMP-03 (auditoría 28-oct): el tamaño real del objeto se comprueba con la metadata ANTES de descargarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createImportHandler,objectBounded,MAX_IMPORT_BYTES} from './imports.mjs';
const tenant='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',importId='44444444-4444-4444-8444-444444444444';
const secret='SYN'.repeat(16),fileHash=createHash('sha256').update('a,b\n1,2\n').digest('hex');
const row={id:importId,import_id:importId,tenant_id:tenant,user_id:user,connection_id:'33333333-3333-4333-8333-333333333333',request_hash:'h',size:'8',content_type:'text/csv',file_hash:fileHash,mapping_version:'v1',state:'reserved',job_id:null,object_path:`${tenant}/imports/x.csv`,expires_at:new Date(Date.now()+3600e3).toISOString(),provenance:{}};
const token=createHmac('sha256',secret).update([row.tenant_id,row.import_id,row.user_id,row.request_hash,new Date(row.expires_at).toISOString()].join('\n')).digest('base64url');
function run(objectBytes){
 let reads=0;const queries=[];
 const database={async transaction(action,work){return work({tenantId:tenant,userId:user,role:'analyst',async query(sql){queries.push(sql);
  if(sql.includes('FROM public.connections'))return {rows:[{id:row.connection_id}]};
  if(sql.includes('FROM public.imports i JOIN'))return {rows:[row]};
  if(sql.includes('FROM storage.objects'))return {rows:[{owner_id:user,object_bytes:objectBytes}]};
  throw new Error('unexpected sql '+sql.slice(0,60));}});}};
 const handler=createImportHandler({database,storage:{createUpload:async()=>{throw new Error('no');},read:async()=>{reads++;return new TextEncoder().encode('a,b\n1,2\n');}},confirmationSecret:secret,admission:undefined});
 const confirm=async()=>{const r=await handler(new Request(`https://x.invalid/api/imports/${importId}/confirm`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({upload_token:token,sha256:fileHash,mapping_version:'v1'})}));return {status:r.status,body:await r.json()};};
 return {confirm,reads:()=>reads};
}
test('objectBounded: metadata ausente, mayor al límite o distinta de la declarada se rechazan',()=>{
 assert.throws(()=>objectBounded({object_bytes:null},{size:'8'}),{code:'object_size_unknown'});
 assert.throws(()=>objectBounded({},{size:'8'}),{code:'object_size_unknown'});
 assert.throws(()=>objectBounded({object_bytes:String(MAX_IMPORT_BYTES+1)},{size:String(MAX_IMPORT_BYTES+1)}),{code:'object_too_large'});
 assert.throws(()=>objectBounded({object_bytes:'9'},{size:'8'}),{code:'object_bytes_invalid'});
 assert.doesNotThrow(()=>objectBounded({object_bytes:'8'},{size:'8'}));
 assert.doesNotThrow(()=>objectBounded({object_bytes:MAX_IMPORT_BYTES},{size:MAX_IMPORT_BYTES}));
});
test('confirm: un objeto de 50 MiB se rechaza con 422 sin descargarlo; uno del tamaño declarado sí avanza a la lectura',async()=>{
 const big=run(String(50*1024*1024));const r=await big.confirm();
 assert.equal(r.status,422);assert.equal(r.body.error?.code??r.body.data?.error,'object_too_large');assert.equal(big.reads(),0,'no se bufferizó nada');
 const wrong=run('9');assert.equal((await wrong.confirm()).status,422);assert.equal(wrong.reads(),0);
 const ok=run('8');await ok.confirm().catch(()=>{});assert.equal(ok.reads(),1,'el tamaño correcto sí llega a la lectura');
});

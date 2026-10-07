import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {candidateInputs, launch} from '../../tests/acceptance/support/F01-03/harness.mjs';
import {storageDenied} from '../../tests/acceptance/support/F01-03/services.mjs';
import {q} from '../../tests/acceptance/support/F01-03/matrix.mjs';

test('SEC-04: private downloads recheck membership; reusable bearer download grants cannot be issued', {timeout:120000}, async t => {
  const h=await launch({services:true});t.after(()=>h.close());
  for(const migration of candidateInputs(process.env.VEXA_CANDIDATE))h.sql(migration);
  const a=await h.user(),b=await h.user();
  for(const actor of [a,b]){
    actor.tenant=randomUUID();actor.path=actor.tenant+'/SYN-download.txt';actor.bytes=JSON.stringify(actor===a?'SOLO_A_F07':'SOLO_B_9F');
    h.sql(`INSERT INTO organizations(id,name) VALUES(${q(actor.tenant)},'SYN-F07'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(actor.tenant)},${q(actor.id)},'owner','active')`);
    const result=await h.http('storage','/object/vexa-private/'+actor.path,actor.token,{method:'POST',body:actor===a?'SOLO_A_F07':'SOLO_B_9F'});
    assert.equal(result.status,200,'POSITIVE_UPLOAD');
  }
  const png=fs.readFileSync(new URL('./synthetic.png',import.meta.url));
  const imagePath=a.tenant+'/SYN-pixel.png';
  const port=Number(process.env.VEXA_F01_03_PORT_BASE??56327)+1;
  const uploadImage=await fetch('http://127.0.0.1:'+port+'/object/vexa-private/'+imagePath,{method:'POST',headers:{authorization:'Bearer '+a.token,'content-type':'image/png'},body:png,signal:AbortSignal.timeout(5000)});
  assert.equal(uploadImage.status,200,'VALID_IMAGE_UPLOAD');await uploadImage.arrayBuffer();
  const readImage=await fetch('http://127.0.0.1:'+port+'/object/authenticated/vexa-private/'+imagePath,{headers:{authorization:'Bearer '+a.token},signal:AbortSignal.timeout(5000)});
  assert.equal(readImage.status,200);assert.deepEqual(Buffer.from(await readImage.arrayBuffer()),png,'VALID_IMAGE_BYTES');
  const download=(actor,path,headers={})=>h.http('storage','/object/authenticated/vexa-private/'+path,actor?.token,{headers});
  await t.test('positive downloads and byte ranges remain available to the current owner',async()=>{
    for(const actor of [a,b]){
      const full=await download(actor,actor.path);assert.equal(full.status,200,'AUTHENTICATED_DOWNLOAD');assert.equal(full.text,actor.bytes);
      const range=await download(actor,actor.path,{range:'bytes=0-5'});assert.equal(range.status,206,'AUTHENTICATED_RANGE');assert.equal(range.text,actor.bytes.slice(0,6));
      const listed=await h.http('storage','/object/list/vexa-private',actor.token,{method:'POST',body:{prefix:actor.tenant,limit:100}});assert.equal(listed.status,200);assert.ok(listed.data.some(row=>row.name==='SYN-download.txt'),'POSITIVE_OBJECT_LIST');
    }
  });
  await t.test('signed upload admission remains functional without issuing a download capability',async()=>{
    const path=a.tenant+'/SYN-signed-upload.txt';
    const signed=await h.http('storage','/object/upload/sign/vexa-private/'+path,a.token,{method:'POST',body:{}});
    assert.equal(signed.status,200,'SIGNED_UPLOAD_ADMISSION');
    assert.ok(signed.data?.url,'SIGNED_UPLOAD_URL');
    const uploaded=await h.http('storage',signed.data.url,null,{method:'PUT',body:'SYN_UPLOAD_BYTES'});
    assert.equal(uploaded.status,200,'SIGNED_UPLOAD_CONSUMPTION');
    const read=await download(a,path);assert.equal(read.status,200);assert.ok(read.text.includes('SYN_UPLOAD_BYTES'));
  });
  await t.test('foreign and anonymous downloads expose neither bytes nor metadata',async()=>{
    for(const actor of [a,null])for(const headers of [{},{range:'bytes=0-5'}]){
      const result=await download(actor,b.path,headers);storageDenied(result);assert.ok(!result.text.includes('SOLO_B_9F'));
    }
  });
  await t.test('download signing is forbidden even for the current owner',async()=>{
    for(const actor of [a,b]){
      const result=await h.http('storage','/object/sign/vexa-private/'+actor.path,actor.token,{method:'POST',body:{expiresIn:60}});
      if(result.data?.signedURL){
        const issued=result.data.signedURL;
        assert.equal((await h.http('storage',issued,null)).status,200,'SIGNED_POSITIVE');
        h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)}`);
        try{const replay=await h.http('storage',issued,null);assert.notEqual(replay.status,200,'SIGNED_URL_SURVIVES_REVOCATION');}
        finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)}`);}
      }
      assert.ok(!result.data?.signedURL&&!result.data?.signedUrl,'REUSABLE_DOWNLOAD_GRANT_FORBIDDEN');storageDenied(result);
    }
  });
  await t.test('bulk download signing cannot issue bearer grants',async()=>{
    for(const actor of [a,b]){
      const batch=await h.http('storage','/object/sign/vexa-private',actor.token,{method:'POST',body:{expiresIn:60,paths:[actor.path]}});
      if(batch.status===200){assert.ok(Array.isArray(batch.data));assert.equal(batch.data.length,1);assert.equal(batch.data[0].path,actor.path);assert.equal(typeof batch.data[0].error,'string');assert.match(batch.data[0].error,/not found|unauthori[sz]ed|access denied|^Either the object does not exist or you do not have access to it$/i);assert.ok(!batch.data[0].signedURL&&!batch.data[0].signedUrl);}
      else storageDenied(batch);
    }
  });
  await t.test('image download signing cannot issue bearer grants',async()=>{
      const image=await h.http('storage','/object/sign/vexa-private/'+imagePath,a.token,{method:'POST',body:{expiresIn:60,transform:{width:16,height:16}}});storageDenied(image);assert.ok(!image.data?.signedUrl&&!image.data?.signedURL);
  });
  await t.test('the same authenticated URL and range are denied immediately after membership revocation',async()=>{
    h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(a.tenant)} AND user_id=${q(a.id)}`);
    for(const headers of [{},{range:'bytes=0-5'}]){const result=await download(a,a.path,headers);storageDenied(result);assert.ok(!result.text.includes('SOLO_A_F07'));}
    const preserved=await download(b,b.path);assert.equal(preserved.status,200,'OTHER_TENANT_UNCHANGED');assert.equal(preserved.text,b.bytes);
    const list=(actor)=>h.http('storage','/object/list/vexa-private',actor.token,{method:'POST',body:{prefix:actor.tenant,limit:100}});
    const revoked=await list(a);if(revoked.status===200)assert.deepEqual(revoked.data,[]);else storageDenied(revoked);
    const other=await list(b);assert.equal(other.status,200);assert.ok(other.data.some(row=>row.name==='SYN-download.txt'));
  });
});

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {A,B,selfReactivateOracle} from './oracles.mjs';
import {q} from './matrix.mjs';
import {read,denied} from './harness.mjs';
export function storageDenied(r) {
  assert.ok([401,403,404].includes(r.status)||(r.status===400&&[401,403,404].includes(Number(r.data?.statusCode))),`STORAGE_DENY:${r.status}`);
  assert.ok(!r.data?.signedURL,'STORAGE_SIGN_LEAK');
}
export async function storageWriteOracle(h,actors,{operation='all',revoked=false,ownSource}={}) {
  const bucket='vexa-private',payload='SYN_VALID_BYTES',source=`${B}/${randomUUID()}.txt`;
  const upload=(actor,name,headers={},body=payload)=>h.http('storage',`/object/${bucket}/${name}`,actor.token,{method:'POST',body,headers});
  assert.equal((await upload(actors.b,source,{},'SYN_ORIGINAL_BYTES')).status,200,'STORAGE_WRITE_FIXTURE');
  const snapshot=()=>h.sql(`SELECT row_to_json(o) FROM storage.objects o WHERE bucket_id=${q(bucket)} AND name=${q(source)}`);
  const before=snapshot();
  const bytes=(await h.http('storage',`/object/authenticated/${bucket}/${source}`,actors.b.token)).text;
  const intact=async()=>{
    assert.equal(snapshot(),before,'STORAGE_B_METADATA_INTACT');
    const r=await h.http('storage',`/object/authenticated/${bucket}/${source}`,actors.b.token);
    assert.equal(r.status,200,'STORAGE_B_EXISTS');assert.equal(r.text,bytes,'STORAGE_B_BYTES_INTACT');
  };
  const destination=`${A}/${randomUUID()}.txt`;
  const ops={
    INSERT:(actor,target)=>upload(actor,target),
    OVERWRITE:(actor,target)=>upload(actor,target,{'x-upsert':'true'}),
    UPDATE:(actor,target)=>h.http('storage',`/object/${bucket}/${target}`,actor.token,{method:'PUT',body:payload}),
    MOVE:(actor,target)=>h.http('storage','/object/move',actor.token,{method:'POST',body:{bucketId:bucket,sourceKey:target,destinationKey:destination}}),
    DELETE:(actor,target)=>h.http('storage',`/object/${bucket}`,actor.token,{method:'DELETE',body:{prefixes:[target]}}),
  };
  for(const op of operation==='all'?Object.keys(ops):[operation]){
    const target=op==='INSERT'?`${B}/${randomUUID()}.txt`:source;
    const r=await ops[op](actors.a,target);
    if(op==='DELETE'&&r.status===200)assert.deepEqual(r.data,[],'STORAGE_CROSS_DELETE');
    else if(r.status===200){
      // A successful status alone is not proof of a mutation. Require its effect.
      if(op==='MOVE'){
        assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(source)}`),'0','MOVE_REPRO_SOURCE_REMOVED');
        assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(destination)}`),'1','MOVE_REPRO_DESTINATION');
      }else{
        const visible=await h.http('storage',`/object/authenticated/${bucket}/${target}`,actors.b.token);
        assert.equal(visible.status,200,'WRITE_REPRO_B_READ');assert.equal(visible.text,JSON.stringify(payload),'WRITE_REPRO_B_BYTES');
      }
      assert.fail(`STORAGE_CROSS_${op}:200 persisted`);
    }else storageDenied(r);
    assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(target)}`),op==='INSERT'?'0':'1','STORAGE_CROSS_'+op+'_EFFECT');
    await intact();
  }
  if(operation!=='all')return;
  const protectedName=ownSource??`${A}/${randomUUID()}.txt`;
  if(!revoked)assert.equal((await upload(actors.a,protectedName)).status,200,'STORAGE_OWN_FIXTURE');
  const ownSnapshot=()=>h.sql(`SELECT row_to_json(o) FROM storage.objects o WHERE name=${q(protectedName)}`);
  const ownBefore=ownSnapshot();assert.ok(ownBefore,'STORAGE_OWN_FIXTURE_EXISTS');
  for(const role of revoked?['a']:['viewer']){
    for(const op of ['OVERWRITE','UPDATE','MOVE','DELETE']){
      const r=await ops[op](actors[role],protectedName);
      if(op==='DELETE'&&r.status===200)assert.deepEqual(r.data,[],'STORAGE_ROLE_DELETE:'+role);else storageDenied(r);
      assert.equal(ownSnapshot(),ownBefore,'STORAGE_ROLE_METADATA_INTACT:'+role);
    }
  }
  if(!revoked)for(const role of ['viewer','analyst']){
    const r=await h.http('storage',`/object/authenticated/${bucket}/${protectedName}`,actors[role].token);
    assert.equal(r.status,200,'STORAGE_ROLE_READ:'+role);assert.equal(r.text,JSON.stringify(payload),'STORAGE_ROLE_READ_BYTES');
  }
  for(const role of revoked?['a']:['a','analyst','viewer']){
    const actor=actors[role],name=`${A}/${randomUUID()}.txt`;
    const r=await upload(actor,name);
    if(revoked||role==='viewer'){storageDenied(r);continue;}
    assert.equal(r.status,200,'STORAGE_ROLE_UPLOAD:'+role);
    // Updates and moves have no client grant: original bytes/names are immutable.
    for(const op of ['OVERWRITE','UPDATE','MOVE'])storageDenied(await ops[op](actor,name));
    const del=await ops.DELETE(actor,name);
    if(role==='a'){
      assert.equal(del.status,200,'STORAGE_OWNER_DELETE');
      assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(name)}`),'0','STORAGE_OWNER_DELETE_EFFECT');
    }else{
      if(del.status===200)assert.deepEqual(del.data,[],'STORAGE_ANALYST_DELETE');else storageDenied(del);
      assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(name)}`),'1','STORAGE_ANALYST_INTACT');
    }
  }
}
export async function serviceOracle(h,f,actors) {
  const bucket='vexa-private',paths={};
  assert.equal(h.sql("SELECT public FROM storage.buckets WHERE id='vexa-private'"),'f','STORAGE_PRIVATE');
  for(const [key,tenant,marker] of [['a',A,'SOLO_A_7E'],['b',B,'SOLO_B_9F']]) {
    const name=`${tenant}/${randomUUID()}.txt`;paths[key]=name;
    const upload=await h.http('storage',`/object/${bucket}/${name}`,actors[key].token,{method:'POST',body:marker});
    assert.equal(upload.status,200,'STORAGE_UPLOAD_POSITIVE');
    const read=await h.http('storage',`/object/authenticated/${bucket}/${name}`,actors[key].token);
    assert.equal(read.status,200);assert.ok(read.text.includes(marker),'STORAGE_READ_POSITIVE');
    const signed=await h.http('storage',`/object/sign/${bucket}/${name}`,actors[key].token,{method:'POST',body:{expiresIn:30}});
    assert.equal(signed.status,200);assert.ok(signed.data?.signedURL,'STORAGE_SIGN_POSITIVE');
    const signedRead=await h.http('storage',signed.data.signedURL,null);
    assert.equal(signedRead.status,200);assert.ok(signedRead.text.includes(marker),'STORAGE_SIGN_CONTENT');
  }
  for(const actor of [actors.a,actors.outsider,null]) {
    for(const endpoint of ['authenticated','public']) {
      const r=await h.http('storage',`/object/${endpoint}/${bucket}/${paths.b}`,actor?.token,{headers:{Range:'bytes=0-31'}});
      storageDenied(r);assert.ok(!r.text.includes('SOLO_B_9F'),'STORAGE_RANGE_LEAK');
    }
    storageDenied(await h.http('storage',`/object/sign/${bucket}/${paths.b}`,actor?.token,{method:'POST',body:{expiresIn:30}}));
    const list=await h.http('storage',`/object/list/${bucket}`,actor?.token,{method:'POST',body:{prefix:B,limit:100}});
    if(list.status===200)assert.deepEqual(list.data,[],'STORAGE_METADATA_LEAK');else storageDenied(list);
  }
  await storageWriteOracle(h,actors);
  const search=(actor,tenant)=>h.http('rest','/rpc/match_embeddings',actor?.token,{method:'POST',body:{query_embedding:[1,0,0],match_count:100,tenant_id:tenant}});
  for(const [key,tenant] of [['a',A],['b',B]]){
    const r=await search(actors[key],tenant);assert.equal(r.status,200,'RPC_POSITIVE: real function required');
    const other=key==='a'?'b':'a';
    for(const forbidden of [other==='b'?'SOLO_B_9F':'SOLO_A_7E',...Object.values(f[other]).map(row=>row.id),other==='b'?B:A])
      assert.ok(!r.text.toLowerCase().includes(forbidden.toLowerCase()),'RPC_OWN_PAYLOAD_LEAK:'+key);
    assert.ok(Array.isArray(r.data));assert.deepEqual(r.data.map(x=>x.id),[f[key].embeddings.id],'RPC_OWN_RESULT');
  }
  for(const actor of [actors.a,actors.outsider,null]){
    const r=await search(actor,B);
    if(r.status===200)assert.deepEqual(r.data,[],'RPC_TENANT_LEAK');else assert.ok([401,403].includes(r.status),`RPC_INFRA_OR_BINDING:${r.status}`);
    assert.ok(!r.text.includes('SOLO_B_9F')&&!r.text.includes(f.b.embeddings.id),'RPC_CANARY_LEAK');
  }
  return async()=>{
    const fresh=await h.login(actors.a);
    for(const actor of [actors.a,fresh]){
      selfReactivateOracle(h,actor);
      const patch=await h.http('rest',`/memberships?user_id=eq.${actor.id}`,actor.token,{method:'PATCH',body:{status:'active'},headers:{Prefer:'return=representation'}});
      if(patch.status===200)assert.deepEqual(patch.data,[],'REVOKED_HTTP_REACTIVATE');
      else assert.ok([401,403].includes(patch.status),'REVOKED_HTTP_REACTIVATE_INFRA');
      assert.equal(h.sql(`SELECT status FROM memberships WHERE tenant_id=${q(A)} AND user_id=${q(actor.id)}`),'revoked','REVOKED_HTTP_PERSISTENT');
      denied(h.probe(read('connections'),actor),'REVOKED_SESSION_SQL');
      const rest=await h.http('rest','/connections?select=*',actor.token);
      if(rest.status===200)assert.deepEqual(rest.data,[],'REVOKED_SESSION_REST');else assert.ok([401,403].includes(rest.status),'REVOKED_REST_INFRA');
      storageDenied(await h.http('storage',`/object/authenticated/${bucket}/${paths.a}`,actor.token));
      storageDenied(await h.http('storage',`/object/sign/${bucket}/${paths.a}`,actor.token,{method:'POST',body:{expiresIn:30}}));
      const r=await search(actor,A);if(r.status===200)assert.deepEqual(r.data,[],'RPC_REVOKED');else assert.ok([401,403].includes(r.status),'RPC_REVOKED_INFRA');
      await storageWriteOracle(h,{...actors,a:actor},{revoked:true,ownSource:paths.a});
    }
  };
}

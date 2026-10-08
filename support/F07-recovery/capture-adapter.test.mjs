import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyCapture,binaryHash,semanticHash} from './capture-adapter.mjs';

const sourceRef='abcdefghijklmnopqrst';
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const pinned=file=>({sha256:binaryHash(fs.readFileSync(file)),bytes:fs.statSync(file).size});
function fixture(t){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'SYN-capture-adapter-'));
 fs.chmodSync(root,0o700);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const snapshotDirectory=path.join(root,'snapshot'),storageDirectory=path.join(root,'storage');
 fs.mkdirSync(snapshotDirectory,{mode:0o700});fs.mkdirSync(storageDirectory,{mode:0o700});
 const blobs=[Buffer.from('SYN alpha'),Buffer.from('SYN beta')];
 const anchors=blobs.map((b,i)=>({bucket:'SYN-private',name:`SYN-tenant/object-${i}.txt`,sha256:binaryHash(b),bytes:b.length}));
 const inventory={complete:true,sections:{storage_content_anchors:anchors,storage:anchors.map(o=>({bucket_id:o.bucket,name:o.name}))},scope:'database-catalog-and-row-counts-in-shared-MVCC-snapshot',storageAnchorMethod:'mvcc-content-sha256',globalRolePasswordsExported:false,storageBytesExported:false,captureSession:{sourceRef}};
 write(path.join(snapshotDirectory,'inventory.json'),inventory);
 fs.writeFileSync(path.join(snapshotDirectory,'database.dump'),'PGDMPSYN archive; no real DB or contents',{mode:0o600});
 fs.writeFileSync(path.join(snapshotDirectory,'toc.list'),'; Archive created at SYN fixture\n; Selected TOC Entries:\n1; 0 1 TABLE DATA public SYN postgres\n2; 0 2 SEQUENCE SET public SYN_seq postgres\n',{mode:0o600});
 const source={schema:'recovery457-source-local-export-v1',sourceRef,state:'database-archive-created',snapshot:'00000001-00000001-1',targetEffects:false,targetWriteAuthorized:false,releaseAuthorized:false,databaseArchiveOnly:true,storageBytesExported:false,restoreValidated:false,capture:{authorizationId:'SYN-capture',authorizationSha256:'a'.repeat(64),custodySha256:'b'.repeat(64),scope:'source-readonly-to-private-local-archive',targetEffects:false,targetWriteAuthorized:false},localClientEnded:true,sourceSessionClosed:true,temporaryCredentialsRemoved:true,closureScope:'local-client-end-only',remoteSessionClosureProven:false,inventoryHash:semanticHash(inventory),archiveSha256:pinned(path.join(snapshotDirectory,'database.dump')).sha256,files:['database.dump','inventory.json','toc.list'].map(name=>({path:path.join(snapshotDirectory,name),...pinned(path.join(snapshotDirectory,name))}))};
 write(path.join(snapshotDirectory,'receipt.json'),source);
 const snapshotPins=Object.fromEntries(['inventory.json','receipt.json','database.dump'].map(name=>[name,pinned(path.join(snapshotDirectory,name))]));
 const objects=anchors.map((o,i)=>({...o,index:i+1,file:`object-${String(i+1).padStart(2,'0')}-${o.sha256}.blob`}));
 objects.forEach((o,i)=>fs.writeFileSync(path.join(storageDirectory,o.file),blobs[i],{mode:0o600}));
 const manifest={schema:'storage-capture478-objects-v1',sourceRef,snapshot:snapshotPins,objects};
 write(path.join(storageDirectory,'objects.json'),manifest);
 const total=blobs.reduce((n,b)=>n+b.length,0);
 const receipt={schema:'storage-capture478-receipt-v1',status:'SNAPSHOT_ANCHORED_BYTES_CAPTURED',sourceRef,snapshot:snapshotPins,objects:2,bytes:total,objectsManifestSha256:pinned(path.join(storageDirectory,'objects.json')).sha256,transport:'fixed-origin-native-fetch',remoteOperations:['GET'],snapshotAnchorMatch:true,currentDatabaseConsistencyProven:false,restoreValidated:false,quarantineValidated:false,productionReady:false};
 write(path.join(storageDirectory,'receipt.json'),receipt);
 const config={schema:'rovaq-capture-adapter-config-v1',sourceRef,snapshotDirectory,snapshotPins:{...snapshotPins,'toc.list':pinned(path.join(snapshotDirectory,'toc.list'))},inventorySemanticSha256:semanticHash(inventory),storageDirectory,storagePins:Object.fromEntries(['receipt.json','objects.json'].map(name=>[name,pinned(path.join(storageDirectory,name))])),expectedObjects:2,expectedBytes:total,metadataReview:null};
 const originalFiles=[...Object.keys(config.snapshotPins).map(n=>path.join(snapshotDirectory,n)),...fs.readdirSync(storageDirectory).map(n=>path.join(storageDirectory,n))];
 const originals=originalFiles.map(p=>[p,fs.readFileSync(p)]);
 return {root,config,inventory,source,manifest,receipt,objects,originals};
}
function changeJSON(f,area,name,change){
 const dir=area==='snapshot'?f.config.snapshotDirectory:f.config.storageDirectory;
 const file=path.join(dir,name),d=JSON.parse(fs.readFileSync(file));change(d);write(file,d);
 f.config[area==='snapshot'?'snapshotPins':'storagePins'][name]=pinned(file);
 return d;
}
function attachReview(f){
 const bindings=verifyCapture(f.config);
 const raw=path.join(f.root,'SYN-metadata-copy.txt');fs.writeFileSync(raw,'SYN offline COPY metadata, reviewed separately',{mode:0o600});
 const review={schema:'rovaq-storage-metadata-review-v1',status:'reviewed',reviewer:'SYN-reviewer',reference:'SYN-independent-review',sourceRef,archiveSha256:bindings.archiveSha256,inventoryBinarySha256:bindings.inventoryBinarySha256,inventorySemanticSha256:bindings.inventorySemanticSha256,objectsManifestSha256:bindings.objectsManifestSha256,objectCount:2,totalBytes:f.config.expectedBytes,metadataSource:{path:raw,pin:pinned(raw)},objects:f.objects.map(o=>({bucket:o.bucket,name:o.name,sourceMetadata:{mimetype:'text/plain',SYNMarker:'preserved'},contentType:'text/plain; charset=utf-8'}))};
 const file=path.join(f.root,'metadata-review.json');write(file,review);
 f.config.metadataReview={path:file,pin:pinned(file)};return {file,review,raw};
}

test('SYN complete capture verifies binary/semantic identities and preserves all originals without restoration authority',t=>{
 const f=fixture(t),result=verifyCapture(f.config);
 assert.equal(result.status,'capture-verified-metadata-review-required');assert.equal(result.objectCount,2);assert.equal(result.totalBytes,17);
 assert.equal(result.metadataReady,false);assert.equal(result.restoreReady,false);assert.equal(result.restoreAuthorized,false);assert.equal(result.sourceOnly,true);assert.equal(result.targetBinding,null);
 assert.notEqual(result.inventoryBinarySha256,result.inventorySemanticSha256);assert.equal(Object.hasOwn(result,'catalogHash'),false);
 for(const [file,raw]of f.originals)assert.deepEqual(fs.readFileSync(file),raw);
});
test('byte alteration in every snapshot file fails its independent external pin',t=>{
 const f=fixture(t);
 for(const name of Object.keys(f.config.snapshotPins)){
  const file=path.join(f.config.snapshotDirectory,name),raw=fs.readFileSync(file),changed=Buffer.from(raw);changed[changed.length-1]^=1;fs.writeFileSync(file,changed);
  assert.throws(()=>verifyCapture(f.config),/FILE_HASH/);fs.writeFileSync(file,raw);
 }
});
test('inventory semantic identity is independently required, not substituted with binary hash or catalog alias',t=>{
 const f=fixture(t);f.config.inventorySemanticSha256=f.config.snapshotPins['inventory.json'].sha256;
 assert.throws(()=>verifyCapture(f.config),/INVENTORY_SEMANTIC_HASH/);
});
test('same-size blob alteration is rejected even with complete favorable receipts',t=>{
 const f=fixture(t),file=path.join(f.config.storageDirectory,f.objects[0].file);fs.writeFileSync(file,'SYN ALPHA');
 assert.throws(()=>verifyCapture(f.config),/FILE_HASH/);
});
test('receipt-only capture with missing blob is rejected',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.config.storageDirectory,f.objects[0].file));assert.throws(()=>verifyCapture(f.config));
});
test('extra blob, unaccounted file and failed attempt marker are rejected',t=>{
 const f=fixture(t);
 for(const name of ['extra.blob','extra.txt','failure.json']){const p=path.join(f.config.storageDirectory,name);fs.writeFileSync(p,'SYN extra');assert.throws(()=>verifyCapture(f.config),/STORAGE_EXTRA_OR_INCOMPLETE/);fs.unlinkSync(p);}
});
test('storage manifest missing object fails even when manifest and receipt pins are refreshed',t=>{
 const f=fixture(t);changeJSON(f,'storage','objects.json',d=>d.objects.pop());
 changeJSON(f,'storage','receipt.json',d=>d.objectsManifestSha256=f.config.storagePins['objects.json'].sha256);
 assert.throws(()=>verifyCapture(f.config),/STORAGE_OBJECT_COVERAGE/);
});
test('receipt from a different snapshot cannot be mixed with these verified blobs',t=>{
 const f=fixture(t);changeJSON(f,'storage','receipt.json',d=>d.snapshot['database.dump'].sha256='0'.repeat(64));assert.throws(()=>verifyCapture(f.config),/STORAGE_SNAPSHOT_BINDING/);
});
test('source receipt TOC descriptor must match its external pin',t=>{
 const f=fixture(t);changeJSON(f,'snapshot','receipt.json',d=>d.files.find(x=>x.path.endsWith('toc.list')).sha256='0'.repeat(64));assert.throws(()=>verifyCapture(f.config),/SOURCE_FILE_BINDING/);
});
test('file and parent symlinks and path traversal are rejected',t=>{
 const f=fixture(t),file=path.join(f.config.storageDirectory,f.objects[0].file),moved=path.join(f.root,'SYN-blob');fs.renameSync(file,moved);fs.symlinkSync(moved,file);
 assert.throws(()=>verifyCapture(f.config),/SYMLINK_FORBIDDEN/);fs.unlinkSync(file);fs.renameSync(moved,file);
 const link=path.join(f.root,'link');fs.symlinkSync(f.config.storageDirectory,link);const original=f.config.storageDirectory;f.config.storageDirectory=link;assert.throws(()=>verifyCapture(f.config),/SYMLINK_FORBIDDEN/);
 f.config.storageDirectory=original+'/../storage';assert.throws(()=>verifyCapture(f.config),/ABSOLUTE_NORMALIZED_PATH_REQUIRED/);
});
test('untrusted blob filename cannot escape capture directory',t=>{
 const f=fixture(t);changeJSON(f,'storage','objects.json',d=>d.objects[0].file='../SYN-escape.blob');changeJSON(f,'storage','receipt.json',d=>d.objectsManifestSha256=f.config.storagePins['objects.json'].sha256);assert.throws(()=>verifyCapture(f.config),/STORAGE_BLOB_NAME/);
});
test('caller cannot inject target or authority into offline config',t=>{
 const f=fixture(t);
 for(const [name,value]of [['targetRef','SYN-target'],['authorization',{}],['restoreAuthorized',true],['targetBinding',{}],['currentAuthority',{}]])assert.throws(()=>verifyCapture({...f.config,[name]:value}),/TARGET_OR_AUTHORITY_FORBIDDEN|AUTHORITY_ESCALATION_FORBIDDEN/);
});
test('source-only original may not be relabeled with target authority, even with a new outer pin',t=>{
 const f=fixture(t);changeJSON(f,'snapshot','receipt.json',d=>d.targetWriteAuthorized=true);assert.throws(()=>verifyCapture(f.config),/AUTHORITY_ESCALATION_FORBIDDEN/);
});
test('synthetic transport receipt does not stand in for a real capture receipt',t=>{
 const f=fixture(t);changeJSON(f,'storage','receipt.json',d=>d.status='SYNTHETIC_CAPTURE_ONLY');assert.throws(()=>verifyCapture(f.config),/STORAGE_READ_ONLY_CAPTURE/);
});
test('reviewed metadata uses new pinned contract and still does not authorize restoration',t=>{
 const f=fixture(t),{review}=attachReview(f);const result=verifyCapture(f.config);
 assert.equal(result.metadataReady,true);assert.equal(result.status,'capture-verified-metadata-reviewed');assert.equal(result.restoreReady,false);assert.equal(result.restoreAuthorized,false);
 assert.equal(result.metadataReview.reference,review.reference);assert.equal(result.metadataReview.pin.sha256,f.config.metadataReview.pin.sha256);
 assert.equal(Object.hasOwn(result.objects[0],'contentType'),false,'downstream must use the explicit reviewed metadata contract');
});
test('metadata review rejects wrong shape, unreviewed state, count/hash mismatch, missing MIME or invented authority',t=>{
 const f=fixture(t),{file,review}=attachReview(f);
 const mutations=[()=>42,()=>[],d=>({...d,status:'pending'}),d=>({...d,objectCount:3}),d=>({...d,archiveSha256:'0'.repeat(64)}),d=>({...d,restoreAuthorized:true}),d=>({...d,objects:d.objects.map((o,i)=>i?o:{...o,contentType:null})})];
 for(const change of mutations){write(file,change(structuredClone(review)));f.config.metadataReview.pin=pinned(file);assert.throws(()=>verifyCapture(f.config));}
});
test('pinned raw metadata source is required; review-only cannot invent its existence',t=>{
 const f=fixture(t),{raw}=attachReview(f);fs.unlinkSync(raw);assert.throws(()=>verifyCapture(f.config));
});
test('SYN CLI requires external config hash, emits no failure payload and leaves sources untouched',t=>{
 const f=fixture(t),config=path.join(f.root,'config.json');write(config,f.config);
 const file=fileURLToPath(new URL('./capture-adapter.mjs',import.meta.url));
 const run=hash=>spawnSync(process.execPath,[file,'--config',config,'--sha256',hash],{encoding:'utf8',timeout:5000});
 const good=run(pinned(config).sha256);assert.equal(good.status,0,good.stderr);assert.equal(JSON.parse(good.stdout).restoreAuthorized,false);
 const bad=run('0'.repeat(64));assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.equal(bad.stderr,'{"status":"CAPTURE_ADAPTER_FAILED","restoreAuthorized":false}\n');
 for(const [p,raw]of f.originals)assert.deepEqual(fs.readFileSync(p),raw);
});

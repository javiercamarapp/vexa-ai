/** Offline, read-only verification of original source-only captures.
 * No database, network, subprocess, credentials or restoration capability.
 * External pins are supplied by the reviewing operator, never learned from inputs.
 * Metadata review is an external attestation, not proof of managed compatibility.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const HASH=/^[a-f0-9]{64}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const check=(ok,code)=>{if(!ok)throw Error(code);};
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export const binaryHash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Same serialization as recovery457's inventoryHash; NOT a sorted/canonical JSON hash.
export const semanticHash=value=>binaryHash(JSON.stringify(value));
const equal=(a,b)=>semanticHash(a)===semanticHash(b);
const json=bytes=>{try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error('INVALID_JSON');}};
const size=n=>Number.isSafeInteger(n)&&n>=0;
const pin=p=>exact(p,['sha256','bytes'])&&HASH.test(p.sha256)&&size(p.bytes);
const key=o=>JSON.stringify([o.bucket,o.name]);

function safePath(file){
 check(typeof file==='string'&&path.isAbsolute(file)&&path.normalize(file)===file&&!/[\0\r\n]/.test(file),'ABSOLUTE_NORMALIZED_PATH_REQUIRED');
 let at=path.parse(file).root;
 for(const segment of file.slice(at.length).split(path.sep).filter(Boolean)){
  at=path.join(at,segment);check(!fs.lstatSync(at).isSymbolicLink(),'SYMLINK_FORBIDDEN');
 }
 return file;
}
function readPinned(file,expected){
 check(pin(expected),'EXTERNAL_PIN_REQUIRED');safePath(file);
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{
  const before=fs.fstatSync(fd);
  check(before.isFile()&&before.nlink===1&&before.size===expected.bytes,'FILE_SIZE_OR_TYPE');
  const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd);
  check(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'FILE_CHANGED_DURING_READ');
  check(bytes.length===expected.bytes&&binaryHash(bytes)===expected.sha256,'FILE_HASH');
  return bytes;
 }finally{fs.closeSync(fd);}
}
function location(root,name){
 check(typeof name==='string'&&name===path.basename(name)&&name!=='.'&&name!=='..'&&!/[\\\0\r\n]/.test(name),'LOCAL_FILENAME');
 return path.join(root,name);
}
function identity(o){
 check(object(o)&&typeof o.bucket==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(o.bucket)&&o.bucket!=='.'&&o.bucket!=='..','BUCKET_IDENTITY');
 check(typeof o.name==='string'&&o.name.length>0&&o.name.length<=2048&&o.name.isWellFormed()&&!/[\u0000-\u001f\u007f\\]/.test(o.name)&&o.name.split('/').every(s=>s!==''&&s!=='.'&&s!=='..'),'OBJECT_IDENTITY');
}
function forbidAuthority(value){
 check(object(value),'OBJECT_REQUIRED');
 for(const field of ['targetRef','targetBinding','allowedTargetRefs','authorization','currentAuthority','quarantineReceipt'])check(!Object.hasOwn(value,field),'TARGET_OR_AUTHORITY_FORBIDDEN');
 for(const field of ['restoreAuthorized','targetWriteAuthorized','targetEffects','releaseAuthorized','restoreValidated','quarantineValidated','productionReady'])if(Object.hasOwn(value,field))check(value[field]===false,'AUTHORITY_ESCALATION_FORBIDDEN');
}
function verifyMetadata(descriptor,bindings,anchors,read){
 if(descriptor===null)return {metadataReady:false,metadataReview:null};
 check(exact(descriptor,['path','pin']),'METADATA_REVIEW_DESCRIPTOR');
 const review=json(read(descriptor.path,descriptor.pin));forbidAuthority(review);
 check(exact(review,['schema','status','reviewer','reference','sourceRef','archiveSha256','inventoryBinarySha256','inventorySemanticSha256','objectsManifestSha256','objectCount','totalBytes','metadataSource','objects']),'METADATA_REVIEW_SHAPE');
 check(review.schema==='rovaq-storage-metadata-review-v1'&&review.status==='reviewed','METADATA_REVIEW_REQUIRED');
 check([review.reviewer,review.reference].every(v=>typeof v==='string'&&v.trim().length>0),'METADATA_REVIEW_PROVENANCE');
 for(const name of ['sourceRef','archiveSha256','inventoryBinarySha256','inventorySemanticSha256','objectsManifestSha256','objectCount','totalBytes'])check(review[name]===bindings[name],'METADATA_REVIEW_BINDING');
 check(exact(review.metadataSource,['path','pin']),'METADATA_SOURCE_REQUIRED');
 read(review.metadataSource.path,review.metadataSource.pin);
 check(Array.isArray(review.objects)&&review.objects.length===anchors.size,'METADATA_COVERAGE');
 const seen=new Set();
 for(const item of review.objects){
  check(exact(item,['bucket','name','sourceMetadata','contentType']),'METADATA_OBJECT_SHAPE');identity(item);
  const k=key(item);check(anchors.has(k)&&!seen.has(k),'METADATA_COVERAGE');seen.add(k);
  // Reviewer explicitly decides content type; never substitute HTTP headers or infer it.
  check(object(item.sourceMetadata)&&typeof item.contentType==='string'&&/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+(?:;[^\r\n\0]+)?$/.test(item.contentType),'REVIEWED_METADATA_REQUIRED');
 }
 return {metadataReady:true,metadataReview:{path:descriptor.path,pin:descriptor.pin,metadataSource:review.metadataSource,reviewer:review.reviewer,reference:review.reference}};
}

export function verifyCapture(input){
 const c=structuredClone(input);forbidAuthority(c);
 check(exact(c,['schema','sourceRef','snapshotDirectory','snapshotPins','inventorySemanticSha256','storageDirectory','storagePins','expectedObjects','expectedBytes','metadataReview']),'CONFIG_SHAPE');
 check(c.schema==='rovaq-capture-adapter-config-v1'&&/^[a-z]{20}$/.test(c.sourceRef??''),'CONFIG_IDENTITY');
 check(HASH.test(c.inventorySemanticSha256??'')&&size(c.expectedObjects)&&size(c.expectedBytes),'EXPECTED_CAPTURE_TOTALS');
 for(const directory of [c.snapshotDirectory,c.storageDirectory])check(fs.statSync(safePath(directory)).isDirectory(),'DIRECTORY_REQUIRED');
 check(c.snapshotDirectory!==c.storageDirectory,'DISTINCT_CAPTURE_DIRECTORIES');
 check(exact(c.snapshotPins,['receipt.json','inventory.json','database.dump','toc.list'])&&Object.values(c.snapshotPins).every(pin),'SNAPSHOT_PINS');
 check(exact(c.storagePins,['receipt.json','objects.json'])&&Object.values(c.storagePins).every(pin),'STORAGE_PINS');
 const reads=new Map();
 const read=(file,p)=>{const bytes=readPinned(file,p);if(reads.has(file))check(equal(reads.get(file),p),'CONFLICTING_FILE_PINS');reads.set(file,p);return bytes;};
 const sourceFiles=Object.fromEntries(Object.entries(c.snapshotPins).map(([name,p])=>[name,read(location(c.snapshotDirectory,name),p)]));
 const source=json(sourceFiles['receipt.json']),inventory=json(sourceFiles['inventory.json']);
 forbidAuthority(source);check(object(source.capture),'SOURCE_CAPTURE_REQUIRED');forbidAuthority(source.capture);
 check(source.schema==='recovery457-source-local-export-v1'&&source.state==='database-archive-created'&&source.sourceRef===c.sourceRef,'SOURCE_RECEIPT');
 for(const name of ['targetEffects','targetWriteAuthorized','releaseAuthorized','restoreValidated','storageBytesExported'])check(source[name]===false,'SOURCE_ONLY_REQUIRED');
 check(source.databaseArchiveOnly===true&&source.capture.scope==='source-readonly-to-private-local-archive'&&source.capture.targetEffects===false&&source.capture.targetWriteAuthorized===false,'SOURCE_ONLY_REQUIRED');
 check(HASH.test(source.capture.authorizationSha256??'')&&HASH.test(source.capture.custodySha256??'')&&typeof source.capture.authorizationId==='string','ORIGINAL_CAPTURE_BINDING');
 check(source.localClientEnded===true&&source.sourceSessionClosed===true&&source.temporaryCredentialsRemoved===true&&source.closureScope==='local-client-end-only'&&source.remoteSessionClosureProven===false,'SOURCE_CLEANUP_RECEIPT');
 check(typeof source.snapshot==='string'&&/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/i.test(source.snapshot),'MVCC_SNAPSHOT_ID');
 check(object(inventory)&&inventory.complete===true&&inventory.captureSession?.sourceRef===c.sourceRef&&inventory.storageAnchorMethod==='mvcc-content-sha256','INVENTORY_COMPLETE_SNAPSHOT');
 const inventorySemanticSha256=semanticHash(inventory);
 check(inventorySemanticSha256===c.inventorySemanticSha256&&source.inventoryHash===inventorySemanticSha256,'INVENTORY_SEMANTIC_HASH');
 // Preserve any historical alias in its original receipt; never synthesize catalogHash.
 if(Object.hasOwn(source,'catalogHash'))check(source.catalogHash===inventorySemanticSha256,'LEGACY_CATALOG_ALIAS_MISMATCH');
 check(source.archiveSha256===c.snapshotPins['database.dump'].sha256&&sourceFiles['database.dump'].subarray(0,5).toString()==='PGDMP','DATABASE_ARCHIVE_BINDING');
 check(Array.isArray(source.files)&&source.files.length===3,'SOURCE_FILE_COVERAGE');
 const sourceNames=new Set();
 for(const item of source.files){
  check(exact(item,['path','sha256','bytes'])&&typeof item.path==='string','SOURCE_FILE_DESCRIPTOR');
  const name=path.basename(item.path);check(['inventory.json','database.dump','toc.list'].includes(name)&&!sourceNames.has(name),'SOURCE_FILE_COVERAGE');sourceNames.add(name);
  check(path.isAbsolute(item.path)&&path.normalize(item.path)===item.path&&item.sha256===c.snapshotPins[name].sha256&&item.bytes===c.snapshotPins[name].bytes,'SOURCE_FILE_BINDING');
 }
 const toc=sourceFiles['toc.list'].toString('utf8');
 check(toc.includes('Archive created at')&&toc.includes('Selected TOC Entries'),'TOC_HEADER');
 const ids=[];for(const line of toc.split(/\r?\n/)){if(!line.trim()||line.startsWith(';'))continue;const m=line.match(/^(\d+); \d+ \d+ .+$/);check(m&&Number.isSafeInteger(Number(m[1]))&&Number(m[1])>0,'TOC_ENTRY');ids.push(Number(m[1]));}
 check(ids.length>0&&new Set(ids).size===ids.length,'TOC_ENTRY_COVERAGE');
 const a=inventory.sections?.storage_content_anchors,listed=inventory.sections?.storage;
 check(Array.isArray(a)&&Array.isArray(listed)&&a.length===c.expectedObjects&&listed.length===a.length,'ANCHOR_COVERAGE');
 const anchors=new Map();let total=0;
 for(const item of a){identity(item);check(HASH.test(item.sha256??'')&&size(item.bytes),'ANCHOR_BYTES_HASH');check(!anchors.has(key(item)),'DUPLICATE_ANCHOR');anchors.set(key(item),item);total+=item.bytes;check(Number.isSafeInteger(total),'TOTAL_BYTES_RANGE');}
 check(total===c.expectedBytes,'ANCHOR_TOTAL_BYTES');
 const inventoryKeys=new Set();for(const item of listed){check(object(item),'INVENTORY_OBJECT');const k=key({bucket:item.bucket_id,name:item.name});check(anchors.has(k)&&!inventoryKeys.has(k),'INVENTORY_OBJECT_COVERAGE');inventoryKeys.add(k);}
 const manifest=json(read(location(c.storageDirectory,'objects.json'),c.storagePins['objects.json']));
 const storage=json(read(location(c.storageDirectory,'receipt.json'),c.storagePins['receipt.json']));forbidAuthority(manifest);forbidAuthority(storage);
 check(manifest.schema==='storage-capture478-objects-v1'&&storage.schema==='storage-capture478-receipt-v1'&&manifest.sourceRef===c.sourceRef&&storage.sourceRef===c.sourceRef,'STORAGE_CAPTURE_IDENTITY');
 const snapshotPins=Object.fromEntries(['inventory.json','receipt.json','database.dump'].map(name=>[name,c.snapshotPins[name]]));
 for(const value of [manifest,storage]){
  check(exact(value.snapshot,Object.keys(snapshotPins)),'STORAGE_SNAPSHOT_BINDING');
  for(const name of Object.keys(snapshotPins))check(exact(value.snapshot[name],['sha256','bytes'])&&value.snapshot[name].sha256===snapshotPins[name].sha256&&value.snapshot[name].bytes===snapshotPins[name].bytes,'STORAGE_SNAPSHOT_BINDING');
 }
 check(storage.status==='SNAPSHOT_ANCHORED_BYTES_CAPTURED'&&storage.transport==='fixed-origin-native-fetch'&&equal(storage.remoteOperations,['GET']),'STORAGE_READ_ONLY_CAPTURE');
 check(storage.snapshotAnchorMatch===true&&storage.currentDatabaseConsistencyProven===false&&storage.restoreValidated===false&&storage.quarantineValidated===false&&storage.productionReady===false,'STORAGE_CAPTURE_SCOPE');
 check(storage.objects===c.expectedObjects&&storage.bytes===total&&storage.objectsManifestSha256===c.storagePins['objects.json'].sha256,'STORAGE_RECEIPT_BINDING');
 check(Array.isArray(manifest.objects)&&manifest.objects.length===anchors.size,'STORAGE_OBJECT_COVERAGE');
 const seen=new Set(),names=new Set(),objects=[];
 for(const item of manifest.objects){
  check(exact(item,['index','bucket','name','sha256','bytes','file']),'STORAGE_OBJECT_DESCRIPTOR');identity(item);
  const k=key(item),anchor=anchors.get(k);check(anchor&&!seen.has(k)&&item.index===objects.length+1,'STORAGE_OBJECT_COVERAGE');seen.add(k);
  check(item.sha256===anchor.sha256&&item.bytes===anchor.bytes,'STORAGE_ANCHOR_BINDING');
  check(item.file===`object-${String(item.index).padStart(2,'0')}-${item.sha256}.blob`&&!names.has(item.file),'STORAGE_BLOB_NAME');names.add(item.file);
  const file=location(c.storageDirectory,item.file);read(file,{sha256:item.sha256,bytes:item.bytes});
  objects.push({bucket:item.bucket,name:item.name,sha256:item.sha256,bytes:item.bytes,file});
 }
 // No unaccounted blobs or abandoned partial capture masquerading as complete.
 const actual=fs.readdirSync(c.storageDirectory);
 check(actual.length===names.size+2+(actual.includes('capture-intent.json')?1:0)&&actual.every(name=>names.has(name)||['receipt.json','objects.json','capture-intent.json'].includes(name)),'STORAGE_EXTRA_OR_INCOMPLETE');
 for(const name of actual)check(fs.lstatSync(safePath(location(c.storageDirectory,name))).isFile(),'STORAGE_DIRECTORY_ENTRY');
 const bindings={sourceRef:c.sourceRef,archiveSha256:source.archiveSha256,inventoryBinarySha256:c.snapshotPins['inventory.json'].sha256,inventorySemanticSha256,objectsManifestSha256:c.storagePins['objects.json'].sha256,objectCount:anchors.size,totalBytes:total};
 const metadata=verifyMetadata(c.metadataReview,bindings,anchors,read);
 for(const [file,p] of reads)readPinned(file,p);
 return {
  schema:'rovaq-source-capture-bundle-v1',status:metadata.metadataReady?'capture-verified-metadata-reviewed':'capture-verified-metadata-review-required',
  ...bindings,sourceOnly:true,restoreAuthorized:false,restoreReady:false,targetBinding:null,releaseAuthorized:false,productionReady:false,
  ...metadata,configSemanticSha256:semanticHash(c),snapshotId:source.snapshot,
  originals:{snapshotDirectory:c.snapshotDirectory,snapshotPins:c.snapshotPins,storageDirectory:c.storageDirectory,storagePins:c.storagePins},
  captureAuthority:{scope:source.capture.scope,authorizationId:source.capture.authorizationId,authorizationSha256:source.capture.authorizationSha256,custodySha256:source.capture.custodySha256},
  toc:{path:location(c.snapshotDirectory,'toc.list'),...c.snapshotPins['toc.list'],entries:ids.length},objects,
  limits:['Original receipts and files are unmodified; historical source-only authority does not authorize a target.',
   'Binary hash and JSON.stringify inventory hash are separate bindings; no fabricated catalogHash.',
   'Archive/TOC origin is bound to pinned original receipts; no new pg_restore parse or managed import executed.',
   'Metadata semantics require independent review of the pinned metadata source; content type is never inferred.',
   'No current authority, target binding, quarantine, managed compatibility, restore or production claim.'],
 };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  check(process.argv.length===6&&process.argv[2]==='--config'&&process.argv[4]==='--sha256'&&HASH.test(process.argv[5]),'CLI_CONFIG_PIN_REQUIRED');
  const configPath=safePath(process.argv[3]),stat=fs.lstatSync(configPath);
  check((stat.mode&0o777)===0o600&&stat.uid===process.getuid(),'PRIVATE_CONFIG_REQUIRED');
  const bytes=readPinned(configPath,{bytes:stat.size,sha256:process.argv[5]});
  // Full contract can include private object paths. The caller controls private stdout custody.
  process.stdout.write(JSON.stringify(verifyCapture(json(bytes)),null,2)+'\n');
 }catch{process.stderr.write('{"status":"CAPTURE_ADAPTER_FAILED","restoreAuthorized":false}\n');process.exitCode=1;}
}

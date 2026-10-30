// F4: rutas member-file del manejador de importaciones (preview/registro), con base y almacenamiento en memoria y datos SINTETICOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createImportHandler} from './imports.mjs';
import {salesCsv,xlsx} from '../ingestion/member-files.fixtures.mjs';
const tenant='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',id='44444444-4444-4444-8444-444444444444',conn='33333333-3333-4333-8333-333333333333';
const secret='SYN'.repeat(16),CSV='text/csv',XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function setup({bytes=salesCsv(),type=CSV,provenance={},state='reserved',expires=Date.now()+600000,jobId=null}={}){
 const sha=createHash('sha256').update(bytes).digest('hex');
 const row={id,import_id:id,tenant_id:tenant,user_id:user,connection_id:conn,request_hash:'h',size:String(bytes.length),content_type:type,file_hash:sha,mapping_version:'interactive-unmapped-v1',state,job_id:jobId,object_path:`${tenant}/imports/${id}/original`,expires_at:new Date(expires).toISOString(),provenance};
 const log={updates:[],reads:0,sql:[]};
 const database={async transaction(action,work){return work({tenantId:tenant,userId:user,role:'analyst',async query(sql,params){log.sql.push(sql);
  if(sql.includes('FROM public.connections'))return {rows:[{id:conn}]};
  if(sql.includes('FROM public.imports i JOIN'))return {rows:[row]};
  if(sql.startsWith('SELECT id FROM public.imports'))return {rows:[{id}]};
  if(sql.includes('FROM storage.objects'))return {rows:[{owner_id:user,object_bytes:String(bytes.length)}]};
  if(sql.startsWith('UPDATE public.imports')){log.updates.push(params);row.state='uploaded';row.provenance=JSON.parse(params[2]);return {rows:[{id}]};}
  throw new Error('unexpected sql '+sql.slice(0,70));}});}};
 const handler=createImportHandler({database,storage:{createUpload:async()=>{throw new Error('no');},read:async()=>{log.reads++;return bytes;}},confirmationSecret:secret});
 const post=async(path,body)=>{const r=await handler(new Request(`https://x.invalid/api/imports/${id}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 const get=async()=>{const r=await handler(new Request(`https://x.invalid/api/imports/${id}`));return {status:r.status,body:await r.json()};};
 return {post,get,log,sha,row};
}
const good={kind:'sales_by_sku',currency:'USD'};

test('preview: devuelve conteos, agregados y procedencia sin valores de celda ni escrituras',async()=>{
 const t=setup();const r=await t.post('/member-file/preview',good);
 assert.equal(r.status,200);const d=r.body.data;
 assert.deepEqual(d.rows,{read:3,accepted:3,rejected:0,duplicates:0});assert.equal(d.aggregates.amounts[0].amount_minor,'8575');assert.equal(d.can_register,true);
 assert.equal(t.log.updates.length,0,'preview no escribe');assert.ok(!JSON.stringify(r.body).includes('SYN-A'));
});

test('registro: guarda procedencia y corte en imports.provenance y pasa a uploaded (confirm_import ya no lo acepta)',async()=>{
 const t=setup();const r=await t.post('/member-file/register',{...good,sha256:t.sha});
 assert.equal(r.status,201);assert.equal(r.body.data.member_file.cut,'2026-10-05T00:00:00.000Z');assert.equal(r.body.data.member_file.registered_by,user);assert.equal(r.body.data.member_file.applied,false);
 assert.equal(t.log.updates.length,1);assert.match(t.log.sql.find(q=>q.startsWith('UPDATE')),/state='uploaded'.*AND state='reserved'/);
 assert.ok(!t.log.sql.find(q=>q.startsWith('UPDATE')).includes('accepted'),'no toca los contadores de cobertura');
 // reintento identico: idempotente, sin segunda escritura
 const again=await t.post('/member-file/register',{...good,sha256:t.sha});
 assert.equal(again.status,200);assert.equal(again.body.data.replayed,true);assert.equal(t.log.updates.length,1);
 // opciones distintas sobre un archivo ya registrado: conflicto
 const other=await t.post('/member-file/register',{kind:'sales_by_sku',currency:'MXN',sha256:t.sha});assert.equal(other.status,409);assert.equal(other.body.error.code,'member_file_immutable');
 // detalle: lo registrado se muestra sin releer el archivo
 const reads=t.log.reads;const detail=await t.get();
 assert.equal(detail.status,200);assert.equal(detail.body.data.preview_state,'registered');assert.equal(detail.body.data.member_file.kind,'sales_by_sku');assert.equal(t.log.reads,reads);
});

test('registro: si la fila ya no esta en reserved (carrera) o el rol no escribe, 409 y nada queda registrado',async()=>{
 const lost=setup();
 const handlerDb={async transaction(action,work){return work({tenantId:tenant,userId:user,role:'analyst',async query(sql){
  if(sql.includes('FROM public.connections'))return {rows:[{id:conn}]};
  if(sql.includes('FROM public.imports i JOIN'))return {rows:[lost.row]};
  if(sql.startsWith('SELECT id FROM public.imports'))return {rows:[{id}]};
  if(sql.includes('FROM storage.objects'))return {rows:[{owner_id:user,object_bytes:String(lost.row.size)}]};
  if(sql.startsWith('UPDATE public.imports'))return {rows:[]};
  throw new Error('unexpected');}});}};
 const h=createImportHandler({database:handlerDb,storage:{createUpload:async()=>{throw new Error('no');},read:async()=>salesCsv()},confirmationSecret:secret});
 const r=await h(new Request(`https://x.invalid/api/imports/${id}/member-file/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...good,sha256:lost.sha})}));
 assert.equal(r.status,409);assert.equal((await r.json()).error.code,'member_file_immutable');
 assert.equal(lost.log.updates.length,0);
});

test('registro bloqueado: hash distinto, reserva vencida, mapeo previo, trabajo existente',async()=>{
 const t=setup();assert.equal((await t.post('/member-file/register',{...good,sha256:'0'.repeat(64)})).body.error.code,'confirmation_conflict');
 assert.equal((await t.post('/member-file/register',{...good,sha256:'xyz'})).body.error.code,'invalid_metadata');
 assert.equal((await setup({expires:Date.now()-1000}).post('/member-file/preview',good)).body.error.code,'reservation_expired');
 assert.equal((await setup({provenance:{mapping:{columns:{}}}}).post('/member-file/preview',good)).body.error.code,'member_file_immutable');
 assert.equal((await setup({jobId:'55555555-5555-4555-8555-555555555555',state:'queued'}).post('/member-file/preview',good)).status,409);
});

test('rechazos del dominio salen como 422 con codigo; entradas con claves de mas, 400',async()=>{
 const t=setup();
 const unknown=await t.post('/member-file/preview',{kind:'otro'});assert.equal(unknown.status,422);assert.equal(unknown.body.error.code,'UNKNOWN_KIND');
 const noCur=await t.post('/member-file/preview',{kind:'sales_by_sku'});assert.equal(noCur.status,200);assert.equal(noCur.body.data.blocker,'currency_required');
 assert.equal((await t.post('/member-file/register',{kind:'sales_by_sku',sha256:t.sha})).body.error.code,'currency_required');
 assert.equal((await t.post('/member-file/preview',{...good,extra:1})).status,400);
 assert.equal((await t.post('/member-file/preview',{kind:7})).status,400);
 const noHead=setup({bytes:salesCsv([['SYN-A','2026-09-01','1','1.00']],['SKU','Date','Units Sold','Notas'])});
 assert.equal((await noHead.post('/member-file/register',{...good,sha256:noHead.sha})).body.error.code,'member_file_headers_invalid');
 const none=setup({bytes:salesCsv([['','','','']])});assert.equal((await none.post('/member-file/register',{...good,sha256:none.sha})).body.error.code,'member_file_no_valid_rows');
 assert.equal(t.log.updates.length,0);
});

test('XLSX por la misma ruta, con hoja y fecha serial',async()=>{
 const bytes=xlsx([['SKU','Date','Units Sold','Gross Sales'],['SYN-A',46025.45,3,'45.50']]);const t=setup({bytes,type:XLSX});
 const r=await t.post('/member-file/preview',good);assert.equal(r.status,200);assert.equal(r.body.data.rows.accepted,1);assert.equal(r.body.data.sheet,'Hoja1');
});

test('un archivo registrado no se puede confirmar como importacion de mensajes (se rechaza antes de descargar)',async()=>{
 const t=setup();await t.post('/member-file/register',{...good,sha256:t.sha});
 const token=createHmac('sha256',secret).update([t.row.tenant_id,t.row.import_id,t.row.user_id,t.row.request_hash,new Date(t.row.expires_at).toISOString()].join('\n')).digest('base64url');
 const reads=t.log.reads;
 const r=await t.post('/confirm',{upload_token:token,sha256:t.sha,mapping_version:t.row.mapping_version});
 assert.equal(r.status,409);assert.equal(r.body.error.code,'member_file_not_confirmable');assert.equal(t.log.reads,reads);
});

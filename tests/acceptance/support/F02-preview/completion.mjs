import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {csv,mapping} from './fixtures.mjs';
export async function completionExam(page,{base,h,request,status,q,hash,snapshot,stop,start}){
 const alert=()=>page.locator('section[aria-labelledby=imports-heading] [role=alert]');
 const response=(p,suffix,method='POST')=>p.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix)&&r.request().method()===method);
 const configure=async p=>{for(const k of ['id','text','date','amount','currency'])await p.getByLabel(new RegExp('^Columna '+k)).selectOption(k);await p.getByLabel('Zona horaria IANA').fill('UTC');};
 const action=async(p,name,suffix,expected=200)=>{const pending=response(p,suffix);await p.getByRole('button',{name,exact:true}).click();const r=await pending;assert.equal(r.status(),expected,name);return (await r.json()).data;};
 const fileInput=async(buffer,name)=>{if(buffer.length>1024*1024){const file=path.join(process.env.F02_PREVIEW_ARTIFACTS,name);fs.writeFileSync(file,buffer,{flag:'wx'});const cdp=await page.context().newCDPSession(page);try{const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'input[type=file]'});assert.ok(nodeId);await cdp.send('DOM.setFileInputFiles',{nodeId,files:[file]});}finally{await cdp.detach();}}else await page.getByLabel('Archivo',{exact:true}).setInputFiles({name,mimeType:'text/csv',buffer});};
 const upload=async(buffer,name)=>{await page.getByLabel(/^Conexión/).selectOption(h.A.connection);await fileInput(buffer,name);const pending=page.waitForResponse(r=>r.request().method()==='GET'&&/\/api\/imports\/[^/]+$/.test(new URL(r.url()).pathname));await page.getByRole('button',{name:'Reservar y subir archivo'}).click();const r=await pending;assert.equal(r.status(),200,'BROWSER_UPLOAD_DETAIL');return (await r.json()).data;};
 // Two actual editors loaded at the same durable version, not a fabricated conflict response.
 await page.goto(base+'/imports');const d=await upload(csv(),'SYNTHETIC-two-editors.csv');await configure(page);
 const peer=await page.context().newPage();peer.setDefaultTimeout(12000);
 try{
 await peer.goto(base+'/imports');await peer.getByRole('button',{name:new RegExp('^'+d.import.id)}).click();await configure(peer);await peer.getByLabel('Zona horaria IANA').fill('America/New_York');
 await action(page,'Validar y previsualizar','/preview');await action(peer,'Validar y previsualizar','/preview');
 const winner=await action(page,'Guardar y confirmar mapping','/mapping');const before=snapshot(h,d.import.id);
 await action(peer,'Guardar y confirmar mapping','/mapping',409);await peer.locator('section[aria-labelledby=imports-heading] [role=alert]').waitFor();assert.match(await peer.locator('section[aria-labelledby=imports-heading] [role=alert]').innerText(),/mapping_version_conflict.*recarga/s);assert.ok(await peer.getByRole('button',{name:'Confirmar envío a cola'}).isDisabled());assert.deepEqual(snapshot(h,d.import.id),before,'UI_CAS_NO_EFFECT');
 const reload=response(peer,'/'+d.import.id,'GET');await peer.getByRole('button',{name:'Recargar esta reserva'}).click();assert.equal((await reload).status(),200);await peer.getByText(new RegExp('Versión: '+winner.mapping_version)).waitFor();assert.equal(await peer.getByLabel('Zona horaria IANA').inputValue(),'UTC');console.log('PASS UI TWO EDITORS CAS RELOAD');
 }finally{await peer.close();}
 // SSR writes require one exact Origin on every write route, including missing and combined values.
 const meta={connection_id:h.A.connection,mapping_version:'interactive-unmapped-v1',content_type:'text/csv',size:csv().length,sha256:hash(csv())};
 for(const origin of [null,'','null','https://foreign.invalid',base+', '+base])for(const [route,body] of [['',meta],['/'+d.import.id+'/preview',{mapping}],['/'+d.import.id+'/mapping',{mapping,expected_version:d.import.mapping_version}],['/'+d.import.id+'/confirm',{}]]){
 const headers=origin===null?{origin:undefined}:{origin};status(await request(h.A,route,body,headers),403,'ORIGIN_MATRIX');
 }
 console.log('PASS SSR ORIGIN MATRIX');
 // Authenticated Storage download is tenant- and membership-scoped, regardless of API endpoint.
 const object=h.sql(`SELECT object_path FROM imports WHERE id=${q(d.import.id)}`);
 const direct=token=>h.ports.storage('/object/authenticated/vexa-private/'+object,token);
 assert.equal((await direct(h.A.token)).status,200,'STORAGE_DOWNLOAD_OWNER');assert.notEqual((await direct(h.B.token)).status,200,'STORAGE_DOWNLOAD_TENANT_B');
 h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);
 try{assert.notEqual((await direct(h.A.token)).status,200,'STORAGE_DOWNLOAD_REVOKED');}finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);}
 assert.equal((await direct(h.A.token)).status,200,'STORAGE_DOWNLOAD_RECOVERED');
 const signed=await h.ports.storage('/object/sign/vexa-private/'+object,h.A.token,{method:'POST',body:{expiresIn:1}});assert.equal(signed.status,200,'DOWNLOAD_SIGN');
 const signedURL=new URL(signed.data.signedURL,'http://127.0.0.1:'+JSON.parse(process.env.F02_PREVIEW_PORTS)[1]);
 assert.equal((await fetch(signedURL)).status,200,'SIGNED_DOWNLOAD_POSITIVE');await new Promise(r=>setTimeout(r,2100));assert.notEqual((await fetch(signedURL)).status,200,'SIGNED_DOWNLOAD_REAL_EXPIRY');console.log('PASS STORAGE DOWNLOAD NEGATIVES REAL EXPIRY');
 // Change the fixture DB DEFAULT before creating/signing a reservation. Never alter signed expires_at.
 h.sql("ALTER TABLE import_uploads ALTER COLUMN expires_at SET DEFAULT (now()+interval '7 seconds')");
 let expired;
 try{expired=await upload(Buffer.from(csv().toString().replace('SYNTHETIC','SYNTHETIC TTL')),'SYNTHETIC-expiry.csv');await configure(page);await action(page,'Validar y previsualizar','/preview');await action(page,'Guardar y confirmar mapping','/mapping');}finally{h.sql("ALTER TABLE import_uploads ALTER COLUMN expires_at SET DEFAULT (now()+interval '15 minutes')");}
 const stable=snapshot(h,expired.import.id);await new Promise(r=>setTimeout(r,Math.max(0,new Date(expired.import.expires_at).getTime()-Date.now()+150)));
 await action(page,'Confirmar envío a cola','/confirm',409);await alert().waitFor();assert.match(await alert().innerText(),/reservation_expired/);assert.ok(await page.getByRole('button',{name:'Confirmar envío a cola'}).isDisabled());assert.deepEqual(snapshot(h,expired.import.id),stable,'EXPIRED_NO_JOB');
 await page.getByRole('button',{name:'Reservar y subir archivo'}).click();await alert().waitFor();assert.match(await alert().innerText(),/reservation_expired/);
 const renewed=await upload(Buffer.from(csv().toString().replace('SYNTHETIC','SYNTHETIC TTL')),'SYNTHETIC-expiry.csv');assert.notEqual(renewed.import.id,expired.import.id,'EXPLICIT_RESTART_NEW_RESERVATION');assert.equal(snapshot(h,renewed.import.id).jobs.length,0);console.log('PASS UI REAL EXPIRY EXPLICIT RESTART');
 // Exactly 20MiB valid CSV, bounded short rows; plus one byte must stop before reserve/PUT.
 const size=20*1024*1024,head=Buffer.from('id,text\n'),unit=Buffer.from('a,'+'s'.repeat(1021)+'\n');const large=Buffer.alloc(size);head.copy(large);let at=head.length;while(at+unit.length<=size){unit.copy(large,at);at+=unit.length;}Buffer.from('x'.repeat(size-at-1)+'\n').copy(large,at);
 const big=await upload(large,'SYNTHETIC-20MiB.csv');assert.equal(Number(h.sql(`SELECT size FROM import_uploads WHERE import_id=${q(big.import.id)}`)),size,'EXACT_20MIB_RESERVATION');
 let writes=0;const watch=r=>{if(r.method()==='PUT'||r.method()==='POST'&&new URL(r.url()).pathname==='/api/imports')writes++;};page.on('request',watch);
 await fileInput(Buffer.concat([large,Buffer.from('x')]),'SYNTHETIC-too-large.csv');await page.getByRole('button',{name:'Reservar y subir archivo'}).click();await alert().waitFor();assert.match(await alert().innerText(),/20 MiB/);assert.equal(writes,0,'OVERSIZE_NO_RESERVE_OR_PUT');page.off('request',watch);console.log('PASS UI 20MIB AND EXCESS');
 // Pagination exercises actual SQL pages and UI append/dedup with a retained second-page selection.
 h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) SELECT gen_random_uuid(),${q(h.A.tenant)},'csv','SYNTHETIC-PAGE-'||g FROM generate_series(1,103) g;
 WITH added AS (INSERT INTO imports(tenant_id,connection_id,file_hash,mapping_version,idempotency_key,object_path) SELECT ${q(h.A.tenant)},${q(h.A.connection)},${q(meta.sha256)},'interactive-unmapped-v1',gen_random_uuid()::text,${q(h.A.tenant)}||'/imports/'||gen_random_uuid()::text||'/original' FROM generate_series(1,55) RETURNING id,tenant_id)
 INSERT INTO import_uploads(tenant_id,import_id,user_id,size,content_type,request_hash) SELECT tenant_id,id,${q(h.A.id)},${meta.size},'text/csv','SYNTHETIC-PAGE' FROM added;`);
 await page.goto(base+'/imports');await page.getByRole('button',{name:'Más conexiones',exact:true}).waitFor();
 const first=await page.getByLabel(/^Conexión/).locator('option').evaluateAll(es=>es.map(e=>e.value));
 let next=response(page,'/api/imports','GET');await page.getByRole('button',{name:'Más conexiones',exact:true}).click();assert.equal((await next).status(),200);
 await page.waitForFunction(select=>select.options.length===105,await page.getByLabel(/^Conexión/).elementHandle());
 const all=await page.getByLabel(/^Conexión/).locator('option').evaluateAll(es=>es.map(e=>e.value));assert.equal(all.length,105);assert.equal(new Set(all).size,all.length);const second=all.find(id=>id&&!first.includes(id));assert.ok(second);await page.getByLabel(/^Conexión/).selectOption(second);
 next=response(page,'/api/imports','GET');await page.getByRole('button',{name:'Más reservas',exact:true}).click();assert.equal((await next).status(),200);await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby=imports-heading] > ul > li > button').length>50);const ids=await page.locator('section[aria-labelledby=imports-heading] > ul > li > button').allTextContents();assert.ok(ids.length>50);assert.equal(new Set(ids).size,ids.length);
 next=response(page,'/api/imports','GET');await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();assert.equal((await next).status(),200);await page.waitForFunction(()=>document.querySelectorAll('section[aria-labelledby=imports-heading] > ul > li > button').length===50);assert.equal(await page.getByLabel(/^Conexión/).inputValue(),second,'PAGINATION_RETAINS_SELECTED_CONNECTION_AFTER_RELOAD');console.log('PASS UI PAGINATION RETAINED CONNECTION');
 // Runtime missing DB config with valid Auth retains the real workspace and explains 503.
 await stop();await start({VEXA_DATABASE_URL:''});status(await request(h.A,''),503,'RUNTIME_CONFIG_ABSENT');await page.goto(base+'/imports');await alert().waitFor();assert.match(await alert().innerText(),/503.*Configurar PostgreSQL/s);await stop();await start();status(await request(h.A,''),200,'RUNTIME_CONFIG_RECOVERED');console.log('PASS RUNTIME CONFIG 503 UI RECOVERY');
}

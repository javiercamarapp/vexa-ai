import assert from 'node:assert/strict';import {xlsx,row,csv} from './fixtures.mjs';import {safeExport} from './oracles.mjs';
export async function uiStates(page,{downloadBytes,base,connectionId,revoke,restore,empty,unempty}){
 const listResponse=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/imports'&&r.request().method()==='GET');
 // Delay the real request; never fabricate a response or disable browser security.
 let release,finished;const held=new Promise(r=>release=r),continued=new Promise(r=>finished=r);
 const delay=async route=>{await held;try{await route.continue();}finally{finished();}};await page.route(/\/api\/imports(?:\?.*)?$/,delay);
 try{await page.goto(base+'/imports');await page.getByRole('status').filter({hasText:'Procesando'}).waitFor();console.log('PASS UI LOADING');}finally{release();await continued;await page.unroute(/\/api\/imports(?:\?.*)?$/,delay);}
 await page.getByRole('button',{name:'Recargar reservas / reintentar'}).waitFor();
 // Loss of transport must remain an error, then retry must make a new real GET.
 const abort=route=>route.abort('failed');await page.route(/\/api\/imports(?:\?.*)?$/,abort);
 await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();await page.locator('section[aria-labelledby=imports-heading] [role=alert]').waitFor();assert.match(await page.locator('section[aria-labelledby=imports-heading] [role=alert]').innerText(),/fetch|error|fall/i);
 await page.unroute(/\/api\/imports(?:\?.*)?$/,abort);let response=listResponse();await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();assert.equal((await response).status(),200);await page.locator('section[aria-labelledby=imports-heading] [role=alert]').waitFor({state:'detached'});console.log('PASS UI ERROR RETRY');
 await empty();try{response=listResponse();await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();assert.equal((await response).status(),200);await page.getByText('No hay conexiones activas disponibles.').waitFor();console.log('PASS UI EMPTY');}finally{await unempty();}
 await revoke();try{response=listResponse();await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();assert.equal((await response).status(),403,'UI_REVOKED_403');await page.locator('section[aria-labelledby=imports-heading] [role=alert]').waitFor();assert.match(await page.locator('section[aria-labelledby=imports-heading] [role=alert]').innerText(),/403/);console.log('PASS UI REVOCATION');}finally{await restore();}
 response=listResponse();await page.getByRole('button',{name:'Recargar reservas / reintentar'}).click();assert.equal((await response).status(),200);
 const headers=['id','text','date','amount','currency'],book=xlsx([{name:'SYN_A',rows:[headers,row({amount:'1.23'})]},{name:'SYN_B',rows:[headers,row({amount:'4.56'}),row({id:'bad',amount:'invalid'})]}]);
 await page.getByLabel(/^Conexión/).selectOption(connectionId);await page.getByLabel('Archivo',{exact:true}).setInputFiles({name:'SYNTHETIC-multi.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:book});
 const detail=page.waitForResponse(r=>r.request().method()==='GET'&&/\/api\/imports\/[^/]+$/.test(new URL(r.url()).pathname));await page.getByRole('button',{name:'Reservar y subir archivo'}).click();assert.equal((await detail).status(),200);
 await page.getByText('Selecciona una hoja del archivo.',{exact:true}).waitFor();
 const selected=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).searchParams.get('sheet')==='SYN_B');
 await page.getByLabel(/^Hoja Excel/).selectOption('SYN_B');assert.equal((await selected).status(),200);
 for(const key of ['id','text','date','amount','currency'])await page.getByLabel(new RegExp('^Columna '+key)).selectOption(key);
 await page.getByLabel('Zona horaria IANA').fill('UTC');
 let preview=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/preview'));await page.getByRole('button',{name:'Validar y previsualizar'}).click();let r=await preview;assert.equal(r.status(),200);const data=(await r.json()).data;assert.equal(data.input_rows,2);assert.equal(data.coverage.rejected,1);assert.equal(data.sample.rows[0].money.amount_minor,'456','XLSX_SELECTED_B');await page.getByText('456 USD',{exact:true}).waitFor();
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/mapping'));await page.getByRole('button',{name:'Guardar y confirmar mapping'}).click();assert.equal((await saved).status(),200);
 const download=page.waitForEvent('download');await page.getByRole('link',{name:/Descargar errores CSV/}).click();const file=await download;assert.equal(await file.failure(),null);safeExport((await downloadBytes(file)).toString(),1);console.log('PASS UI XLSX SELECTION CSV DOWNLOAD');
 // Population counters are asserted from 10K actual rows; no sample extrapolation.
 const tenK=csv(Array.from({length:10000},(_,i)=>row({id:'UI-'+i,amount:i>=9990?'invalid':'10.01'})));
 await page.getByLabel('Archivo',{exact:true}).setInputFiles({name:'SYNTHETIC-10K.csv',mimeType:'text/csv',buffer:tenK});const loaded=page.waitForResponse(r=>r.request().method()==='GET'&&/\/api\/imports\/[^/]+$/.test(new URL(r.url()).pathname));await page.getByRole('button',{name:'Reservar y subir archivo'}).click();assert.equal((await loaded).status(),200);
 for(const key of ['id','text','date','amount','currency'])await page.getByLabel(new RegExp('^Columna '+key)).selectOption(key);await page.getByLabel('Zona horaria IANA').fill('UTC');
 preview=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/preview'));await page.getByRole('button',{name:'Validar y previsualizar'}).click();r=await preview;assert.equal(r.status(),200);const large=(await r.json()).data;assert.equal(large.input_rows,10000);assert.equal(large.coverage.accepted,9990);assert.equal(large.coverage.rejected,10);assert.equal(large.sample.rows.length,20);await page.getByRole('heading',{name:'Validación: 10000 filas'}).waitFor();console.log('PASS UI 10000 ROWS EXACT COUNTERS');
}

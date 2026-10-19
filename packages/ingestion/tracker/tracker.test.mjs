import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildXlsx} from './xlsx-fixture.mjs';
import {readWorkbook,planSheetJob,planWorkbook,manifest,TrackerLedger,buildRow,ticketEvidence} from './index.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const HEAD=['Requester','Hubspot ID','Request Date','Order ID','Notes'];
const row=(i,{tk=String(10000000000+i),note='n'+i}={})=>['u'+i,tk,45000+i,'ORD-'+i,note];
const sheetOf=(name,n,opts={})=>({name,state:opts.state,rows:[HEAD,...Array.from({length:n},(_,i)=>row(i+2,opts.row?.(i+2)))]});
test('lector: valor y fórmula por celda, compartidas, resultado vacío, hoja oculta',()=>{
 const wb=readWorkbook(buildXlsx([{name:'A',rows:[['h1','h2'],[{f:'1+1',v:2},{emptyV:true}],[{sf:'master',si:0,ref:'A3:A4',f:'B3*2',v:4},'x'],[{sf:'dep',si:0,v:6},null]]},{name:'Oculta',state:'hidden',rows:[['z']]}]));
 assert.deepEqual(wb.sheets.map(s=>[s.name,s.state]),[['A','visible'],['Oculta','hidden']]);
 const r=wb.sheets[0].rows;
 assert.equal(r[1].cells[0].f,'1+1');assert.equal(r[1].cells[0].v,'2');
 assert.equal(r[1].cells[1].v,'');assert.equal(r[1].cells[1].f,'""'); // resultado vacío cuenta como presente
 assert.equal(r[2].cells[0].fs,'0');assert.equal(r[2].cells[0].fr,'A3:A4');assert.equal(r[3].cells[0].f,'');assert.equal(r[3].cells[0].fs,'0');
 assert.equal(r[3].cells.length,1);
});
test('lector: rechaza macros y ZIP corrupto',()=>{
 assert.throws(()=>readWorkbook(new Uint8Array([1,2,3])));
 assert.throws(()=>readWorkbook('x'));
});
test('lotes <=250, una hoja por job, conteos',()=>{
 const wb=readWorkbook(buildXlsx([sheetOf('Big',600),sheetOf('Small',3,{state:'hidden'})]));
 const jobs=planWorkbook(wb);
 assert.equal(jobs.length,2);assert.equal(jobs[0].counts.rows,601);assert.equal(jobs[0].batches.length,3);
 assert.deepEqual(jobs[0].batches.map(b=>b.rows.length),[250,250,101]);assert.equal(jobs[1].state,'hidden');
 assert.throws(()=>planSheetJob(wb.sheets[0],{chunkSize:251}),/INVALID_CHUNK_SIZE/);
 const m=manifest(wb);assert.equal(m.total.rows,605);assert.equal(m.total.cells,605*5-0);
});
test('forma completa: 16 hojas con los conteos del recibo (sintético)',()=>{
 const shape=[['Warranty Tools',1750],['Warranty Parts',2000],['Return Labels',1204],['Refunds',1310],['Cancellations',1000],['Refunds Requests',1313,1],['Waitlist',257],['Quotes',283],['B&S',185],['RMA',96],['WPR',1988,1],['WTR',1750,1],['Cancel Subscriptions',86,1],['Address Verification',2,1],['Fraud Preventation',2,1],['FB  Reviews',2,1]];
 const wb=readWorkbook(buildXlsx(shape.map(([name,n,h])=>({name,state:h?'hidden':undefined,rows:[HEAD,...Array.from({length:n-1},(_,i)=>row(i+2))]}))));
 const m=manifest(wb);
 assert.equal(m.sheets.length,16);assert.equal(m.total.rows,13228);assert.equal(m.total.rejected,0);
 assert.ok(m.sheets.every(s=>s.maxBatch<=250));assert.equal(m.total.batches,m.sheets.reduce((a,s,i)=>a+Math.ceil(shape[i][1]/250),0));
 assert.equal(m.sheets.filter(s=>s.state==='hidden').length,7);
});
test('ticket: solo con evidencia; filas sin ticket se conservan',()=>{
 const wb=readWorkbook(buildXlsx([{name:'S',rows:[HEAD,row(2),row(3,{tk:''}),row(4,{tk:'12'}),row(5,{tk:'20000000005'}),['a',null,1,'ORD-9']]}]));
 const idx=new Set(['10000000002']);
 const j=planSheetJob(wb.sheets[0],{ticketIndex:idx});
 const st=j.batches[0].rows.map(r=>r.ticket.state);
 assert.deepEqual(st,['header','linked','no_ticket','malformed_id','candidate','no_ticket']);
 assert.equal(j.counts.accepted,6);assert.equal(j.counts.rejected,0);
 assert.equal(j.batches[0].rows[1].ticket.cell,'B2'); // evidencia = celda concreta
 const sinIndice=planSheetJob(wb.sheets[0]);assert.ok(!sinIndice.batches[0].rows.some(r=>r.ticket.state==='linked'));
 assert.equal(ticketEvidence([{col:3,v:'ORD-1',ref:'D2'}],[1],idx).state,'no_ticket'); // Order ID no enlaza
});
test('rechazos con motivo, sin perder el recuento',()=>{
 const sheet={name:'S',rows:[{row:1,cells:[{col:0,ref:'A1',t:'s',v:'Hubspot ID'}]},{row:2,cells:[{col:250,ref:'IQ2',t:'n',v:'1'}]},{row:3,cells:[{col:0,ref:'A3',t:'s',v:'x'.repeat(100001)}]},{row:0,cells:[]}]};
 const j=planSheetJob(sheet);
 assert.deepEqual(j.rejections.map(r=>r.code),['ROW_TOO_WIDE','CELL_TOO_LONG','ROW_NUMBER_INVALID']);
 assert.equal(j.counts.accepted+j.counts.rejected,j.counts.rows);assert.ok(j.rejections.every(r=>/^[0-9a-f]{64}$/.test(r.raw_hash)));
});
test('hash de fila: estable, sensible a valor y a fórmula, indiferente al origen sst/inline',()=>{
 const mk=(c)=>buildRow({name:'S',rows:[]},{row:2,cells:[c]},{hubspot:[]}).record.row_hash;
 const base={col:0,ref:'A2',t:'n',v:'2',f:null};
 assert.equal(mk(base),mk({...base}));assert.notEqual(mk(base),mk({...base,v:'3'}));assert.notEqual(mk(base),mk({...base,f:'1+1'}));
 assert.equal(mk({col:0,ref:'A2',t:'s',v:'a'}),mk({col:0,ref:'A2',t:'str',v:'a'}));
});
function ingest(L,v,wb){for(const j of planWorkbook(wb))for(const b of j.batches)L.applyBatch(v,b.rows);}
test('revisiones: idempotencia, versión nueva, cabeza = más reciente, celdas cambiadas',()=>{
 const A=readWorkbook(buildXlsx([sheetOf('S',10)])),B=readWorkbook(buildXlsx([sheetOf('S',12,{row:i=>i===3?{note:'cambiada'}:{}})]));
 const L=new TrackerLedger(),a=sha('a'),b=sha('b');
 L.addVersion({sha256:a,rank:1});L.addVersion({sha256:b,rank:2});
 ingest(L,a,A);const n1=L.revisionCount;assert.equal(n1,11);
 ingest(L,a,A);assert.equal(L.revisionCount,n1); // reintento idempotente
 ingest(L,b,B);
 assert.equal(L.revisionCount,n1+1+2);assert.equal(L.observed(b),13);
 assert.equal(L.head('S!3').version,b);assert.notEqual(L.head('S!3').hash,L.head('S!4').hash);
 const d=L.diff(a,b);assert.equal(d.changedCells,1+2*5);assert.equal(d.rowsChanged,1);assert.equal(d.rowsOnlyTo,2);
 // aplicar una versión anterior después NO mueve la cabeza
 const C=readWorkbook(buildXlsx([sheetOf('S',10,{row:i=>i===5?{note:'vieja'}:{}})])),c=sha('c');L.addVersion({sha256:c,rank:0});ingest(L,c,C);
 assert.equal(L.head('S!5').version,b);assert.equal(L.head('S!5').revision.cells.find(x=>x.col===4).v,'n5');
 assert.equal(L.diff(c,b).rowsChanged,2); // fila 3 (cambiada en b) y fila 5 (vieja en c)
 assert.throws(()=>L.addVersion({sha256:a,rank:9}),/VERSION_CONFLICT/);assert.throws(()=>L.addVersion({sha256:sha('z'),rank:2}),/VERSION_RANK_TAKEN/);
 assert.throws(()=>L.applyBatch(a,Array(251).fill({row_ref:'x',row_hash:'h'})),/BATCH_TOO_LARGE/);
});

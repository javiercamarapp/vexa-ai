// Reader-specific instrumentation. Observes real zlib allocation cap, not RSS/heap claims.
import assert from 'node:assert/strict';import zlib from 'node:zlib';import {syncBuiltinESMExports} from 'node:module';import {fixture} from './adversarial-xlsx.mjs';import {ingestion,exported} from './common.mjs';
const {good,bad,limits}=fixture('actual-deflate-budget');
const descriptor=Object.getOwnPropertyDescriptor(zlib,'inflateRawSync');let events=[];
Object.defineProperty(zlib,'inflateRawSync',{...descriptor,value:function(input,options){const event={compressed:input.length,cap:options?.maxOutputLength};events.push(event);try{const r=descriptor.value.call(this,input,options);event.expanded=Buffer.isBuffer(r)?r.length:r.buffer.length;return r;}catch(e){event.code=e.code;throw e;}}});syncBuiltinESMExports();
try{
 const parse=exported(await ingestion(),'parseXLSX');assert.equal(parse(good).sheets[0].rows[0].values[0],'SYNTHETIC');
 if(events.length===0){console.error('BLOCKED: INSTRUMENTATION_UNAVAILABLE; reader needs reviewed adapter');process.exitCode=2;}
 else{events=[];assert.throws(()=>parse(bad,limits),e=>e.code==='XLSX_LIMIT_EXPANDED');assert.ok(events.length>0,'ACTUAL_EXPANSION_OBSERVED');let total=0;
 for(const e of events){assert.ok(Number.isSafeInteger(e.cap)&&e.cap>0&&e.cap<=limits.maxExpandedBytes-total,'ACTUAL_EXPANSION_CAP');if(e.expanded!==undefined){total+=e.expanded;assert.ok(total<=limits.maxExpandedBytes,'ACTUAL_EXPANSION_TOTAL');}}
 assert.ok(events.some(e=>e.code==='ERR_BUFFER_TOO_LARGE'),'ACTUAL_DEFLATE_STOPPED_BY_CAP');console.log(JSON.stringify({marker:'ACTUAL_EXPANSION_OBSERVED',decompressor:'node:zlib.inflateRawSync',node:process.version,declaredLie:true,limit:limits.maxExpandedBytes,events}));}
}finally{Object.defineProperty(zlib,'inflateRawSync',descriptor);syncBuiltinESMExports();}

// Synthetic ZIP mutations retain every unrelated header, payload and workbook part.
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {workbook,zip} from './xlsx.mjs';
export function members(b){const end=b.length-22;let p=b.readUInt32LE(end+16);const out=[];for(let i=0;i<b.readUInt16LE(end+10);i++){assert.equal(b.readUInt32LE(p),0x02014b50);const n=b.readUInt16LE(p+28),local=b.readUInt32LE(p+42),start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),length=b.readUInt32LE(p+20),method=b.readUInt16LE(p+10);const packed=b.subarray(start,start+length);out.push({name:b.toString('utf8',p+46,p+46+n),central:p,local,start,packed,raw:method===8?inflateRawSync(packed):packed});p+=46+n+b.readUInt16LE(p+30)+b.readUInt16LE(p+32);}return out;}
const entries=()=>members(workbook()).map(e=>[e.name,e.raw]);
function changePart(name,transform){return zip(entries().map(([n,b])=>[n,n===name?transform(b.toString()):b]));}
function sizes(b,value){const out=Buffer.from(b),e=members(out).find(e=>e.name==='padding.xml');out.writeUInt32LE(value,e.central+24);out.writeUInt32LE(value,e.local+22);return out;}
function zip64(b){const end=b.length-22,record=Buffer.alloc(56),locator=Buffer.alloc(20),legacy=Buffer.from(b.subarray(end));record.writeUInt32LE(0x06064b50);record.writeBigUInt64LE(44n,4);record.writeUInt16LE(45,12);record.writeUInt16LE(45,14);record.writeBigUInt64LE(BigInt(b.readUInt16LE(end+8)),24);record.writeBigUInt64LE(BigInt(b.readUInt16LE(end+10)),32);record.writeBigUInt64LE(BigInt(b.readUInt32LE(end+12)),40);record.writeBigUInt64LE(BigInt(b.readUInt32LE(end+16)),48);locator.writeUInt32LE(0x07064b50);locator.writeBigUInt64LE(BigInt(end),8);locator.writeUInt32LE(1,16);legacy.writeUInt16LE(65535,8);legacy.writeUInt16LE(65535,10);legacy.writeUInt32LE(0xffffffff,12);legacy.writeUInt32LE(0xffffffff,16);return Buffer.concat([b.subarray(0,end),record,locator,legacy]);}
const sheet='xl/worksheets/sheet1.xml';
const definitions=[
 ['crc',()=>{const good=workbook(),bad=Buffer.from(good),e=members(good).find(e=>e.name===sheet);const wrong=(bad.readUInt32LE(e.central+16)^1)>>>0;bad.writeUInt32LE(wrong,e.central+16);bad.writeUInt32LE(wrong,e.local+14);return {good,bad};},['XLSX_CRC']],
 ['declared-small',()=>{const good=workbook({padding:4096,store:true});return {good,bad:sizes(good,64)};},['XLSX_ZIP_MISMATCH']],
 ['declared-large',()=>{const good=workbook({padding:4096});return {good,bad:sizes(good,8192)};},['XLSX_ZIP_MISMATCH']],
 ['actual-deflate-budget',()=>{const good=workbook({padding:1024*1024}),bad=sizes(good,64);return {good,bad,limits:{maxExpandedBytes:100000}};},['XLSX_LIMIT_EXPANDED']],
 ['actual-store-budget',()=>{const good=workbook({padding:1024*1024,store:true}),bad=sizes(good,64);return {good,bad,limits:{maxExpandedBytes:100000}};},['XLSX_LIMIT_EXPANDED']],
 ['duplicate',()=>{const good=workbook(),es=entries();es.push([sheet,es.find(([n])=>n===sheet)[1].toString().replace('SYNTHETIC','OTHER')]);return {good,bad:zip(es)};},['XLSX_ZIP_DUPLICATE']],
 ...[['alias-dot','xl/./worksheets/sheet1.xml'],['escape-dotdot','../escape.xml'],['escape-absolute','/escape.xml'],['escape-backslash','xl\\worksheets\\sheet1.xml']].map(([id,name])=>[id,()=>({good:workbook(),bad:zip([...entries(),[name,'<synthetic/>']])}),['XLSX_PATH']]),
 ['relationship-escape',()=>({good:workbook(),bad:changePart('xl/_rels/workbook.xml.rels',s=>s.replace('worksheets/sheet1.xml','../../escape.xml'))}),['XLSX_PATH']],
 ['relationship-encoded',()=>({good:workbook(),bad:changePart('xl/_rels/workbook.xml.rels',s=>s.replace('worksheets/sheet1.xml','%2e%2e/escape.xml'))}),['XLSX_PATH']],
 ['xml-dtd-internal',()=>({good:workbook(),bad:changePart(sheet,s=>'<!DOCTYPE worksheet [<!ENTITY synthetic "SYNTHETIC">]>'+s.replace('SYNTHETIC','&synthetic;'))}),['XLSX_XML']],
 ['xml-dtd-external',()=>({good:workbook(),bad:changePart(sheet,s=>'<!DOCTYPE worksheet [<!ENTITY synthetic SYSTEM "https://example.invalid/never">]>'+s.replace('SYNTHETIC','&synthetic;'))}),['XLSX_XML']],
 ['xml-dtd-file',()=>({good:workbook(),bad:changePart(sheet,s=>'<!DOCTYPE worksheet [<!ENTITY synthetic SYSTEM "file:///__vexa_synthetic_never_exists__/fixture">]>'+s.replace('SYNTHETIC','&synthetic;'))}),['XLSX_XML']],
 ['xml-unknown-entity',()=>({good:workbook(),bad:changePart(sheet,s=>s.replace('SYNTHETIC','&undefinedSynthetic;'))}),['XLSX_XML']],
 ['zip64',()=>({good:workbook(),bad:zip64(workbook())}),['XLSX_ZIP_UNSUPPORTED']],
];
export const adverseIds=definitions.map(([id])=>id);
export function fixture(id){const definition=definitions.find(d=>d[0]===id);assert.ok(definition);return {id,...definition[1](),codes:definition[2]};}
export function positiveEntities(){return changePart(sheet,s=>s.replace('SYNTHETIC','A&amp;B&lt;C&gt;&quot;&apos;&#128512;&#xE9;'));}
export function oracle(parse,id){const {good,bad,limits,codes}=fixture(id);assert.deepEqual(parse(good).sheets[0].rows,[{line:1,values:['SYNTHETIC','1001']}],`ADVERSE_POSITIVE:${id}`);if(id==='zip64'){try{assert.deepEqual(parse(bad).sheets[0].rows,[{line:1,values:['SYNTHETIC','1001']}],'ZIP64_SUPPORTED_CELLS');}catch(error){assert.ok(codes.includes(error.code),`ZIP64_UNSUPPORTED_TYPED:${error.code}`);}return;}assert.throws(()=>parse(bad,limits),error=>{assert.ok(codes.includes(error.code),`ADVERSE_REASON:${id}:${error.code}`);return true;},`ADVERSE_REJECT:${id}`);}

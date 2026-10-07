import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshConnectionOptions,type ImportConnection} from '../src/lib/imports/connection-options';
const row=(id:string,account_id=id):ImportConnection=>({id,source:'csv',account_id});
const first={connections:[row('a')],next_connection_offset:100};
test('reload preserves a selected later-page connection with freshly authorized metadata',async()=>{
 const offsets:number[]=[];
 const actual=await refreshConnectionOptions(first,'selected',async offset=>{offsets.push(offset);return offset===100?{connections:[row('b')],next_connection_offset:200}:{connections:[row('selected','SYN renamed account')],next_connection_offset:300};});
 assert.deepEqual(actual,[row('a'),row('selected','SYN renamed account')]);assert.deepEqual(offsets,[100,200]);
});
test('reload removes selection absent from every current authorized page',async()=>{
 const actual=await refreshConnectionOptions(first,'revoked',async()=>({connections:[row('b')],next_connection_offset:null}));
 assert.deepEqual(actual,[row('a')]);
});
test('authorization or transport failure does not produce a successful refreshed list',async()=>{
 await assert.rejects(refreshConnectionOptions(first,'selected',async()=>{throw Error('403: organization revoked');}),/403/);
});
test('a selected first-page connection or empty selection needs no extra reads',async()=>{
 const unexpected=async()=>{throw Error('unexpected page');};
 assert.deepEqual(await refreshConnectionOptions(first,'a',unexpected),first.connections);
 assert.deepEqual(await refreshConnectionOptions(first,'',unexpected),first.connections);
});
test('a repeated page cursor stops instead of looping indefinitely',async()=>{
 await assert.rejects(refreshConnectionOptions(first,'selected',async()=>({connections:[],next_connection_offset:100})),/paginación/);
});

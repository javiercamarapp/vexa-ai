import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const candidate=path.resolve(process.env.VEXA_CANDIDATE??fileURLToPath(new URL('../../../..',import.meta.url)));
export async function ingestion(){
 const p=path.join(candidate,'packages/ingestion/index.mjs');
 assert.ok(fs.existsSync(p),'IMPLEMENTATION_MISSING: packages/ingestion/index.mjs');
 assert.ok(!fs.lstatSync(p).isSymbolicLink(),'INPUT_SYMLINK');
 return import(pathToFileURL(p).href);
}
export function exported(m,name){assert.equal(typeof m[name],'function',`CONTRACT_BINDING_MISSING: ingestion.${name}; see support/F02/README.md`);return m[name];}
export const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC-A'};
export const options={context,observed_at:'2026-09-19T00:00:00Z',mappingVersion:'csv-message-v1'};
export const header='external_id,source_revision,occurred_at,text,role,customer_id,sku,conversation_id';
export const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
export function csvRow({id='syn-1',text='SYNTHETIC',role='customer',customer='',sku='',date='2026-09-01T00:00:00Z'}={}){return [id,'r1',date,text,role,customer,sku,'conversation-1'].map(quote).join(',');}
export function rejected(fn,code){assert.throws(fn,e=>{assert.equal(e.code,code,`REJECTION_REASON:${code}`);return true;},`EXPECTED_REJECTION:${code}`);}

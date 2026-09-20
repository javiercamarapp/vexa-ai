import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const candidate=path.resolve(process.env.VEXA_CANDIDATE??fileURLToPath(new URL('../../../..',import.meta.url)));
export const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC-ACCOUNT-A'};
export const token='SYNTHETIC-CC0-NOT-A-CREDENTIAL';
export const stamp='2026-09-20T00:00:00.000Z';
export async function implementation(){const file=path.join(candidate,'packages/connectors/index.mjs');assert.ok(fs.existsSync(file),'IMPLEMENTATION_MISSING: packages/connectors/index.mjs');assert.ok(!fs.lstatSync(file).isSymbolicLink(),'IMPLEMENTATION_SYMLINK');const m=await import(pathToFileURL(file).href);assert.equal(typeof m.createHubSpotAdapter,'function','HUBSPOT_ADAPTER_MISSING');return m;}
export const options={context,token,version:'v3',scopes:['conversations.read'],clock:()=>new Date(stamp),timeoutMs:500,maxRetries:0};
export const rootPath='/conversations/v3/conversations/threads';
export const thread=(id,extra={})=>({id,createdAt:stamp,archived:false,threadAssociations:{associatedTicketId:'9007199254740993123'},...extra});
export const message=(id,extra={})=>({id,conversationsThreadId:'T1',createdAt:stamp,updatedAt:stamp,type:'MESSAGE',text:'SYNTHETIC café',truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-123'}],...extra});
export const json=(res,body,status=200,headers={})=>{res.writeHead(status,{'content-type':'application/json',...headers});res.end(JSON.stringify(body));};
export async function server(handler,run){
 const seen=[],errors=[];const sockets=new Set();const srv=http.createServer((req,res)=>{const u=new URL(req.url,'http://127.0.0.1');seen.push({path:u.pathname,query:Object.fromEntries(u.searchParams),method:req.method});try{assert.equal(req.method,'GET','READ_ONLY');assert.equal(req.headers.authorization,`Bearer ${token}`,'AUTH_HEADER');handler(req,res,u,seen);}catch(e){errors.push(e);res.writeHead(500);res.end('{}');}});
 srv.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const fetcher=async(input,init)=>{const u=new URL(input);assert.equal(u.origin,'https://api.hubapi.com','PROVIDER_HOST_ALLOWLIST');assert.equal(init.method,'GET','READ_ONLY_FETCH');assert.equal(init.redirect,'manual','NO_REDIRECT_FOLLOW');assert.ok(init.signal instanceof AbortSignal,'ABORT_SIGNAL');const local=new URL(u.pathname+u.search,`http://127.0.0.1:${srv.address().port}`);const response=await fetch(local,init);return new Proxy(response,{get(target,key){if(key==='url')return u.href;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});};
 try{return await run(fetcher,seen);}finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>srv.close(resolve));if(errors.length)throw errors[0];}
}
export async function collect(adapter,opts){const pages=[];for await(const page of adapter.pages(opts))pages.push(page);return pages;}
export function code(expected){return error=>{assert.equal(error.code,expected,`ERROR_CODE:${expected}`);assert.ok(!JSON.stringify(error).includes(token),'SECRET_REDACTION');assert.ok(!String(error.stack).includes(token),'SECRET_STACK');return true;};}

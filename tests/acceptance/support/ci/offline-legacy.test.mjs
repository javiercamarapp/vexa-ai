import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canaries,inspectPublished} from './artifact-secrets.mjs';
import {isOfflineLegacyResponse} from './offline-legacy.mjs';
// Recorded from the real handlers with absent Auth configuration and poisoned fetch.
const cases=[
 ['/api/notifications/push',{error:{code:'push_request_failed',message:'No se pudo verificar la suscripción.',retryable:true},meta:{trace_id:'00000000-0000-4000-8000-000000000001'}}],
 ['/api/notifications/delivery',{error:{code:'delivery_policy_unavailable',message:'No se pudo verificar la política de envío con tus permisos actuales.'}}],
 ['/api/candidates',{error:{code:'candidates_unavailable',message:'No se pudo completar la gestión de candidatos.'}}],
 ['/api/history',{error:{code:'history_unavailable'}}],
 ['/api/recovery',{error:{code:'retention_unavailable'}}],
 ['/api/evaluation',{error:{code:'evaluation_configuration_required'}}],
 ['/api/platform',{error:{code:'platform_configuration_required'}}],
];
async function check(route,body,{mode=true,status=503,cache='private, no-store',type='application/json',malformed=false,headerSecret=false,bodySecret=false}={}){
 const fixture=canaries(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-offline-legacy-'));
 const server=createServer((req,res)=>{
  assert.equal(req.method,'GET');
  if(req.url===route){res.writeHead(status,{'content-type':type,'cache-control':cache,...(headerSecret?{'x-test-secret':fixture.server}:{})});res.end(malformed?'not json':JSON.stringify(bodySecret?{...body,secret:fixture.service}:body));}
  else{res.writeHead(200,{'content-type':'text/html'});res.end('<a href="'+route+'">fixture</a>');}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{return await inspectPublished(tmp,'http://127.0.0.1:'+server.address().port,fixture,{allowUnconfiguredImports:mode});}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
}
for(const [route,body] of cases){
 test('offline exact legacy response: '+route,()=>check(route,body));
 test('legacy exception retains route/status/configuration/cache/secret guards: '+route,async()=>{
  for(const options of [{mode:false},{status:500},{cache:'public, no-store'},{cache:'private, public, no-store'},{cache:'private'},{type:'text/html'},{malformed:true}])await assert.rejects(check(route,body,options),/PAGE_HTTP_STATUS/);
  for(const other of [route+'/other',route+'?tenant=x'])await assert.rejects(check(other,body),/PAGE_HTTP_STATUS/);
  for(const changed of [{...body,data:{}},{...body,extra:true},{...body,error:{...body.error,extra:true}},{...body,error:{...body.error,code:'database_unavailable'}},{...body,error:null},{...body,error:[]}])await assert.rejects(check(route,changed),/PAGE_HTTP_STATUS/);
  if(!body.meta)await assert.rejects(check(route,{...body,meta:{trace_id:'extra'}}),/PAGE_HTTP_STATUS/);
  for(const options of [{headerSecret:true},{bodySecret:true}])await assert.rejects(check(route,body,options),/CLIENT_SECRET_LEAK/);
 });
}
test('push trace/message/retryable remain exact; legacy shapes do not acquire missing fields',async()=>{
 const [route,body]=cases[0];
 for(const changed of [{error:body.error},{...body,meta:{trace_id:''}},{...body,meta:{trace_id:'not-a-uuid'}},{...body,meta:{...body.meta,extra:true}},{...body,error:{...body.error,retryable:false}},{...body,error:{...body.error,message:'other failure'}}])await assert.rejects(check(route,changed),/PAGE_HTTP_STATUS/);
 for(const [other,value] of cases.slice(1))await assert.rejects(check(other,{...value,error:{...value.error,retryable:true}}),/PAGE_HTTP_STATUS/);
});

test('legacy profile cannot excuse POST or a required artifact',()=>{
 for(const [route,envelope] of cases){
  const args={offline:true,required:false,method:'GET',url:new URL(route,'http://127.0.0.1'),status:503,contentType:'application/json',cache:'private, no-store',envelope};
  assert.equal(isOfflineLegacyResponse(args),true);
  for(const delta of [{method:'POST'},{method:'HEAD'},{required:true},{offline:false},{offline:1}])assert.equal(isOfflineLegacyResponse({...args,...delta}),false);
 }
});

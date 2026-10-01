import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createECDH,randomBytes} from 'node:crypto';
export function syntheticSubscription(label){
 const key=createECDH('prime256v1');key.generateKeys();const auth=randomBytes(16);
 return {privateKey:key,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/SYN305_'+label,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}}};
}
/** Real SDK encrypts; test-only socket adapter sends exclusively to our local Unix-socket TLS receiver. */
export async function localProvider(evidence){
 const cert=path.join(evidence,'SYN-local-cert.pem'),key=path.join(evidence,'SYN-local-key.pem');
 const r=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,'LOCAL_CERT_REQUIRED');fs.chmodSync(key,0o600);
 const socketDirectory=fs.mkdtempSync('/tmp/vexa-push305-'),socketPath=path.join(socketDirectory,'tls.sock');
 const calls=[],sockets=new Set();let respond=()=>({status:201});
 const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},async(req,res)=>{
  const chunks=[];for await(const bytes of req)chunks.push(bytes);const call={path:req.url,headers:req.headers,body:Buffer.concat(chunks)};calls.push(call);
  const result=respond(call,calls.length);if(result.hang)return;
  res.writeHead(result.status,result.headers??{});res.end('SYN local receiver');
 });server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});server.listen(socketPath);await once(server,'listening');
 return {socketPath,calls,activeConnections:()=>sockets.size,setResponse(fn){respond=fn;},request(url,options,callback){const parsed=new URL(url);assert.equal(parsed.origin,'https://fcm.googleapis.com');assert.ok(parsed.pathname.startsWith('/fcm/send/SYN305_'));return https.request('https://localhost'+parsed.pathname,{...options,socketPath,rejectUnauthorized:false},callback);},async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));fs.rmSync(key,{force:true});fs.rmSync(socketDirectory,{recursive:true,force:true});assert.equal(sockets.size,0,'LOCAL_TLS_SOCKETS_CLOSED');fs.writeFileSync(path.join(evidence,'local-provider-cleanup.json'),JSON.stringify({sockets:0,socketDirectoryAbsent:!fs.existsSync(socketDirectory),privateFixtureKeyAbsent:!fs.existsSync(key)}));}};
}

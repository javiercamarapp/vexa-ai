import http from 'node:http';
import assert from 'node:assert/strict';
const nativeFetch=globalThis.fetch;
export const origin='https://synthetic-vexa.zendesk.com';
export async function server(handler){
 const requests=[];const sockets=new Set();
 const s=http.createServer(async(req,res)=>{try{const u=new URL(req.url,origin);requests.push({path:u.pathname,query:Object.fromEntries(u.searchParams),method:req.method});const out=await handler(u,requests.length,req,res);if(out===undefined)return;res.writeHead(out.status??200,{'Content-Type':'application/json',...out.headers});res.end(JSON.stringify(out.body??out));}catch{res.writeHead(500);res.end('{}');}});
 s.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 return {requests,fetch:async(raw,init)=>{const u=new URL(raw);assert.equal(u.origin,origin,'AUTHORIZED_HOST');assert.equal(init.method,'GET','READ_ONLY');assert.equal(init.redirect,'manual','NO_REDIRECT');assert.match(init.headers.Authorization,/^Bearer SYNTHETIC/);const r=await nativeFetch(`http://127.0.0.1:${s.address().port}${u.pathname}${u.search}`,init);return new Response(r.body,{status:r.status,headers:r.headers});},close:async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>s.close(resolve));}};
}

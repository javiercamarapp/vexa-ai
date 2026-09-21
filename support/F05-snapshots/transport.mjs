import http from 'node:http';
import {createHash} from 'node:crypto';
export async function createDownloadProxy(target){
 const upstream=new URL(target);if(upstream.hostname!=='127.0.0.1'||upstream.protocol!=='http:')throw Error('LOCAL_TEST_TRANSPORT_ONLY');const sockets=new Set(),holds=new Map();
 const server=http.createServer((req,res)=>{const pending=holds.get(req.url);const forwarded=http.request({hostname:upstream.hostname,port:upstream.port,method:req.method,path:req.url,headers:req.headers},response=>{
  if(!pending){res.writeHead(response.statusCode,response.headers);response.pipe(res);return;}
  holds.delete(req.url);const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',async()=>{const body=Buffer.concat(chunks);pending.evidence={url:req.url,status:response.statusCode,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};res.writeHead(response.statusCode,response.headers);if(body.length)res.write(body.subarray(0,1));pending.markStarted();await pending.released;if(!res.destroyed)res.end(body.subarray(1));});
 });forwarded.on('error',()=>{res.destroy();});req.pipe(forwarded);});
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const all=new Set();
 return {port:server.address().port,hold(exactPath){if(holds.has(exactPath))throw Error('DUPLICATE_TRANSPORT_HOLD');let release,markStarted;const state={released:new Promise(r=>release=r),started:new Promise(r=>markStarted=r),expired:false,evidence:null};state.markStarted=markStarted;state.release=()=>{clearTimeout(state.timer);release();};state.timer=setTimeout(()=>{state.expired=true;state.release();},10000);holds.set(exactPath,state);all.add(state);return state;},async close(){for(const h of all)h.release();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}};
}

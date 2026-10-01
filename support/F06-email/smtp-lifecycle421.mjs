import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const bounded=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),5000);})]);}finally{clearTimeout(timer);}};
test('421 real SMTP signal cancellation owns only its socket while a concurrent send completes',{timeout:20000},async()=>{
 const {createMailpitSender}=await import(pathToFileURL(path.join(process.env.SYN421_RUNTIME,'packages/notifications/email.mjs')));
 let secondDataResolve,firstConnectedResolve;const firstConnected=new Promise(r=>firstConnectedResolve=r),secondData=new Promise(r=>secondDataResolve=r),sockets=new Set();let connections=0,secondSocket;
 const server=createServer(socket=>{const ordinal=++connections;sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));if(ordinal===1){firstConnectedResolve();return;}
  secondSocket=socket;socket.write('220 SYN local SMTP\r\n');let input='',data=false;
  socket.on('data',chunk=>{input+=chunk.toString();while(input.includes('\r\n')){const index=input.indexOf('\r\n'),line=input.slice(0,index);input=input.slice(index+2);if(data){if(line==='.'){data=false;secondDataResolve();}continue;}
   if(/^EHLO |^HELO /i.test(line))socket.write('250 SYN local SMTP\r\n');else if(/^MAIL FROM:|^RCPT TO:/i.test(line))socket.write('250 OK\r\n');else if(line==='DATA'){data=true;socket.write('354 End with dot\r\n');}else if(line==='QUIT'){socket.end('221 Bye\r\n');}else socket.write('250 OK\r\n');
  }});
 });
 server.listen(60825,'127.0.0.1');await once(server,'listening');
 try{
  const sender=createMailpitSender({port:60825}),message={from:'SYN-vexa@example.test',to:'SYN-recipient@example.test',subject:'SYN local lifecycle',text:'SYN only, no remote recipient'},aborted=new AbortController();aborted.abort();
  await assert.rejects(sender.sendMail(message,{signal:aborted.signal}));assert.equal(connections,0,'PRE_ABORT_NO_CONNECTION');
  const controller=new AbortController(),first=sender.sendMail(message,{signal:controller.signal}).then(value=>({ok:true,value}),error=>({ok:false,errorCode:error.code??'error'}));await bounded(firstConnected,'FIRST_SOCKET_CONNECT');
  const second=sender.sendMail(message);await bounded(secondData,'SECOND_DATA_RECEIVED');const abortAt=Date.now();controller.abort();const firstResult=await bounded(first,'FIRST_ABORT');assert.equal(firstResult.ok,false);assert.ok(Date.now()-abortAt<2000,'ABORT_BOUNDED');
  assert.equal(secondSocket.destroyed,false,'OTHER_SOCKET_STILL_OPEN');secondSocket.write('250 SYN accepted\r\n');const secondResult=await bounded(second,'SECOND_ACCEPTED');assert.deepEqual(secondResult.accepted,['SYN-recipient@example.test']);
  for(let n=0;n<100&&sockets.size;n++)await new Promise(r=>setTimeout(r,10));assert.equal(sockets.size,0,'ALL_ATTEMPT_SOCKETS_CLOSED');
  fs.writeFileSync(path.join(process.env.SYN421_EVIDENCE,'smtp-lifecycle421.json'),JSON.stringify({preabortConnections:0,connections,aborted:firstResult,otherAccepted:secondResult.accepted,socketsRemaining:sockets.size,localOnly:true},null,2));
 }finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});

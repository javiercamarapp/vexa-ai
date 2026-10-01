// Local CLI regression only; no DB, managed scheduling or production certification.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const target=resolve(process.argv[2]);
async function probe(name,behavior,options={}){
 let requests=0,out='',err='',timedOut=false,signalSent=false;
 const server=createServer((req,res)=>{requests++;behavior(req,res,requests,()=>child.kill(options.stopSignal??'SIGTERM'));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const start=performance.now();
 const child=spawn(process.execPath,[target,...(options.once?['--once']:[])],{env:{PATH:process.env.PATH,VEXA_WORKER_ENDPOINT:`http://127.0.0.1:${server.address().port}`,VEXA_WORKER_TRIGGER_SECRET:'SYN-LOCAL-ONLY',VEXA_WORKER_INTERVAL_MS:options.interval??'10000'},stdio:['ignore','pipe','pipe']});
 const pid=child.pid;
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},options.timeout??14000);
 child.stdout.on('data',d=>{out+=d;if(options.stopOnStatus&&!signalSent){signalSent=true;child.kill('SIGTERM');}});
 child.stderr.on('data',d=>err+=d);
 const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 clearTimeout(timer);server.closeAllConnections();await new Promise(r=>server.close(r));
 const duration=Math.round(performance.now()-start);
 const pass=options.expect({requests,out,err,timedOut,duration,...result});
 return {name,pass,pid,requests,duration,timedOut,...result,stdout:out,stderr:err};
}
const cases=await Promise.all([
 probe('tcp-recovery',(req,res,n,stop)=>{if(n===1)req.socket.destroy();else{res.end('SYN');setTimeout(stop,30);}}, {expect:r=>r.requests===2&&r.code===0&&!r.timedOut&&r.err.includes('worker_transport_error')}),
 probe('nan-rejected',(req,res)=>res.end('SYN'),{interval:'NaN',once:true,expect:r=>r.requests===0&&r.code!==0}),
 probe('sigterm-wait',(req,res)=>res.end('SYN'),{stopOnStatus:true,timeout:2000,expect:r=>r.code===0&&!r.timedOut&&r.requests===1}),
 probe('sigterm-inflight',(req,res,n,stop)=>setTimeout(stop,30),{timeout:2000,expect:r=>r.code===0&&!r.timedOut&&r.requests===1}),
 probe('once-http-failure',(req,res)=>{res.statusCode=503;res.end('SYN');},{once:true,expect:r=>r.code===1&&r.out.includes('worker_http_status=503')}),
 probe('sigint-inflight',(req,res,n,stop)=>setTimeout(stop,30),{stopSignal:'SIGINT',timeout:2000,expect:r=>r.code===0&&!r.timedOut&&r.requests===1}),
 probe('once-transport-failure',(req)=>req.socket.destroy(),{once:true,expect:r=>r.code===1&&r.err==='worker_transport_error\n'}),
 probe('infinity-rejected',(req,res)=>res.end('SYN'),{interval:'Infinity',once:true,expect:r=>r.requests===0&&r.code!==0}),
 probe('below-min-rejected',(req,res)=>res.end('SYN'),{interval:'9999',once:true,expect:r=>r.requests===0&&r.code!==0}),
 probe('above-max-rejected',(req,res)=>res.end('SYN'),{interval:'60001',once:true,expect:r=>r.requests===0&&r.code!==0}),
 probe('http-recovery',(req,res,n,stop)=>{res.statusCode=n===1?503:200;res.end('SYN-PRIVATE-BODY');if(n===2)setTimeout(stop,30);},{expect:r=>r.requests===2&&r.code===0&&!r.timedOut&&r.out.includes('worker_http_status=503')&&r.out.includes('worker_http_status=200')&&!r.out.includes('SYN-PRIVATE')}),
 probe('once-success',(req,res)=>res.end('SYN'),{once:true,expect:r=>r.code===0&&r.requests===1}),
]);
console.log(JSON.stringify({node:process.version,target,cases,passed:cases.filter(x=>x.pass).length,total:cases.length,cleanup:'all child exit events observed; loopback servers closed'},null,2));
process.exitCode=cases.every(x=>x.pass)?0:1;

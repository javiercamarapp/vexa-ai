import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
// Only targets the process group created by this call, never a shared shell/group.
export async function runGroup(command,args,{env,log,timeoutMs,graceMs=10000,onLine=()=>{}}){
 assert.ok(process.platform!=='win32','POSIX_PROCESS_GROUP_REQUIRED');assert.ok(Number.isFinite(timeoutMs)&&timeoutMs>0);assert.ok(Number.isFinite(graceMs)&&graceMs>0);
 const fd=fs.openSync(log,'wx',0o600),child=spawn(command,args,{env,detached:true,stdio:['ignore','pipe','pipe']});let timedOut=false,error=null,grace,pending='';
 const signal=kind=>{if(!child.pid)return;try{process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')error??=e.message;}};
 const fail=err=>{error??=err.message;signal('SIGTERM');grace??=setTimeout(()=>signal('SIGKILL'),graceMs);};
 child.on('error',e=>{error??=e.message;});
 child.stdout.on('data',bytes=>{try{fs.writeSync(fd,bytes);pending+=bytes.toString();const lines=pending.split('\n');pending=lines.pop();for(const line of lines)onLine(line);}catch(e){fail(e);}});
 child.stderr.on('data',bytes=>{try{fs.writeSync(fd,bytes);}catch(e){fail(e);}});
 const timer=setTimeout(()=>{timedOut=true;signal('SIGTERM');grace??=setTimeout(()=>signal('SIGKILL'),graceMs);},timeoutMs);
 try{const result=await new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));if(timedOut||error)signal('SIGKILL');return{pid:child.pid??null,...result,timedOut,error};}
 finally{clearTimeout(timer);clearTimeout(grace);fs.closeSync(fd);}
}

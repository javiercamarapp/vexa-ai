import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';import {createInterface} from 'node:readline';import {fileURLToPath} from 'node:url';
/** Reuses frozen SQL fixtures in the existing isolated database, without another build or database. */
export async function emailPreSend(t,h,evidence){
 const child=spawn('python3',['-u',fileURLToPath(new URL('./pre-send.py',import.meta.url))],{stdio:['pipe','pipe','pipe']});const ended=once(child,'exit');const results=[];let stderr='',timer;
 try{timer=setTimeout(()=>child.kill('SIGKILL'),180000);child.stderr.on('data',b=>{stderr+=b;});
  for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
   const message=JSON.parse(line);
   if(typeof message.sql==='string'){let result;try{result={returncode:0,stdout:h.sql(message.sql),stderr:''};}catch(error){result={returncode:1,stdout:'',stderr:error.message};}child.stdin.write(JSON.stringify(result)+'\n');}
   else{assert.ok(message.record,'SQL_CONTROL_PROTOCOL');results.push(message.record);await t.test('email pre-send '+message.record.name,()=>assert.equal(message.record.status,'PASS',message.record.error));}
  }
  const[code,signal]=await ended;assert.equal(code,0,stderr);assert.equal(signal,null);assert.equal(results.length,24);assert.ok(results.every(r=>r.status==='PASS'));
 }finally{clearTimeout(timer);child.stdin.end();if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await ended;}fs.writeFileSync(path.join(evidence,'email-pre-send.json'),JSON.stringify({results,stderr,childExited:child.exitCode!==null||child.signalCode!==null},null,2),{mode:0o600});}
}

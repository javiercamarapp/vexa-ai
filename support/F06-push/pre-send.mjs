import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';import {createInterface} from 'node:readline';import {fileURLToPath} from 'node:url';
/** Reuses frozen SQL fixtures in the existing isolated database, without another build or database. */
export async function pushPreSend(t,h,evidence){
 const child=spawn('python3',['-u',fileURLToPath(new URL('./pre-send.py',import.meta.url))],{stdio:['pipe','pipe','pipe']});const ended=once(child,'exit');const results=[];let stderr='',timer;
 try{timer=setTimeout(()=>child.kill('SIGKILL'),180000);child.stderr.on('data',b=>{stderr+=b;});
  for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
   const message=JSON.parse(line);
   if(message.rpc){
    const q=v=>"'"+String(v).replaceAll("'","''")+"'",r=message.rpc;let result;
    try{result=h.json(`BEGIN;CREATE TEMP TABLE push_exam_result(value jsonb);GRANT ALL ON push_exam_result TO vexa_backend;SELECT set_config('request.jwt.claim.sub',${q(r.user)},true) AS ignored \\gset
SELECT set_config('vexa.tenant_id',${q(r.tenant)},true) AS ignored \\gset
SELECT set_config('vexa.action',${q(r.action)},true) AS ignored \\gset
SET LOCAL ROLE vexa_backend;DO $probe$ DECLARE result jsonb;BEGIN BEGIN SELECT ${r.expression} INTO result;INSERT INTO push_exam_result VALUES(jsonb_build_object('code','00000','rows',result));EXCEPTION WHEN OTHERS THEN INSERT INTO push_exam_result VALUES(jsonb_build_object('code',SQLSTATE));END;END $probe$;RESET ROLE;SELECT value FROM push_exam_result;COMMIT;`);}catch(error){result={code:'INFRA_FAILURE',message:error.message};}
    child.stdin.write(JSON.stringify(result)+'\n');
   }
   else if(typeof message.sql==='string'){let result;try{result={returncode:0,stdout:h.sql(message.sql),stderr:''};}catch(error){result={returncode:1,stdout:'',stderr:error.message};}child.stdin.write(JSON.stringify(result)+'\n');}
   else{assert.ok(message.record,'SQL_CONTROL_PROTOCOL');results.push(message.record);await t.test('push pre-send '+message.record.name,()=>assert.equal(message.record.status,'PASS',message.record.error));}
  }
  const[code,signal]=await ended;assert.equal(code,0,stderr);assert.equal(signal,null);assert.equal(results.length,21);assert.ok(results.every(r=>r.status==='PASS'));
 }finally{clearTimeout(timer);child.stdin.end();if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await ended;}fs.writeFileSync(path.join(evidence,'push-pre-send.json'),JSON.stringify({results,stderr,childExited:child.exitCode!==null||child.signalCode!==null},null,2),{mode:0o600});}
}

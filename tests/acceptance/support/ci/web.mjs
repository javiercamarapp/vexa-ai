import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
import {canaries,inspectPublished,redact} from './artifact-secrets.mjs';
const candidate=process.argv[2];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-ci-web-'));
const fixture=canaries();
let child;
try {
 const pkg=JSON.parse(fs.readFileSync(path.join(candidate,'apps/web/package.json')));
 for(const [key,value] of Object.entries({lint:'eslint . --max-warnings=0',typecheck:'next typegen && tsc --noEmit',build:'next build --webpack'}))assert.equal(pkg.scripts[key],value,'WEB_SCRIPT_CONTRACT:'+key);
 for(const [key,value] of Object.entries({next:'16.3.5',typescript:'5.9.3',eslint:'9.39.4'}))assert.equal({...pkg.dependencies,...pkg.devDependencies}[key],value,'WEB_TOOL_VERSION');
 copyBuildInputs(candidate,tmp);const env=buildEnvironment(process.env,tmp);const cwd=path.join(tmp,'apps/web');
 env.SUPABASE_SERVICE_ROLE_KEY=fixture.service;env.VEXA_SERVER_ONLY_CANARY=fixture.server;
 fs.mkdirSync(path.join(cwd,'public'),{recursive:true});
 const publicName=`ci-public-${fixture.nonce}.txt`;
 fs.writeFileSync(path.join(cwd,'public',publicName),fixture.anon,{mode:0o600});
 const run=(bin,args,where=cwd)=>{const r=spawnSync(bin,args,{cwd:where,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});process.stdout.write(redact(r.stdout??'',fixture));process.stderr.write(redact(r.stderr??'',fixture));assert.ok(!r.error&&r.status===0,`WEB_CHILD_EXIT:${r.status??r.error?.code}`);};
 run('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],tmp);
 // Unit/HTTP tests come from control; imports resolve to the copied candidate product.
 const control=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
 for(const rel of ['apps/web/tests/auth-http.test.ts','packages/platform/tests/session.test.ts'])fs.copyFileSync(path.join(control,rel),path.join(tmp,rel));
 run(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap','tests/session.test.ts'],path.join(tmp,'packages/platform'));
 run(process.execPath,['--import','tsx','--test','--test-reporter=tap','tests/auth-http.test.ts']);
 const tool=(file,args)=>run(process.execPath,[path.join(tmp,'node_modules',file),...args]);
 tool('next/dist/bin/next',['typegen']);tool('typescript/bin/tsc',['--noEmit']);tool('eslint/bin/eslint.js',['.','--max-warnings=0']);tool('next/dist/bin/next',['build','--webpack']);
 assert.ok(fs.readFileSync(path.join(cwd,'.next/BUILD_ID'),'utf8').trim());
 // Production smoke: real build, own ephemeral loopback port, no external service credentials.
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd,env,stdio:'ignore'});
 let ok=false;for(let i=0;i<100;i++){assert.equal(child.exitCode,null,'BUILD_START_EXIT');try{const r=await fetch(`http://127.0.0.1:${port}/api/health/version`,{redirect:'manual',signal:AbortSignal.timeout(1000)});if(r.status===200){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ok,'BUILD_API_HEALTH');
 console.log('BUILD_API_HEALTH:200');
 const origin=`http://127.0.0.1:${port}`;
 const result=await inspectPublished(cwd,origin,fixture);
 const publicResponse=await fetch(`${origin}/${publicName}`,{signal:AbortSignal.timeout(10000)});
 assert.ok(publicResponse.status===200 && await publicResponse.text()===fixture.anon,'PUBLIC_ANON_CONTROL');
 console.log('CLIENT_ARTIFACTS_CLEAN:'+JSON.stringify(result));
}finally{if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}fs.rmSync(tmp,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildEnvironment} from '../../scaffold-copy.mjs';
import {resourceBroker} from '../ci/resources.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export function command(bin,args,options={}){
 const r=spawnSync(bin,args,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,...options});
 assert.ok(!r.error&&r.status===0,`SETUP ${bin}: ${r.status??r.error?.code}\n${r.stderr??''}\n${r.stdout??''}`);return r.stdout;
}
export function inputs(candidate){
 assert.ok(candidate,'VEXA_CANDIDATE explícito obligatorio');
 const choose=(files,label)=>{const found=files.find(f=>fs.existsSync(path.join(candidate,f)));assert.ok(found,'IMPLEMENTATION_MISSING: '+label);return found;};
 return {
 state:choose(['apps/web/src/components/workspace/data-state.tsx','apps/web/src/components/data-state.tsx'],'DataState'),
 navigation:choose(['apps/web/src/components/workspace/navigation.tsx','apps/web/src/components/navigation.tsx'],'Navigation'),
 };
}
function copy(src,dest){
 assert.ok(!fs.lstatSync(src).isSymbolicLink(),'SETUP symlink input');
 if(fs.statSync(src).isDirectory()){
  fs.mkdirSync(dest,{recursive:true});for(const name of fs.readdirSync(src)){
   if(['.git','.next','node_modules','private','.runtime'].includes(name)||name.startsWith('.env'))continue;
   copy(path.join(src,name),path.join(dest,name));
  }
 }else fs.copyFileSync(src,dest);
}
export async function prepare(candidate,{proposal=false}={}){
 assert.ok(candidate,'VEXA_CANDIDATE explícito obligatorio');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f01-04-'));
 const broker=resourceBroker();
 const h={tmp,child:null,container:'vexa-f01-04-'+randomUUID()+'-browser'};
 h.close=async()=>{if(h.child){h.child.kill('SIGTERM');await new Promise(r=>setTimeout(r,300));if(h.child.exitCode===null)h.child.kill('SIGKILL');}if(h.browserReserved)broker.remove('container',h.container);};
 try{
  for(const rel of ['package.json','package-lock.json','apps','packages'])if(fs.existsSync(path.join(candidate,rel)))copy(path.join(candidate,rel),path.join(tmp,rel));
  if(proposal){
   // Explicit read-only source allowlist. This is a component oracle probe, NOT a product candidate.
   const source='/Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/integrated/apps/web/src/components/workspace';
   const dest=path.join(tmp,'apps/web/src/components/workspace');fs.mkdirSync(dest,{recursive:true});
   for(const name of ['navigation.tsx','data-state.tsx'])fs.copyFileSync(path.join(source,name),path.join(dest,name));
  }
  h.inputs=inputs(tmp);
  if(proposal){const rel='apps/web/src/lib/workspace/contracts.ts';fs.mkdirSync(path.dirname(path.join(tmp,rel)),{recursive:true});fs.copyFileSync('/Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/integrated/'+rel,path.join(tmp,rel));}
h.env={...buildEnvironment(process.env,tmp),WATCHPACK_POLLING:'500'};
  command('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:tmp,env:h.env});
  // A test-only mounting route, never implements state handling, navigation or authorization.
  const dir=path.join(tmp,'apps/web/src/app/exam-f01-04');fs.mkdirSync(dir,{recursive:true});
  const state='../../'+h.inputs.state.split('src/')[1].replace(/\.tsx$/,'');
  const nav='../../'+h.inputs.navigation.split('src/')[1].replace(/\.tsx$/,'');
  fs.writeFileSync(path.join(dir,'page.tsx'),`import {randomUUID} from 'node:crypto';\nimport {parseScope} from '../../lib/workspace/contracts';\nimport {DataState} from '${state}';\nimport {Navigation} from '${nav}';\nexport default async function Exam({searchParams}:{searchParams:Promise<Record<string,string>>}){const q=await searchParams;const kind=q.kind;const query=new URLSearchParams();for(const [k,v] of Object.entries(q))if(k!=='kind')for(const x of Array.isArray(v)?v:[v])query.append(k,x);let invalid:any;try{parseScope(query)}catch(e){invalid=e;}const state:any=invalid?{kind:'error',message:'Alcance inválido. Revisa los filtros.',code:invalid.code}:kind==='error'?{kind,message:'SYN_DATABASE_UNAVAILABLE',code:'SYN_ERROR'}:['partial','stale','ready'].includes(kind)?{kind,coverage:'SYN_COVERAGE',watermark:'2026-09-01T00:00:00Z'}:{kind};return <><Navigation/><div id="exam-state" data-render={randomUUID()}><DataState state={state}><p>SYN_AUTHORIZED_CHILD</p></DataState></div></>;}`);
  h.start=async(extra={})=>{
   await new Promise((resolve,reject)=>{const socket=net.createServer();socket.once('error',reject);socket.listen(57560,'0.0.0.0',()=>socket.close(resolve));});
   const log=fs.openSync(path.join(tmp,'next.log'),'a');
   h.child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','0.0.0.0','--port','57560'],{cwd:path.join(tmp,'apps/web'),env:{...h.env,...extra},stdio:['ignore',log,log]});fs.closeSync(log);
   for(let i=0;i<100;i++){
    assert.equal(h.child.exitCode,null,'SETUP own Next exited: '+fs.readFileSync(path.join(tmp,'next.log'),'utf8').slice(-4000));
    try{const r=await fetch('http://127.0.0.1:57560/exam-f01-04?kind=ready',{signal:AbortSignal.timeout(1000)});if(r.status===200)return;}catch{}
    await new Promise(r=>setTimeout(r,200));
   }assert.fail('SETUP Next render unavailable: '+fs.readFileSync(path.join(tmp,'next.log'),'utf8').slice(-4000));
  };
  const browserLabels=broker.reserve('container',h.container);h.browserReserved=true;
  command('docker',['run','--pull','never','-d','--name',h.container,...browserLabels,'--add-host','host.docker.internal:host-gateway','--entrypoint','sleep','mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492','900']);h.browserStarted=true;
  // Container-local loopback bridge preserves the application's allowed localhost origin.
  command('docker',['exec','-d',h.container,'node','-e',"require('node:net').createServer(s=>{const u=require('node:net').connect(57560,'host.docker.internal');s.on('error',()=>u.destroy());u.on('error',()=>s.destroy());s.pipe(u);u.pipe(s);}).listen(57560,'127.0.0.1')"]);
  command('docker',['cp',path.join(here,'browser.cjs'),h.container+':/tmp/browser.cjs']);
  h.browser=mode=>{
   const r=spawnSync('docker',['exec',h.container,'node','/tmp/browser.cjs',mode],{encoding:'utf8',timeout:150000,maxBuffer:4*1024*1024});
   fs.appendFileSync(path.join(tmp,'browser.log'),r.stdout+r.stderr);return r;
  };
  h.screenshots=()=>{const dest=path.join(tmp,'screenshots');fs.mkdirSync(dest,{recursive:true});for(const name of command('docker',['exec',h.container,'sh','-c','ls /tmp/*.png']).trim().split('\n'))command('docker',['cp',h.container+':'+name,dest]);};
  return h;
 }catch(e){await h.close();throw e;}
}
export async function components(h){const r=h.browser('components');assert.ok(!r.error,'BROWSER_SETUP:'+r.error);assert.equal(r.status,0,r.stdout+r.stderr);h.screenshots();}

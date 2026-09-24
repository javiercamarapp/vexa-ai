import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {privateJson,check,fail,validate} from './contract.mjs';import {runSmoke} from './runner.mjs';
export async function main(argv=process.argv.slice(2)){
 const flags={};for(let i=0;i<argv.length;i+=2){check(['--release','--authorization','--config','--out','--cdp'].includes(argv[i])&&!flags[argv[i]]&&argv[i+1],'ARGUMENTS_INVALID');flags[argv[i]]=argv[i+1];}
 for(const name of ['--release','--authorization','--config','--out'])check(path.isAbsolute(flags[name]??''),'ABSOLUTE_PATHS_REQUIRED');
 const out=flags['--out'];await fs.mkdir(out,{mode:0o700});let browser;
 try{const [release,authorization,config]=await Promise.all(['--release','--authorization','--config'].map(k=>privateJson(flags[k])));validate(release,authorization,config);let chromium;try{({chromium}=await import('playwright-core'));}catch{fail('PLAYWRIGHT_CORE_REQUIRED',true);}
  if(flags['--cdp']){const u=new URL(flags['--cdp']);check(['http:','ws:'].includes(u.protocol)&&['localhost','127.0.0.1'].includes(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash,'LOCAL_BROWSER_ENDPOINT_REQUIRED');browser=await chromium.connectOverCDP(flags['--cdp']);}else browser=await chromium.launch({headless:true});
  return await runSmoke({release,authorization,config,out,browser});
 }catch(e){const report={schema:'vexa-release-smoke-v1',status:e.blocked?'blocked':'fail',error:{code:e.code??'SMOKE_SETUP_FAILED'}};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;}finally{await browser?.close();}
}
if(process.argv[1]&&await fs.realpath(process.argv[1]).catch(()=>null)===await fs.realpath(fileURLToPath(import.meta.url))){try{const r=await main();process.stdout.write(JSON.stringify({status:r.status})+'\n');process.exitCode=r.status==='pass'?0:r.status==='blocked'?2:1;}catch{process.stderr.write('SMOKE_INPUT_OR_OUTPUT_INVALID\n');process.exitCode=1;}}

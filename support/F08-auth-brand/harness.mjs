// Author-only local composition of the accepted Auth infrastructure. No cloud calls.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {catalog,render} from './templates.mjs';
export async function setup(candidate,evidence){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-auth-brand373-'));
 const origin=new URL('../../tests/acceptance/support/F01-02/',import.meta.url);
 const relocate=(text,base)=>text.replace(/from '([^']+)'/g,(all,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):all);
 let infra=relocate(fs.readFileSync(new URL('infra.mjs',origin),'utf8'),new URL('infra.mjs',origin));
 for(let i=0;i<4;i++)infra=infra.replaceAll(String(57570+i),String(64600+i));
 infra=infra.replace("extra=[])=>{","extra=[],command=[])=>{").replace('...extra,image]);return name;', '...extra,image,...command]);return name;');
 const html=Object.fromEntries(catalog.map(item=>[item.id,render(item)]));
 const server=`const http=require('node:http');const templates=${JSON.stringify(html)};http.createServer((req,res)=>{const body=templates[req.url.slice(1)];res.writeHead(body?200:404,{'content-type':'text/html; charset=utf-8'});res.end(body??'missing');}).listen(8026,'0.0.0.0');`;
 const marker="  run('auth',images.auth,";
 assert.ok(infra.includes(marker));
 infra=infra.replace(marker,`  const templateFile=path.join(tmp,'templates.cjs');fs.writeFileSync(templateFile,${JSON.stringify(server)});run('templates',images.node,{},[],['--mount',\`type=bind,src=\${templateFile},dst=/tmp/templates.cjs,readonly\`,'--entrypoint','node'],['/tmp/templates.cjs']);\n`+marker);
 const vars=catalog.flatMap(item=>[`GOTRUE_MAILER_TEMPLATES_${item.id.toUpperCase()}: 'http://'+owner+'-templates:8026/${item.id}'`,`GOTRUE_MAILER_SUBJECTS_${item.id.toUpperCase()}: ${JSON.stringify(item.subject)}`,...(item.notice?[`GOTRUE_MAILER_NOTIFICATIONS_${item.event.toUpperCase()}_ENABLED:true`]:[])]).join(',');
 infra=infra.replace("GOTRUE_SMTP_SENDER_NAME:'Synthetic Auth'",`GOTRUE_SMTP_SENDER_NAME:'SYN VEXA',${vars}`);
 fs.writeFileSync(path.join(dir,'infra.mjs'),infra);
 let harness=relocate(fs.readFileSync(new URL('harness.mjs',origin),'utf8'),new URL('harness.mjs',origin));
 harness=harness.replace("const support = path.dirname(new URL(import.meta.url).pathname);",'const support = '+JSON.stringify(new URL(origin).pathname)+';');
 harness=harness.replace(JSON.stringify(new URL('infra.mjs',origin).href),JSON.stringify(pathToFileURL(path.join(dir,'infra.mjs')).href));
 for(let i=0;i<4;i++)harness=harness.replaceAll(String(57570+i),String(64600+i));
 harness=harness.replace("NEXT_PUBLIC_SITE_URL:origin};","NEXT_PUBLIC_SITE_URL:origin,VEXA_EMAIL_AUTH_ENABLED:'true',VEXA_GOOGLE_AUTH_ENABLED:'true',VEXA_TEAM_AUTH_URL:authURL,VEXA_TEAM_AUTH_ADMIN_KEY:h.secret};");
 harness=harness.replace('export function command(bin,args,opts={}) {',"export function command(bin,args,opts={}) { if(opts.env)opts={...opts,env:{...opts.env,PATH:path.dirname(process.execPath)+':'+opts.env.PATH}};");
 harness=harness.replace("command('npm',['run','build','--workspace','apps/web'],{cwd:build,env,timeout:90000});","command('npm',['run','lint','--workspace','apps/web'],{cwd:build,env,timeout:90000});command('npm',['run','test:auth','--workspace','apps/web'],{cwd:build,env,timeout:90000});command('npm',['run','build','--workspace','apps/web'],{cwd:build,env,timeout:90000});command('npm',['run','typecheck','--workspace','apps/web'],{cwd:build,env,timeout:90000});");
 // Keep command logs for both failed and successful checks, without synthetic Auth secrets.
 harness=harness.replace("  // Do not expose stdout/stderr: commands can contain synthetic Auth secrets.",`  if(bin==='npm')fs.appendFileSync(${JSON.stringify(path.join(evidence,'build.log'))},JSON.stringify(args)+'\\n'+(r.stdout+r.stderr).replace(/eyJ[A-Za-z0-9_.-]+/g,'[JWT]')+'\\n',{mode:0o600});\n  // Do not expose stdout/stderr: commands can contain synthetic Auth secrets.`);
 fs.writeFileSync(path.join(dir,'harness.mjs'),harness);
 const module=await import(pathToFileURL(path.join(dir,'harness.mjs')));
 let h;
 try{h=await module.local(candidate);await module.startApp(h,candidate);}
 catch(error){if(h){await h.stopApp?.();await h.close();}fs.rmSync(dir,{recursive:true,force:true});throw error;}
 return {...h,module,origin:'http://127.0.0.1:64600',mailURL:'http://127.0.0.1:64602',async close(){await h.stopApp?.();await h.close();fs.cpSync(h.infra.artifacts,path.join(evidence,'infra'),{recursive:true});fs.rmSync(dir,{recursive:true,force:true});}};
}

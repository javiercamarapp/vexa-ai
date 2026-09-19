// External, synthetic-only exam machinery. Never an implementation of VEXA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync, spawn} from 'node:child_process';
import {randomUUID,createHmac} from 'node:crypto';
import {once} from 'node:events';
import net from 'node:net';
import {buildEnvironment} from '../../scaffold-copy.mjs';
import {redirectOracle} from './oracles.mjs';

export const origin = 'http://127.0.0.1:3640';
export const authURL = 'http://127.0.0.1:56321';
const support = path.dirname(new URL(import.meta.url).pathname);
export function command(bin,args,opts={}) {
  const r=spawnSync(bin,args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,...opts});
  // Do not expose stdout/stderr: commands can contain synthetic Auth secrets.
  assert.ok(!r.error && r.status===0, `SETUP: ${bin} failed (${r.status ?? r.error?.code}); no acceptance result`);
  return r.stdout;
}
export function sql(query) {
  return command('docker',['exec','-i','supabase_db_vexa-local','psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query});
}
export async function local(candidate) {
  assert.ok(candidate,'SETUP: VEXA_CANDIDATE must identify the real candidate');
  assert.match(fs.readFileSync(path.join(candidate,'supabase/config.toml'),'utf8'),/^project_id\s*=\s*"vexa-local"$/m);
  const identity=command('docker',['inspect','supabase_db_vexa-local','--format','{{ index .Config.Labels "com.supabase.cli.project" }} {{ (index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort }}']).trim();
  assert.equal(identity,'vexa-local 56322','SETUP: wrong local project; refusing fixture writes');
  const gateway=JSON.parse(command('docker',['inspect','supabase_kong_vexa-local']))[0];
  assert.equal(gateway.Config.Labels['com.supabase.cli.project'],'vexa-local');
  assert.equal(gateway.NetworkSettings.Ports['8000/tcp']?.[0]?.HostPort,'56321','SETUP: wrong gateway port');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f01-02-'));
  const cleanup=()=>fs.rmSync(tmp,{recursive:true,force:true});
  try {
    // Status runs from our config-only temporary, never reads a candidate .env.
    fs.mkdirSync(path.join(tmp,'supabase'));
    fs.copyFileSync(path.join(candidate,'supabase/config.toml'),path.join(tmp,'supabase/config.toml'));
    const env=buildEnvironment(process.env,tmp);
    // Read only this project's local gateway keys in-process. The installed CLI
    // writes global telemetry even for status, so it is not used by this gate.
    const auth=JSON.parse(command('docker',['inspect','supabase_auth_vexa-local']))[0];
    assert.equal(auth.Config.Labels['com.supabase.cli.project'],'vexa-local');
    const signingKey=auth.Config.Env.find(e=>e.startsWith('GOTRUE_JWT_SECRET='))?.slice('GOTRUE_JWT_SECRET='.length);
    assert.ok(signingKey,'SETUP: local Auth signing key unavailable');
    const sign=claims=>{
      const input=[{alg:'HS256',typ:'JWT'},claims].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
      return input+'.'+createHmac('sha256',signingKey).update(input).digest('base64url');
    };
    // Privileged setup only; actual user sessions below are issued by Auth.
    const keyFor=role=>sign({iss:'supabase',role,exp:Math.floor(Date.now()/1000)+600});
    const status={API_URL:authURL,ANON_KEY:keyFor('anon'),SERVICE_ROLE_KEY:keyFor('service_role')};
    assert.equal(status.API_URL,authURL,'SETUP: local API must be 56321');
    assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY,'SETUP: local synthetic Auth keys unavailable');
    for(const f of ['package.json','package-lock.json']) fs.copyFileSync(path.join(support,f),path.join(tmp,f));
    command('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:tmp,env,timeout:60000});
    const require=createRequire(path.join(tmp,'package.json'));
    const {createClient}=require('@supabase/supabase-js');
    const {createServerClient}=require('@supabase/ssr');
    const {chromium}=require('playwright-core');
    const client=createClient(authURL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(authURL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const users=[];
    return {tmp,env,client,admin,createServerClient,chromium,anon:status.ANON_KEY,secret:status.SERVICE_ROLE_KEY,
      signedClockSession(session,expired){
        const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
        // Explicit synthetic expiry probe signed by this local issuer's key.
        // Not claimed to be an naturally expired OAuth round trip.
        const exp=Math.floor(Date.now()/1000)+(expired?-3600:300);
        return {...session,access_token:sign({...claims,iat:Math.floor(Date.now()/1000)-7200,exp}),refresh_token:'',expires_at:exp};
      },
      async user(){
        const email=`f01-02-${randomUUID()}@example.test`, password=`SYN-${randomUUID()}!`;
        const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
        assert.ok(!error && data.user?.id,'SETUP: local synthetic user creation failed');
        users.push(data.user.id);
        const result=await client.auth.signInWithPassword({email,password});
        assert.ok(!result.error && result.data.session,'SETUP: real local password login failed');
        return {...result.data,userId:data.user.id,email};
      },
      async close(){
        const errors=[];
        for(const id of users){const {error}=await admin.auth.admin.deleteUser(id);if(error)errors.push(id);}
        cleanup(); assert.equal(errors.length,0,'TEARDOWN: could not remove own synthetic Auth users');
      }
    };
  }catch(error){cleanup();throw error;}
}

export function denied(status,location) {
  assert.ok(status===401 || ([302,303,307,308].includes(status) && location && new URL(location,origin).origin===origin && new URL(location,origin).pathname==='/login'),
    'AUTH_REJECT: invalid session must receive 401 or local login redirect');
}
export function tamper(token) {
  const parts=token.split('.');
  // Change a significant signature byte, keeping the actual signed claims intact.
  parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  return parts.join('.');
}
export async function signatureOracle(read,valid) {
  assert.equal(await read(valid),true,'AUTH_POSITIVE: genuine local token must authenticate');
  assert.equal(await read(tamper(valid)),false,'AUTH_SIGNATURE: altered signature must be rejected');
}

export async function startApp(h,candidate) {
  const build=path.join(h.tmp,'candidate');fs.mkdirSync(build);
  // Only tracked build inputs; excludes ignored credentials and candidate artifacts.
  const tracked=command('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:candidate}).split('\0').filter(Boolean);
  for(const rel of tracked.filter(x=>/^(apps\/|packages\/|package(?:-lock)?\.json$)/.test(x))){
    if(rel.split('/').some(x=>['node_modules','.next'].includes(x)||/^\.env(?:\.|$)/.test(x)))continue;
    const src=path.join(candidate,rel);assert.ok(!fs.lstatSync(src).isSymbolicLink(),'SETUP: symlink build input');
    fs.mkdirSync(path.dirname(path.join(build,rel)),{recursive:true});fs.copyFileSync(src,path.join(build,rel));
  }
  const env={...buildEnvironment(process.env,build),NEXT_PUBLIC_SUPABASE_URL:authURL,NEXT_PUBLIC_SUPABASE_ANON_KEY:h.anon,
    SUPABASE_URL:authURL,SUPABASE_ANON_KEY:h.anon,NEXT_PUBLIC_SITE_URL:origin};
  command('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:build,env,timeout:60000});
  command('npm',['run','build','--workspace','apps/web'],{cwd:build,env,timeout:90000});
  await new Promise((resolve,reject)=>{
    const check=net.createServer();
    check.once('error',()=>reject(new Error('SETUP: localhost VEXA 3640 is occupied; will not reuse or stop its owner')));
    check.listen(3640,'127.0.0.1',()=>check.close(resolve));
  });
  const child=spawn(process.execPath,[path.join(build,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3640'],{cwd:path.join(build,'apps/web'),env,stdio:'ignore'});
  h.stopApp=async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null){child.kill('SIGKILL');await once(child,'exit');}};
  let ready=false;
  for(let i=0;i<80;i++){
    assert.equal(child.exitCode,null,'SETUP: own Next server exited; port may be occupied');
    try{const r=await fetch(`${origin}/api/health/version`,{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'SETUP: own Next server not ready');
}

export async function login(h,context,email,next='/') {
  const jar=new Map();
  const ssr=h.createServerClient(authURL,h.anon,{auth:{flowType:'pkce'},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>jar.set(c.name,c.value))}});
  const result=await ssr.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:`${origin}/auth/callback?next=${encodeURIComponent(next)}`}});
  assert.ok(!result.error,'SETUP: local PKCE OTP request failed');
  let link;
  for(let i=0;i<50 && !link;i++){
    const response=await fetch('http://127.0.0.1:56324/api/v1/messages',{signal:AbortSignal.timeout(3000)});
    assert.equal(response.status,200,'SETUP: local Mailpit unavailable');
    const list=await response.json();
    const msg=list.messages?.find(m=>m.To?.some(t=>t.Address===email));
    if(msg){
      const mail=await (await fetch(`http://127.0.0.1:56324/api/v1/message/${encodeURIComponent(msg.ID)}`)).json();
      link=(mail.Text+' '+mail.HTML).match(/https?:\/\/[^\s<>"']+\/auth\/v1\/verify\?[^\s<>"']+/)?.[0]?.replaceAll('&amp;','&');
    }
    if(!link)await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(link,'SETUP: local Mailpit did not deliver a real PKCE verification link');
  assert.equal(new URL(link).origin,authURL,'SETUP: refusing non-VEXA verification link');
  const verified=await fetch(link,{redirect:'manual',signal:AbortSignal.timeout(5000)});
  const callback=new URL(verified.headers.get('location') || '/',origin);
  assert.equal(callback.origin,origin);assert.equal(callback.pathname,'/auth/callback');
  assert.ok(callback.searchParams.get('code'),'SETUP: Auth did not issue a real callback code');
  callback.searchParams.set('next',next);
  await context.addCookies([...jar].map(([name,value])=>({name,value,url:origin,sameSite:'Lax'})));
  // APIRequestContext shares browser cookies, but does not follow unsafe redirects.
  const response=await context.request.get(callback.href,{maxRedirects:0});
  assert.ok([302,303,307,308].includes(response.status()),'CALLBACK_SUCCESS: valid code must redirect');
  const dest=new URL(response.headers().location || '',origin);
  assert.equal(dest.origin,origin,'REDIRECT_ORIGIN: successful callback escaped VEXA');
  assert.notEqual(dest.pathname,'/login','CALLBACK_SUCCESS: valid code fell back to login');
  redirectOracle(next,dest.href,origin);
  const cookies=(await context.cookies()).filter(c=>/-auth-token(?:\.\d+)?$/.test(c.name))
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  assert.ok(cookies.length,'CALLBACK_SESSION: successful callback did not set an SSR session');
  const encoded=cookies.map(c=>c.value).join('');
  assert.ok(encoded.startsWith('base64-'),'SETUP: SSR cookie encoding changed');
  const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url'));
  const checked=await h.client.auth.getUser(session.access_token);
  assert.ok(!checked.error && checked.data.user?.email===email,'CALLBACK_SESSION: callback did not authenticate the intended local user');
  return dest.href;
}

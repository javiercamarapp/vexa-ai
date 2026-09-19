/** Real Next HTTP responses with synthetic public config; no Supabase or browser calls. Run after build. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
for (const configured of [false,true]) test(`served form headers (configured=${configured})`,{timeout:30000},async()=>{
  const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL','VEXA_GOOGLE_AUTH_ENABLED'])delete env[key];
  if(configured)Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:56321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key',NEXT_PUBLIC_SITE_URL:'http://localhost:3000',VEXA_GOOGLE_AUTH_ENABLED:'true'});
  const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']});
  const ended=once(server,'exit');
  try {
    const base=await new Promise((resolve,reject)=>{
      let output='';const timer=setTimeout(()=>reject(new Error(`Next startup timeout: ${output}`)),20000);
      const read=chunk=>{output+=chunk.toString();const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match && /Ready in/.test(output)){clearTimeout(timer);resolve(match[0]);}};
      server.stdout.on('data',read);server.stderr.on('data',read);
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Next exited ${code}: ${output}`));});
    });
    for(const path of configured?['/login']:['/login','/']){
      const response=await fetch(base+path);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('referrer-policy'),'same-origin');
      assert.match(response.headers.get('cache-control'),/no-store/);
      const html=await response.text();
      if(configured){assert.match(html,/action="\/auth\/google"/);assert.match(html,/action="\/auth\/logout"/);assert.match(html,/method="post"/);}
    }
  } finally {if(server.exitCode===null && server.signalCode===null)server.kill('SIGTERM');await ended;}
});

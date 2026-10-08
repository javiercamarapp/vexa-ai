import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertOfflineBuild} from './offline-environment.mjs';
test('offline guard rejects each configuration input including partial and empty site',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-offline-env-'));fs.mkdirSync(path.join(root,'apps/web'),{recursive:true});
 try{
  assertOfflineBuild({PATH:'/synthetic',VEXA_SERVER_ONLY_CANARY:'SYN'},root);
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL','VEXA_DATABASE_URL','VEXA_IMPORT_CONFIRMATION_SECRET'])
   for(const value of ['SYN',''])assert.throws(()=>assertOfflineBuild({[key]:value},root),/OFFLINE_SMOKE_MUST_BE_UNCONFIGURED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('dotenv files in repository or Next workspace cannot configure the offline child',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-offline-files-'));fs.mkdirSync(path.join(root,'apps/web'),{recursive:true});
 try{
  for(const directory of [root,path.join(root,'apps/web')])for(const name of ['.env','.env.local','.env.production','.env.production.local','.ENV','.ENV.production']){
   const file=path.join(directory,name);fs.writeFileSync(file,'NEXT_PUBLIC_SITE_URL=https://synthetic.invalid\n');
   assert.throws(()=>assertOfflineBuild({},root),/OFFLINE_DOTENV_FORBIDDEN/);fs.unlinkSync(file);
  }
  assertOfflineBuild({},root);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

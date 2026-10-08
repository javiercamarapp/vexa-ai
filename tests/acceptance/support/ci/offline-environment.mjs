import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export function assertOfflineBuild(environment,root){
 for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL','VEXA_DATABASE_URL','VEXA_IMPORT_CONFIRMATION_SECRET'])
  assert.equal(environment[key],undefined,'OFFLINE_SMOKE_MUST_BE_UNCONFIGURED:'+key);
 // Next loads dotenv files independently of the child process's initial env.
 for(const directory of [root,path.join(root,'apps/web')])
  for(const name of fs.readdirSync(directory))
   assert.ok(!name.toLowerCase().startsWith('.env'),'OFFLINE_DOTENV_FORBIDDEN:'+name);
}

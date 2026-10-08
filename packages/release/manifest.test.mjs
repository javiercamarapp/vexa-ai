import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReleaseManifest,main} from './manifest.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
test('real clean Git inventory binds commit/locks/migrations, ignores secret values and never certifies release',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'vexa-release-test-')),root=join(folder,'source');await mkdir(root);
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();
 try{
  const files={'.gitignore':'.env\n','package-lock.json':'{"lockfileVersion":3}\n','apps/web/next.config.ts':'export default {};\n','apps/web/src/app/api/health/version/route.ts':'export const revision=process.env.VEXA_COMPILED_REVISION;\n','packages/runtime.mjs':'export const config=env.VEXA_SERVER_TEST;\n','supabase/migrations/0001_test.sql':'select 1;\n'};
  for(const [name,content] of Object.entries(files)){await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),content);}
  git('init','--quiet');git('add','.');git('commit','--quiet','-m','Synthetic release fixture');
  await writeFile(join(root,'.env'),'VEXA_SERVER_TEST=SYN_SECRET_MUST_NOT_APPEAR');
  const manifest=await createReleaseManifest(root);
  assert.equal(manifest.source.commit_sha,git('rev-parse','HEAD'));
  assert.equal(manifest.source.files.find(x=>x.path==='package-lock.json').sha256,sha(files['package-lock.json']));
  assert.deepEqual(manifest.source.migration_order,['supabase/migrations/0001_test.sql']);
  assert.equal(manifest.status,'blocked');assert.equal(manifest.build.served_revision,null);
  assert.equal(manifest.evidence.production_authorization,null);
  assert.ok(!JSON.stringify(manifest).includes('SYN_SECRET_MUST_NOT_APPEAR'));
  assert.ok(manifest.environment_names.some(x=>x.name==='VEXA_SERVER_TEST'));
  const out=join(folder,'manifest.json');await main(['--root',root,'--out',out]);assert.equal((await stat(out)).mode&0o777,0o600);
  await assert.rejects(main(['--root',root,'--out',out]),e=>e.code==='EEXIST');
  const before=await readFile(out);await mkdir(join(root,'..looks-external'));await assert.rejects(main(['--root',root,'--out',join(root,'..looks-external','report.json')]),/RELEASE_OUTPUT_MUST_BE_OUTSIDE_SOURCE/);
  for(const flag of ['assume-unchanged','skip-worktree']){
   git('update-index','--'+flag,'apps/web/next.config.ts');
   await assert.rejects(createReleaseManifest(root),/RELEASE_INDEX_FLAGS_UNSAFE/);
   await writeFile(join(root,'apps/web/next.config.ts'),'export default {changed:true};\n');
   assert.equal(git('status','--porcelain'),'');
   await assert.rejects(createReleaseManifest(root),/RELEASE_INDEX_FLAGS_UNSAFE/);
   git('update-index','--no-'+flag,'apps/web/next.config.ts');
   await writeFile(join(root,'apps/web/next.config.ts'),files['apps/web/next.config.ts']);
  }
  await writeFile(join(root,'package-lock.json'),'changed');await assert.rejects(createReleaseManifest(root),/RELEASE_SOURCE_DIRTY/);
  assert.deepEqual(await readFile(out),before,'Existing receipt must remain immutable');
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('migration inventory includes four-digit and fourteen-digit versions with exact hashes and excludes malformed paths',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'vexa-release-migrations-')),root=join(folder,'source');await mkdir(root);
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();
 const expected=['supabase/migrations/0001_initial.sql','supabase/migrations/0041_private_download_authorization.sql','supabase/migrations/20260930224057_platform_administration.sql','supabase/migrations/20261004061000_member_reusable_plan.sql'];
 const excluded=['supabase/migrations/001_short.sql','supabase/migrations/00001_long.sql','supabase/migrations/2026100406100_short_timestamp.sql','supabase/migrations/202610040610000_long_timestamp.sql','supabase/migrations/2026100406100x_non_numeric.sql','supabase/migrations/0001_.sql','supabase/migrations/20261004061000_.sql','supabase/migrations/0001-missing_separator.sql','supabase/migrations/20261004061000missing_separator.sql','supabase/migrations/0002_backup.sql.bak','supabase/migrations/nested/0002_nested.sql','other/migrations/0002_wrong_root.sql'];
 try{
  const files={'package-lock.json':'{}','apps/web/next.config.ts':'export default {};','apps/web/src/app/api/health/version/route.ts':'export const GET=()=>{};'};
  for(const [index,name]of [...expected].reverse().concat(excluded).entries())files[name]=`-- SYN inventory only ${index}\nselect ${index};\n`;
  for(const [name,content]of Object.entries(files)){await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),content);}
  git('init','--quiet');git('add','.');git('commit','--quiet','-m','Synthetic mixed migration names');
  const manifest=await createReleaseManifest(root);
  assert.deepEqual(manifest.source.migration_order,expected,'Every supported migration is inventoried in existing lexical order');
  assert.deepEqual(manifest.source.files.filter(x=>x.path.startsWith('supabase/migrations/')),expected.map(path=>({path,sha256:sha(files[path])})),'Migration bytes are bound as well as their names');
  for(const name of excluded)assert.equal(manifest.source.files.some(x=>x.path===name),false,'Not a supported migration: '+name);
 }finally{await rm(folder,{recursive:true,force:true});}
});

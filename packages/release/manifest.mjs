import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
// Git status trusts these index flags and can hide changed source bytes.
// Release inventory requires an ordinary fully materialized checkout.
function assertVisibleIndex(root){
 if(git(root,['ls-files','-v','-z']).split('\0').some(entry=>/^[a-zS] /.test(entry)))throw new Error('RELEASE_INDEX_FLAGS_UNSAFE');
}
/** No environment values or .env files are read. Operator approval and remote
 * evidence are intentionally separate from local source inventory. */
export async function createReleaseManifest(root){
 root=await realpath(root);
 assertVisibleIndex(root);
 if(git(root,['status','--porcelain','--untracked-files=all']))throw new Error('RELEASE_SOURCE_DIRTY');
 const sha=git(root,['rev-parse','HEAD']);if(!/^[0-9a-f]{40}$/.test(sha))throw new Error('RELEASE_SHA_INVALID');
 const tracked=git(root,['ls-files','-z']).split('\0').filter(Boolean).sort();
 const trackedSet=new Set(tracked);
 for(const required of ['package-lock.json','apps/web/next.config.ts','apps/web/src/app/api/health/version/route.ts'])if(!trackedSet.has(required))throw new Error('RELEASE_INPUT_MISSING');
 const migrations=tracked.filter(p=>/^supabase\/migrations\/\d{4}_[^/]+\.sql$/.test(p));
 if(!migrations.length)throw new Error('RELEASE_MIGRATIONS_MISSING');
 const configs=tracked.filter(p=>/(?:^|\/)package(?:-lock)?\.json$/.test(p)||/^apps\/web\/(?:next\.config\.ts|tsconfig\.json)$/.test(p));
 const sources=[...configs,...migrations];
 const digests=[];
 for(const path of sources){const p=resolve(root,path),stat=await lstat(p);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('RELEASE_REGULAR_FILE_REQUIRED');digests.push({path,sha256:hash(await readFile(p))});}
 // Only tracked source files, never process.env/.env contents. This is an
 // inventory for review, not proof every reference is required in production.
 const envNames=new Set(['VEXA_BUILD_REVISION']);
 for(const path of tracked.filter(p=>/^(apps\/web\/src|packages)\//.test(p)&&/\.(?:mjs|ts|tsx)$/.test(p)&&!/(?:\.test\.|\/tests?\/)/.test(p))){
  const p=resolve(root,path),stat=await lstat(p);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('RELEASE_REGULAR_FILE_REQUIRED');
  const source=await readFile(p,'utf8');
  for(const match of source.matchAll(/(?:process\.env|\benv)\.([A-Z][A-Z0-9_]*)/g))envNames.add(match[1]);
 }
 assertVisibleIndex(root);
 if(git(root,['rev-parse','HEAD'])!==sha||git(root,['status','--porcelain','--untracked-files=all']))throw new Error('RELEASE_SOURCE_CHANGED');
 for(const entry of digests)if(hash(await readFile(resolve(root,entry.path)))!==entry.sha256)throw new Error('RELEASE_SOURCE_CHANGED');
 return {schema_version:'vexa-release-manifest-v1',status:'blocked',created_at:new Date().toISOString(),source:{commit_sha:sha,clean:true,files:digests,migration_order:migrations},
  build:{revision_variable:'VEXA_BUILD_REVISION',required_value:sha,served_revision_endpoint:'/api/health/version',served_revision:null,observed_at:null},
  environment_names:[...envNames].sort().map(name=>({name,exposure:name.startsWith('NEXT_PUBLIC_')?'public':name==='VEXA_BUILD_REVISION'||name==='VEXA_COMPILED_REVISION'?'public_build_identity':'server_review_required',required_in_target:'operator_review_required',rotation_owner:null})),
  destination:{environment:null,url:null,supabase_project_ref:null,vercel_project_id:null,operator_verified:false},
  owners:{release:null,database:null,operations:null,customer:null},
  evidence:{independent_review:null,critical_findings:null,restore_drill:null,local_regressions:null,remote_smoke:null,remote_served_sha:null,production_authorization:null},
  blockers:['DESTINATION_AND_OWNERS_REQUIRED','INDEPENDENT_REVIEW_AND_ZERO_OPEN_P0_P1_REQUIRED','RESTORE_AND_CRITICAL_REGRESSIONS_REQUIRED','EXPLICIT_REMOTE_SQL_AND_DEPLOYMENT_AUTHORIZATION_REQUIRED','REMOTE_SMOKE_AND_SERVED_SHA_MATCH_REQUIRED'],
  migration_strategy:'Expand with approved SQL before compatible app; restore/tombstones and old-app compatibility must be verified. Never run destructive down migrations as an automatic rollback.',
  statement:'Source inventory only; does not deploy, apply SQL, authorize costs, or assert production readiness.'};
}

export async function main(argv=process.argv.slice(2)){
 const flags={};for(let i=0;i<argv.length;i+=2){const key=argv[i];if(!['--root','--out'].includes(key)||flags[key]||!argv[i+1])throw new Error('RELEASE_ARGUMENTS_INVALID');flags[key]=argv[i+1];}
 if(!flags['--root']||!flags['--out']||!isAbsolute(flags['--root'])||!isAbsolute(flags['--out']))throw new Error('RELEASE_ABSOLUTE_PATHS_REQUIRED');
 const root=await realpath(flags['--root']),out=resolve(flags['--out']),parent=await realpath(resolve(out,'..'));
 const rel=relative(root,parent);if(!(rel==='..'||rel.startsWith('../')||isAbsolute(rel)))throw new Error('RELEASE_OUTPUT_MUST_BE_OUTSIDE_SOURCE');
 const manifest=await createReleaseManifest(root);
 await writeFile(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
 return manifest;
}
if(process.argv[1]&&await realpath(process.argv[1]).catch(()=>null)===await realpath(fileURLToPath(import.meta.url))){
 try{const result=await main();process.stdout.write(JSON.stringify({status:result.status,sha:result.source.commit_sha})+'\n');}
 catch(error){const code=error instanceof Error&&/^RELEASE_[A-Z_]+$/.test(error.message)?error.message:'RELEASE_MANIFEST_FAILED';process.stderr.write(code+'\n');process.exitCode=1;}
}

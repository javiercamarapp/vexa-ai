import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {spawn,spawnSync,fork} from 'node:child_process';import {createServer} from 'node:net';import {once} from 'node:events';import {randomUUID,createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export const hash=v=>createHash('sha256').update(v).digest('hex');
export async function setup(candidate,evidence){
 assert.ok(['22','26'].includes(process.versions.node.split('.')[0]),'NODE22_OR_26_REQUIRED');assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
 for(const f of ['packages/connectors/sync.mjs','supabase/migrations/0008_sync_cursors.sql'])assert.ok(fs.existsSync(path.join(candidate,f)),'IMPLEMENTATION_MISSING:'+f);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f0303-build-')),sockets=fs.mkdtempSync('/tmp/f0303-sql-');
 const inherited=process.env.VEXA_CI_JOURNAL,broker=process.env.VEXA_CI_BROKER;assert.equal(Boolean(inherited),Boolean(broker),'BROKER_CONFIG');
 const journal=inherited??path.join(evidence,'resources.jsonl'),offset=inherited?fs.readFileSync(journal,'utf8').split('\n').filter(Boolean).length:0;
 const children=new Set(),pools=new Set();let infra,tunnel,closing;
 const h={tmp,evidence,children,close(){return closing??=this.cleanup();},async cleanup(){
  for(const p of pools)await p.end();
  for(const c of children)if(c.exitCode===null&&c.signalCode===null){const end=once(c,'exit').catch(()=>{});c.kill('SIGKILL');await end;}
  if(tunnel)await new Promise(r=>tunnel.close(r));
  const resources=fs.existsSync(journal)?fs.readFileSync(journal,'utf8').split('\n').filter(Boolean).slice(offset).map(JSON.parse):[];
  for(const r of resources){const s=spawnSync('docker',[r.kind,'inspect',r.name,'--format','{{.Id}}'],{encoding:'utf8',timeout:15000});r.id=s.status===0?s.stdout.trim():null;}
  if(infra)infra.close();for(const r of resources){const s=spawnSync('docker',[r.kind,'inspect',r.id??r.name],{encoding:'utf8',timeout:15000});r.absent=s.status!==0&&!s.error&&/No such (?:object|container|network)|not found/i.test(s.stderr);assert.ok(r.absent,'RESOURCE_STILL_EXISTS');}
  fs.writeFileSync(path.join(evidence,'cleanup.json'),JSON.stringify({resources,removed:resources.every(r=>r.absent)}),{mode:0o600});
  fs.rmSync(sockets,{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});process.off('SIGTERM',stop);process.off('SIGINT',stop);if(!inherited){delete process.env.VEXA_CI_JOURNAL;delete process.env.VEXA_CI_BROKER;}
 }};
 const stop=()=>{void h.close().finally(()=>process.exit(1));};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 try{
  const inputs={};for(const dir of ['packages/connectors','packages/platform','packages/ingestion','supabase/migrations']){const walk=p=>{for(const d of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,d.name);if(d.isDirectory())walk(f);else{assert.ok(d.isFile(),'SOURCE_TYPE');inputs[path.relative(candidate,f)]={hash:hash(fs.readFileSync(f)),mode:fs.statSync(f).mode&0o777};}}};walk(path.join(candidate,dir));}
  fs.writeFileSync(path.join(evidence,'source-hashes.json'),JSON.stringify(inputs),{mode:0o600});h.verifySources=()=>{for(const[f,s]of Object.entries(inputs)){assert.equal(hash(fs.readFileSync(path.join(candidate,f))),s.hash,'SOURCE_CHANGED:'+f);assert.equal(fs.statSync(path.join(candidate,f)).mode&0o777,s.mode,'SOURCE_MODE_CHANGED:'+f);}};
  copyBuildInputs(candidate,tmp);const env=buildEnvironment(process.env,tmp);env.PATH=path.dirname(process.execPath)+':'+env.PATH;
  const install=spawnSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:tmp,env,encoding:'utf8',timeout:150000,maxBuffer:4e6});fs.writeFileSync(path.join(evidence,'install.log'),install.stdout+install.stderr);assert.equal(install.status,0,'OFFLINE_DEPENDENCIES');
  h.built=path.join(tmp,'built');const build=spawnSync(process.execPath,[path.join(tmp,'packages/jobs/durable/build.mjs'),h.built],{env,cwd:tmp,encoding:'utf8',timeout:30000});assert.equal(build.status,0,'BUILD_DATABASE');fs.cpSync(path.join(tmp,'packages/connectors'),path.join(h.built,'packages/connectors'),{recursive:true});
  let code=fs.readFileSync(new URL('../F02-durable/isolated-infra.mjs',import.meta.url),'utf8').replace("'../ci/resources.mjs'",JSON.stringify(new URL('../ci/resources.mjs',import.meta.url).href)).replace("'../F01-03/matrix.mjs'",JSON.stringify(new URL('../F01-03/matrix.mjs',import.meta.url).href));
  for(const[a,b]of [['56327','58300'],['56328','58301'],['56329','58302']])code=code.replaceAll(a,b);code=code.replaceAll("'--label','com.supabase.cli.project=vexa-local'","'--label','vexa.exam=f0303'");fs.writeFileSync(path.join(tmp,'infra.mjs'),code);
  if(!inherited){process.env.VEXA_CI_BROKER=randomUUID();process.env.VEXA_CI_JOURNAL=journal;fs.writeFileSync(journal,'',{mode:0o600,flag:'wx'});}
  const {launch,candidateInputs}=await import(pathToFileURL(path.join(tmp,'infra.mjs')));infra=await launch({services:true});for(const ddl of candidateInputs(candidate))infra.sql(ddl);h.sql=infra.sql;h.json=infra.json;h.probe=infra.probe;
  const pc=infra.productConfiguration(),db=pc.container.replace(/-storage$/,'-db');
  tunnel=createServer(socket=>{const c=spawn('docker',['exec','-i',db,'nc','127.0.0.1','5432'],{stdio:['pipe','pipe','ignore']});children.add(c);socket.pipe(c.stdin);c.stdout.pipe(socket);socket.on('error',()=>{});c.stdin.on('error',()=>{});socket.on('close',()=>c.kill());c.on('exit',()=>{children.delete(c);socket.destroy();});});tunnel.listen(sockets+'/.s.PGSQL.5432');await once(tunnel,'listening');
  h.connection={...pc.connection,host:sockets};assert.deepEqual(h.json("SELECT json_build_object('super',rolsuper,'bypass',rolbypassrls) FROM pg_roles WHERE rolname='f02_product'"),{super:false,bypass:false},'BACKEND_NO_SUPERUSER');
  const {default:pg}=await import(pathToFileURL(path.join(tmp,'node_modules/pg/lib/index.js')));const {createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
  h.actor=(role='owner',tenant=randomUUID(),source='zendesk')=>{const a={id:randomUUID(),tenant,role,connection:randomUUID(),account:'SYN-'+randomUUID(),source};infra.sql(`INSERT INTO auth.users(id) VALUES(${q(a.id)}); INSERT INTO organizations(id,name) VALUES(${q(tenant)},'SYNTHETIC F03-03') ON CONFLICT DO NOTHING; INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(tenant)},${q(a.id)},${q(role)},'active');INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(tenant)},${q(source)},${q(a.account)});`);return a;};
  h.repository=(a,{fault}={})=>{const pool=new pg.Pool({...h.connection,max:2});pools.add(pool);const wrapped={async connect(){const c=await pool.connect();return {release:()=>c.release(),query:async(text,values)=>{if(fault?.before)await fault.before(text,values,c);let r;try{r=await c.query(text,values);}catch(e){fs.appendFileSync(path.join(evidence,'sql-errors.jsonl'),JSON.stringify({sql:text,code:e.code,message:e.message})+'\n',{mode:0o600});throw e;}if(fault?.after)await fault.after(text,values,c);return r;}};}};const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role,status:'active',permissions_version:1}];}};const database=createDatabase({identity,pool:wrapped,selectedTenant:a.tenant});return {database,repository:h.sync.createSyncRepository({database})};};
  h.child=(a,request)=>new Promise((resolve,reject)=>{const c=fork(new URL('./worker.mjs',import.meta.url),[],{execPath:process.execPath,execArgv:[],env:{...env,F03_BUILD:h.built,F03_PG:path.join(tmp,'node_modules/pg/lib/index.js')},stdio:['ignore','ignore','ignore','ipc']});children.add(c);let result;const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('CHILD_TIMEOUT'));},20000);c.on('message',m=>result=m);c.on('error',reject);c.on('exit',code=>{clearTimeout(timer);children.delete(c);resolve({code,result});});c.send({connection:h.connection,actor:a,request});});
  return h;
 }catch(e){await h.close();throw e;}
}

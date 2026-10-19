// Postgres LOCAL desechable (initdb en /private/tmp) con las migraciones REALES de supabase/migrations aplicadas.
// Solo se usan sustitutos mínimos para lo que el entorno local no tiene: esquema auth, storage y tipo vector (como text).
// Las tablas, constraints y triggers de evidencia/extracción (0001-0044) son los de producción. Se destruye al terminar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const MIG=path.join(path.dirname(fileURLToPath(import.meta.url)),'../../supabase/migrations');
export const pgAvailable=()=>spawnSync('which',['initdb']).status===0&&spawnSync('which',['psql']).status===0;
export async function withLocalPg(fn){
  const root=fs.mkdtempSync('/private/tmp/claude-501/pg-');const sock=root,data=path.join(root,'data');
  const run=(cmd,args,opt={})=>spawnSync(cmd,args,{encoding:'utf8',...opt});
  const psql=(sql,db='t')=>{const r=run('psql',['-h',sock,'-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',sql]);return{ok:r.status===0,out:r.stdout.trim(),err:r.stderr.trim()};};
  const file=(f,db='t')=>run('psql',['-h',sock,'-U','postgres','-d',db,'-q','-f',f]);
  try{
    if(run('initdb',['-D',data,'-U','postgres','--auth=trust','-E','UTF8']).status!==0)throw Error('initdb falló');
    if(run('pg_ctl',['-D',data,'-o',`-k ${sock} -c listen_addresses= -c fsync=off`,'-l',path.join(root,'log'),'-w','start']).status!==0)throw Error('pg_ctl falló');
    psql('create database t','postgres');
    for(const r of ['anon','authenticated','service_role'])psql(`create role ${r}`,'postgres');
    psql(`create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id uuid,metadata jsonb);
      create schema extensions; create function extensions.fakedist(text,text) returns float8 language sql as 'select 0::float8'; create operator extensions.<=> (leftarg=text,rightarg=text,function=extensions.fakedist);`);
    const tmp=path.join(root,'mig');fs.mkdirSync(tmp);
    for(const f of fs.readdirSync(MIG).filter(x=>/^00([0-3]\d|4[0-4])_.*\.sql$/.test(x)).sort()){
      fs.writeFileSync(path.join(tmp,f),fs.readFileSync(path.join(MIG,f),'utf8').replace(/create extension if not exists vector with schema extensions;/g,'').replace(/extensions\.vector_dims\([a-z_]+\)/g,'dim').replace(/extensions\.vector(\(\d+\))?/g,'text'));
      file(path.join(tmp,f));
    }
    return await fn({psql,file,root,sock});
  }finally{run('pg_ctl',['-D',data,'-m','immediate','stop']);fs.rmSync(root,{recursive:true,force:true});}
}
export const SEED_SQL=(o)=>`
insert into public.organizations(id,name) values('${o.tenant}','t');
insert into public.connections(id,tenant_id,source,account_id) values('${o.conn}','${o.tenant}','csv','acc');
insert into public.conversations(id,tenant_id,source,external_id,connection_id) values('${o.conv}','${o.tenant}','csv','c1','${o.conn}');
insert into public.source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,conversation_id,canonical_id,provenance) values('${o.csrev??o.conv.replace(/.$/,'f')}','${o.tenant}','${o.conn}','conversation','c1','1','${'b'.repeat(64)}','${'c'.repeat(64)}','legacy','[]'::jsonb,'${o.conv}','${o.conv}','{}'::jsonb);
insert into public.source_heads(id,tenant_id,connection_id,entity_type,external_id,version,state,selected_revision_id) values('${o.conv}','${o.tenant}','${o.conn}','conversation','c1',1,'unique','${o.csrev??o.conv.replace(/.$/,'f')}');
${o.msgs.map((m,i)=>`insert into public.messages(id,tenant_id,external_id,role,occurred_at,conversation_id,connection_id) values('${m.id}','${o.tenant}','e${i}','${m.role}','2026-08-0${i+1}T10:00:00Z','${o.conv}','${o.conn}');
insert into public.message_revisions(id,tenant_id,message_id,revision,text_ref,hash) values('${m.rev}','${o.tenant}','${m.id}','1','import:i:row:${i}','${'a'.repeat(64)}');
insert into public.source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,message_id,canonical_id,message_revision_id,provenance) values('${m.srev}','${o.tenant}','${o.conn}','message','e${i}','1','${'b'.repeat(64)}','${'c'.repeat(64)}','legacy','[]'::jsonb,'${m.id}','${m.id}','${m.rev}','{}'::jsonb);
insert into public.source_heads(id,tenant_id,connection_id,entity_type,external_id,version,state,selected_revision_id) values('${m.id}','${o.tenant}','${o.conn}','message','e${i}',1,'unique','${m.srev}');`).join('\n')}`;

# SYNTHETIC local PostgreSQL fixtures, no Supabase HTTP/prod data.
import pathlib,subprocess,time,sys
root=pathlib.Path(__file__).resolve().parents[3]
fixtures=[('vexa-recovery-309-incompatible',61822)] if '--incompatible-only' in sys.argv else [('vexa-recovery-309-source',61820),('vexa-recovery-309-target',61821)]
for name,port in fixtures:
 subprocess.run(['docker','run','--pull','never','--label','vexa.recovery=synthetic','--name',name,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','-p',f'127.0.0.1:{port}:5432','public.ecr.aws/supabase/postgres:17.6.1.166'],check=True,capture_output=True)
 for _ in range(200):
  if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1'],capture_output=True).returncode==0:break
  time.sleep(.2)
 else:raise Exception('own DB TCP not ready')
 def sql(s):
  r=subprocess.run(['docker','exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input=s,capture_output=True,text=True);assert r.returncode==0,r.stderr
 sql('create schema if not exists storage;create table if not exists storage.buckets(id text primary key,name text,public boolean);create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create table if not exists auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);')
 sql("alter role supabase_admin password 'synthetic-recovery-local-only';")
 for f in sorted((root/'supabase/migrations').glob('*.sql')):sql(f.read_text())
 print(name,'all migrations applied')

"""Actual product copies in TMP; never mutate author's source; no mock replacement."""
import pathlib,os,sys,subprocess,json,uuid,tempfile,shutil,hashlib
base=pathlib.Path(__file__).resolve().parent
source=pathlib.Path(os.environ['VEXA_CANDIDATE']).resolve()
art=base/'evidence'/('product-mutations-'+str(uuid.uuid4()));art.mkdir()
files=['supabase/config.toml']+[str(p.relative_to(source)) for d in ['packages/platform/src','packages/jobs','supabase/migrations'] for p in (source/d).rglob('*') if p.is_file() and p.suffix in ['.ts','.mjs','.sql'] and '/test/' not in str(p)]
hashes={f:hashlib.sha256((source/f).read_bytes()).hexdigest() for f in files}
results=[]
with tempfile.TemporaryDirectory(prefix='f02-product-mutants-') as tmp:
 for f in files:
  p=pathlib.Path(tmp)/f;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/f,p)
 target=pathlib.Path(tmp)/'packages/jobs/imports.mjs';original=target.read_text()
 for name,fragment,assertion in [('hash','||hash(bytes)!==prepared.row.file_hash','PRODUCT_HASH_MISMATCH'),('atomic','   // Auth/session/','ATOMIC_CONFIRM_ROLLBACK')]:
  if len(sys.argv)>1 and name not in sys.argv[1:]:continue
  assert original.count(fragment)==1,'MUTATION_ANCHOR_MISMATCH'
  for stage in ['healthy','defect','restored']:
   replacement='' if name=='hash' else '   await database.transaction(\'import\',async s=>s.query("UPDATE public.imports SET provenance=provenance || jsonb_build_object(\'premature\',true) WHERE id=$1",[match[1]]));\n'+fragment
   target.write_text(original.replace(fragment,replacement) if stage=='defect' else original)
   cmd=[sys.executable,'-B',str(base/'run.py'),'node','--test',str(base/('product-bytes.test.mjs' if name=='hash' else 'product-probe.test.mjs'))]
   r=subprocess.run(cmd,env=dict(os.environ,VEXA_CANDIDATE=tmp,PYTHONDONTWRITEBYTECODE='1',F02_BYTES_HASH_ONLY='1',F02_PROBE_CASE='SQL fault at outbox'),capture_output=True,text=True,timeout=100)
   out=r.stdout+r.stderr;(art/(name+'-'+stage+'.txt')).write_text(out)
   results.append(dict(name=name,stage=stage,exit=r.returncode,command=cmd,assertion=assertion,mutation_sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
   (art/'results.json').write_text(json.dumps({'source_hashes':hashes,'runs':results},indent=2))
   expected=1 if stage=='defect' else 0
   assert r.returncode==expected and 'CLEANUP True' in out and (stage!='defect' or (assertion in out and 'AssertionError [ERR_ASSERTION]' in out)),'PRODUCT_MUTATION_NOT_PROVED '+str(art)
   print(name,stage,r.returncode,flush=True)
for f,h in hashes.items():assert hashlib.sha256((source/f).read_bytes()).hexdigest()==h,'SOURCE_CHANGED_DURING_RUN'
print('PRODUCT_MUTATIONS',art)

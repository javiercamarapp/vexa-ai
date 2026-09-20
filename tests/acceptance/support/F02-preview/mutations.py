"""Mutate only disposable product copies; preserve 0/1/assertion/0 evidence."""
import pathlib,os,shutil,tempfile,subprocess,json,hashlib
root=pathlib.Path(__file__).resolve().parents[4]
source=pathlib.Path(os.environ['VEXA_CANDIDATE'])
art=pathlib.Path(tempfile.mkdtemp(prefix='f0203-mutants-'))
node='/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node'
mutants=[('ambiguousdate','packages/ingestion/mapping.mjs',"const config=canonicalMapping(mapping);","const config=canonicalMapping({...mapping,dateFormat:mapping.dateFormat??'dmy'});",'pure','DATE_EXPLICIT_ambiguous missing format'),('csvformula','packages/ingestion/mapping.mjs',"s=\"'\"+s;","s=s;",'pure','CSV_FORMULA'),('cas','packages/jobs/imports.mjs',"if(input.expected_version!==r.mapping_version)","if(false)",'http','CAS_STALE')]
results=[]
for name,rel,old,new,suite,target in mutants:
 tmp=art/name;tmp.mkdir();product=tmp/'product';product.mkdir()
 for scope in ['packages','apps','supabase']:
  shutil.copytree(source/scope,product/scope,ignore=shutil.ignore_patterns('node_modules','.next','__pycache__'))
 p=product/rel;s=p.read_text();assert s.count(old)==1,(name,'ANCHOR')
 codes=[]
 for stage in ['before','mutant','restored']:
  if stage=='mutant':p.write_text(s.replace(old,new))
  if stage=='restored':p.write_text(s)
  env=dict(os.environ,VEXA_CANDIDATE=str(product),PYTHONDONTWRITEBYTECODE='1')
  cmd=['python3','-B',str(root/'tests/acceptance/support/F02-preview/run.py'),node,'--test',str(root/f'tests/acceptance/support/F02-preview/{suite}.test.mjs')]
  r=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
  (tmp/(stage+'.log')).write_text(r.stdout);codes.append(r.returncode)
  if stage=='mutant':assert r.returncode==1 and target in r.stdout and "code: 'ERR_ASSERTION'" in r.stdout and 'CLEANUP True' in r.stdout,(name,'NOT_ASSERTION_KILL')
  else:assert r.returncode==0,(name,stage)
 assert hashlib.sha256(p.read_bytes()).digest()==hashlib.sha256((source/rel).read_bytes()).digest()
 results.append({'mutant':name,'codes':codes,'target':target,'restored_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 shutil.rmtree(product)
 print(name,codes,target,flush=True)
(art/'result.json').write_text(json.dumps(results,indent=2));print('MUTATION_EVIDENCE',art)

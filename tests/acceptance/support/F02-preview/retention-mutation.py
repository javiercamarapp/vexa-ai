"""Real browser retention sensitivity, delayed JSON; TMP copies only, no business mocks."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,time
root=pathlib.Path(__file__).resolve().parents[4]
source=pathlib.Path(os.environ['VEXA_CANDIDATE']).resolve()
art=pathlib.Path(tempfile.mkdtemp(prefix='f0203-retention-'))
ignore=shutil.ignore_patterns('.git','.runtime','private','node_modules','.next','__pycache__')
control=art/'control';product=art/'product'
shutil.copytree(root,control,ignore=ignore);shutil.copytree(source,product,ignore=ignore)
p=control/'tests/acceptance/support/F02-preview/completion.mjs';text=p.read_text()
anchor=' // Pagination exercises actual SQL pages and UI append/dedup with a retained second-page selection.'
delay="\n await page.addInitScript(()=>{const original=Response.prototype.json;Response.prototype.json=async function(...args){const data=await original.apply(this,args);if(new URL(this.url,location.href).pathname==='/api/imports')await new Promise(resolve=>setTimeout(resolve,500));return data;};});\n"
assert text.count(anchor)==1;p.write_text(text.replace(anchor,anchor+delay))
rel='apps/web/src/components/import-preview.tsx';target=product/rel;original=target.read_bytes();source_hash=hashlib.sha256((source/rel).read_bytes()).hexdigest()
old='[...data.connections,...previous.filter(c=>c.id===connection&&!data.connections.some((item:{id:string})=>item.id===c.id))]'
assert original.decode().count(old)==1
node=os.environ.get('EXAM_NODE','node');env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','VEXA_CANDIDATE':str(product)};env.pop('NODE_TEST_CONTEXT',None)
results=[]
try:
 for label in ['positive','mutant','restored']:
  target.write_bytes(original.decode().replace(old,'data.connections').encode() if label=='mutant' else original)
  cmd=[node,'--test','--test-reporter=tap','tests/acceptance/F02-03.test.mjs'];start=time.time();log=art/(label+'.log')
  with log.open('x') as out:r=subprocess.run(cmd,cwd=control,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=470)
  output=log.read_text();row={'label':label,'command':cmd,'exit':r.returncode,'seconds':time.time()-start,'log':str(log)};results.append(row)
  (art/'result.json').write_text(json.dumps(results,indent=2)+'\n')
  assert r.returncode==(1 if label=='mutant' else 0),(label,log)
  if label=='mutant':assert 'PAGINATION_RETAINS_SELECTED_CONNECTION_AFTER_RELOAD' in output and 'ERR_ASSERTION' in output,'NOT_TARGET_ASSERTION'
  assert 'CLEANUP True' in output,'CLEANUP_NOT_VERIFIED'
finally:
 target.write_bytes(original)
 assert hashlib.sha256((source/rel).read_bytes()).hexdigest()==source_hash,'ORIGINAL_SOURCE_CHANGED'
 (art/'restoration.json').write_text(json.dumps({'source_unchanged':True,'copy_restored':target.read_bytes()==original,'source_sha256':source_hash},indent=2)+'\n')
print('RETENTION_MUTATION_COMPLETE',art)

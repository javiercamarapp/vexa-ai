"""Reproducible isolated execution; copies only ingestion modules, never cache/private."""
import hashlib,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
source=Path(sys.argv[1]).resolve(); support=Path(__file__).resolve().parent; root=support.parents[3]; evidence=support/'evidence/close01'; evidence.mkdir(parents=True,exist_ok=True)
files=['index.mjs','csv.mjs','xlsx.mjs']
def hashes():return {f:hashlib.sha256((source/'packages/ingestion'/f).read_bytes()).hexdigest() for f in files}
before=hashes();results=[]
try:
 with tempfile.TemporaryDirectory(prefix='vexa-gate01-final-') as tmp:
  tmp=Path(tmp).resolve();target=tmp/'packages/ingestion';target.mkdir(parents=True)
  for f in files:shutil.copyfile(source/'packages/ingestion'/f,target/f)
  assert {f:hashlib.sha256((target/f).read_bytes()).hexdigest() for f in files}==before
  env={'PATH':os.environ['PATH'],'VEXA_CANDIDATE':str(tmp)}
  runs=[('full-gate',['node','--test','--test-reporter=tap','tests/acceptance/F02-01.test.mjs']),('preexpand',['node',str(support/'preexpand.mjs')]),('actual-expansion',['node',str(support/'probe-expanded.mjs')])]
  for label,command in runs:
   r=subprocess.run(command,cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
   (evidence/(label+'.log')).write_text(r.stdout);results.append({'label':label,'command':command,'exit':r.returncode,'artifact':label+'.log'});print(label,r.returncode,flush=True)
finally:
 after=hashes();report={'source':str(source),'gate_sha256':hashlib.sha256((root/'tests/acceptance/F02-01.test.mjs').read_bytes()).hexdigest(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'base_sha':'8340d26e1c6463ed6ccd158ee2a6ed4d202bc987','beforeHashes':before,'afterHashes':after,'sourceUnchanged':before==after,'copiedFilesOnly':files,'results':results,'reviewer':'pending','accepted':False}
 (evidence/'verification.json').write_text(json.dumps(report,indent=2)+'\n');assert before==after,'SOURCE_CHANGED'
sys.exit(0 if all(r['exit']==0 for r in results) else 1)

"""Small deterministic mutation probe, not Stryker or a full mutation score.
Only creates owned temporary candidates. Baseline kernel and gates never change.
"""
import hashlib,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MUTANTS=[
 ('unknown-as-zero','if (value === null) return null;','if (value === null) return 0n;'),
 ('duplicate-events-counted','return [...map.values()].map(v=>v.record);','return records;'),
 ('reversal-added','(amount-(rev?.known??0n))','(amount+(rev?.known??0n))'),
 ('precision-lost','return BigInt(value);','return BigInt(Number(value));'),
 ('scenario-overstated','/10000n).toString()','/1000n).toString()')]
def main():
 source=ROOT/'packages/economics/index.mjs';before=source.read_bytes();text=before.decode()
 gate=ROOT/'tests/acceptance/economics.test.mjs'
 base=subprocess.run(['node','--test',str(gate)],cwd=ROOT,capture_output=True,text=True,timeout=20)
 if base.returncode:raise SystemExit('Baseline fails; no mutation conclusion allowed')
 result=[];logdir=ROOT/'private/logs';logdir.mkdir(parents=True,exist_ok=True)
 for id,old,new in MUTANTS:
  if text.count(old)!=1:raise SystemExit('Mutation no longer matches exactly: '+id)
  with tempfile.TemporaryDirectory(prefix='vexa-mutation-') as tmp:
   p=Path(tmp)/'packages/economics/index.mjs';p.parent.mkdir(parents=True);p.write_text(text.replace(old,new))
   syntax=subprocess.run(['node','--check',str(p)],capture_output=True,text=True,timeout=10)
   if syntax.returncode:result.append({'id':id,'status':'invalid'});continue
   try:r=subprocess.run(['node','--test',str(gate)],cwd=ROOT,env={**os.environ,'VEXA_CANDIDATE':tmp},capture_output=True,text=True,timeout=20)
   except subprocess.TimeoutExpired:result.append({'id':id,'status':'timeout-not-killed'});continue
   log=r.stdout+r.stderr;(logdir/f'mutation-{id}.log').write_text(log)
   status='killed' if r.returncode and 'ERR_ASSERTION' in log else ('survived' if not r.returncode else 'execution-error-not-killed')
   result.append({'id':id,'status':status,'exit':r.returncode,'log_sha256':hashlib.sha256(log.encode()).hexdigest()})
 assert source.read_bytes()==before,'Baseline changed'
 data={'scope':'five hand-picked arithmetic mutations; not whole-product mutation score','baseline_sha256':hashlib.sha256(before).hexdigest(),'gate_sha256':hashlib.sha256(gate.read_bytes()).hexdigest(),'baseline_exit':base.returncode,'results':result,'killed':sum(x['status']=='killed' for x in result),'total':len(result),'baseline_unchanged':True}
 out=ROOT/'construccion/RESULTADO-MUTACION.json'
 if out.exists() and not out.read_bytes():raise SystemExit('Refusing empty/placeholder output')
 out.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data,indent=2))
 raise SystemExit(0 if data['killed']==data['total'] else 1)
if __name__=='__main__':main()

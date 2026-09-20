"""OS exits 0/1/0. Only the named assertion kills each synthetic defect."""
import os,pathlib,subprocess,json,time,sys,uuid
base=pathlib.Path(__file__).resolve().parent
outdir=base/'evidence'/('mutations-'+str(uuid.uuid4()));outdir.mkdir()
command=[sys.executable,str(base/'run.py'),'node','--test',str(base/'probe.test.mjs')]
results=[]
for name,case,defect,assertion in [('hash','D02-02','hash','HASH_MISMATCH'),('atomic','SQL fault at outbox','atomic','ATOMIC_CONFIRM_ROLLBACK'),('mapping','D02-12','mapping','RESERVE_MAPPING_CONFLICT'),('restart','D02-14','volatile-secret','OLD_TOKEN_AFTER_PROCESS_RESTART'),('expiry','D02-15','queued','EXPIRED_NOT_QUEUED'),('owner','D02-16','owner','RESERVATION_OWNER'),('size','D02-02','size','SIZE_MISMATCH'),('duplicate','D02-01','duplicate','IDEMPOTENT_JOB'),('token-expiry','D02-03','token-expiry','EXPIRED_CONFIRM')]:
 if len(sys.argv)>1 and name not in sys.argv[1:]:continue
 for stage,fault,expected in [('healthy','',0),('defect',defect,1),('restored','',0)]:
  env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',F02_PROBE_CASE=case,F02_ORACLE_DEFECT=fault)
  r=subprocess.run(command,env=env,capture_output=True,text=True,timeout=100)
  text=r.stdout+r.stderr;(outdir/(name+'-'+stage+'.txt')).write_text(text)
  result={'name':name,'stage':stage,'command':command,'case':case,'defect':fault,'exit':r.returncode,'expected':expected,'assertion':assertion if fault else None}
  results.append(result);(outdir/'results.json').write_text(json.dumps(results,indent=2))
  if r.returncode!=expected or (fault and (assertion not in text or 'AssertionError [ERR_ASSERTION]' not in text or 'INFRA:' in text or 'INFRA_F01' in text)) or 'CLEANUP True' not in text:
   print('MUTATION_PROOF_REJECTED',name,stage,outdir);sys.exit(1)
  print(name,stage,'exit',r.returncode,flush=True)
print('MUTATION_PROOF',outdir)

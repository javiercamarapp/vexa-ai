"""Fresh OS runs; each output retained. No result receipt is a pass oracle."""
import os,sys,subprocess,pathlib,json,uuid
b=pathlib.Path(__file__).resolve().parent
art=b/'evidence'/('close-controls-'+str(uuid.uuid4()));art.mkdir()
runs=[]
for label,script,extra,expected,marker in [
 ('ssr-healthy','ssr-exam.mjs',{},0,'SSR_INDEPENDENT_TOTAL_PASS'),
 ('ssr-origin-mutant','ssr-exam.mjs',{'F02_SSR_MUTANT':'origin'},1,'SSR_ORIGIN_REJECT'),
 ('ssr-restored','ssr-exam.mjs',{},0,'SSR_INDEPENDENT_TOTAL_PASS'),
 ('node-contract','product-probe.test.mjs',{},0,''),
 ('expiry-owner','product-expiry.test.mjs',{},0,''),
]:
 command=[sys.executable,'-B',str(b/'run.py'),'node']+(['--test'] if '.test.' in script else [])+[str(b/script)]
 r=subprocess.run(command,env=dict(os.environ,**extra),capture_output=True,text=True,timeout=310)
 out=r.stdout+r.stderr;(art/(label+'.log')).write_text(out)
 runs.append(dict(label=label,command=command,exit=r.returncode,expected=expected,marker=marker))
 (art/'runs.json').write_text(json.dumps(runs,indent=2));print(label,r.returncode,str(art),flush=True)
 assert r.returncode==expected and marker in out and 'CLEANUP True' in out,'CONTROL_FAILED: '+label
 if expected==1:assert 'SSR_AUTHENTICATED_POSITIVE_REACHED' in out and 'AssertionError [ERR_ASSERTION]' in out

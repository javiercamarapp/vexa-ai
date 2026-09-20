"""Real job circuit; isolated candidate mutations, positive before/after. No fixture PASS."""
import argparse, json, pathlib, shutil, subprocess, sys, tempfile
HERE=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--candidate',type=pathlib.Path,required=True);p.add_argument('--job',choices=['web-quality','sql-integration'],required=True);a=p.parse_args()
root=pathlib.Path(tempfile.mkdtemp(prefix='vexa-f0105-probe-'));root.chmod(0o700)
results=[]
def run(candidate,label,expected=None):
 r=subprocess.run([sys.executable,'-B',str(HERE.parent/'ci/run.py'),'--job',a.job,'--candidate',str(candidate)],capture_output=True,text=True)
 (root/(label+'.stdout')).write_text(r.stdout+r.stderr)
 info=json.loads(r.stdout.strip().splitlines()[-1]);receipt=json.loads(pathlib.Path(info['receipt']).read_text())
 logs='\n'.join(pathlib.Path(c['log']).read_text() for c in receipt['commands'])
 results.append({'label':label,'exit_code':r.returncode,'receipt':info['receipt'],'expected':expected})
 (root/'results.json').write_text(json.dumps(results,indent=2))
 if expected:
  assert r.returncode!=0 and receipt['status']=='product_fail' and expected in logs,(label,info)
 else: assert r.returncode==0 and receipt['status']=='pass',(label,info)
 print(label+': verified '+str(r.returncode),flush=True)
run(a.candidate,'positive-before')
mutations=[('ts2322','apps/web/src/ci-mutant.ts',"const broken: number = 'x'; export { broken };\n",'TS2322')] if a.job=='web-quality' else [
 ('syntax','supabase/migrations/9998_ci_mutant.sql','THIS IS NOT SQL;\n','SQLSTATE:42601'),
 ('rls','supabase/migrations/9999_ci_mutant.sql','ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;\n','READ_A:conversations:a')]
for label,file,content,expected in mutations:
 candidate=root/label;shutil.copytree(a.candidate,candidate)
 (candidate/file).write_text(content)
 run(candidate,label,expected)
run(a.candidate,'positive-after')
print('PROBE_EVIDENCE:'+str(root))

import copy, json, pathlib, sys, tempfile, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'ci'))
from contract import workflow, validate
from run import execute, JobFailure, environment, fingerprint
class Policy(unittest.TestCase):
 def test_policy_mutants(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'ci.json'; good=workflow()
   p.write_text(json.dumps(good));validate(p)
   def remove_job(w): del w['jobs']['sql-integration']
   mutations=[remove_job,
    lambda w:w['jobs']['web-quality']['steps'][-1].update({'continue-on-error':'${{ true }}'}),
    lambda w:w['on']['push'].update(paths=['docs/**']),
    lambda w:w['jobs']['web-quality']['steps'][-1].update(run='node --test --test-name-pattern=never candidate/tests/test.mjs'),
    lambda w:w['jobs']['web-quality'].update({'secrets':'inherit'}),
    lambda w:w['jobs']['web-quality'].update({'runs-on':'self-hosted'}),
    lambda w:w['jobs']['control-kernel']['steps'][0]['with'].update(ref='main'),
    lambda w:w.update(permissions={'contents':'write'}),
    lambda w:w['jobs']['web-quality'].update(env={'KEY':'${{ secrets.PROD_KEY }}'}),
    lambda w:w['jobs']['web-quality'].update(env={'NEXT_PUBLIC_SERVICE_ROLE_KEY':'SYN'}),
    lambda w:w['jobs']['sql-integration'].update({'continue-on-error':True}),
    lambda w:w['jobs']['sql-integration'].update({'if':False}),
    lambda w:w['jobs']['web-quality']['steps'][-1].update(run='false || true'),
    lambda w:w['jobs']['web-quality']['steps'][-1].update(run='false; exit 0'),
    lambda w:w['jobs']['web-quality']['steps'][-1].update(run='false | tee log'),
    lambda w:w['on'].update(pull_request_target={}),
    lambda w:w['jobs']['web-quality']['steps'][0]['with'].update({'persist-credentials':True})]
   for mutate in mutations:
    w=copy.deepcopy(good);mutate(w);p.write_text(json.dumps(w))
    with self.assertRaisesRegex(ValueError,'CI_CONTRACT_MISMATCH'):validate(p)
   p.write_text('{"name":1,"name":2}')
   with self.assertRaisesRegex(ValueError,'CI_DUPLICATE_KEY'):validate(p)
   p.unlink()
   with self.assertRaisesRegex(ValueError,'CI_CONTRACT_MISSING'):validate(p)
   p.write_text(json.dumps(good));validate(p)
 def test_actual_child_status(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); records=[];env=environment(p,p)
   execute([sys.executable,'-c','print("positive")'],p,env,p,records)
   with self.assertRaises(JobFailure) as caught:execute([sys.executable,'-c','raise SystemExit(17)'],p,env,p,records)
   self.assertEqual(caught.exception.code,17);self.assertEqual(records[-1]['exit_code'],17)
   execute([sys.executable,'-c','print("positive restored")'],p,env,p,records)
 def test_environment_scrub(self):
  import os
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)
   before=dict(os.environ)
   try:
    os.environ.update(GITHUB_TOKEN='SYN-canary',NEXT_PUBLIC_SERVICE_ROLE_KEY='SYN-admin',NODE_OPTIONS='--invalid')
    env=environment(p,p)
    execute([sys.executable,'-c',"import os; assert not any(k in os.environ for k in ['GITHUB_TOKEN','NEXT_PUBLIC_SERVICE_ROLE_KEY','NODE_OPTIONS'])"],p,env,p,[])
   finally: os.environ.clear();os.environ.update(before)
 def test_real_empty_and_skipped_node_runs(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); test=p/'case.test.mjs'; env=environment(p,p)
   for source,reason in [("",'CRITICAL_EMPTY_TEST_RUN'),("import test from 'node:test';test.skip('critical',()=>{});",'CRITICAL_SKIP_OR_FAILURE')]:
    test.write_text(source)
    with self.assertRaises(JobFailure) as caught: execute(['node','--test','--test-reporter=tap',str(test)],p,env,p,[])
    self.assertIn(reason,caught.exception.output)
   test.write_text("import test from 'node:test';test('positive',()=>{});")
   execute(['node','--test','--test-reporter=tap',str(test)],p,env,p,[])
 def test_timeout_status(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); records=[]
   with self.assertRaises(JobFailure) as caught: execute([sys.executable,'-c','import time; time.sleep(10)'],p,environment(p,p),p,records,timeout=.1)
   self.assertEqual(caught.exception.code,124);self.assertTrue(records[-1]['timeout'])
 def test_fingerprint_and_symlink(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); f=p/'input';f.write_text('before');before=fingerprint(p)
   f.write_text('after');self.assertNotEqual(before,fingerprint(p))
   (p/'link').symlink_to(f)
   with self.assertRaisesRegex(ValueError,'SYMLINK_INPUT'):fingerprint(p)
 def test_real_launcher_propagates_tool_failure(self):
  import os, subprocess
  # Disposable tool failure, not a product mutant. Exercises main -> execute -> receipt -> exit.
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); candidate=p/'candidate';candidate.mkdir();bin=p/'bin';bin.mkdir()
   tool=bin/'node';tool.write_text('#!'+sys.executable+'\nimport sys\nif sys.argv[1:] == ["--version"]: print("v26.7.0")\nelse: print("SYN_TOOL_FAILURE_17"); sys.exit(17)\n');tool.chmod(0o700)
   env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH']}
   r=subprocess.run([sys.executable,'-B',str(pathlib.Path(__file__).resolve().parents[1]/'ci/run.py'),'--job','web-quality','--candidate',str(candidate)],env=env,capture_output=True,text=True)
   self.assertEqual(r.returncode,17,r.stderr)
   result=json.loads(r.stdout);receipt=json.loads(pathlib.Path(result['receipt']).read_text())
   self.assertEqual(receipt['commands'][-1]['exit_code'],17)
   self.assertEqual(receipt['status'],'failed_unclassified')
   self.assertEqual(receipt['run_id'],'pending')
   tool.write_text('#!'+sys.executable+'\nimport sys,os,pathlib\nif sys.argv[1:] == ["--version"]: print("v26.7.0")\nelse: pathlib.Path(os.environ["VEXA_CANDIDATE"],"link").symlink_to("/tmp"); sys.exit(17)\n')
   r=subprocess.run([sys.executable,'-B',str(pathlib.Path(__file__).resolve().parents[1]/'ci/run.py'),'--job','web-quality','--candidate',str(candidate)],env=env,capture_output=True,text=True)
   self.assertEqual(r.returncode,1,r.stderr)
   receipt=json.loads(pathlib.Path(json.loads(r.stdout)['receipt']).read_text())
   self.assertEqual(receipt['status'],'integrity_fail')
 def test_event_binding_and_forged_receipt(self):
  import os, subprocess
  launcher=pathlib.Path(__file__).resolve().parents[1]/'ci/run.py'
  with tempfile.TemporaryDirectory() as d:
   candidate=pathlib.Path(d)
   (candidate/'receipt.json').write_text(json.dumps({'status':'pass','exit_code':0,'run_id':'invented'}))
   env={**os.environ,'GITHUB_REF':'refs/heads/main','GITHUB_EVENT_NAME':'push'}
   r=subprocess.run([sys.executable,'-B',str(launcher),'--job','auth-e2e','--candidate',str(candidate),'--event-sha','0'*40],env=env,capture_output=True,text=True)
   self.assertEqual(r.returncode,1)
   receipt=json.loads(pathlib.Path(json.loads(r.stdout)['receipt']).read_text())
   self.assertEqual(receipt['reason'],'EVENT_SHA_MISMATCH')
   self.assertEqual(receipt['run_id'],'pending')
if __name__=='__main__':unittest.main()
